import { json, type RequestHandler } from '@sveltejs/kit';
import { createDirectusClient } from '#lib/server/directus/client';
import {
	correlationId,
	defaultProvisioningStores,
	getBearerToken,
	loadWordPressProvisioningConfig,
	ProvisioningRateLimitError,
	readProvisioningBody,
	requestBodyLimitExceeded,
	WordPressProvisioningError,
	WordPressProvisioningService
} from '#lib/server/wordpress/provisioning';

function responseHeaders(id: string): HeadersInit {
	return {
		'cache-control': 'no-store',
		'x-correlation-id': id
	};
}

function safeResponse(
	status: number,
	code: string,
	message: string,
	correlation: string,
	extra: Record<string, string> = {}
): Response {
	return json(
		{ error: { code, message, correlation_id: correlation } },
		{ status, headers: { ...responseHeaders(correlation), ...extra } }
	);
}

function logEvent(event: string, correlation: string, fields: Record<string, unknown> = {}): void {
	console.info(
		JSON.stringify({
			event,
			correlation_id: correlation,
			...fields
		})
	);
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const correlation = correlationId(request.headers.get('x-correlation-id'));
	logEvent('wordpress_provisioning_started', correlation);

	let config;
	try {
		config = loadWordPressProvisioningConfig();
	} catch (error) {
		console.error('WordPress provisioning configuration failed', {
			name: error instanceof Error ? error.name : 'UnknownError'
		});
		return safeResponse(
			503,
			'integration_unavailable',
			'The WordPress integration is unavailable.',
			correlation
		);
	}

	if (!config.enabled) {
		return safeResponse(
			503,
			'integration_unavailable',
			'The WordPress integration is unavailable.',
			correlation
		);
	}

	const token = getBearerToken(request.headers.get('authorization'));
	if (!token) {
		logEvent('wordpress_provisioning_rejected', correlation, { reason: 'missing_authorization' });
		return safeResponse(
			401,
			'unauthorized',
			'The WordPress provisioning request was not authorized.',
			correlation
		);
	}
	if (requestBodyLimitExceeded(request, config.maxRequestBytes)) {
		logEvent('wordpress_provisioning_rejected', correlation, { reason: 'request_too_large' });
		return safeResponse(
			400,
			'invalid_request',
			'The WordPress provisioning request was invalid.',
			correlation
		);
	}

	const client = createDirectusClient();
	if (!client) {
		console.error('WordPress provisioning requires a configured Directus client', {
			correlation_id: correlation
		});
		return safeResponse(
			503,
			'integration_unavailable',
			'The WordPress integration is unavailable.',
			correlation
		);
	}

	try {
		const body = await readProvisioningBody(request, config.maxRequestBytes);
		const service = new WordPressProvisioningService(
			client,
			config,
			defaultProvisioningStores.replay,
			defaultProvisioningStores.launch,
			defaultProvisioningStores.rateLimiter
		);
		let rateKey = 'unknown';
		try {
			rateKey = getClientAddress();
		} catch {
			// Some local adapters do not expose a client address. Keep the safe
			// shared fallback rather than trusting an unverified forwarded header.
		}
		const result = await service.provision(token, body, rateKey);
		logEvent('wordpress_provisioning_succeeded', correlation);
		return json({ data: result }, { headers: responseHeaders(correlation) });
	} catch (error) {
		if (error instanceof ProvisioningRateLimitError) {
			logEvent('wordpress_provisioning_rejected', correlation, { reason: 'rate_limited' });
			return safeResponse(error.status, error.code, error.safeMessage, correlation, {
				'retry-after': String(error.retryAfterSeconds)
			});
		}
		if (error instanceof WordPressProvisioningError) {
			logEvent('wordpress_provisioning_rejected', correlation, { reason: error.code });
			return safeResponse(error.status, error.code, error.safeMessage, correlation);
		}
		console.error('WordPress provisioning failed', {
			correlation_id: correlation,
			name: error instanceof Error ? error.name : 'UnknownError'
		});
		return safeResponse(
			502,
			'integration_backend_error',
			'The WordPress integration is temporarily unavailable.',
			correlation
		);
	}
};
