import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { LogOut } from 'lucide-react';
import { useLanguage } from './i18n';

export default function Layout() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const { language, setLanguage, t } = useLanguage();

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
								<img src="/golyo-m.png" alt="golyo" className="h-8 w-8" />
								<span className="font-bold text-xl text-gray-900">CG3 Checker</span>
							</Link>
						</div>
						<div className="flex items-center gap-4">
							{user ? (
								<>
									<Link to="/check" className="inline-flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-gray-900">
										<span>{t('checks')}</span>
									</Link>
									{user.admin && (
										<Link to="/admin" className="px-3 py-2 text-gray-700 hover:text-gray-900">
											{t('admin')}
										</Link>
									)}
									<button
										onClick={handleLogout}
										className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
									>
										<LogOut className="w-4 h-4" />
										{t('logout')}
									</button>
								</>
							) : (
								<Link to="/login" className="text-gray-600 hover:text-gray-900 font-medium">
									{t('login')}
								</Link>
							)}
							<label className="flex items-center gap-2 text-sm text-gray-600">
								<span className="sr-only">{t('language')}</span>
								<select
									value={language}
									onChange={(event) => setLanguage(event.target.value as 'hu' | 'en')}
									aria-label={t('language')}
									className="rounded-md border border-gray-300 bg-white px-2 py-1"
								>
									<option value="hu">{t('hungarian')}</option>
									<option value="en">{t('english')}</option>
								</select>
							</label>
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
