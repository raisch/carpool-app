import { createHash, createVerify, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Role } from '#lib/domain/types';
import type { ProvisionedWordPressUser } from '../directus/client';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_ISSUER = 'https://www.ligerbots.org';
const DEFAULT_AUDIENCE = 'carpool-provisioning';
const DEFAULT_KEY_ID = 'wordpress-development';
const DEFAULT_TTL_SECONDS = 60;
const DEFAULT_CLOCK_SKEW_SECONDS = 5;
const DEFAULT_MAX_REQUEST_BYTES = 16_384;
const MAX_TOKEN_LENGTH = 16_384;

export interface WordPressProvisioningConfig {
	enabled: boolean;
	issuer: string;
	audience: string;
	keyId: string;
	publicKey: string;
	publicKeys?: Readonly<Record<string, string>>;
	clockSkewSeconds: number;
	launchTtlSeconds: number;
	maxRequestBytes: number;
	store: 'memory' | 'external';
}

export interface ProvisionedCarpoolUser {
	id: string;
	role: Role;
	status: 'active' | 'inactive';
}

export interface WordPressIdentityRepository {
	upsertWordPressUser(input: ProvisionedWordPressUser): Promise<ProvisionedCarpoolUser>;
}

export interface ProvisioningResponse {
	launch_code: string;
	expires_in: number;
}

export interface LaunchCredential {
	sourceUid: string;
	userId: string;
	role: Role;
	displayName: string;
}

export class WordPressProvisioningError extends Error {
	readonly status: number;
	readonly code: string;
	readonly safeMessage: string;

	constructor(status: number, code: string, safeMessage: string) {
		super(safeMessage);
		this.name = 'WordPressProvisioningError';
		this.status = status;
		this.code = code;
		this.safeMessage = safeMessage;
	}
}

export class ProvisioningConfigurationError extends WordPressProvisioningError {
	constructor(message: string) {
		super(503, 'integration_unavailable', message);
		this.name = 'ProvisioningConfigurationError';
	}
}

class InvalidProvisioningRequestError extends WordPressProvisioningError {
	constructor() {
		super(400, 'invalid_request', 'The WordPress provisioning request was invalid.');
		this.name = 'InvalidProvisioningRequestError';
	}
}

class InvalidProvisioningTokenError extends WordPressProvisioningError {
	constructor() {
		super(401, 'unauthorized', 'The WordPress provisioning request was not authorized.');
		this.name = 'InvalidProvisioningTokenError';
	}
}

class InactiveCarpoolUserError extends WordPressProvisioningError {
	constructor() {
		super(403, 'carpool_user_inactive', 'This Carpool account is inactive.');
		this.name = 'InactiveCarpoolUserError';
	}
}

export class ProvisioningRateLimitError extends WordPressProvisioningError {
	readonly retryAfterSeconds: number;

	constructor(retryAfterSeconds: number) {
		super(429, 'rate_limited', 'Too many WordPress provisioning requests. Please try again later.');
		this.name = 'ProvisioningRateLimitError';
		this.retryAfterSeconds = retryAfterSeconds;
	}
}

class ProvisioningBackendError extends WordPressProvisioningError {
	constructor() {
		super(
			502,
			'integration_backend_error',
			'The WordPress integration is temporarily unavailable.'
		);
		this.name = 'ProvisioningBackendError';
	}
}

interface VerifiedProfile {
	sourceUid: string;
	firstName: string;
	lastName: string;
	email: string;
	telephone: string | null;
}

interface JwtClaims {
	iss: unknown;
	sub: unknown;
	aud: unknown;
	iat: unknown;
	nbf: unknown;
	exp: unknown;
	jti: unknown;
	user: unknown;
}

