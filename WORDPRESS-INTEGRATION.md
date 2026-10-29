# WordPress Integration Installation Guide

This guide installs the LigerBots WordPress integration plugin and connects it
to the Carpool application. It covers the complete WordPress-to-Carpool launch
flow, local development, staging requirements, production security, and
troubleshooting.

The design and protocol details are maintained in
[`design/wordpress-integration-design.md`](./design/wordpress-integration-design.md).
The plugin source is in
[`wordpress/plugin/`](./wordpress/plugin/).

## 1. What the integration does

WordPress remains the authoritative identity provider. The plugin does not
implement login, passwords, account recovery, or a second user database.

When a logged-in user selects the existing **Resources / Carpools** menu item:

1. WordPress verifies the logged-in session and a WordPress nonce.
2. The plugin normalizes the current WordPress profile.
3. The plugin creates a short-lived RS256 JWT.
4. WordPress sends the JWT server-to-server to the Carpool provisioning
   endpoint.
5. Carpool verifies the JWT and upserts the identity in Directus using
   `(source_system, source_uid)`.
6. A new identity is created with `role = rider` and `status = active`.
7. Existing Carpool role and status values are preserved.
8. Carpool returns a short-lived, opaque, single-use launch code.
9. The browser is redirected to `/launch?code=...` on the Carpool application.
10. Carpool consumes the code, creates its own session cookie, removes the code
    from the address bar, and shows the authenticated application.

WordPress cannot assign Carpool roles or deactivate Carpool users. Carpool
administrators perform those operations in the Carpool user-management page.
Deactivation invalidates active Carpool sessions and a later WordPress launch
does not reactivate the user.

The browser never receives the provisioning JWT, Directus token, private key,
or profile data in the launch URL.

## 2. Requirements

### WordPress server

- WordPress 6.0 or newer.
- PHP 8.0 or newer.
- OpenSSL support for RS256 signing.
- WordPress HTTP API/cURL support for `wp_remote_post`.
- A logged-in WordPress user with a valid first name, last name, and email.
- HTTPS in staging and production.
- Ability to install a plugin and add a small site-specific configuration
  mu-plugin or equivalent deployment configuration.
- The private signing key stored outside the plugin directory and outside the
  web root.

Composer is required only to build the plugin package. It is not required on
the production WordPress host if the generated `vendor/` directory is deployed
with the plugin.

### Carpool server

- The SvelteKit Carpool application is running and reachable by WordPress.
- Directus and PostgreSQL are running and migrated.
- The Carpool server has a restricted Directus token in `DIRECTUS_TOKEN`.
- The WordPress source identity migration has been applied, including
  `migrations/003-wordpress-identity.sql` and
  `migrations/004-user-lifecycle.sql`.
- `WORDPRESS_INTEGRATION_ENABLED=true`.
- The Carpool public key matches the WordPress private key.
- `WORDPRESS_ISSUER`, `WORDPRESS_AUDIENCE`, and `WORDPRESS_KEY_ID` exactly
  match the values used by the plugin.
- The Carpool launch URL is reachable by the user’s browser.

For production, also provide:

- HTTPS for both the provisioning and launch URLs.
- A durable/shared provisioning replay and launch-code store.
- A durable/shared Carpool session store when multiple app instances run.
- Secure cookies with `CARPOOL_SESSION_SECURE=true`.
- Secret management for private/public keys and Directus credentials.
- Clock synchronization between WordPress and Carpool.
- Monitoring for provisioning failures, replay attempts, rejected tokens, and
  session failures.

### Current repository status

The repository currently provides a complete local integration flow. Local
provisioning, replay protection, launch-code storage, and sessions use
in-memory stores. The application intentionally fails closed in
`NODE_ENV=production` when the provisioning store is not durable. Selecting
`WORDPRESS_PROVISIONING_STORE=external` also fails closed until the external
store adapter is implemented and configured.

Do not treat the local in-memory configuration as a production deployment.

## 3. Credential and session lifetimes

The default local values are:

