import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { fetchWithAuth } from '../api';

export default function Login() {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const { login } = useAuth();
	const navigate = useNavigate();

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
				setError(data?.error || 'Login failed');
				return;
			}

			login(data.token, {
				username: data.username,
				id: data.id,
				displayname: data.displayname,
				registered: data.registered,
				admin: data.admin
			});

			navigate('/user');
		} catch (err) {
			console.error(err);
			setError('Network error');
		}
	};

	return (
		<div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow">
			<h2 className="text-2xl font-bold text-center mb-6">Login</h2>
			{error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4">{error}</div>}
			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<label className="block text-sm font-medium text-gray-700">Username</label>
					<input
						type="text"
						required
						className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
					/>
				</div>
				<div>
					<label className="block text-sm font-medium text-gray-700">Password</label>
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
					Sign In
				</button>
			</form>
		</div>
	);
}
