import { useParams } from 'react-router-dom';
import CheckList from './CheckList';
import { shortValue } from '../hash';

export default function CheckSearch() {
	const { hash = '' } = useParams<{ hash: string }>();
	const decodedHash = decodeURIComponent(hash);
	return (
		<CheckList
			title={`Checks for ${shortValue(decodedHash)}`}
			endpoint={`/api/teacher/check/student/${encodeURIComponent(decodedHash)}`}
			emptyText="No checks found for this student."
		/>
	);
}
