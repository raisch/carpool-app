import { describe, expect, it } from 'vitest';
import {
	identityNotConfigured,
	identityUnauthenticated,
	NotConfiguredIdentityProvider
} from './identity';

describe('identity boundary', () => {
	it('returns an explicit not-configured state', async () => {
		expect(await new NotConfiguredIdentityProvider().getCurrentUser()).toEqual(
			identityNotConfigured()
		);
		expect(identityNotConfigured()).toMatchObject({
			status: 'not-configured',
			code: 'identity_not_configured'
		});
	});

	it('represents a missing WordPress session separately from local configuration', () => {
		expect(identityUnauthenticated()).toMatchObject({
			status: 'unauthenticated',
			code: 'not_authenticated'
		});
	});
});