| Item                             |   Lifetime | Notes                                                     |
| -------------------------------- | ---------: | --------------------------------------------------------- |
| WordPress provisioning JWT       | 60 seconds | Sent only in the server-to-server `Authorization` header. |
| Carpool launch code              | 60 seconds | Opaque, single-use, and consumed atomically.              |
| Carpool session idle timeout     | 30 minutes | Authenticated activity refreshes this window.             |
| Carpool session absolute timeout |    8 hours | Activity cannot extend this maximum.                      |
| WordPress simulator session      |    8 hours | Local simulator only; stored in memory.                   |

Returning to WordPress does not log out of Carpool. A Carpool logout or user
deactivation revokes the Carpool session. Restarting the local SvelteKit
server clears local Carpool sessions.

## 4. Generate an RSA key pair

Generate one key pair per environment. Never reuse a development key in
staging or production.

```sh
umask 077
mkdir -p /tmp/ligerbots-carpool-keys
openssl genpkey \
  -algorithm RSA \
  -pkeyopt rsa_keygen_bits:2048 \
  -out /tmp/ligerbots-carpool-keys/wordpress-private.pem
openssl pkey \
  -in /tmp/ligerbots-carpool-keys/wordpress-private.pem \
  -pubout \
  -out /tmp/ligerbots-carpool-keys/wordpress-public.pem
chmod 600 /tmp/ligerbots-carpool-keys/wordpress-private.pem
chmod 644 /tmp/ligerbots-carpool-keys/wordpress-public.pem
```

For a real WordPress deployment, copy the private key to a protected path such
as `/etc/ligerbots/wordpress-private.pem` or a container secret. Copy the
public key to the Carpool host or secret manager. Do not commit either key.

Use a stable key ID, for example `wordpress-production-2026-01`. The key ID is
part of the JWT header and must match `WORDPRESS_KEY_ID` on Carpool.

## 5. Configure the Carpool application

Copy the environment template if needed:

```sh
cp .env.example .env
```

Set the Directus and WordPress integration values in `.env`:

```env
DIRECTUS_URL=http://localhost:8055
DIRECTUS_TOKEN=<restricted-server-token>

WORDPRESS_INTEGRATION_ENABLED=true
WORDPRESS_ISSUER=https://www.ligerbots.org
WORDPRESS_AUDIENCE=carpool-provisioning
WORDPRESS_KEY_ID=wordpress-development
WORDPRESS_PUBLIC_KEY_PATH=/tmp/ligerbots-carpool-keys/wordpress-public.pem
WORDPRESS_CLOCK_SKEW_SECONDS=5
WORDPRESS_LAUNCH_TTL_SECONDS=60
WORDPRESS_PROVISIONING_STORE=memory

CARPOOL_SESSION_IDLE_TIMEOUT_SECONDS=1800
CARPOOL_SESSION_ABSOLUTE_TIMEOUT_SECONDS=28800
CARPOOL_SESSION_SECURE=false
```

Do not set `CARPOOL_DEV_USER_ID`, `CARPOOL_DEV_USER_NAME`, or
`CARPOOL_DEV_USER_ROLE` while testing WordPress authentication. Those variables
select a local identity adapter instead of a WordPress session.

Apply the schema and start the local application:

```sh
pnpm docker:up
pnpm directus:migrate
pnpm directus:test
pnpm dev
```

The provisioning endpoint is:

```text
http://localhost:5173/api/integration/wordpress/provision
```

The launch endpoint is:

```text
http://localhost:5173/launch
```

In a containerized WordPress deployment, the provisioning URL must use a host
name or service name reachable from the WordPress container. `localhost` from
inside a WordPress container refers to the WordPress container itself. The
launch URL must instead be reachable from the user’s browser.

## 6. Build the WordPress plugin

Build from the repository root:

```sh
cd wordpress/plugin
composer install --no-dev --prefer-dist --optimize-autoloader
```

The complete plugin directory must contain:

```text
ligerbots-carpool-integration/
├── composer.json
├── composer.lock
├── ligerbots-carpool-integration.php
└── vendor/
```

Create a deployable archive without including development files:

```sh
cd wordpress/plugin
zip -r /tmp/ligerbots-carpool-integration.zip \
  composer.json composer.lock ligerbots-carpool-integration.php vendor
```

The plugin intentionally fails closed if `vendor/autoload.php` or required
configuration is unavailable.

