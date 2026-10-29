import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { createIdentityProvider } from '#lib/server/identity';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.identity = await createIdentityProvider(event.cookies).getCurrentUser();
	return resolve(event);
};

export const handleError: HandleServerError = ({ event, error }) => {
	console.error('Unhandled carpool server error', {
		method: event.request.method,
		path: event.url.pathname,
		name: error instanceof Error ? error.name : 'UnknownError'
	});
	return { message: 'An unexpected server error occurred. Please try again.' };
};
