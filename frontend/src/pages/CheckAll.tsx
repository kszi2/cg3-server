import { useAuth } from '../AuthContext';
import CheckList from './CheckList';
import { useLanguage } from '../i18n';

export default function CheckAll() {
	const { user } = useAuth();
	const { t } = useLanguage();

	if (!user?.admin) {
		return <div className="text-red-700">{t('adminAccess')}</div>;
	}

	return <CheckList title={t('allChecks')} endpoint="/api/teacher/check/all" emptyText={t('noChecks')} />;
}