function requiredString(value: unknown, maxLength: number): string | null {
	if (typeof value !== 'string') return null;
	const normalized = value.trim();
	return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function decodeBase64Url(value: string): Buffer {
	if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new InvalidProvisioningTokenError();
	return Buffer.from(value, 'base64url');
}

function decodeJson<T>(value: string): T {
	try {
		return JSON.parse(decodeBase64Url(value).toString('utf8')) as T;
	} catch {
		throw new InvalidProvisioningTokenError();
	}
}

function audienceMatches(value: unknown, expected: string): boolean {
	return typeof value === 'string'
		? value === expected
		: Array.isArray(value) && value.length > 0 && value.includes(expected);
}

function numericClaim(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseProfile(claims: JwtClaims): VerifiedProfile {
	const sourceUid = requiredString(claims.sub, 128);
	if (!sourceUid || typeof claims.user !== 'object' || claims.user === null) {
		throw new InvalidProvisioningTokenError();
	}

	const user = claims.user as Record<string, unknown>;
	const firstName = requiredString(user.first_name, 100);
	const lastName = requiredString(user.last_name, 100);
	const email = requiredString(user.email, 320);
	const telephone = user.telephone === undefined ? null : requiredString(user.telephone, 40);
	if (!firstName || !lastName || !email || !EMAIL_PATTERN.test(email)) {
		throw new InvalidProvisioningTokenError();
	}
	if (user.telephone !== undefined && user.telephone !== null && telephone === null) {
		throw new InvalidProvisioningTokenError();
	}

	return { sourceUid, firstName, lastName, email, telephone };
}

export function loadWordPressProvisioningConfig(
	environment: NodeJS.ProcessEnv = process.env
): WordPressProvisioningConfig {
	const enabled = environment.WORDPRESS_INTEGRATION_ENABLED === 'true';
	const issuer = environment.WORDPRESS_ISSUER?.trim() || DEFAULT_ISSUER;
	const audience = environment.WORDPRESS_AUDIENCE?.trim() || DEFAULT_AUDIENCE;
	const keyId = environment.WORDPRESS_KEY_ID?.trim() || DEFAULT_KEY_ID;
	const clockSkewSeconds = Number(
		environment.WORDPRESS_CLOCK_SKEW_SECONDS ?? DEFAULT_CLOCK_SKEW_SECONDS
	);
	const launchTtlSeconds = Number(environment.WORDPRESS_LAUNCH_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
	const maxRequestBytes = Number(
		environment.WORDPRESS_MAX_REQUEST_BYTES ?? DEFAULT_MAX_REQUEST_BYTES
	);
	const store = environment.WORDPRESS_PROVISIONING_STORE === 'external' ? 'external' : 'memory';
	let publicKey = environment.WORDPRESS_PUBLIC_KEY?.trim() ?? '';
	let publicKeys: Record<string, string> | undefined;
	if (environment.WORDPRESS_PUBLIC_KEYS?.trim()) {
		try {
			const parsed: unknown = JSON.parse(environment.WORDPRESS_PUBLIC_KEYS);
			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error();
			publicKeys = {};
			for (const [id, value] of Object.entries(parsed)) {
				if (!/^[A-Za-z0-9._-]{1,128}$/.test(id) || typeof value !== 'string' || !value.trim()) {
					throw new Error();
				}
				publicKeys[id] = value;
			}
			if (Object.keys(publicKeys).length === 0) throw new Error();
		} catch {
			throw new ProvisioningConfigurationError('WordPress public key configuration is invalid.');
		}
	}

	if (!publicKey && environment.WORDPRESS_PUBLIC_KEY_PATH?.trim()) {
		try {
			publicKey = readFileSync(environment.WORDPRESS_PUBLIC_KEY_PATH.trim(), 'utf8');
		} catch {
			throw new ProvisioningConfigurationError(
				'WordPress public key configuration is unavailable.'
			);
		}
	}

	if (!Number.isInteger(clockSkewSeconds) || clockSkewSeconds < 0 || clockSkewSeconds > 300) {
		throw new ProvisioningConfigurationError('WordPress clock-skew configuration is invalid.');
	}
	if (!Number.isInteger(launchTtlSeconds) || launchTtlSeconds < 1 || launchTtlSeconds > 300) {
		throw new ProvisioningConfigurationError('WordPress launch lifetime configuration is invalid.');
	}
	if (!Number.isInteger(maxRequestBytes) || maxRequestBytes < 1024 || maxRequestBytes > 1_048_576) {
		throw new ProvisioningConfigurationError('WordPress request-size configuration is invalid.');
	}
	if (enabled && !publicKey && !publicKeys) {
		throw new ProvisioningConfigurationError('WordPress public key configuration is required.');
	}
	if (enabled && store === 'external') {
		throw new ProvisioningConfigurationError(
			'An external WordPress provisioning store adapter is not configured.'
		);
	}
	if (enabled && environment.NODE_ENV === 'production' && store !== 'external') {
		throw new ProvisioningConfigurationError(
			'A durable WordPress provisioning store is required in production.'
		);
	}

	return {
		enabled,
		issuer,
		audience,
		keyId,
		publicKey,
		clockSkewSeconds,
		launchTtlSeconds,
		maxRequestBytes,
		store,
		...(publicKeys ? { publicKeys } : {})
	};
}

export function verifyProvisioningToken(
	token: string,
	config: Pick<
		WordPressProvisioningConfig,
		'issuer' | 'audience' | 'keyId' | 'publicKey' | 'clockSkewSeconds' | 'publicKeys'
	>,
	nowMs = Date.now()
): VerifiedProfile {
	if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
		throw new InvalidProvisioningTokenError();
	}
	const parts = token.split('.');
	if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
		throw new InvalidProvisioningTokenError();
	}

	const header = decodeJson<{ alg?: unknown; kid?: unknown }>(parts[0]);
	const claims = decodeJson<JwtClaims>(parts[1]);
	if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
		throw new InvalidProvisioningTokenError();
	}
	const publicKey =
		config.publicKeys?.[header.kid] ?? (header.kid === config.keyId ? config.publicKey : '');
	if (!publicKey) throw new InvalidProvisioningTokenError();

	let signatureValid: boolean;
	try {
		const verifier = createVerify('RSA-SHA256');
		verifier.update(`${parts[0]}.${parts[1]}`);
		verifier.end();
		signatureValid = verifier.verify(publicKey, decodeBase64Url(parts[2]));
	} catch {
		throw new InvalidProvisioningTokenError();
	}
	if (!signatureValid) throw new InvalidProvisioningTokenError();

	if (claims.iss !== config.issuer || !audienceMatches(claims.aud, config.audience)) {
		throw new InvalidProvisioningTokenError();
	}
	const issuedAt = numericClaim(claims.iat);
	const notBefore = numericClaim(claims.nbf);
	const expiresAt = numericClaim(claims.exp);
	const jti = requiredString(claims.jti, 128);
	const nowSeconds = nowMs / 1000;
	if (
		issuedAt === null ||
		notBefore === null ||
		expiresAt === null ||
		!jti ||
		expiresAt <= nowSeconds - config.clockSkewSeconds ||
		notBefore > nowSeconds + config.clockSkewSeconds ||
		issuedAt > nowSeconds + config.clockSkewSeconds ||
		expiresAt < issuedAt
	) {
		throw new InvalidProvisioningTokenError();
	}

	return parseProfile(claims);
}

