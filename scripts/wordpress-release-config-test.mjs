import { readFile } from 'node:fs/promises';

const provisioning = await readFile('src/lib/server/wordpress/provisioning.ts', 'utf8');
const session = await readFile('src/lib/server/session.ts', 'utf8');
const envExample = await readFile('.env.example', 'utf8');
const simulator = await readFile('wordpress/simulator/server.mjs', 'utf8');

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

assert(
	provisioning.includes("environment.NODE_ENV === 'production' && store !== 'external'"),
	'Production provisioning must reject the local memory store'
);
assert(
	provisioning.includes('An external WordPress provisioning store adapter is not configured.'),
	'An unimplemented external provisioning adapter must fail closed'
);
assert(
	session.includes("environment.NODE_ENV === 'production' && !secure"),
	'Production sessions must require secure cookies'
);
assert(
	envExample.includes('WORDPRESS_SIMULATOR_INTEGRATION_ENABLED=false'),
	'The simulator must be disabled by default'
);
assert(
	simulator.includes('WORDPRESS_SIMULATOR_INTEGRATION_ENABLED'),
	'The simulator integration mode must be explicitly configurable'
);
assert(
	!envExample.includes('WORDPRESS_SIMULATOR_INTEGRATION_ENABLED=true'),
	'The example environment must not enable the simulator'
);

console.log(
	'verified production configuration fails closed for memory stores, insecure cookies, and simulator mode'
);
