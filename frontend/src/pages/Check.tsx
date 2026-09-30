import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Upload as UploadIcon } from 'lucide-react';
import { fetchWithAuth } from '../api';
import { useAuth } from '../AuthContext';
import { isNeptunCode, sha1 } from '../hash';

type Status = { type: 'error' | 'success'; text: string } | null;

const maxSourceSize = 1 << 20;

function readAsBase64(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result !== 'string') {
				reject(new Error('Could not read the selected file.'));
				return;
			}
			resolve(reader.result.split(',')[1] ?? '');
		};
		reader.onerror = () => reject(new Error('Could not read the selected file.'));
		reader.readAsDataURL(file);
	});
}

export default function Check() {
	const { user, loading } = useAuth();
	const navigate = useNavigate();
	const [searchHash, setSearchHash] = useState('');
	const [uploadHash, setUploadHash] = useState('');
	const [file, setFile] = useState<File | null>(null);
	const [uploading, setUploading] = useState(false);
	const [uploadStatus, setUploadStatus] = useState<Status>(null);

	const handleUpload = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!file) {
			setUploadStatus({ type: 'error', text: 'Select a ZIP file first.' });
			return;
		}
		if (file.size > maxSourceSize) {
			setUploadStatus({ type: 'error', text: 'The ZIP file must not exceed 1 MiB.' });
			return;
		}

		setUploading(true);
		setUploadStatus(null);
		try {
			const source = await readAsBase64(file);
			const payload: { source: string; neptunHash?: string } = { source };
			const code = uploadHash.trim();
			if (!user && !code) {
				setUploadStatus({ type: 'error', text: 'A six-character Neptun code is required for student uploads.' });
				return;
			}
			if (code && !isNeptunCode(code)) {
				setUploadStatus({ type: 'error', text: 'The Neptun code must be exactly 6 characters.' });
				return;
			}
			if (code) payload.neptunHash = await sha1(code);
			const response = await fetchWithAuth(user ? '/api/teacher/check' : '/api/student/check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const data = await response.json();
			if (!response.ok) {
				setUploadStatus({ type: 'error', text: data?.error || 'Could not upload the check.' });
				return;
			}
			navigate(`/check/${data.uuid}`);
		} catch (error) {
			console.error(error);
			setUploadStatus({ type: 'error', text: 'Network error while uploading the check.' });
		} finally {
			setUploading(false);
		}
	};

	const handleSearch = (event: React.FormEvent) => {
		event.preventDefault();
		const code = searchHash.trim();
		if (!isNeptunCode(code)) {
			setUploadStatus({ type: 'error', text: 'The Neptun code must be exactly 6 characters.' });
			return;
		}
		void sha1(code).then((hash) => navigate(`/check/search/${encodeURIComponent(hash)}`));
	};

	if (loading) return <div className="text-center py-12">Loading...</div>;

	return (
		<div className="space-y-8">
			<h1 className="text-2xl font-bold">{user ? 'Teacher checks' : 'Student check upload'}</h1>
			<div className="bg-white p-8 rounded-lg shadow">
				<h2 className="text-xl font-bold mb-2">Upload a check</h2>
				<p className="text-gray-600 mb-6">
					{user ? 'Upload a ZIP archive with an optional student assignment.' : 'Upload a ZIP archive for checking. A Neptun hash is required.'}
				</p>
				{uploadStatus && (
					<div className={`mb-4 p-3 rounded ${uploadStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
						{uploadStatus.text}
					</div>
				)}
				<form onSubmit={handleUpload} className="space-y-4">
					<div>
						<label htmlFor="upload-student-hash" className="block text-sm font-medium text-gray-700">
							Neptun code {!user && <span className="font-normal text-red-600">(required)</span>}
							{user && <span className="font-normal text-gray-500">(optional)</span>}
						</label>
						<input
							id="upload-student-hash"
							type="text"
							value={uploadHash}
							onChange={(event) => setUploadHash(event.target.value)}
							className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
							placeholder="ABC123"
							maxLength={6}
						/>
					</div>
					<div>
						<label htmlFor="check-source" className="block text-sm font-medium text-gray-700">
							ZIP archive
						</label>
						<input
							id="check-source"
							type="file"
							accept=".zip,application/zip"
							required
							onChange={(event) => setFile(event.target.files?.[0] || null)}
							className="mt-1 block w-full"
						/>
						<p className="mt-1 text-xs text-gray-500">ZIP files up to 1 MiB.</p>
					</div>
					<button
						type="submit"
						disabled={uploading}
						className="inline-flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
					>
						<UploadIcon className="w-4 h-4" />
						{uploading ? 'Uploading...' : 'Upload for checking'}
					</button>
				</form>
			</div>

			{user && (
				<div className="grid gap-8 lg:grid-cols-2">
					<div className="bg-white p-8 rounded-lg shadow">
						<h2 className="text-xl font-bold mb-2">My uploaded checks</h2>
						<p className="text-gray-600 mb-6">Open the checks you have submitted.</p>
						<Link to="/check/my" className="inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-800 text-white hover:bg-gray-900">
							View my checks
						</Link>
					</div>
					<div className="bg-white p-8 rounded-lg shadow">
						<h2 className="text-xl font-bold mb-2">Search by Neptun code</h2>
						<p className="text-gray-600 mb-6">Find all checks associated with a student.</p>
						<form onSubmit={handleSearch} className="space-y-4">
							<input
								type="text"
								required
								value={searchHash}
								onChange={(event) => setSearchHash(event.target.value)}
								className="block w-full px-3 py-2 border border-gray-300 rounded-md"
								placeholder="ABC123"
								maxLength={6}
								aria-label="Neptun hash"
							/>
							<button type="submit" className="inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-800 text-white hover:bg-gray-900">
								<Search className="w-4 h-4" />
								Search checks
							</button>
						</form>
					</div>
					{user?.admin && (
						<div className="bg-white p-8 rounded-lg shadow">
							<h2 className="text-xl font-bold mb-2">All checks</h2>
							<p className="text-gray-600 mb-6">Review and manage every uploaded check.</p>
							<Link to="/check/all" className="inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-800 text-white hover:bg-gray-900">
								View all checks
							</Link>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
