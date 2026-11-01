import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchWithAuth } from '../api';
import { useAuth } from '../AuthContext';
import { shortValue, studentLabel } from '../hash';
import { checkDefinitions } from '../checkData';
import type { CheckDefinition } from '../checkData';
import { translateCheckHelp, useLanguage } from '../i18n';

type CheckStatus = {
	status: 'pending' | 'done';
	checkedAt: string | null;
};

type CheckResult = {
	check: string;
	result: number;
	notes: string | null;
	attachment: string | null;
	attachmentType: string | null;
};

type Run = {
	uuid: string;
	createdAt: string;
	checkedAt: string | null;
	user: { username: string; displayname: string } | null;
	student: { neptunHash: string; initials: string } | null;
	source?: string | null;
	checkResults: CheckResult[];
};

type PageState = { type: 'error' | 'success'; text: string } | null;

function getResultClass(result: number) {
	if (result === 0) return 'bg-gray-100 text-gray-700';
	return result > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
}

function downloadBase64(base64: string, filename: string, contentType: string) {
	const binary = atob(base64);
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	const blob = new Blob([bytes], { type: contentType });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

export default function CheckDetail() {
	const { user, loading } = useAuth();
	const { language, t } = useLanguage();
	const { id } = useParams<{ id: string }>();
	const [status, setStatus] = useState<CheckStatus | null>(null);
	const [run, setRun] = useState<Run | null>(null);
	const [error, setError] = useState<PageState>(null);
	const [pollCountdown, setPollCountdown] = useState(5);
	const [pollGeneration, setPollGeneration] = useState(0);
	const [actionStatus, setActionStatus] = useState<PageState>(null);
	const [acting, setActing] = useState(false);

	const loadCurrentStatus = async () => {
		if (!id) return;
		const response = await fetchWithAuth(`/api/teacher/check/${encodeURIComponent(id)}/status`);
		const data = await response.json();
		if (!response.ok) throw new Error(data?.error || t('checkStatusError'));
		setStatus(data);
		return data as CheckStatus;
	};

	const handleRecheck = async () => {
		if (!id || !window.confirm(t('confirmReRun'))) return;
		setActing(true);
		setActionStatus(null);
		try {
			const response = await fetchWithAuth(`/api/teacher/check/${encodeURIComponent(id)}/recheck`, { method: 'POST' });
			const data = await response.json();
			if (!response.ok) throw new Error(data?.error || t('checkReRunError'));
			setRun(null);
			setActionStatus({ type: 'success', text: t('checkQueued') });
			await loadCurrentStatus();
			setPollGeneration((generation) => generation + 1);
		} catch (actionError) {
			console.error(actionError);
			setActionStatus({ type: 'error', text: actionError instanceof Error ? actionError.message : t('checkReRunError') });
		} finally {
			setActing(false);
		}
	};

	const handleDelete = async () => {
		if (!id || !window.confirm(t('confirmDeleteCheck'))) return;
		setActing(true);
		setActionStatus(null);
		try {
			const response = await fetchWithAuth(`/api/teacher/check/${encodeURIComponent(id)}`, { method: 'DELETE' });
			const data = await response.json();
			if (!response.ok) throw new Error(data?.error || t('checkDeleted'));
			window.location.assign('/check/all');
		} catch (actionError) {
			console.error(actionError);
			setActionStatus({ type: 'error', text: actionError instanceof Error ? actionError.message : t('checkDeleted') });
			setActing(false);
		}
	};

	const handleCopyStudentLink = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href);
			setActionStatus({ type: 'success', text: t('studentLinkCopied') });
		} catch (copyError) {
			console.error(copyError);
			setActionStatus({ type: 'error', text: t('copyStudentLinkError') });
		}
	};

	useEffect(() => {
		if (status?.status !== 'pending') return;

		const countdownTimer = window.setInterval(() => {
			setPollCountdown((current) => (current > 0 ? current - 1 : 0));
		}, 1000);

		return () => window.clearInterval(countdownTimer);
	}, [status?.status]);

	useEffect(() => {
		if (!id || loading) return;

		let cancelled = false;
		let timer: number | undefined;

		const loadStatus = async () => {
			try {
				const statusPath = user ? `/api/teacher/check/${encodeURIComponent(id)}/status` : `/api/student/check/${encodeURIComponent(id)}/status`;
				const response = await fetchWithAuth(statusPath);
				const data = await response.json();
				if (cancelled) return;
				if (!response.ok) {
					setError({ type: 'error', text: data?.error || t('checkStatusError') });
					return;
				}

				setStatus(data);
				if (data.status === 'done') {
					const runResponse = await fetchWithAuth(
						user ? `/api/teacher/check/${encodeURIComponent(id)}` : `/api/student/check/${encodeURIComponent(id)}`
					);
					const runData = await runResponse.json();
					if (cancelled) return;
					if (!runResponse.ok) {
						setError({ type: 'error', text: runData?.error || t('checkResultsError') });
						return;
					}
					setRun(runData);
					return;
				}

				setPollCountdown(5);
				timer = window.setTimeout(loadStatus, 5000);
			} catch (loadError) {
				if (!cancelled) {
					console.error(loadError);
					setError({ type: 'error', text: t('checkNetworkError') });
					setPollCountdown(5);
					timer = window.setTimeout(loadStatus, 5000);
				}
			}
		};

		void loadStatus();
		return () => {
			cancelled = true;
			if (timer !== undefined) window.clearTimeout(timer);
		};
	}, [id, loading, pollGeneration, t, user]);

	if (loading) return <div className="text-center py-12">{t('loading')}</div>;
	if (!id) {
		return <div className="text-red-700">{t('invalidCheckId')}</div>;
	}

	const resultByName = new Map((run?.checkResults ?? []).map((result) => [result.check, result]));
	const orderedResults: CheckDefinition[] = [
		...checkDefinitions,
		...(run?.checkResults ?? [])
			.filter((result) => !checkDefinitions.some((definition) => definition.name === result.check))
			.map((result) => ({ name: result.check, help: t('notDocumented') }))
	];

	return (
		<div className="space-y-8">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold">{t('checkDetails')}</h1>
					<p className="mt-1 font-mono text-sm text-gray-500 break-all">{shortValue(id)}</p>
				</div>
				<Link to="/check" className="text-blue-600 hover:text-blue-800">
					{t('backToChecks')}
				</Link>
			</div>

			{error && <div className="p-3 rounded bg-red-50 text-red-700">{error.text}</div>}
			{actionStatus && (
				<div className={`p-3 rounded ${actionStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
					{actionStatus.text}
				</div>
			)}

			<div className="bg-white p-4 rounded-lg shadow">
				<h2 className="text-lg font-bold mb-3">{t('checkInformation')}</h2>
				<div className={`grid gap-x-4 gap-y-2 text-sm ${user ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
					<div>
						<span className="text-gray-500">{t('uploaded')}:</span>{' '}
						<span className="whitespace-nowrap">{run?.createdAt ? new Date(run.createdAt).toLocaleString(language) : '-'}</span>
					</div>
					<div>
						<span className="text-gray-500">{t('checked')}:</span>{' '}
						<span className="whitespace-nowrap">
							{status?.status === 'pending'
								? t('recheckingIn', { seconds: pollCountdown })
								: status?.checkedAt
									? new Date(status.checkedAt).toLocaleString(language)
									: '-'}
						</span>
					</div>
					<div>
						<span className="text-gray-500">{t('student')}:</span>{' '}
						{run?.student ? (
							user ? (
								<Link to={`/check/search/${encodeURIComponent(run.student.neptunHash)}`} className="text-blue-600 hover:text-blue-800">
									{studentLabel(run.student.initials, run.student.neptunHash)}
								</Link>
							) : (
								studentLabel(run.student.initials, run.student.neptunHash)
							)
						) : (
							t('unassigned')
						)}
					</div>
					{user && (
						<div>
							<span className="text-gray-500">{t('uploadedBy')}:</span> {run?.user?.displayname || run?.user?.username || t('unknown')}
						</div>
					)}
				</div>
				{user && (
					<div className="mt-6 flex flex-wrap gap-3">
						{user?.admin && (
							<>
								<button
									type="button"
									onClick={() => void handleRecheck()}
									disabled={acting}
									className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
								>
									{t('reRunCheck')}
								</button>
								<button
									type="button"
									onClick={() => void handleDelete()}
									disabled={acting}
									className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
								>
									{t('deleteCheck')}
								</button>
							</>
						)}
						<button
							type="button"
							onClick={() => void handleCopyStudentLink()}
							className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
							title={t('copyStudentLink')}
						>
							<span>{t('copyStudentLink')}</span>
						</button>
					</div>
				)}
				{run?.source && (
					<button
						type="button"
						onClick={() => downloadBase64(run.source!, `check-${shortValue(id)}.zip`, 'application/zip')}
						className="mt-4 px-3 py-2 rounded bg-gray-800 text-white hover:bg-gray-900"
					>
						{t('downloadSource')}
					</button>
				)}
			</div>

			{run && (
				<div className="bg-white p-4 rounded-lg shadow">
					<div className="mb-6">
						<h2 className="text-xl font-bold">{t('checks')}</h2>
					</div>
					{orderedResults.length === 0 ? (
						<p className="text-gray-500">{t('noResults')}</p>
					) : (
						<div className="space-y-3">
							{orderedResults.map((definition, index) => {
								const checkResult = resultByName.get(definition.name);
								const result = checkResult?.result ?? 0;
								return (
									<details key={`${definition.name}-${index}`} className="rounded border border-gray-200">
										<summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50">
											<span className="flex items-center gap-2 font-medium">
												<span>{definition.name}</span>
												<span
													className="text-xs text-blue-600"
													title={translateCheckHelp(definition.name, definition.help, language)}
													aria-label={`Help for ${definition.name}`}
												>
													?
												</span>
											</span>
											<span className="flex shrink-0 items-center gap-2">
												<span className={`rounded px-2 py-1 text-xs font-semibold ${getResultClass(result)}`}>
													{result === 0 ? t('skip') : result > 0 ? t('pass') : t('fail')}
												</span>
											</span>
										</summary>
										<div className="border-t border-gray-200 px-4 py-3 text-sm text-gray-700">
											<div className="mb-2 text-gray-500">{translateCheckHelp(definition.name, definition.help, language)}</div>
											<div className="whitespace-pre-wrap break-words font-mono">
												{checkResult?.notes || (checkResult ? '-' : t('skippedNotReturned'))}
											</div>
											{checkResult?.attachment && (
												<button
													type="button"
													onClick={() =>
														downloadBase64(
															checkResult.attachment!,
															`${definition.name}.attachment`,
															checkResult.attachmentType || 'application/octet-stream'
														)
													}
													className="mt-3 px-3 py-1 rounded bg-gray-100 text-gray-800 hover:bg-gray-200"
												>
													{t('downloadAttachment')}
												</button>
											)}
										</div>
									</details>
								);
							})}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
