import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { Search, Upload as UploadIcon } from 'lucide-react';
import { fetchWithAuth } from '../api';
import { useAuth } from '../AuthContext';
import { isNeptunCode, sha1 } from '../hash';
import { useLanguage } from '../i18n';

type Status = { type: 'error' | 'success'; text: string } | null;
type TurnstileConfig = { enabled: boolean; siteKey: string | null };

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
	const { t } = useLanguage();
	const [searchHash, setSearchHash] = useState('');
	const [uploadHash, setUploadHash] = useState('');
	const [file, setFile] = useState<File | null>(null);
	const [uploading, setUploading] = useState(false);
	const [uploadStatus, setUploadStatus] = useState<Status>(null);
	const [turnstileConfig, setTurnstileConfig] = useState<TurnstileConfig | null>(null);
	const [turnstileToken, setTurnstileToken] = useState('');
	const turnstileRef = useRef<TurnstileInstance>(null);

	useEffect(() => {
		let cancelled = false;
		void fetchWithAuth('/api/turnstile')
			.then(async (response) => {
				const data = await response.json();
				if (!response.ok) throw new Error(data?.error || 'Could not load CAPTCHA configuration.');
				if (!cancelled) setTurnstileConfig(data);
			})
			.catch((error) => {
				console.error(error);
				if (!cancelled) setTurnstileConfig({ enabled: false, siteKey: null });
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const handleUpload = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!file) {
			setUploadStatus({ type: 'error', text: t('selectZip') });
			return;
		}
		if (file.size > maxSourceSize) {
			setUploadStatus({ type: 'error', text: t('zipTooLarge') });
			return;
		}
		if (!user && turnstileConfig?.enabled && !turnstileToken) {
			setUploadStatus({ type: 'error', text: t('captchaRequired') });
			return;
		}

		setUploading(true);
		setUploadStatus(null);
		try {
			const source = await readAsBase64(file);
			const payload: { source: string; neptunHash?: string; token?: string } = { source };
			const code = uploadHash.trim();
			if (!user && !code) {
				setUploadStatus({ type: 'error', text: t('neptunRequiredError') });
				return;
			}
			if (code && !isNeptunCode(code)) {
				setUploadStatus({ type: 'error', text: t('neptunLength') });
				return;
			}
			if (code) payload.neptunHash = await sha1(code);
			if (!user && turnstileToken) payload.token = turnstileToken;
			const response = await fetchWithAuth(user ? '/api/teacher/check' : '/api/student/check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const data = await response.json();
			if (!response.ok) {
				setUploadStatus({ type: 'error', text: data?.error || t('uploadFailed') });
				if (!user) {
					setTurnstileToken('');
					turnstileRef.current?.reset();
				}
				return;
			}
			navigate(`/check/${data.uuid}`);
		} catch (error) {
			console.error(error);
			setUploadStatus({ type: 'error', text: t('uploadNetworkError') });
		} finally {
			setUploading(false);
		}
	};

	const handleSearch = (event: React.FormEvent) => {
		event.preventDefault();
		const code = searchHash.trim();
		if (!isNeptunCode(code)) {
			setUploadStatus({ type: 'error', text: t('neptunLength') });
			return;
		}
		void sha1(code).then((hash) => navigate(`/check/search/${encodeURIComponent(hash)}`));
	};

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = event.target.files?.[0] || null;
		setFile(selectedFile);
		if (!selectedFile) return;

		const match = selectedFile.name.match(/^INFOC_([A-Z][A-Z0-9]{5})_/);
		if (match) setUploadHash(match[1]);
	};

	if (loading) return <div className="text-center py-12">{t('loading')}</div>;

	return (
		<div className="space-y-8">
			<h1 className="text-2xl font-bold">{user ? t('teacherChecks') : t('studentCheckUpload')}</h1>
			<div className="bg-white p-8 rounded-lg shadow">
				<h2 className="text-xl font-bold mb-2">{t('uploadCheck')}</h2>
				<p className="text-gray-600 mb-6">{user ? t('teacherUploadDescription') : t('studentUploadDescription')}</p>
				{uploadStatus && (
					<div className={`mb-4 p-3 rounded ${uploadStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
						{uploadStatus.text}
					</div>
				)}
				<form onSubmit={handleUpload} className="space-y-4">
					<div>
						<label htmlFor="upload-student-hash" className="block text-sm font-medium text-gray-700">
							{t('neptunCode') + ' '}
							{!user && <span className="font-normal text-red-600">({t('neptunRequired')})</span>}
							{user && <span className="font-normal text-gray-500">({t('optional')})</span>}
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
							{t('zipArchive')}
						</label>
						<input id="check-source" type="file" accept=".zip,application/zip" required onChange={handleFileChange} className="mt-1 block w-full" />
						<p className="mt-1 text-xs text-gray-500">{t('zipLimit')}</p>
					</div>
					{!user && turnstileConfig?.enabled && turnstileConfig.siteKey && (
						<Turnstile
							ref={turnstileRef}
							siteKey={turnstileConfig.siteKey}
							onSuccess={setTurnstileToken}
							onExpire={() => setTurnstileToken('')}
							onError={() => {
								setTurnstileToken('');
								setUploadStatus({ type: 'error', text: t('captchaLoad') });
							}}
						/>
					)}
					<button
						type="submit"
						disabled={uploading}
						className="inline-flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
					>
						<UploadIcon className="w-4 h-4" />
						{uploading ? t('uploading') : t('uploadForChecking')}
					</button>
				</form>
			</div>

			{user && (
				<div className="grid gap-8 lg:grid-cols-2">
					<div className="bg-white p-8 rounded-lg shadow">
						<h2 className="text-xl font-bold mb-2">{t('myUploadedChecks')}</h2>
						<p className="text-gray-600 mb-6">{t('openSubmittedChecks')}</p>
						<Link to="/check/my" className="inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-800 text-white hover:bg-gray-900">
							{t('viewMyChecks')}
						</Link>
					</div>
					<div className="bg-white p-8 rounded-lg shadow">
						<h2 className="text-xl font-bold mb-2">{t('searchByNeptun')}</h2>
						<p className="text-gray-600 mb-6">{t('findStudentChecks')}</p>
						<form onSubmit={handleSearch} className="space-y-4">
							<input
								type="text"
								required
								value={searchHash}
								onChange={(event) => setSearchHash(event.target.value)}
								className="block w-full px-3 py-2 border border-gray-300 rounded-md"
								placeholder="ABC123"
								maxLength={6}
								aria-label="Neptun code"
							/>
							<button type="submit" className="inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-800 text-white hover:bg-gray-900">
								<Search className="w-4 h-4" />
								{t('searchChecks')}
							</button>
						</form>
					</div>
					{user?.admin && (
						<div className="bg-white p-8 rounded-lg shadow">
							<h2 className="text-xl font-bold mb-2">{t('allChecks')}</h2>
							<p className="text-gray-600 mb-6">{t('reviewAllChecks')}</p>
							<Link to="/check/all" className="inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-800 text-white hover:bg-gray-900">
								{t('viewAllChecks')}
							</Link>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
