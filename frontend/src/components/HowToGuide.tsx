import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../i18n';

type GuideState = { language: string; status: 'loading' | 'ready' | 'error'; content: string };

export default function HowToGuide() {
	const { language } = useLanguage();
	const [guide, setGuide] = useState<GuideState>({ language: '', status: 'loading', content: '' });

	useEffect(() => {
		const controller = new AbortController();

		void fetch(`/assets/how-to/${language}.md`, { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) throw new Error(`Could not load guide: ${response.status}`);
				return response.text();
			})
			.then((content) => setGuide({ language, status: 'ready', content }))
			.catch((reason: unknown) => {
				if (reason instanceof DOMException && reason.name === 'AbortError') return;
				console.error(reason);
				setGuide({ language, status: 'error', content: '' });
			});

		return () => controller.abort();
	}, [language]);

	if (guide.language !== language || guide.status === 'loading') {
		return <div className="bg-white p-8 rounded-lg shadow animate-pulse h-32" aria-hidden="true" />;
	}
	if (guide.status === 'error') return null;

	return (
		<article className="guide-content max-w-none bg-white p-8 rounded-lg shadow">
			<ReactMarkdown>{guide.content}</ReactMarkdown>
		</article>
	);
}
