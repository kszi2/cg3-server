import { useAuth } from '../AuthContext';
import CheckList from './CheckList';

export default function CheckAll() {
	const { user } = useAuth();

	if (!user?.admin) {
		return <div className="text-red-700">Administrator access is required.</div>;
	}

	return <CheckList title="All checks" endpoint="/api/teacher/check/all" emptyText="No checks have been uploaded yet." />;
}