## 7. Install and activate the plugin

### WordPress admin installation

1. Open **Plugins → Add New → Upload Plugin**.
2. Upload `ligerbots-carpool-integration.zip`.
3. Install the plugin.
4. Activate **LigerBots Carpool Integration**.

### Server-side installation

Alternatively, extract the complete directory into:

```text
wp-content/plugins/ligerbots-carpool-integration/
```

Ensure the web server user can read the plugin and `vendor/` directory, but
cannot write to the private key. Activate the plugin from the WordPress admin
screen or with WP-CLI:

```sh
wp plugin activate ligerbots-carpool-integration
```

The plugin does not create a menu item. It rewrites an existing item whose
label is `Carpools` or `Resources / Carpools`, including supported block-theme
Navigation links. Create or retain that item in the WordPress menu and make
sure it is assigned to the intended menu location.

Logged-out visitors see the normal menu item behavior and cannot launch the
Carpool flow. The launch handler checks WordPress authentication independently,
so hiding the item is not the security control.

## 8. Configure WordPress

The plugin has no settings page. Put secrets in `wp-config.php` and put
filters in a site-specific mu-plugin or another trusted configuration plugin.

### 8.1 Private key in `wp-config.php`

Add this before the WordPress bootstrap include in `wp-config.php`:

```php
$ligerbots_carpool_private_key_path = '/etc/ligerbots/wordpress-private.pem';
$ligerbots_carpool_private_key = is_readable($ligerbots_carpool_private_key_path)
    ? file_get_contents($ligerbots_carpool_private_key_path)
    : '';

define(
    'LIGERBOTS_CARPOOL_PRIVATE_KEY',
    is_string($ligerbots_carpool_private_key) ? $ligerbots_carpool_private_key : ''
);
```

The private key must not be stored in a WordPress option, user-meta field,
theme file, browser script, or plugin source file.

### 8.2 Integration filters

Create a file such as
`wp-content/mu-plugins/ligerbots-carpool-config.php`:

```php
<?php

add_filter('ligerbots_carpool_config', static function (array $config): array {
    $config['provisioning_url'] = 'https://carpool.example.org/api/integration/wordpress/provision';
    $config['launch_url'] = 'https://carpool.example.org/launch';
    $config['issuer'] = 'https://www.ligerbots.org';
    $config['audience'] = 'carpool-provisioning';
    $config['key_id'] = 'wordpress-production-2026-01';
    $config['timeout'] = 10;

    return $config;
});
```

The values must match Carpool exactly:

| WordPress setting  | Carpool setting                                       | Requirement                                  |
| ------------------ | ----------------------------------------------------- | -------------------------------------------- |
| `provisioning_url` | Server URL for `/api/integration/wordpress/provision` | Must be reachable from the WordPress server. |
| `launch_url`       | `WORDPRESS_LAUNCH_PATH` and Carpool origin            | Must be reachable from the user’s browser.   |
| `issuer`           | `WORDPRESS_ISSUER`                                    | Exact string match.                          |
| `audience`         | `WORDPRESS_AUDIENCE`                                  | Exact string match.                          |
| `key_id`           | `WORDPRESS_KEY_ID` or `WORDPRESS_PUBLIC_KEYS` key     | Must select the matching public key.         |

Provisioning and launch URLs must use HTTPS outside the explicitly supported
local HTTP mode. Keep separate values and keys for development, staging, and
production.

### 8.3 Custom menu item ID

The plugin automatically matches `Carpools` and `Resources / Carpools`. If the
site uses another label, add this filter to the same mu-plugin:

```php
add_filter('ligerbots_carpool_menu_item_id', static function (): int {
    return 123; // Existing WordPress menu item ID.
});
```

The plugin changes the URL at render time; it does not modify the saved menu
item in the database.

### 8.4 Telephone profile field

Telephone is optional. The plugin checks these user-meta keys in order:

```text
phone_number, telephone, phone
```

To use a site-specific key:

```php
add_filter('ligerbots_carpool_telephone_meta_keys', static function (): array {
    return ['my_verified_phone'];
});
```

Carpool receives telephone data only when an approved workflow requires it.

## 9. Local WordPress simulator workflow

