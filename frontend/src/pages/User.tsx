import { useAuth } from '../AuthContext';

export default function User() {
	const { user } = useAuth();

	if (!user) {
		return <div className="text-center py-12 text-gray-500">Please log in to view your profile.</div>;
	}

	return (
		<div className="space-y-8">
			<div className="bg-white p-8 rounded-lg shadow">
				<h1 className="text-2xl font-bold mb-2">My profile</h1>
				<p className="text-gray-600 mb-6">Signed in as {user.username}</p>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="rounded border border-gray-200 p-4">
						<div className="text-sm text-gray-500">Username</div>
						<div className="font-medium mt-1">{user.username}</div>
					</div>
					<div className="rounded border border-gray-200 p-4">
						<div className="text-sm text-gray-500">Display name</div>
						<div className="font-medium mt-1">{user.displayname}</div>
					</div>
					<div className="rounded border border-gray-200 p-4">
						<div className="text-sm text-gray-500">Role</div>
						<div className="font-medium mt-1">{user.admin ? 'Administrator' : 'Teacher'}</div>
					</div>
				</div>
			</div>
		</div>
	);
}
