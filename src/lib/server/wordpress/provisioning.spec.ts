import { createSign, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
	MemoryLaunchCredentialStore,
	MemoryRateLimiter,
	MemoryReplayStore,
	WordPressProvisioningService,
	WordPressProvisioningError,
	readProvisioningBody,
	verifyProvisioningToken,
	type WordPressProvisioningConfig
} from './provisioning';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const config: WordPressProvisioningConfig = {
	enabled: true,
	issuer: 'https://www.ligerbots.org',
	audience: 'carpool-provisioning',
	keyId: 'wordpress-test',
	publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
	clockSkewSeconds: 5,
	launchTtlSeconds: 60,
	maxRequestBytes: 16_384,
	store: 'memory'
};
const nowMs = 1_800_000_000_000;

function encode(value: unknown): string {
	return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function token(
	overrides: Partial<{
		iss: string;
		aud: string;
		exp: number;
		nbf: number;
		jti: string;
		email: string;
		alg: string;
		kid: string;
	}>
): string {
	const header = encode({
		alg: overrides.alg ?? 'RS256',
		typ: 'JWT',
		kid: overrides.kid ?? config.keyId
	});
	const payload = encode({
		iss: overrides.iss ?? config.issuer,
		sub: 'wp-user-123',
		aud: overrides.aud ?? config.audience,
		iat: nowMs / 1000,
		nbf: overrides.nbf ?? nowMs / 1000,
		exp: overrides.exp ?? nowMs / 1000 + 60,
		jti: overrides.jti ?? 'jti-123',
		user: {
			first_name: 'First',
			last_name: 'Last',
			email: overrides.email ?? 'first.last@example.test',
			telephone: '+15551234567'
		}
	});
	const signer = createSign('RSA-SHA256');
	signer.update(`${header}.${payload}`);
	signer.end();
	return `${header}.${payload}.${signer.sign(privateKey).toString('base64url')}`;
}

function service(limit = 30) {
	const calls: unknown[] = [];
	const repository = {
		upsertWordPressUser: async (input: unknown) => {
			calls.push(input);
			return { id: 'user-1', role: 'rider' as const, status: 'active' as const };
		}
	};
	const launch = new MemoryLaunchCredentialStore();
	return {
		repository,
		calls,
		launch,
		service: new WordPressProvisioningService(
			repository,
			config,
			new MemoryReplayStore(),
			launch,
			new MemoryRateLimiter(limit, 60_000)
		)
	};
}

describe('WordPress provisioning boundary', () => {
	it('verifies an RS256 token and returns only the approved profile', () => {
		expect(verifyProvisioningToken(token({}), config, nowMs)).toEqual({
			sourceUid: 'wp-user-123',
			firstName: 'First',
			lastName: 'Last',
			email: 'first.last@example.test',
			telephone: '+15551234567'
		});
	});

	it.each([
		['wrong issuer', { iss: 'https://attacker.example.test' }],
		['wrong audience', { aud: 'other-service' }],
		['expired', { exp: nowMs / 1000 - 1 }],
		['wrong algorithm', { alg: 'HS256' }],
		['wrong key id', { kid: 'old-key' }],
		['invalid email', { email: 'not-an-email' }]
	])('rejects %s tokens', (_label, overrides) => {
		expect(() => verifyProvisioningToken(token(overrides), config, nowMs)).toThrow(
			'not authorized'
		);
	});

	it('rejects malformed and oversized request bodies', async () => {
		await expect(
			readProvisioningBody(new Request('http://localhost', { method: 'POST', body: '{' }), 1024)
		).rejects.toMatchObject({ status: 400, code: 'invalid_request' });
		await expect(
			readProvisioningBody(
				new Request('http://localhost', { method: 'POST', body: 'x'.repeat(1025) }),
				1024
			)
		).rejects.toMatchObject({ status: 400, code: 'invalid_request' });
		expect(() => verifyProvisioningToken('not-a-jwt', config, nowMs)).toThrow('not authorized');
	});

	it('upserts one identity and issues an opaque launch credential', async () => {
		const { service: provisioning, calls, launch } = service();
		const result = await provisioning.provision(
			token({}),
			{ source_system: 'wordpress' },
			'127.0.0.1',
			nowMs
		);

		expect(result.expires_in).toBe(60);
		expect(result.launch_code).toMatch(/^[A-Za-z0-9_-]{40,}$/);
		expect(calls).toEqual([
			{
				sourceSystem: 'wordpress',
				sourceUid: 'wp-user-123',
				firstName: 'First',
				lastName: 'Last',
				email: 'first.last@example.test',
				telephone: '+15551234567'
			}
		]);
		expect(launch.consume(result.launch_code, nowMs)).toEqual({
			sourceUid: 'wp-user-123',
			userId: 'user-1',
			role: 'rider',
			displayName: 'First Last'
		});
	});

	it('rejects a replayed jti and consumes launch credentials once', async () => {
		const { service: provisioning, launch } = service();
		const first = await provisioning.provision(
			token({ jti: 'replay-once' }),
			{},
			'127.0.0.1',
			nowMs
		);
		await expect(
			provisioning.provision(token({ jti: 'replay-once' }), {}, '127.0.0.1', nowMs)
		).rejects.toBeInstanceOf(WordPressProvisioningError);

		expect(launch.consume(first.launch_code, nowMs)).toEqual({
			sourceUid: 'wp-user-123',
			userId: 'user-1',
			role: 'rider',
			displayName: 'First Last'
		});
		expect(launch.consume(first.launch_code, nowMs)).toBeNull();
	});

	it('rejects unsupported request fields', async () => {
		const { service: provisioning } = service();
		await expect(
			provisioning.provision(token({ jti: 'invalid-body' }), { role: 'admin' }, '127.0.0.1', nowMs)
		).rejects.toMatchObject({ status: 400, code: 'invalid_request' });
	});

	it('does not issue a launch code for a Carpool-deactivated user', async () => {
		const inactiveRepository = {
			upsertWordPressUser: async () => ({
				id: 'user-1',
				role: 'rider' as const,
				status: 'inactive' as const
			})
		};
		const launch = new MemoryLaunchCredentialStore();
		const inactiveProvisioning = new WordPressProvisioningService(
			inactiveRepository,
			config,
			new MemoryReplayStore(),
			launch,
			new MemoryRateLimiter(30, 60_000)
		);

		await expect(
			inactiveProvisioning.provision(token({ jti: 'inactive-user' }), {}, '127.0.0.1', nowMs)
		).rejects.toMatchObject({ status: 403, code: 'carpool_user_inactive' });
		expect(launch.consume('not-issued', nowMs)).toBeNull();
	});

	it('rate limits repeated provisioning attempts', async () => {
		const { service: provisioning } = service(1);
		await provisioning.provision(token({ jti: 'first' }), {}, '127.0.0.1', nowMs);
		await expect(
			provisioning.provision(token({ jti: 'second' }), {}, '127.0.0.1', nowMs)
		).rejects.toMatchObject({ status: 429 });
	});
});
