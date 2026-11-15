import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode, InvalidTokenError } from 'jwt-decode';
import { clearAuthToken, getAuthToken, setAuthToken, fetchWithAuth } from './api';

export interface User {
	username: string;
	id: number;
	displayname: string;
	registered: string;
	admin: boolean;
}

interface AuthContextType {
	user: User | null;
	loading: boolean;
	login: (token: string, userData: User) => void;
	logout: () => void;
	checkAuth: () => Promise<void>;
}

interface JwtPayload {
	exp?: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const navigate = useNavigate();

	const redirectToLogin = () => {
		clearAuthToken();
		setUser(null);
		setLoading(false);
		navigate('/login', { replace: true });
	};

	const checkAuth = async () => {
		const token = getAuthToken();
		if (!token) {
			setUser(null);
			setLoading(false);
			return;
		}
		try {
			const payload = jwtDecode<JwtPayload>(token);
			if (typeof payload.exp === 'number' && payload.exp <= Math.floor(Date.now() / 1000)) {
				redirectToLogin();
				return;
			}
		} catch (error) {
			if (!(error instanceof InvalidTokenError)) {
				redirectToLogin();
				return;
			}
		}

		try {
			const res = await fetchWithAuth('/api/teacher/user/me');
			if (res.ok) {
				const userData = await res.json();
				setUser(userData);
			} else {
				redirectToLogin();
			}
		} catch (e) {
			console.error(e);
			setUser(null);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		checkAuth();
	}, []);

	const login = (token: string, userData: User) => {
		setAuthToken(token);
		setUser(userData);
	};

	const logout = () => {
		clearAuthToken();
		setUser(null);
	};

	return <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
}
