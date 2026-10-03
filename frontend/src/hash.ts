export async function sha1(value: string) {
	const data = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-1', data);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isNeptunCode(value: string) {
	return value.trim().length === 6;
}

export function shortValue(value: string | null | undefined) {
	return value ? value.slice(0, 6) : value;
}

export function studentLabel(initials: string | null | undefined, neptunHash: string) {
	return `${initials || '-'} (${shortValue(neptunHash)})`;
}

export function getHungarianInitials(name: string) {
	const multigraphs = ['dzs', 'cs', 'dz', 'gy', 'ly', 'ny', 'sz', 'ty', 'zs'];
	const titleCase = (value: string) => {
		const lowercase = value.toLocaleLowerCase('hu-HU');
		return lowercase.slice(0, 1).toLocaleUpperCase('hu-HU') + lowercase.slice(1);
	};

	return name
		.trim()
		.split(/[\s-]+/)
		.filter(Boolean)
		.map((part) => {
			const lowerPart = part.toLocaleLowerCase('hu-HU');
			const multigraph = multigraphs.find((value) => lowerPart.startsWith(value));
			return titleCase(multigraph ? lowerPart.slice(0, multigraph.length) : lowerPart.slice(0, 1));
		})
		.join('');
}
