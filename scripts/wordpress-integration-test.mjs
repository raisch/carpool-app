import { generateKeyPairSync, createSign, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const appUrl = 'http://127.0.0.1:4175';
const simulatorUrl = 'http://127.0.0.1:8180';
const directusUrl = (process.env.DIRECTUS_URL ?? 'http://localhost:8055').replace(/\/$/, '');
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const userPrefix = `wordpress-m5-${suffix}-`;
const sourceUid = `${userPrefix}9001`;
const created = { users: [] };
let appProcess;
let simulatorProcess;
let tempDirectory;

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function encode(value) {
	return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createToken(privateKey, keyId, profile, overrides = {}) {
	const now = Math.floor(Date.now() / 1000);
	const header = encode({ alg: 'RS256', typ: 'JWT', kid: keyId });
	const payload = encode({
		iss: 'https://www.ligerbots.org',
		sub: profile.uid,
		aud: 'carpool-provisioning',
		iat: now,
		nbf: now,
		exp: now + 60,
		jti: randomUUID(),
		user: {
			first_name: profile.firstName,
			last_name: profile.lastName,
			email: profile.email,
			telephone: profile.telephone
		},
		...overrides
	});
	const signer = createSign('RSA-SHA256');
	signer.update(`${header}.${payload}`);
	signer.end();
	return `${header}.${payload}.${signer.sign(privateKey).toString('base64url')}`;
}

function cookiePair(response) {
	const value = response.headers.get('set-cookie');
	return value ? value.split(';', 1)[0] : '';
}

async function waitFor(url, process) {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		try {
			if ((await fetch(url)).ok) return;
		} catch {
			// The process is still starting.
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	process.kill('SIGTERM');
	throw new Error(`Timed out waiting for ${url}`);
}

async function loginDirectus() {
	const response = await fetch(`${directusUrl}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email: process.env.DIRECTUS_ADMIN_EMAIL,
			password: process.env.DIRECTUS_ADMIN_PASSWORD
		})
	});
	assert(response.ok, `Directus login failed with HTTP ${response.status}`);
	return (await response.json()).data.access_token;
}

const directusToken = await loginDirectus();

async function directus(pathname, options = {}) {
	const response = await fetch(`${directusUrl}${pathname}`, {
		...options,
		headers: {
			Accept: 'application/json',
			Authorization: `Bearer ${directusToken}`,
			...(options.body ? { 'Content-Type': 'application/json' } : {}),
			...(options.headers ?? {})
		}
	});
	const text = await response.text();
	let body;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		body = { raw: text };
	}
	return { response, body };
}

async function createDirectusUser(value) {
	const result = await directus('/items/users', { method: 'POST', body: JSON.stringify(value) });
	assert(result.response.ok, `Unable to create test identity: HTTP ${result.response.status}`);
	return result.body.data;
}

async function stop(process) {
	if (!process) return;
	process.kill('SIGTERM');
	await new Promise((resolve) => process.once('exit', resolve));
}

async function buildApp() {
	await new Promise((resolve, reject) => {
		const process = spawn('pnpm', ['build'], { cwd: root, stdio: 'ignore' });
		process.on('error', reject);
		process.on('exit', (code) =>
			code === 0 ? resolve() : reject(new Error(`Application build failed with code ${code}`))
		);
	});
}

async function request(url, options = {}) {
	return fetch(url, { redirect: 'manual', ...options });
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const oldKeyId = 'wordpress-previous';
tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'carpool-wordpress-m5-'));
const privateKeyPath = path.join(tempDirectory, 'wordpress-private.pem');
await writeFile(privateKeyPath, privateKeyPem, {
	mode: 0o600
});

try {
	await buildApp();
	const admin = await createDirectusUser({
		display_name: `Milestone 5 admin ${suffix}`,
		role: 'admin',
		status: 'active',
		source_system: 'wordpress',
		source_uid: sourceUid,
		first_name: 'Milestone',
		last_name: 'Admin',
		email: `milestone-${suffix}@example.test`,
		telephone: null
	});
	created.users.push(admin.id);
	const rider = await createDirectusUser({
		display_name: `Milestone 5 rider ${suffix}`,
		role: 'rider',
		status: 'active',
		source_system: 'wordpress',
		source_uid: `${userPrefix}9003`,
		first_name: 'Milestone',
		last_name: 'Rider',
		email: `rider-${suffix}@example.test`,
		telephone: null
	});
	created.users.push(rider.id);

	appProcess = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', '4175'], {
		cwd: root,
		stdio: 'ignore',
		env: {
			...process.env,
			NODE_ENV: 'test',
			DIRECTUS_TOKEN: directusToken,
			WORDPRESS_INTEGRATION_ENABLED: 'true',
			WORDPRESS_KEY_ID: 'wordpress-development',
			WORDPRESS_PUBLIC_KEY: publicKeyPem,
			WORDPRESS_PUBLIC_KEYS: JSON.stringify({
				'wordpress-development': publicKeyPem,
				[oldKeyId]: publicKeyPem
			}),
			WORDPRESS_PROVISIONING_STORE: 'memory',
			CARPOOL_SESSION_SECURE: 'false',
			CARPOOL_SESSION_IDLE_TIMEOUT_SECONDS: '30',
			CARPOOL_SESSION_ABSOLUTE_TIMEOUT_SECONDS: '120'
		}
	});
	await waitFor(`${appUrl}/`, appProcess);

	simulatorProcess = spawn('node', ['wordpress/simulator/server.mjs'], {
		cwd: root,
		stdio: 'ignore',
		env: {
			...process.env,
			WORDPRESS_SIMULATOR_PORT: '8180',
			WORDPRESS_SIMULATOR_INTEGRATION_ENABLED: 'true',
			WORDPRESS_SIMULATOR_PRIVATE_KEY_PATH: privateKeyPath,
			WORDPRESS_SIMULATOR_PROVISIONING_URL: `${appUrl}/api/integration/wordpress/provision`,
			WORDPRESS_SIMULATOR_LAUNCH_URL: `${appUrl}/launch`,
			WORDPRESS_SIMULATOR_KEY_ID: 'wordpress-development',
			WORDPRESS_SIMULATOR_USER_PREFIX: userPrefix
		}
	});
	await waitFor(`${simulatorUrl}/health`, simulatorProcess);

	const login = await request(`${simulatorUrl}/wp-login.php`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ user_id: `${userPrefix}9001`, redirect_to: '/' })
	});
	assert(login.status === 303, `WordPress login failed with HTTP ${login.status}`);
	const wordpressCookie = cookiePair(login);
	assert(wordpressCookie.startsWith('wordpress_sim_session='), 'WordPress session cookie missing');

	const home = await request(`${simulatorUrl}/`, { headers: { Cookie: wordpressCookie } });
	const homeHtml = await home.text();
	const launchMatch = homeHtml.match(/href="([^"]*admin-post\.php[^"]*)"/);
	assert(launchMatch, 'WordPress Carpools launch link missing');
	const launchPath = launchMatch[1].replaceAll('&amp;', '&');
	const wordPressLaunch = await request(`${simulatorUrl}${launchPath}`, {
		headers: { Cookie: wordpressCookie }
	});
	assert(
		wordPressLaunch.status === 303,
		`WordPress launch failed with HTTP ${wordPressLaunch.status}`
	);
	const appLaunchUrl = wordPressLaunch.headers.get('location');
	assert(
		appLaunchUrl?.startsWith(`${appUrl}/launch?code=`),
		'WordPress did not redirect to Carpool launch'
	);

	const carpoolLaunch = await request(appLaunchUrl);
	assert(carpoolLaunch.status === 303, `Carpool launch failed with HTTP ${carpoolLaunch.status}`);
	assert(
		carpoolLaunch.headers.get('location') === '/',
		'Carpool launch did not remove the code from the URL'
	);
	const carpoolCookie = cookiePair(carpoolLaunch);
	assert(carpoolCookie.startsWith('carpool_session='), 'Carpool session cookie missing');
	assert(
		/HttpOnly/i.test(carpoolLaunch.headers.get('set-cookie') ?? ''),
		'Session cookie is not HttpOnly'
	);
	assert(
		/SameSite=Lax/i.test(carpoolLaunch.headers.get('set-cookie') ?? ''),
		'Session cookie is not SameSite=Lax'
	);

	const vehicles = await request(`${appUrl}/api/vehicles`, {
		headers: { Accept: 'application/json', Cookie: carpoolCookie }
	});
	assert(vehicles.status === 200, `Authenticated role access failed with HTTP ${vehicles.status}`);

	const users = await request(`${appUrl}/api/users`, {
		headers: { Accept: 'application/json', Cookie: carpoolCookie }
	});
	assert(users.status === 200, `Admin user listing failed with HTTP ${users.status}`);
	const usersBody = await users.json();
	assert(
		usersBody.data.some((user) => String(user.id) === String(rider.id)),
		'Admin user listing omitted the provisioned rider'
	);

	const deactivate = await request(`${appUrl}/api/users`, {
		method: 'PATCH',
		headers: { Accept: 'application/json', Cookie: carpoolCookie, Origin: appUrl },
		body: JSON.stringify({ id: rider.id, role: 'driver', status: 'inactive' })
	});
	assert(deactivate.status === 200, `Admin user update failed with HTTP ${deactivate.status}`);
	assert((await deactivate.json()).data.status === 'inactive', 'User was not deactivated');

	const inactiveToken = createToken(privateKey, 'wordpress-development', {
		uid: `${userPrefix}9003`,
		firstName: 'Changed',
		lastName: 'Rider',
		email: `rider-updated-${suffix}@example.test`,
		telephone: null
	});
	const inactiveLaunch = await request(`${appUrl}/api/integration/wordpress/provision`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${inactiveToken}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ source_system: 'wordpress' })
	});
	assert(inactiveLaunch.status === 403, 'WordPress reactivated a deactivated Carpool user');

	const reactivate = await request(`${appUrl}/api/users`, {
		method: 'PATCH',
		headers: { Accept: 'application/json', Cookie: carpoolCookie, Origin: appUrl },
		body: JSON.stringify({ id: rider.id, role: 'driver', status: 'active' })
	});
	assert(reactivate.status === 200, `Admin reactivation failed with HTTP ${reactivate.status}`);

	const replay = await request(appLaunchUrl);
	assert(replay.status === 303, 'Replayed launch did not redirect safely');
	assert(
		replay.headers.get('location') === '/?launch=invalid',
		'Replayed launch leaked a different result'
	);

	const invalid = await request(`${appUrl}/launch?code=not-a-real-code`);
	assert(invalid.status === 303, 'Invalid launch did not redirect safely');
	assert(invalid.headers.get('location') === '/?launch=invalid', 'Invalid launch guidance changed');

	const logout = await request(`${appUrl}/api/auth/logout`, {
		method: 'POST',
		headers: { Cookie: carpoolCookie, Origin: appUrl }
	});
	assert(
		logout.status === 303 && logout.headers.get('location') === '/',
		`Logout did not redirect home: HTTP ${logout.status} ${logout.headers.get('location') ?? ''}`
	);
	const afterLogout = await request(`${appUrl}/api/vehicles`, {
		headers: { Accept: 'application/json', Cookie: carpoolCookie }
	});
	assert(
		afterLogout.status === 401,
		`Revoked session retained protected access: HTTP ${afterLogout.status}`
	);

	const rotatedToken = createToken(privateKey, oldKeyId, {
		uid: sourceUid,
		firstName: 'Changed',
		lastName: 'Profile',
		email: `changed-${suffix}@example.test`,
		telephone: '+15550001111'
	});
	const rotated = await request(`${appUrl}/api/integration/wordpress/provision`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${rotatedToken}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ source_system: 'wordpress' })
	});
	assert(rotated.status === 200, `Rotated key provisioning failed with HTTP ${rotated.status}`);

	const expired = await request(`${appUrl}/api/integration/wordpress/provision`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${createToken(privateKey, 'wordpress-development', { uid: `${sourceUid}-expired`, firstName: 'Expired', lastName: 'User', email: `expired-${suffix}@example.test`, telephone: null }, { exp: Math.floor(Date.now() / 1000) - 1 })}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ source_system: 'wordpress' })
	});
	assert(expired.status === 401, 'Expired provisioning token was accepted');

	const clientRoots = ['.svelte-kit/output/client', 'build/client'];
	for (const relative of clientRoots) {
		try {
			await readdir(path.join(root, relative));
		} catch {
			continue;
		}
		const files = await readdir(path.join(root, relative), { recursive: true });
		for (const file of files) {
			if (!file.endsWith('.js')) continue;
			const contents = await readFile(path.join(root, relative, file), 'utf8');
			assert(!contents.includes(directusToken), 'Directus token found in client output');
			assert(!contents.includes(privateKeyPem), 'WordPress private key found in client output');
		}
	}

	console.log(
		'verified WordPress launch, Directus identity upsert, Carpool role/status administration, deactivation preservation, session exchange, replay protection, logout, key rotation, timeout rejection, and client secret boundary'
	);
} finally {
	await stop(simulatorProcess);
	await stop(appProcess);
	for (const id of created.users.reverse())
		await directus(`/items/users/${id}`, { method: 'DELETE' });
	if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true });
}