The repository includes a Node-based simulator for the WordPress side. It is
useful for validating the complete flow before installing the PHP plugin on a
real WordPress instance.

Generate the local key pair from section 4, then set these values in `.env`:

```env
WORDPRESS_SIMULATOR_INTEGRATION_ENABLED=true
WORDPRESS_SIMULATOR_ISSUER=https://www.ligerbots.org
WORDPRESS_SIMULATOR_AUDIENCE=carpool-provisioning
WORDPRESS_SIMULATOR_PROVISIONING_URL=http://localhost:5173/api/integration/wordpress/provision
WORDPRESS_SIMULATOR_LAUNCH_URL=http://localhost:5173/launch
WORDPRESS_SIMULATOR_CARPOOL_URL=http://localhost:5173/
WORDPRESS_SIMULATOR_PRIVATE_KEY_PATH=/tmp/ligerbots-carpool-keys/wordpress-private.pem
WORDPRESS_SIMULATOR_KEY_ID=wordpress-development
```

Ensure the Carpool side uses the matching public key and key ID. Start both
servers with:

```sh
./scripts/run-dev-simulator.sh
```

Then:

1. Open <http://localhost:8080>.
2. Select **Log in** for Demo Admin, Demo Driver, or one of Demo Rider 1–5.
3. Select **Resources / Carpools**.
4. Confirm the browser reaches <http://localhost:5173/> without a `code` query
   parameter.
5. Confirm the Carpool navigation displays the selected identity and **Back to
   simulator**.
6. Confirm that an unauthenticated direct visit to <http://localhost:5173/>
   shows the sign-in notice and no event cards.

The simulator’s private key is local test material. Do not copy it to a shared
WordPress or production server.

## 10. Verify a real WordPress installation

After activation and configuration, test in this order:

1. Log out of WordPress and verify the Carpools item does not provide an
   authenticated launch.
2. Log in with a user whose first name, last name, and email are valid.
3. Open the Carpools menu item.
4. Confirm the browser is redirected to Carpool and the final URL contains no
   `code`, JWT, UID, email, or telephone number.
5. Confirm a new Directus identity has:
   - `source_system = wordpress`;
   - `source_uid` equal to the WordPress numeric user ID;
   - `role = rider`;
   - `status = active`.
6. Change that user’s Carpool role in the Carpool admin UI and launch again.
   Confirm WordPress profile refresh does not overwrite the role.
7. Deactivate that user in Carpool and launch again. Confirm no Carpool session
   is created and the user remains inactive.
8. Test a user with a changed email. Confirm the existing identity is updated
   instead of a duplicate being created.
9. Test an invalid nonce and confirm the launch is rejected.
10. Test a missing/mismatched public key, issuer, audience, or key ID and
    confirm the request fails closed.

The Carpool server returns only an envelope like:

```json
{
	"data": {
		"launch_code": "opaque-single-use-value",
		"expires_in": 60
	}
}
```

Any non-2xx response or malformed response is shown to the WordPress user as a
generic temporary-unavailable message. The WordPress PHP error log records a
correlation ID and non-sensitive reason.

## 11. Key rotation

Use overlapping key IDs so old requests can finish while the new key is
deployed:

1. Generate a new key pair and choose a new key ID.
2. Add the new public key to Carpool using `WORDPRESS_PUBLIC_KEYS` while
   retaining the old key ID and public key.
3. Deploy the new private key and new `key_id` to WordPress.
4. Verify a launch with the new key.
5. Wait at least the JWT lifetime plus the configured clock-skew allowance.
6. Remove the old public key from Carpool.

Example Carpool rotation configuration:

```env
WORDPRESS_KEY_ID=wordpress-production-2026-02
WORDPRESS_PUBLIC_KEYS={"wordpress-production-2026-01":"-----BEGIN PUBLIC KEY-----...","wordpress-production-2026-02":"-----BEGIN PUBLIC KEY-----..."}
```

Keep the JSON valid and protect the environment file. Do not place private
keys in `WORDPRESS_PUBLIC_KEYS`.

## 12. Security requirements

- WordPress must validate authentication and nonce state on every launch.
- Carpool must validate JWT signature, algorithm, `kid`, issuer, audience,
  subject, `iat`, `nbf`, `exp`, `jti`, profile limits, and replay state.
