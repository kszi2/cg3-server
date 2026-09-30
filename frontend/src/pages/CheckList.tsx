import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../api';
import { useAuth } from '../AuthContext';
import { shortValue } from '../hash';

export type RunSummary = {
	uuid: string;
	createdAt: string;
	checkedAt: string | null;
	user: { username: string; displayname: string } | null;
	student: { neptunHash: string } | null;
};

type CheckListProps = { title: string; endpoint: string; emptyText: string };

export default function CheckList({ title, endpoint, emptyText }: CheckListProps) {
	const { user } = useAuth();
	const navigate = useNavigate();
	const [runs, setRuns] = useState<RunSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		let cancelled = false;
		const loadRuns = async () => {
			setLoading(true);
			setError('');
			try {
				const response = await fetchWithAuth(endpoint);
				const data = await response.json();
				if (cancelled) return;
				if (!response.ok) {
					setError(data?.error || 'Could not load checks.');
					return;
				}
				setRuns(data || []);
			} catch (loadError) {
				if (!cancelled) {
					console.error(loadError);
					setError('Network error while loading checks.');
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		void loadRuns();
		return () => {
			cancelled = true;
		};
	}, [endpoint]);

	return (
		<div className="space-y-8">
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-2xl font-bold">{title}</h1>
				<Link to="/check" className="text-blue-600 hover:text-blue-800">
					New upload
				</Link>
			</div>
			<div className="bg-white p-4 rounded-lg shadow">
				{error && <div className="mb-4 p-3 rounded bg-red-50 text-red-700">{error}</div>}
				{loading ? (
					<p className="text-gray-500">Loading checks...</p>
				) : runs.length === 0 ? (
					<p className="text-gray-500">{emptyText}</p>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-gray-200">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Run ID</th>
									{user && <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Uploaded by</th>}
									<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
									<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
									<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Checked</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-200">
								{runs.map((run) => (
									<tr key={run.uuid} onClick={() => navigate(`/check/${run.uuid}`)} className="cursor-pointer hover:bg-gray-50">
										<td className="px-2 py-2 font-mono text-xs">{shortValue(run.uuid)}</td>
										{user && <td className="px-2 py-2">{run.user?.displayname || run.user?.username || 'Unknown'}</td>}
										<td className="px-2 py-2">
											{run.student ? (
												<Link
													to={`/check/search/${encodeURIComponent(run.student.neptunHash)}`}
													onClick={(event) => event.stopPropagation()}
													className="text-blue-600 hover:text-blue-800"
												>
													{shortValue(run.student.neptunHash)}
												</Link>
											) : (
												'Unassigned'
											)}
										</td>
										<td className="px-2 py-2 whitespace-nowrap">{new Date(run.createdAt).toLocaleString()}</td>
										<td className="px-2 py-2 whitespace-nowrap">{run.checkedAt ? new Date(run.checkedAt).toLocaleString() : 'Pending'}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
