import { useParams } from 'react-router-dom';
import CheckList from './CheckList';
import { shortValue } from '../hash';
import { useLanguage } from '../i18n';

export default function CheckSearch() {
	const { hash = '' } = useParams<{ hash: string }>();
	const decodedHash = decodeURIComponent(hash);
	const { t } = useLanguage();
	return (
		<CheckList
			title={`${t('checks')} (${shortValue(decodedHash)})`}
			endpoint={`/api/teacher/check/student/${encodeURIComponent(decodedHash)}`}
			emptyText={t('noStudentChecks')}
		/>
	);
}
