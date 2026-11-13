import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchWithAuth } from '../api';
import { useLanguage } from '../i18n';

export default function Register() {
	const { token } = useParams<{ token: string }>();
	const [username, setUsername] = useState('');
	const [displayName, setDisplayName] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const navigate = useNavigate();
	const { t } = useLanguage();

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError('');
		setSubmitting(true);

		try {
			const response = await fetchWithAuth('/api/teacher/user/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, displayname: displayName, password, token })
			});
			const data = await response.json();

			if (!response.ok) {
				setError(data?.error || t('registrationFailed'));
				return;
			}

			navigate('/login', { replace: true });
		} catch (err) {
			console.error(err);
			setError(t('networkError'));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow">
			<h2 className="text-2xl font-bold text-center mb-6">{t('registrationTitle')}</h2>
			{error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4">{error}</div>}
			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<label className="block text-sm font-medium text-gray-700">{t('username')}</label>
					<input
						type="text"
						required
						className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
						value={username}
						onChange={(event) => setUsername(event.target.value)}
					/>
				</div>
				<div>
					<label className="block text-sm font-medium text-gray-700">{t('displayName')}</label>
					<input
						type="text"
						required
						className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
						value={displayName}
						onChange={(event) => setDisplayName(event.target.value)}
					/>
				</div>
				<div>
					<label className="block text-sm font-medium text-gray-700">{t('password')}</label>
					<input
						type="password"
						required
						className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
					/>
				</div>
				<button
					type="submit"
					disabled={submitting}
					className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
				>
					{submitting ? t('registering') : t('register')}
				</button>
			</form>
		</div>
	);
}
