import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import http from 'node:http';

const host = process.env.WORDPRESS_SIMULATOR_HOST ?? '127.0.0.1';
const port = Number(process.env.WORDPRESS_SIMULATOR_PORT ?? 8080);
const carpoolUrl = new URL(process.env.WORDPRESS_SIMULATOR_CARPOOL_URL ?? 'http://localhost:5173/');
const launchUrl = new URL(
	process.env.WORDPRESS_SIMULATOR_LAUNCH_URL ?? 'http://localhost:5173/launch'
);
const provisioningUrl =
	process.env.WORDPRESS_SIMULATOR_PROVISIONING_URL ??
	'http://localhost:5173/api/integration/wordpress/provision';
const integrationEnabled = process.env.WORDPRESS_SIMULATOR_INTEGRATION_ENABLED === 'true';
const issuer = process.env.WORDPRESS_SIMULATOR_ISSUER ?? 'https://www.ligerbots.org';
const audience = process.env.WORDPRESS_SIMULATOR_AUDIENCE ?? 'carpool-provisioning';
const keyId = process.env.WORDPRESS_SIMULATOR_KEY_ID ?? 'wordpress-development';
const privateKeyPath = process.env.WORDPRESS_SIMULATOR_PRIVATE_KEY_PATH ?? '';
const userPrefix = process.env.WORDPRESS_SIMULATOR_USER_PREFIX ?? '';
const sessionTtlMs = 8 * 60 * 60 * 1000;

const users = new Map([
	[
		`${userPrefix}9001`,
		{
			id: `${userPrefix}9001`,
			displayName: 'Demo Admin',
			role: 'admin',
			firstName: 'Demo',
			lastName: 'Admin',
			email: 'demo-admin@example.test'
		}
	],
	[
		`${userPrefix}9002`,
		{
			id: `${userPrefix}9002`,
			displayName: 'Demo Driver',
			role: 'driver',
			firstName: 'Demo',
			lastName: 'Driver',
			email: 'demo-driver@example.test'
		}
	],
	[
		`${userPrefix}9003`,
		{
			id: `${userPrefix}9003`,
			displayName: 'Demo Rider 1',
			role: 'rider',
			firstName: 'Demo',
			lastName: 'Rider 1',
			email: 'demo-rider-1@example.test'
		}
	],
	[
		`${userPrefix}9004`,
		{
			id: `${userPrefix}9004`,
			displayName: 'Demo Rider 2',
			role: 'rider',
			firstName: 'Demo',
			lastName: 'Rider 2',
			email: 'demo-rider-2@example.test'
		}
	],
	[
		`${userPrefix}9005`,
		{
			id: `${userPrefix}9005`,
			displayName: 'Demo Rider 3',
			role: 'rider',
			firstName: 'Demo',
			lastName: 'Rider 3',
			email: 'demo-rider-3@example.test'
		}
	],
	[
		`${userPrefix}9006`,
		{
			id: `${userPrefix}9006`,
			displayName: 'Demo Rider 4',
			role: 'rider',
			firstName: 'Demo',
			lastName: 'Rider 4',
			email: 'demo-rider-4@example.test'
		}
	],
	[
		`${userPrefix}9007`,
		{
			id: `${userPrefix}9007`,
			displayName: 'Demo Rider 5',
			role: 'rider',
			firstName: 'Demo',
			lastName: 'Rider 5',
			email: 'demo-rider-5@example.test'
		}
	]
]);

const sessions = new Map();

function randomToken(bytes = 32) {
	return crypto.randomBytes(bytes).toString('base64url');
}

