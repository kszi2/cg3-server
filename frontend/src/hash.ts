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
