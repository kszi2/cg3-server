import CheckList from './CheckList';

export default function MyChecks() {
	return <CheckList title="My uploaded checks" endpoint="/api/teacher/check/my" emptyText="You have not uploaded any checks yet." />;
}