function encode(value) {
	return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createProvisioningToken(user) {
	if (!privateKeyPath) throw new Error('WordPress simulator private key is not configured');
	const now = Math.floor(Date.now() / 1000);
	const header = encode({ alg: 'RS256', typ: 'JWT', kid: keyId });
	const payload = encode({
		iss: issuer,
		sub: user.id,
		aud: audience,
		iat: now,
		nbf: now,
		exp: now + 60,
		jti: crypto.randomUUID(),
		user: {
			first_name: user.firstName,
			last_name: user.lastName,
			email: user.email
		}
	});
	const signer = crypto.createSign('RSA-SHA256');
	signer.update(`${header}.${payload}`);
	signer.end();
	const signature = signer.sign(requirePrivateKey()).toString('base64url');
	return `${header}.${payload}.${signature}`;
}

let privateKey;
function requirePrivateKey() {
	if (!privateKey) {
		privateKey = crypto.createPrivateKey(readFileSync(privateKeyPath, 'utf8'));
	}
	return privateKey;
}

async function provision(user) {
	const correlation = randomToken(16);
	const response = await fetch(provisioningUrl, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${createProvisioningToken(user)}`,
			'Content-Type': 'application/json',
			'X-Correlation-ID': correlation
		},
		body: JSON.stringify({ source_system: 'wordpress' }),
		signal: AbortSignal.timeout(10_000)
	});
	if (!response.ok) throw new Error(`Provisioning request returned HTTP ${response.status}`);
	const body = await response.json();
	const result = body?.data;
	if (
		!result ||
		typeof result.launch_code !== 'string' ||
		!/^[A-Za-z0-9_-]{32,512}$/.test(result.launch_code) ||
		!Number.isInteger(result.expires_in) ||
		result.expires_in < 1 ||
		result.expires_in > 60
	) {
		throw new Error('Provisioning response was invalid');
	}
	const destination = new URL(launchUrl.toString());
	destination.searchParams.set('code', result.launch_code);
	return destination.toString();
}

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

function parseCookies(request) {
	return Object.fromEntries(
		(request.headers.cookie ?? '')
			.split(';')
			.map((part) => part.trim().split('='))
			.filter(([name, value]) => name && value)
			.map(([name, ...value]) => [name, value.join('=')])
	);
}

function getSession(request) {
	const sessionId = parseCookies(request).wordpress_sim_session;
	const session = sessionId ? sessions.get(sessionId) : null;
	if (!session || session.expiresAt <= Date.now()) {
		if (sessionId) sessions.delete(sessionId);
		return null;
	}
	return session;
}

function safeLocalPath(value, fallback = '/') {
	if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
		return fallback;
	}
	return value;
}

function sendHtml(response, status, body, headers = {}) {
	response.writeHead(status, {
		'cache-control': 'no-store',
		'content-type': 'text/html; charset=utf-8',
		...headers
	});
	response.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WordPress simulator</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, sans-serif; }
    body { margin: 0; background: #f4f6f8; color: #17202a; }
    main { max-width: 760px; margin: 4rem auto; padding: 0 1.25rem; }
    section { background: white; border: 1px solid #d7dde4; border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 18px #17202a12; }
    h1 { margin-top: 0; }
    a, button { font: inherit; }
    a, button { display: inline-block; border-radius: 7px; padding: .65rem .9rem; border: 1px solid #2357a6; background: #2357a6; color: white; text-decoration: none; cursor: pointer; }
    a.secondary { background: white; color: #2357a6; }
    label { display: block; margin: 1rem 0; font-weight: 600; }
    select { display: block; width: 100%; margin-top: .4rem; padding: .65rem; border: 1px solid #aab4bf; border-radius: 7px; background: white; }
    nav { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
    .muted { color: #52606d; }
    .notice { padding: .8rem 1rem; background: #edf4ff; border-left: 4px solid #2357a6; }
  </style>
</head>
<body><main>${body}</main></body>
</html>`);
}

function redirect(response, location, headers = {}) {
	response.writeHead(303, { location, 'cache-control': 'no-store', ...headers });
	response.end();
}

function loginPage(message = '') {
	return `<section>
  <h1>WordPress simulator</h1>
  <p class="muted">This local page simulates an authenticated LigerBots WordPress site.</p>
  ${message ? `<p class="notice">${escapeHtml(message)}</p>` : ''}
  <form method="post" action="/wp-login.php">
    <input type="hidden" name="redirect_to" value="/">
    <label>Test WordPress user
      <select name="user_id">
        ${[...users.values()]
			.map(
				(user) =>
					`<option value="${escapeHtml(user.id)}">${escapeHtml(user.displayName)} (${escapeHtml(user.role)})</option>`
			)
			.join('')}
      </select>
    </label>
    <button type="submit">Log in</button>
  </form>
</section>`;
}

function homePage(session) {
	if (!session) return loginPage();
	const user = users.get(session.userId);
	const nonce = randomToken(18);
	session.nonce = nonce;
	return `<section>
  <nav>
    <strong>LigerBots WordPress</strong>
    <a class="secondary" href="/wp-login.php?action=logout">Log out</a>
  </nav>
  <h1>Resources</h1>
  <p>Signed in as <strong>${escapeHtml(user.displayName)}</strong> (${escapeHtml(user.role)}).</p>
  <p class="muted">The real site would render this menu item only for logged-in users.</p>
  <p><a href="/wp-admin/admin-post.php?action=ligerbots_carpool_launch&amp;_wpnonce=${encodeURIComponent(nonce)}">Resources / Carpools</a></p>
</section>`;
}

async function readForm(request) {
	const chunks = [];
	for await (const chunk of request) chunks.push(chunk);
	return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

const server = http.createServer(async (request, response) => {
	const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port}`}`);
	const session = getSession(request);

	if (request.method === 'GET' && url.pathname === '/health') {
		response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
		response.end(JSON.stringify({ status: 'ok', carpool_url: carpoolUrl.toString() }));
		return;
	}

	if (request.method === 'GET' && url.pathname === '/') {
		sendHtml(response, 200, homePage(session));
		return;
	}

	if (request.method === 'GET' && url.pathname === '/wp-login.php') {
		if (url.searchParams.get('action') === 'logout' && session) {
			sessions.delete(parseCookies(request).wordpress_sim_session);
			redirect(response, '/', {
				'set-cookie': 'wordpress_sim_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'
			});
			return;
		}
		sendHtml(response, 200, loginPage());
		return;
	}

	if (request.method === 'POST' && url.pathname === '/wp-login.php') {
		const form = await readForm(request);
		const user = users.get(form.get('user_id') ?? '');
		if (!user) {
			sendHtml(response, 400, loginPage('Choose a valid simulator user.'));
			return;
		}
		const sessionId = randomToken();
		sessions.set(sessionId, {
			userId: user.id,
			expiresAt: Date.now() + sessionTtlMs,
			nonce: null
		});
		redirect(response, safeLocalPath(form.get('redirect_to')), {
			'set-cookie': `wordpress_sim_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionTtlMs / 1000}`
		});
		return;
	}

	if (request.method === 'GET' && url.pathname === '/wp-admin/admin-post.php') {
		if (url.searchParams.get('action') !== 'ligerbots_carpool_launch') {
			sendHtml(response, 404, '<section><h1>Not found</h1></section>');
			return;
		}
		if (!session) {
			redirect(response, '/wp-login.php');
			return;
		}
		if (!session.nonce || url.searchParams.get('_wpnonce') !== session.nonce) {
			sendHtml(
				response,
				403,
				'<section><h1>Launch denied</h1><p>The simulator nonce was missing or invalid.</p></section>'
			);
			return;
		}
		if (!integrationEnabled) {
			redirect(response, carpoolUrl.toString());
			return;
		}
		try {
			redirect(response, await provision(users.get(session.userId)));
		} catch {
			const correlation = randomToken(12);
			sendHtml(
				response,
				502,
				`<section><h1>Carpool unavailable</h1><p>Please try again later. Reference: ${escapeHtml(correlation)}</p></section>`
			);
		}
		return;
	}

	sendHtml(response, 404, '<section><h1>Not found</h1></section>');
});

server.listen(port, host, () => {
	console.log(`WordPress simulator listening at http://${host}:${port}`);
	console.log(`Carpool navigation target: ${carpoolUrl}`);
});

function stop() {
	server.close(() => process.exit(0));
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
