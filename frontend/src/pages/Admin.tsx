import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { useAuth } from '../AuthContext';
import { fetchWithAuth } from '../api';
import type { User as UserType } from '../AuthContext';
import { getHungarianInitials, isNeptunCode, sha1, studentLabel } from '../hash';
import { Link } from 'react-router-dom';

type StudentRecord = { id: number; neptunHash: string; initials: string; notes: string };
type CardStatus = { type: 'error' | 'success'; text: string } | null;

const emptyCreateForm = { username: '', password: '', displayname: '', admin: false };
const studentPageSize = 25;

type CsvStudent = { name: string; neptun: string; notes: string };

function parseStudentCsv(csv: string) {
	const parsed = Papa.parse<Record<string, string>>(csv, {
		header: true,
		skipEmptyLines: 'greedy',
		transformHeader: (header) => header.trim().toLocaleLowerCase('en-US'),
		transform: (value) => value.trim()
	});
	if (parsed.errors.length) {
		throw new Error(`Could not parse CSV: ${parsed.errors[0].message}`);
	}
	if (!parsed.meta.fields?.includes('name') || !parsed.meta.fields.includes('neptun') || !parsed.meta.fields.includes('notes')) {
		throw new Error('CSV must contain name, neptun, and notes headers.');
	}

	return parsed.data.map((values, index): CsvStudent => {
		const name = values.name || '';
		const neptun = values.neptun || '';
		if (!name || !neptun) throw new Error(`CSV row ${index + 2} must contain name and neptun.`);
		return { name, neptun, notes: values.notes || '' };
	});
}

