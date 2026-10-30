import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import Layout from './Layout';
import Login from './pages/Login';
import Check from './pages/Check';
import CheckDetail from './pages/CheckDetail';
import CheckSearch from './pages/CheckSearch';
import MyChecks from './pages/MyChecks';
import CheckAll from './pages/CheckAll';
import Admin from './pages/Admin';
import { LanguageProvider, useLanguage } from './i18n';

function RequireAuth({ children }: { children: ReactNode }) {
	const { user, loading } = useAuth();
	const { t } = useLanguage();

	if (loading) return <div className="text-center py-12">{t('loading')}</div>;
	if (!user) return <div className="text-center py-12 text-gray-500">{t('loginRequired')}</div>;

	return children;
}

function App() {
	return (
		<LanguageProvider>
			<AuthProvider>
				<Router>
					<Routes>
					<Route path="/" element={<Layout />}>
						<Route index element={<Check />} />
						<Route path="login" element={<Login />} />
						<Route
							path="admin"
							element={
								<RequireAuth>
									<Admin />
								</RequireAuth>
							}
						/>
						<Route path="check" element={<Check />} />
						<Route
							path="check/search/:hash"
							element={
								<RequireAuth>
									<CheckSearch />
								</RequireAuth>
							}
						/>
						<Route
							path="check/my"
							element={
								<RequireAuth>
									<MyChecks />
								</RequireAuth>
							}
						/>
						<Route
							path="check/all"
							element={
								<RequireAuth>
									<CheckAll />
								</RequireAuth>
							}
						/>
						<Route path="check/:id" element={<CheckDetail />} />
					</Route>
					</Routes>
				</Router>
			</AuthProvider>
		</LanguageProvider>
	);
}

export default App;