- The provisioning request must use an HTTPS `Authorization: Bearer` header
  in staging and production.
- The plugin must keep TLS verification enabled.
- Launch codes must be opaque, short-lived, single-use, and consumed
  atomically.
- The Carpool session cookie must be `HttpOnly`, `SameSite=Lax`, and `Secure`
  over HTTPS.
- WordPress cannot assign the Carpool role or lifecycle status.
- Carpool must enforce authorization server-side even when the UI hides links.
- Do not log JWTs, authorization headers, nonces, launch codes, private keys,
  email addresses, or telephone numbers.
- Keep WordPress and Carpool clocks synchronized.
- Do not expose the Directus token to WordPress or browser code.
- Do not use local in-memory stores for a multi-instance production service.

## 13. Troubleshooting

### The menu item does not change

- Confirm the plugin is activated.
- Confirm the saved label is exactly `Carpools` or `Resources / Carpools`, or
  configure `ligerbots_carpool_menu_item_id`.
- Confirm the user is logged in.
- For a block theme, confirm the item is a Navigation link and has the expected
  label.
- Clear any full-page or object cache that renders the old menu URL.

### Carpool says identity integration is unavailable

- Confirm `WORDPRESS_INTEGRATION_ENABLED=true`.
- Confirm the Carpool server was restarted after editing `.env`.
- Confirm `DIRECTUS_TOKEN` is present and can read/write only the required
  Carpool collections.
- Confirm `WORDPRESS_PUBLIC_KEY_PATH` is readable by the SvelteKit process.
- Confirm the public key is the pair for the private key used by WordPress.
- Confirm `WORDPRESS_KEY_ID`, issuer, and audience match the plugin filter.

### WordPress shows “Carpool is temporarily unavailable”

- Check the WordPress PHP error log for the correlation ID.
- Check the Carpool server log for the same `x-correlation-id`.
- Test that the WordPress server can reach the provisioning URL; this is a
  server-to-server request and does not use the browser’s network path.
- Confirm the provisioning response is HTTP 2xx and contains `data.launch_code`
  and `data.expires_in`.
- Confirm the WordPress profile has a valid first name, last name, and email.
- Confirm TLS certificates and system clocks are valid.

### The launch redirects to `/?launch=invalid`

- The launch code may have expired; retry from WordPress.
- The code may already have been used; launch codes are single-use.
- The Carpool app may have restarted; local in-memory launch codes are cleared
  on restart.
- Confirm the browser is reaching the same Carpool instance that received the
  provisioning request.

### The user reaches Carpool but sees no events

- Confirm the user completed the WordPress launch flow and has a Carpool
  session cookie.
- Confirm the Carpool session has not exceeded its idle or absolute timeout.
- Confirm the user is not inactive in the Carpool user-management page.
- Confirm the Carpool server can read published events from Directus.
- Confirm `CARPOOL_DEV_*` variables are not unintentionally selecting a
  different local identity mode.

## 14. Acceptance checklist

Before enabling the integration for real users, confirm:

- [ ] Plugin is built with `composer install --no-dev --prefer-dist`.
- [ ] `vendor/` is deployed with the plugin.
- [ ] WordPress is supported and uses PHP 8.0 or newer.
- [ ] The existing Carpools menu item is present and correctly labeled.
- [ ] The private key is outside the web root and source control.
- [ ] The matching public key is configured on Carpool.
- [ ] WordPress and Carpool issuer, audience, and key ID match.
- [ ] Provisioning URL is reachable from the WordPress server.
- [ ] Launch URL is reachable from the user’s browser.
- [ ] HTTPS and certificate validation are enabled outside local development.
- [ ] Directus migrations and restricted server token are configured.
- [ ] A new WordPress identity is created as an active rider.
- [ ] Carpool role changes survive later WordPress profile refreshes.
- [ ] Carpool deactivation prevents a later launch and invalidates sessions.
- [ ] Replayed, expired, malformed, or forged requests fail closed.
- [ ] Logs contain correlation IDs but no credentials or personal profile data.
- [ ] Local/in-memory provisioning and session stores are not used in
      production.