export default function Admin() {
	const { user } = useAuth();
	const [allUsers, setAllUsers] = useState<UserType[]>([]);
	const [students, setStudents] = useState<StudentRecord[]>([]);
	const [userForm, setUserForm] = useState(emptyCreateForm);
	const [studentFile, setStudentFile] = useState<File | null>(null);
	const [studentSearch, setStudentSearch] = useState('');
	const [studentSearchHashes, setStudentSearchHashes] = useState<string[]>([]);
	const [studentPage, setStudentPage] = useState(1);
	const [userEdits, setUserEdits] = useState<Record<number, { displayname: string; password: string }>>({});
	const [studentEdits, setStudentEdits] = useState<Record<number, { initials: string; notes: string }>>({});
	const [createUserStatus, setCreateUserStatus] = useState<CardStatus>(null);
	const [userTableStatus, setUserTableStatus] = useState<CardStatus>(null);
	const [studentStatus, setStudentStatus] = useState<CardStatus>(null);

	const showTemporaryStatus = (setter: React.Dispatch<React.SetStateAction<CardStatus>>, message: CardStatus) => {
		setter(message);
		window.setTimeout(() => setter(null), 4000);
	};

	const loadUsers = async () => {
		try {
			const response = await fetchWithAuth('/api/teacher/user/all');
			if (!response.ok) throw new Error('Failed to load users');
			setAllUsers((await response.json()) || []);
		} catch (error) {
			console.error(error);
			showTemporaryStatus(setUserTableStatus, { type: 'error', text: 'Failed to load user list.' });
		}
	};

	const loadStudents = async () => {
		try {
			const response = await fetchWithAuth('/api/teacher/students/all');
			if (!response.ok) throw new Error('Failed to load students');
			setStudents((await response.json()) || []);
		} catch (error) {
			console.error(error);
			showTemporaryStatus(setStudentStatus, { type: 'error', text: 'Failed to load student list.' });
		}
	};

	useEffect(() => {
		if (user?.admin) {
			void loadUsers();
			void loadStudents();
		}
	}, [user]);

	useEffect(() => {
		setUserEdits((previous) => {
			const next = { ...previous };
			for (const entry of allUsers) {
				const current = next[entry.id] ?? { displayname: entry.displayname, password: '' };
				next[entry.id] = { displayname: current.displayname || entry.displayname, password: current.password };
			}
			return next;
		});
	}, [allUsers]);

	useEffect(() => {
		setStudentEdits((previous) => {
			const next = { ...previous };
			for (const student of students) {
				const current = next[student.id] ?? { initials: student.initials, notes: student.notes };
				next[student.id] = { initials: current.initials, notes: current.notes };
			}
			return next;
		});
	}, [students]);

	useEffect(() => {
		setStudentPage(1);
	}, [studentSearch]);

	useEffect(() => {
		let cancelled = false;
		const searchText = studentSearch.trim();
		if (!searchText) {
			setStudentSearchHashes([]);
			return () => {
				cancelled = true;
			};
		}

		void Promise.all([sha1(searchText), sha1(searchText.toUpperCase())]).then((hashes) => {
			if (!cancelled) setStudentSearchHashes([...new Set(hashes)]);
		});
		return () => {
			cancelled = true;
		};
	}, [studentSearch]);

	if (!user?.admin) return <div className="text-center py-12 text-red-700">Administrator access is required.</div>;

	const normalizedStudentSearch = studentSearch.trim().toLocaleLowerCase();
	const filteredStudents = students.filter((student) => {
		const edit = studentEdits[student.id] ?? { initials: student.initials, notes: student.notes };
		return (
			studentSearchHashes.includes(student.neptunHash) ||
			[student.id.toString(), student.neptunHash, edit.initials, edit.notes].some((value) => value.toLocaleLowerCase().includes(normalizedStudentSearch))
		);
	});
	const studentPageCount = Math.max(1, Math.ceil(filteredStudents.length / studentPageSize));
	const currentStudentPage = Math.min(studentPage, studentPageCount);
	const visibleStudents = filteredStudents.slice((currentStudentPage - 1) * studentPageSize, currentStudentPage * studentPageSize);

	const handleCreateUser = async (event: React.FormEvent) => {
		event.preventDefault();
		try {
			const response = await fetchWithAuth('/api/teacher/user/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(userForm)
			});
			const data = await response.json();
			if (!response.ok) {
				showTemporaryStatus(setCreateUserStatus, { type: 'error', text: data?.error || 'Could not create user.' });
				return;
			}
			showTemporaryStatus(setCreateUserStatus, { type: 'success', text: `Created user ${data.username}.` });
			setUserForm(emptyCreateForm);
			await loadUsers();
		} catch (error) {
			console.error(error);
			showTemporaryStatus(setCreateUserStatus, { type: 'error', text: 'Network error while creating user.' });
		}
	};

	const handleUserUpdate = async (target: UserType, changes: Record<string, string | boolean>) => {
		try {
			const response = await fetchWithAuth(`/api/teacher/user/${target.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(changes)
			});
			const data = await response.json();
			if (!response.ok) {
				showTemporaryStatus(setUserTableStatus, { type: 'error', text: data?.error || 'Could not update user.' });
				return;
			}
			showTemporaryStatus(setUserTableStatus, { type: 'success', text: `Updated ${data.username}.` });
			setUserEdits((previous) => ({ ...previous, [target.id]: { displayname: data.displayname, password: '' } }));
			await loadUsers();
		} catch (error) {
			console.error(error);
			showTemporaryStatus(setUserTableStatus, { type: 'error', text: 'Network error while updating user.' });
		}
	};

	const saveUser = async (target: UserType) => {
		const edit = userEdits[target.id] ?? { displayname: target.displayname, password: '' };
		const changes: Record<string, string> = {};
		if (edit.displayname.trim() && edit.displayname.trim() !== target.displayname) changes.displayname = edit.displayname.trim();
		if (edit.password.trim()) changes.password = edit.password.trim();
		if (Object.keys(changes).length === 0) {
			showTemporaryStatus(setUserTableStatus, { type: 'error', text: 'No user changes to save.' });
			return;
		}
		await handleUserUpdate(target, changes);
	};

	const handleCreateStudent = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!studentFile) {
			showTemporaryStatus(setStudentStatus, { type: 'error', text: 'Select a CSV file first.' });
			return;
		}
		try {
			const rows = parseStudentCsv(await studentFile.text());
			if (!rows.length) throw new Error('The CSV does not contain any student rows.');
			const invalidCode = rows.find((row) => !isNeptunCode(row.neptun));
			if (invalidCode) throw new Error(`Neptun code must be exactly 6 characters: ${invalidCode.neptun}`);
			const payload = await Promise.all(
				rows.map(async (row) => ({
					neptunHash: await sha1(row.neptun),
					initials: getHungarianInitials(row.name),
					notes: row.notes
				}))
			);
			const response = await fetchWithAuth('/api/teacher/students', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const data = await response.json();
			if (!response.ok) {
				showTemporaryStatus(setStudentStatus, { type: 'error', text: data?.error || 'Could not create student.' });
				return;
			}
			showTemporaryStatus(setStudentStatus, { type: 'success', text: `${data.length} student(s) created.` });
			setStudentFile(null);
			const input = document.getElementById('student-csv') as HTMLInputElement | null;
			if (input) input.value = '';
			await loadStudents();
		} catch (error) {
			console.error(error);
			showTemporaryStatus(setStudentStatus, { type: 'error', text: error instanceof Error ? error.message : 'Could not import students.' });
		}
	};

	const handleStudentUpdate = async (student: StudentRecord) => {
		const edit = studentEdits[student.id] ?? { initials: student.initials, notes: student.notes };
		const changes: Record<string, string> = {};
		if (edit.initials !== student.initials) changes.initials = edit.initials;
		if (edit.notes !== student.notes) changes.notes = edit.notes;
		if (!Object.keys(changes).length) {
			showTemporaryStatus(setStudentStatus, { type: 'error', text: 'No student changes to save.' });
			return;
		}
		try {
			const response = await fetchWithAuth(`/api/teacher/students/${student.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(changes)
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data?.error || 'Could not update student.');
			showTemporaryStatus(setStudentStatus, { type: 'success', text: `Updated ${studentLabel(data.initials, data.neptunHash)}.` });
			await loadStudents();
		} catch (error) {
			console.error(error);
			showTemporaryStatus(setStudentStatus, { type: 'error', text: error instanceof Error ? error.message : 'Could not update student.' });
		}
	};

	const handleDeleteStudent = async (id: number) => {
		if (!window.confirm('Are you sure you want to delete this student?')) return;
		try {
			const response = await fetchWithAuth(`/api/teacher/students/${id}`, { method: 'DELETE' });
			const data = await response.json();
			if (!response.ok) {
				showTemporaryStatus(setStudentStatus, { type: 'error', text: data?.error || 'Could not delete student.' });
				return;
			}
			showTemporaryStatus(setStudentStatus, { type: 'success', text: data.status === 'deleted' ? 'Student deleted.' : 'Student removed.' });
			await loadStudents();
		} catch (error) {
			console.error(error);
			showTemporaryStatus(setStudentStatus, { type: 'error', text: 'Network error while deleting student.' });
		}
	};

	return (
		<div className="space-y-8">
			<h1 className="text-2xl font-bold">Admin panel</h1>
			<div className="bg-white p-8 rounded-lg shadow">
				{createUserStatus && (
					<div className={`mb-4 p-3 rounded ${createUserStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
						{createUserStatus.text}
					</div>
				)}
				<h2 className="text-2xl font-bold mb-6">Create user</h2>
				<form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<input
						type="text"
						required
						placeholder="Username"
						value={userForm.username}
						onChange={(event) => setUserForm({ ...userForm, username: event.target.value })}
						className="px-3 py-2 border border-gray-300 rounded-md"
					/>
					<input
						type="text"
						required
						placeholder="Display name"
						value={userForm.displayname}
						onChange={(event) => setUserForm({ ...userForm, displayname: event.target.value })}
						className="px-3 py-2 border border-gray-300 rounded-md"
					/>
					<input
						type="password"
						required
						placeholder="Password"
						value={userForm.password}
						onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
						className="px-3 py-2 border border-gray-300 rounded-md md:col-span-2"
					/>
					<label className="inline-flex items-center gap-2 md:col-span-2">
						<input type="checkbox" checked={userForm.admin} onChange={(event) => setUserForm({ ...userForm, admin: event.target.checked })} />{' '}
						Administrator
					</label>
					<button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 md:col-span-2">
						Create user
					</button>
				</form>
			</div>

			<div className="bg-white p-8 rounded-lg shadow">
				{userTableStatus && (
					<div className={`mb-4 p-3 rounded ${userTableStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
						{userTableStatus.text}
					</div>
				)}
				<h2 className="text-2xl font-bold mb-6">Users</h2>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Display name</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Password</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200">
							{allUsers.map((entry) => {
								const edit = userEdits[entry.id] ?? { displayname: entry.displayname, password: '' };
								return (
									<tr key={entry.id}>
										<td className="px-4 py-3">{entry.username}</td>
										<td className="px-4 py-3">
											<input
												value={edit.displayname}
												onChange={(event) =>
													setUserEdits((previous) => ({ ...previous, [entry.id]: { ...edit, displayname: event.target.value } }))
												}
												className="w-full px-2 py-1 border border-gray-300 rounded-md"
											/>
										</td>
										<td className="px-4 py-3">
											<input
												type="password"
												value={edit.password}
												onChange={(event) =>
													setUserEdits((previous) => ({ ...previous, [entry.id]: { ...edit, password: event.target.value } }))
												}
												placeholder="new password"
												className="w-full px-2 py-1 border border-gray-300 rounded-md"
											/>
										</td>
										<td className="px-4 py-3">
											<input
												type="checkbox"
												checked={entry.admin}
												disabled={entry.id === user.id}
												onChange={(event) => void handleUserUpdate(entry, { admin: event.target.checked })}
											/>
										</td>
										<td className="px-4 py-3">
											<button
												type="button"
												onClick={() => void saveUser(entry)}
												className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
											>
												Save
											</button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			<div className="bg-white p-8 rounded-lg shadow">
				{studentStatus && (
					<div className={`mb-4 p-3 rounded ${studentStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
						{studentStatus.text}
					</div>
				)}
				<h2 className="text-2xl font-bold mb-6">Students</h2>
				<form onSubmit={handleCreateStudent} className="mb-6 flex gap-3 flex-col md:flex-row">
					<input
						id="student-csv"
						type="file"
						accept=".csv,text/csv"
						required
						onChange={(event) => setStudentFile(event.target.files?.[0] || null)}
						className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
					/>
					<button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
						Import CSV
					</button>
				</form>
				<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<input
						type="search"
						value={studentSearch}
						onChange={(event) => setStudentSearch(event.target.value)}
						placeholder="Search students"
						className="w-full sm:max-w-sm px-3 py-2 border border-gray-300 rounded-md"
					/>
					<span className="text-sm text-gray-500">{filteredStudents.length} student(s)</span>
				</div>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Initials</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200">
							{filteredStudents.length === 0 ? (
								<tr>
									<td colSpan={4} className="px-4 py-6 text-gray-500 text-center">
										{students.length === 0 ? 'No students yet.' : 'No students match the search.'}
									</td>
								</tr>
							) : (
								visibleStudents.map((student) => {
									const edit = studentEdits[student.id] ?? { initials: student.initials, notes: student.notes };
									return (
										<tr key={student.id}>
											<td className="px-4 py-3">
												<Link
													to={`/check/search/${encodeURIComponent(student.neptunHash)}`}
													className="text-blue-600 hover:text-blue-800"
												>
													{studentLabel(edit.initials, student.neptunHash)}
												</Link>
											</td>
											<td className="px-4 py-3">
												<input
													value={edit.initials}
													onChange={(event) =>
														setStudentEdits((previous) => ({
															...previous,
															[student.id]: { ...edit, initials: event.target.value }
														}))
													}
													className="mt-1 w-full px-2 py-1 border border-gray-300 rounded-md"
												/>
											</td>
											<td className="px-4 py-3">
												<input
													value={edit.notes}
													onChange={(event) =>
														setStudentEdits((previous) => ({ ...previous, [student.id]: { ...edit, notes: event.target.value } }))
													}
													className="w-full px-2 py-1 border border-gray-300 rounded-md"
												/>
											</td>
											<td className="px-4 py-3">
												<button
													type="button"
													onClick={() => void handleStudentUpdate(student)}
													className="mr-2 px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
												>
													Save
												</button>
												<button
													type="button"
													onClick={() => void handleDeleteStudent(student.id)}
													className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
												>
													Delete
												</button>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
				<div className="mt-4 flex items-center justify-between gap-4 text-sm">
					<button
						type="button"
						disabled={studentPage === 1}
						onClick={() => setStudentPage((page) => Math.max(1, page - 1))}
						className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
					>
						Previous
					</button>
					<span>
						Page {currentStudentPage} of {studentPageCount}
					</span>
					<button
						type="button"
						disabled={currentStudentPage >= studentPageCount}
						onClick={() => setStudentPage((page) => Math.min(studentPageCount, page + 1))}
						className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
					>
						Next
					</button>
				</div>
			</div>
		</div>
	);
}