export class MemoryReplayStore {
	private readonly entries = new Map<string, number>();

	reserve(jti: string, expiresAtMs: number, nowMs = Date.now()): boolean {
		this.removeExpired(nowMs);
		if (this.entries.has(jti)) return false;
		this.entries.set(jti, expiresAtMs);
		return true;
	}

	release(jti: string): void {
		this.entries.delete(jti);
	}

	private removeExpired(nowMs: number): void {
		for (const [jti, expiresAtMs] of this.entries) {
			if (expiresAtMs <= nowMs) this.entries.delete(jti);
		}
	}
}

export class MemoryLaunchCredentialStore {
	private readonly entries = new Map<
		string,
		LaunchCredential & { expiresAtMs: number; consumed: boolean }
	>();

	issue(
		sourceUid: string,
		userId: string,
		role: Role,
		displayName: string,
		ttlSeconds: number,
		nowMs = Date.now()
	): string {
		this.removeExpired(nowMs);
		const code = randomBytes(32).toString('base64url');
		this.entries.set(hashCredential(code), {
			sourceUid,
			userId,
			role,
			displayName,
			expiresAtMs: nowMs + ttlSeconds * 1000,
			consumed: false
		});
		return code;
	}

	consume(code: string, nowMs = Date.now()): LaunchCredential | null {
		this.removeExpired(nowMs);
		const key = hashCredential(code);
		const entry = this.entries.get(key);
		if (!entry || entry.consumed) return null;
		entry.consumed = true;
		return {
			sourceUid: entry.sourceUid,
			userId: entry.userId,
			role: entry.role,
			displayName: entry.displayName
		};
	}

