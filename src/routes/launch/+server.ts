import { redirect, type RequestHandler } from '@sveltejs/kit';
import {
	defaultProvisioningStores,
	loadWordPressProvisioningConfig
} from '#lib/server/wordpress/provisioning';
import { defaultSessionStore, loadSessionConfig } from '#lib/server/session';

const invalidLaunchDestination = '/?launch=invalid';

function safeDestination(value: string | undefined): string {
	const destination = value?.trim() || '/';
	return destination.startsWith('/') && !destination.startsWith('//') ? destination : '/';
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	let provisioning;
	let session;
	try {
		provisioning = loadWordPressProvisioningConfig();
		session = loadSessionConfig();
	} catch {
		throw redirect(303, invalidLaunchDestination);
	}

	if (!provisioning.enabled) throw redirect(303, invalidLaunchDestination);

	const code = url.searchParams.get('code');
	if (!code || code.length > 512) throw redirect(303, invalidLaunchDestination);

	const launch = defaultProvisioningStores.launch.consume(code);
	if (!launch) throw redirect(303, invalidLaunchDestination);

	const token = defaultSessionStore.create({
		id: launch.userId,
		displayName: launch.displayName,
		role: launch.role
	});
	cookies.set(session.cookieName, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: session.secure,
		maxAge: session.absoluteTimeoutSeconds
	});

	throw redirect(303, safeDestination(process.env.WORDPRESS_LAUNCH_DESTINATION));
};
