import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { fetchWithAuth } from '../api';
import { useLanguage } from '../i18n';

export default function Login() {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const { login } = useAuth();
	const navigate = useNavigate();
	const { t } = useLanguage();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');

		try {
			const res = await fetchWithAuth('/api/teacher/user/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			});

			const data = await res.json();
			if (!res.ok) {
				setError(data?.error || t('loginFailed'));
				return;
			}

			login(data.token, {
				username: data.username,
				id: data.id,
				displayname: data.displayname,
				registered: data.registered,
				admin: data.admin
			});

			navigate('/');
		} catch (err) {
			console.error(err);
			setError(t('networkError'));
		}
	};

	return (
		<div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow">
			<h2 className="text-2xl font-bold text-center mb-6">{t('loginTitle')}</h2>
			<div className="bg-yellow-50 text-yellow-600 p-3 rounded mb-4">{t('loginWarning')}</div>
			{error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4">{error}</div>}
			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<label className="block text-sm font-medium text-gray-700">{t('username')}</label>
					<input
						type="text"
						required
						className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
					/>
				</div>
				<div>
					<label className="block text-sm font-medium text-gray-700">{t('password')}</label>
					<input
						type="password"
						required
						className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
					/>
				</div>
				<button
					type="submit"
					className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
				>
					{t('signIn')}
				</button>
			</form>
		</div>
	);
}
