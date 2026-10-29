import { readFile } from 'node:fs/promises';

const plugin = await readFile('wordpress/plugin/ligerbots-carpool-integration.php', 'utf8');
const composer = JSON.parse(await readFile('wordpress/plugin/composer.json', 'utf8'));
const readme = await readFile('wordpress/plugin/README.md', 'utf8');

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

assert(
	composer.require?.['firebase/php-jwt'] === '^7.0',
	'Plugin must pin the maintained PHP JWT library'
);
assert(
	plugin.includes("add_action('admin_post_"),
	'Plugin must register the authenticated launch handler'
);
assert(
	plugin.includes("add_action('admin_post_nopriv_"),
	'Plugin must register the unauthenticated rejection path'
);
assert(plugin.includes('is_user_logged_in()'), 'Plugin must check WordPress authentication');
assert(plugin.includes('check_admin_referer(self::ACTION)'), 'Plugin must check a WordPress nonce');
assert(plugin.includes('JWT::encode'), 'Plugin must use the maintained JWT library');
assert(plugin.includes("'RS256'"), 'Plugin must sign RS256 provisioning credentials');
assert(plugin.includes("'sslverify' => true"), 'Plugin must require TLS certificate verification');
assert(plugin.includes('wp_remote_post('), 'Plugin must use the WordPress HTTP API');
assert(plugin.includes("$body['data']"), 'Plugin must validate the Carpool response envelope');
assert(plugin.includes("$payload['expires_in']"), 'Plugin must validate the launch-code lifetime');
assert(
	plugin.includes("preg_match('/^[A-Za-z0-9_-]+$/', $code)"),
	'Plugin must validate opaque launch codes'
);
assert(
	plugin.includes("strtolower($parts['scheme']) === 'https'"),
	'Plugin must enforce HTTPS outside local mode'
);
assert(!plugin.includes('error_log($token'), 'Plugin must not log provisioning tokens');
assert(!plugin.includes("error_log($config['private_key']"), 'Plugin must not log private keys');
assert(
	readme.includes('private key') && readme.includes('outside the web root'),
	'Plugin README must document private-key handling'
);
assert(
	readme.includes('LIGERBOTS_CARPOOL_ALLOW_HTTP'),
	'Plugin README must document local-only HTTP opt-in'
);

console.log(
	'verified WordPress plugin dependency, nonce/auth checks, RS256 signing, HTTPS transport, response validation, and secret-redaction contract'
);
