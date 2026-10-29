import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSessionStore } from '#lib/server/session';
import { defaultProvisioningStores } from '#lib/server/wordpress/provisioning';
import { GET } from './+server';

class CookieJar {
	private readonly values = new Map<string, string>();

	get(name: string): string | undefined {
		return this.values.get(name);
	}

	set(name: string, value: string): void {
		this.values.set(name, value);
	}

	delete(name: string): void {
		this.values.delete(name);
	}

	token(): string | undefined {
		return this.values.get('carpool_session');
	}
}

function event(url: string, cookies: CookieJar): Parameters<typeof GET>[0] {
	return { url: new URL(url), cookies } as unknown as Parameters<typeof GET>[0];
}

async function redirectResult(
	promise: Promise<Response>
): Promise<{ status: number; location: string }> {
	try {
		await promise;
		throw new Error('Expected SvelteKit redirect');
	} catch (error) {
		if (
			typeof error !== 'object' ||
			error === null ||
			!('status' in error) ||
			!('location' in error)
		) {
			throw error;
		}
		return error as { status: number; location: string };
	}
}

describe('GET /launch', () => {
	afterEach(() => vi.unstubAllEnvs());

	it('exchanges a launch code for a session cookie exactly once', async () => {
		vi.stubEnv('WORDPRESS_INTEGRATION_ENABLED', 'true');
		vi.stubEnv('WORDPRESS_PUBLIC_KEY', 'development-public-key');
		vi.stubEnv('WORDPRESS_PROVISIONING_STORE', 'memory');
		const code = defaultProvisioningStores.launch.issue(
			'wp-user-1',
			'user-1',
			'admin',
			'Demo Admin',
			60
		);
		const cookies = new CookieJar();

		await expect(
			redirectResult(Promise.resolve(GET(event(`http://localhost/launch?code=${code}`, cookies))))
		).resolves.toEqual({ status: 303, location: '/' });
		expect(cookies.token()).toMatch(/^[A-Za-z0-9_-]{40,}$/);
		expect(defaultSessionStore.get(cookies.token() ?? '')).toEqual({
			id: 'user-1',
			displayName: 'Demo Admin',
			role: 'admin'
		});

		const replay = new CookieJar();
		await expect(
			redirectResult(Promise.resolve(GET(event(`http://localhost/launch?code=${code}`, replay))))
		).resolves.toEqual({ status: 303, location: '/?launch=invalid' });
	});

	it('uses the same safe redirect for a missing code', async () => {
		vi.stubEnv('WORDPRESS_INTEGRATION_ENABLED', 'true');
		vi.stubEnv('WORDPRESS_PUBLIC_KEY', 'development-public-key');

		await expect(
			redirectResult(Promise.resolve(GET(event('http://localhost/launch', new CookieJar()))))
		).resolves.toEqual({ status: 303, location: '/?launch=invalid' });
	});
});
