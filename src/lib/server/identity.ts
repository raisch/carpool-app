import type { IdentityState } from '#lib/domain/types';
import type { CurrentUser, Role } from '#lib/domain/types';
import type { Cookies } from '@sveltejs/kit';
import {
	defaultSessionStore,
	loadSessionConfig,
	SessionConfigurationError,
	type SessionConfig,
	type SessionStore
} from './session';

export type { CurrentUser, IdentityState } from '#lib/domain/types';

export interface IdentityProvider {
	getCurrentUser(): Promise<IdentityState>;
}

export class NotConfiguredIdentityProvider implements IdentityProvider {
	async getCurrentUser(): Promise<IdentityState> {
		return identityNotConfigured();
	}
}

export class SessionIdentityProvider implements IdentityProvider {
	constructor(
		private readonly cookies: Pick<Cookies, 'get'>,
		private readonly config: SessionConfig,
		private readonly sessions: SessionStore = defaultSessionStore
	) {}

	async getCurrentUser(): Promise<IdentityState> {
		const token = this.cookies.get(this.config.cookieName);
		const currentUser = token ? this.sessions.get(token) : null;
		return currentUser ? { status: 'configured', currentUser } : identityUnauthenticated();
	}
}

/**
 * Local verification identity only. This is intentionally environment based;
 * it is not an authentication or session implementation.
 */
export class EnvironmentIdentityProvider implements IdentityProvider {
	constructor(private readonly currentUser: CurrentUser) {}

	async getCurrentUser(): Promise<IdentityState> {
		return { status: 'configured', currentUser: this.currentUser };
	}
}

export function identityNotConfigured(): IdentityState {
	return {
		status: 'not-configured',
		code: 'identity_not_configured',
		message: 'Identity integration is not configured yet.'
	};
}

export function identityUnauthenticated(): IdentityState {
	return {
		status: 'unauthenticated',
		code: 'not_authenticated',
		message: 'Please log into the LigerBots web site first and open Resources / Carpools.'
	};
}

export function createIdentityProvider(cookies?: Pick<Cookies, 'get'>): IdentityProvider {
	if (cookies && process.env.WORDPRESS_INTEGRATION_ENABLED === 'true') {
		try {
			return new SessionIdentityProvider(cookies, loadSessionConfig());
		} catch (error) {
			if (!(error instanceof SessionConfigurationError)) throw error;
			return new NotAuthenticatedIdentityProvider();
		}
	}

	const id = process.env.CARPOOL_DEV_USER_ID?.trim();
	const displayName = process.env.CARPOOL_DEV_USER_NAME?.trim() || 'Local team member';
	const role = process.env.CARPOOL_DEV_USER_ROLE?.trim() as Role | undefined;
	if (id && role && ['rider', 'driver', 'admin'].includes(role)) {
		return new EnvironmentIdentityProvider({ id, displayName, role });
	}
	return new NotConfiguredIdentityProvider();
}

class NotAuthenticatedIdentityProvider implements IdentityProvider {
	async getCurrentUser(): Promise<IdentityState> {
		return identityUnauthenticated();
	}
}
