import { createHash, randomBytes } from 'node:crypto';
import type { CurrentUser } from '#lib/domain/types';

const DEFAULT_COOKIE_NAME = 'carpool_session';
const DEFAULT_IDLE_TIMEOUT_SECONDS = 1_800;
const DEFAULT_ABSOLUTE_TIMEOUT_SECONDS = 28_800;

export interface SessionConfig {
	cookieName: string;
	idleTimeoutSeconds: number;
	absoluteTimeoutSeconds: number;
	secure: boolean;
}

export class SessionConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SessionConfigurationError';
	}
}

interface SessionRecord {
	user: CurrentUser;
	createdAtMs: number;
	lastSeenAtMs: number;
	expiresAtMs: number;
}

export interface SessionStore {
	create(user: CurrentUser, nowMs?: number): string;
	get(token: string, nowMs?: number): CurrentUser | null;
	revoke(token: string): void;
	updateUser(user: CurrentUser): void;
	invalidateUser(userId: string): void;
}

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

function positiveInteger(value: string | undefined, fallback: number, max: number): number {
	const parsed = Number(value ?? fallback);
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
		throw new SessionConfigurationError('Session timeout configuration is invalid.');
	}
	return parsed;
}

export function loadSessionConfig(environment: NodeJS.ProcessEnv = process.env): SessionConfig {
	const cookieName = environment.CARPOOL_SESSION_COOKIE?.trim() || DEFAULT_COOKIE_NAME;
	if (!/^[A-Za-z0-9_-]{1,64}$/.test(cookieName)) {
		throw new SessionConfigurationError('Session cookie configuration is invalid.');
	}

	const idleTimeoutSeconds = positiveInteger(
		environment.CARPOOL_SESSION_IDLE_TIMEOUT_SECONDS,
		DEFAULT_IDLE_TIMEOUT_SECONDS,
		86_400
	);
	const absoluteTimeoutSeconds = positiveInteger(
		environment.CARPOOL_SESSION_ABSOLUTE_TIMEOUT_SECONDS,
		DEFAULT_ABSOLUTE_TIMEOUT_SECONDS,
		604_800
	);
	if (idleTimeoutSeconds > absoluteTimeoutSeconds) {
		throw new SessionConfigurationError('Session idle timeout cannot exceed absolute timeout.');
	}

	const configuredSecure = environment.CARPOOL_SESSION_SECURE;
	const secure =
		configuredSecure === undefined
			? environment.NODE_ENV === 'production'
			: configuredSecure === 'true';
	if (
		configuredSecure !== undefined &&
		configuredSecure !== 'true' &&
		configuredSecure !== 'false'
	) {
		throw new SessionConfigurationError('Session secure-cookie configuration is invalid.');
	}
	if (environment.NODE_ENV === 'production' && !secure) {
		throw new SessionConfigurationError('Secure session cookies are required in production.');
	}

	return { cookieName, idleTimeoutSeconds, absoluteTimeoutSeconds, secure };
}

export class MemorySessionStore implements SessionStore {
	private readonly sessions = new Map<string, SessionRecord>();

	constructor(private readonly config: SessionConfig = loadSessionConfig()) {}

	create(user: CurrentUser, nowMs = Date.now()): string {
		this.removeExpired(nowMs);
		const token = randomBytes(32).toString('base64url');
		this.sessions.set(hashToken(token), {
			user,
			createdAtMs: nowMs,
			lastSeenAtMs: nowMs,
			expiresAtMs: nowMs + this.config.absoluteTimeoutSeconds * 1000
		});
		return token;
	}

	get(token: string, nowMs = Date.now()): CurrentUser | null {
		this.removeExpired(nowMs);
		if (token.length === 0 || token.length > 512) return null;
		const key = hashToken(token);
		const session = this.sessions.get(key);
		if (!session) return null;
		if (session.lastSeenAtMs + this.config.idleTimeoutSeconds * 1000 <= nowMs) {
			this.sessions.delete(key);
			return null;
		}
		session.lastSeenAtMs = nowMs;
		return session.user;
	}

	revoke(token: string): void {
		if (token.length > 0) this.sessions.delete(hashToken(token));
	}

	updateUser(user: CurrentUser): void {
		for (const session of this.sessions.values()) {
			if (session.user.id === user.id) session.user = user;
		}
	}

	invalidateUser(userId: string): void {
		for (const [key, session] of this.sessions) {
			if (session.user.id === userId) this.sessions.delete(key);
		}
	}

	private removeExpired(nowMs: number): void {
		for (const [key, session] of this.sessions) {
			if (
				session.expiresAtMs <= nowMs ||
				session.lastSeenAtMs + this.config.idleTimeoutSeconds * 1000 <= nowMs
			) {
				this.sessions.delete(key);
			}
		}
	}
}

export const defaultSessionStore = new MemorySessionStore();
