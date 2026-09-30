import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ClipboardCheck, LogOut, User as UserIcon, ShieldCheck } from 'lucide-react';

export default function Layout() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();

	const handleLogout = () => {
		logout();
		navigate('/login');
	};

	return (
		<div className="min-h-screen bg-gray-100">
			<nav className="bg-white shadow">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between h-16">
						<div className="flex items-center">
							<Link to="/" className="flex-shrink-0 flex items-center gap-2">
								<ShieldCheck className="w-8 h-8 text-blue-600" />
								<span className="font-bold text-xl text-gray-900">CG3 Checker</span>
							</Link>
						</div>
						<div className="flex items-center gap-4">
							{user ? (
								<>
									<Link to="/user" className="inline-flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-gray-900">
										<UserIcon className="w-5 h-5" />
										<span>{user.displayname}</span>
									</Link>
									<Link to="/check" className="inline-flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-gray-900">
										<ClipboardCheck className="w-5 h-5" />
										<span>Checks</span>
									</Link>
									{user.admin && (
										<Link to="/admin" className="px-3 py-2 text-gray-700 hover:text-gray-900">
											Admin
										</Link>
									)}
									<button
										onClick={handleLogout}
										className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
									>
										<LogOut className="w-4 h-4" />
										Logout
									</button>
								</>
							) : (
								<Link to="/login" className="text-gray-600 hover:text-gray-900 font-medium">
									Login
								</Link>
							)}
						</div>
					</div>
				</div>
			</nav>
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<Outlet />
			</main>
		</div>
	);
}
