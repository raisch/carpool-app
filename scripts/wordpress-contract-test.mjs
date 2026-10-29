import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(
	await readFile(path.join(root, 'wordpress/integration-contract.json'), 'utf8')
);

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

assert(contract.version === '1.0.0', 'WordPress contract version is missing or unexpected');
assert(contract.sourceSystem === 'wordpress', 'WordPress source system is missing');
assert(contract.provisioning.jwtAlgorithm === 'RS256', 'Provisioning must use RS256');
assert(contract.provisioning.ttlSeconds === 60, 'Provisioning JWT TTL must be 60 seconds');
assert(contract.provisioning.clockSkewSeconds === 5, 'Clock skew must be five seconds');
assert(
	contract.provisioning.requiredClaims.join('|') === 'iss|sub|aud|iat|nbf|exp|jti|user',
	'Provisioning claim contract is incomplete'
);
assert(
	contract.identityKey.join('|') === 'source_system|source_uid',
	'Identity key must use source system and source UID'
);
assert(contract.roleMapping.roleClaimAccepted === false, 'Roles must not be accepted from the JWT');
assert(contract.roleMapping.default === 'rider', 'The least-privileged default role must be rider');
assert(contract.profile.firstName.required, 'First name must be required');
assert(contract.profile.lastName.required, 'Last name must be required');
assert(contract.profile.email.required, 'Email must be required');
assert(!contract.profile.telephone.required, 'Telephone must remain optional');
assert(
	contract.environments.development.keyId === 'wordpress-development',
	'Development key ID must match the local research simulator'
);
assert(
	contract.environments.production.carpoolUrl === null &&
		contract.environments.production.keyId === null,
	'Production values must remain explicit approval placeholders'
);

console.log(`verified WordPress integration contract ${contract.version}`);