	private removeExpired(nowMs: number): void {
		for (const [key, entry] of this.entries) {
			if (entry.expiresAtMs <= nowMs) this.entries.delete(key);
		}
	}
}

export class MemoryRateLimiter {
	private readonly entries = new Map<string, { count: number; resetAtMs: number }>();

	constructor(
		private readonly limit = 30,
		private readonly windowMs = 60_000
	) {}

	allow(key: string, nowMs = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
		const current = this.entries.get(key);
		if (!current || current.resetAtMs <= nowMs) {
			this.entries.set(key, { count: 1, resetAtMs: nowMs + this.windowMs });
			return { allowed: true, retryAfterSeconds: 0 };
		}
		if (current.count >= this.limit) {
			return {
				allowed: false,
				retryAfterSeconds: Math.max(1, Math.ceil((current.resetAtMs - nowMs) / 1000))
			};
		}
		current.count += 1;
		return { allowed: true, retryAfterSeconds: 0 };
	}
}

function hashCredential(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function bodyIsValid(body: unknown): boolean {
	if (body === undefined || body === null) return true;
	if (typeof body !== 'object' || Array.isArray(body)) return false;
	const input = body as Record<string, unknown>;
	return (
		Object.keys(input).every((key) => key === 'source_system') &&
		(input.source_system === undefined || input.source_system === 'wordpress')
	);
}

export class WordPressProvisioningService {
	constructor(
		private readonly repository: WordPressIdentityRepository,
		private readonly config: WordPressProvisioningConfig,
		private readonly replayStore: MemoryReplayStore,
		private readonly launchStore: MemoryLaunchCredentialStore,
		private readonly rateLimiter: MemoryRateLimiter
	) {}

	async provision(
		token: string,
		body: unknown,
		rateKey: string,
		nowMs = Date.now()
	): Promise<ProvisioningResponse> {
		const rate = this.rateLimiter.allow(rateKey, nowMs);
		if (!rate.allowed) throw new ProvisioningRateLimitError(rate.retryAfterSeconds);
		if (!bodyIsValid(body)) throw new InvalidProvisioningRequestError();

		const profile = verifyProvisioningToken(token, this.config, nowMs);
		const exp = numericClaim(decodeJson<JwtClaims>(token.split('.')[1]).exp);
		const jti = requiredString(decodeJson<JwtClaims>(token.split('.')[1]).jti, 128);
		if (exp === null || !jti) throw new InvalidProvisioningTokenError();
		if (!this.replayStore.reserve(jti, exp * 1000, nowMs)) {
			throw new InvalidProvisioningTokenError();
		}

		try {
			const user = await this.repository.upsertWordPressUser({
				sourceSystem: 'wordpress',
				sourceUid: profile.sourceUid,
				firstName: profile.firstName,
				lastName: profile.lastName,
				email: profile.email,
				telephone: profile.telephone
			});
			if (user.status !== 'active') throw new InactiveCarpoolUserError();
			const launchCode = this.launchStore.issue(
				profile.sourceUid,
				user.id,
				user.role,
				`${profile.firstName} ${profile.lastName}`,
				this.config.launchTtlSeconds,
				nowMs
			);
			return { launch_code: launchCode, expires_in: this.config.launchTtlSeconds };
		} catch (error) {
			this.replayStore.release(jti);
			if (error instanceof WordPressProvisioningError) throw error;
			throw new ProvisioningBackendError();
		}
	}
}

export function getBearerToken(value: string | null): string | null {
	if (!value?.startsWith('Bearer ')) return null;
	const token = value.slice('Bearer '.length).trim();
	return token.length > 0 ? token : null;
}

export function correlationId(value: string | null): string {
	return value && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : randomUUID();
}

export function requestBodyLimitExceeded(request: Request, maxBytes: number): boolean {
	const contentLength = request.headers.get('content-length');
	return contentLength !== null && Number(contentLength) > maxBytes;
}

export async function readProvisioningBody(request: Request, maxBytes: number): Promise<unknown> {
	const text = await request.text();
	if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new InvalidProvisioningRequestError();
	if (text.trim() === '') return {};
	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new InvalidProvisioningRequestError();
	}
}

export const defaultProvisioningStores = {
	replay: new MemoryReplayStore(),
	launch: new MemoryLaunchCredentialStore(),
	rateLimiter: new MemoryRateLimiter()
};
