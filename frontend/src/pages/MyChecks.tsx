import CheckList from './CheckList';
import { useLanguage } from '../i18n';

export default function MyChecks() {
	const { t } = useLanguage();
	return <CheckList title={t('myUploadedChecks')} endpoint="/api/teacher/check/my" emptyText={t('noMyChecks')} />;
}
