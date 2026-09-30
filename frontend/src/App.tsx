import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import Layout from './Layout';
import Login from './pages/Login';
import User from './pages/User';
import Check from './pages/Check';
import CheckDetail from './pages/CheckDetail';
import CheckSearch from './pages/CheckSearch';
import MyChecks from './pages/MyChecks';
import CheckAll from './pages/CheckAll';
import Admin from './pages/Admin';

function RequireAuth({ children }: { children: ReactNode }) {
	const { user, loading } = useAuth();

	if (loading) return <div className="text-center py-12">Loading...</div>;
	if (!user) return <div className="text-center py-12 text-gray-500">Please log in to access this page.</div>;

	return children;
}

function App() {
	return (
		<AuthProvider>
			<Router>
				<Routes>
					<Route path="/" element={<Layout />}>
						<Route index element={<Check />} />
						<Route path="login" element={<Login />} />
						<Route
							path="user"
							element={
								<RequireAuth>
									<User />
								</RequireAuth>
							}
						/>
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
	);
}

export default App;
