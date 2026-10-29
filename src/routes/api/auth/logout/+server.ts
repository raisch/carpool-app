import { redirect, type RequestHandler } from '@sveltejs/kit';
import { defaultSessionStore, loadSessionConfig } from '#lib/server/session';

export const POST: RequestHandler = async ({ cookies }) => {
	try {
		const config = loadSessionConfig();
		const token = cookies.get(config.cookieName);
		if (token) defaultSessionStore.revoke(token);
		cookies.delete(config.cookieName, { path: '/' });
	} catch {
		// Clearing the known default cookie keeps logout safe even if a bad
		// deployment configuration prevents the normal session config loading.
		cookies.delete('carpool_session', { path: '/' });
	}

	throw redirect(303, '/');
};
