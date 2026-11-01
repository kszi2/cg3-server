import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from './AuthContext';
import { Menu, X } from 'lucide-react';
import { useLanguage } from './i18n';

export default function Layout() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const { language, setLanguage, t } = useLanguage();
	const [menuOpen, setMenuOpen] = useState(false);

	const handleLogout = () => {
		setMenuOpen(false);
		logout();
		navigate('/login');
	};

	const closeMenu = () => setMenuOpen(false);

	return (
		<div className="min-h-screen bg-gray-100">
			<nav className="bg-white shadow">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between h-16">
						<div className="flex items-center">
							<Link to="/" className="flex-shrink-0 flex items-center gap-2">
								<img src="/assets/golyo-m.png" alt="golyo" className="h-8 w-8" />
								<span className="font-bold text-xl text-gray-900">CG3 Checker</span>
							</Link>
						</div>
						<div className="hidden md:flex items-center gap-4">
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
						<button
							type="button"
							className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
							onClick={() => setMenuOpen((open) => !open)}
							aria-expanded={menuOpen}
							aria-controls="mobile-navigation"
							aria-label={t('menu')}
						>
							{menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
						</button>
					</div>
					{menuOpen && (
						<div id="mobile-navigation" className="md:hidden border-t border-gray-100 py-3">
							<div className="flex flex-col gap-1">
								{user ? (
									<>
										<Link
											to="/check"
											onClick={closeMenu}
											className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
										>
											{t('checks')}
										</Link>
										{user.admin && (
											<Link
												to="/admin"
												onClick={closeMenu}
												className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
											>
												{t('admin')}
											</Link>
										)}
										<button
											type="button"
											onClick={handleLogout}
											className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-left text-gray-700 hover:bg-gray-100 hover:text-gray-900"
										>
											{t('logout')}
										</button>
									</>
								) : (
									<Link to="/login" onClick={closeMenu} className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900">
										{t('login')}
									</Link>
								)}
								<label className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-600">
									<span>{t('language')}</span>
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
					)}
				</div>
			</nav>
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<Outlet />
			</main>
		</div>
	);
}
