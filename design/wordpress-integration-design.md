# WordPress Integration and Authentication Design

## 1. Purpose and status

This document defines how the Carpool application will authenticate users from
the LigerBots WordPress site. WordPress remains the source of authentication;
Carpool receives a verified identity, creates its own application session, and
continues to enforce its own role and resource authorization.

This design is based on the research in
[`../../ligerbots-carpool-app/research/web-site-integration/`](../../ligerbots-carpool-app/research/web-site-integration/),
especially the [JWT integration plan](../../ligerbots-carpool-app/research/web-site-integration/web-site-integration-plan.md),
the WordPress plugin, and its protocol test jigs.

The production authentication boundary is not implemented in the current
Carpool application. The current `EnvironmentIdentityProvider` is a local
development adapter only. This document separates that temporary adapter from
the production protocol and defines the milestones required to replace it.

The repository includes a lightweight WordPress simulator at
[`wordpress/simulator/server.mjs`](../wordpress/simulator/server.mjs). It
provides a local logged-in WordPress-like page and a nonce-protected
`Resources / Carpools` navigation link to the running Carpool app. It is a
navigation and UX simulator, not a production authentication implementation.

## 2. Goals and non-goals

### Goals

- Reuse WordPress login as the identity source for Carpool users.
- Prove the WordPress server identity to Carpool with an asymmetric signed
  provisioning credential.
- Avoid putting profile data, reusable JWTs, or Directus credentials in the
  browser URL.
- Exchange a short-lived, single-use launch credential for a normal Carpool
  session cookie.
- Upsert users by stable WordPress identity, not by email address.
- Keep Carpool role and resource authorization independent from WordPress
  menu visibility.
- Support key rotation, replay protection, rate limiting, safe errors, and
  auditable but credential-redacted logs.
- Provide a local simulator for navigation and an executable test boundary
  before the real WordPress site is connected.

### Non-goals

- Replacing WordPress login, password management, or account recovery.
- Accepting a user-supplied UID, email, query parameter, or link click as proof
  of identity.
- Sharing a WordPress cookie with the Carpool origin.
- Making Directus a browser-facing authentication service.
- Building a general WordPress CMS integration or copying the legacy site
  theme into this application.

## 3. Trust boundaries

```text
WordPress browser session
        │ authenticated menu action + WordPress nonce
        ▼
WordPress integration plugin
        │ HTTPS server-to-server request
        │ RS256 provisioning JWT, short-lived
        ▼
Carpool provisioning endpoint
        │ validates signature, claims, replay, profile
        │ upserts the identity through a restricted Directus service client
        │ returns a short-lived opaque launch code
        ▼
Browser redirect to Carpool /launch?code=...
        │ atomic one-time code exchange
        ▼
Carpool session cookie and authenticated application routes
```

The WordPress cookie is trusted only by WordPress. The provisioning JWT is
trusted only by the Carpool server and only for the provisioning request. The
launch code is trusted only once by the Carpool launch handler. The session
cookie is trusted only by the Carpool application.

Directus remains behind the Carpool server. The browser never receives the
Directus token and never calls Directus directly.

## 4. Identity contract

WordPress supplies the smallest profile needed by Carpool:

| Claim/field  | Required | Meaning                                                  |
| ------------ | -------: | -------------------------------------------------------- |
| `sub`        |      yes | Stable WordPress user identifier; never an email address |
| `first_name` |      yes | Display first name                                       |
| `last_name`  |      yes | Display last name                                        |
| `email`      |      yes | Validated contact email                                  |
| `telephone`  |       no | Verified telephone only when a workflow needs it         |

Carpool owns the application role and lifecycle status. WordPress is the
authoritative source for authentication and the approved profile fields, but
it cannot submit or change a Carpool role and cannot deactivate a Carpool
identity. A new identity is created as `rider`; subsequent provisioning
refreshes profile fields while preserving the role and status chosen in
Carpool. Carpool administrators change roles and active/inactive status in the
Carpool user-management screen.

The identity record must be keyed by `(source_system, source_uid)`. A changed
email address updates the existing identity; it must never create a duplicate
Carpool user.

The versioned contract is recorded in
[`wordpress/integration-contract.json`](../wordpress/integration-contract.json).
It defines the development values taken from the research simulator, keeps
staging/production values that require approval explicit, and records profile
limits, retention intent, role-mapping policy, and the provisioning response.

## 5. Provisioning protocol

### 5.1 WordPress launch request

The integration plugin changes the existing authenticated `Resources / Carpools`
menu item to point to a WordPress handler such as:

```text
/wp-admin/admin-post.php?action=ligerbots_carpool_launch&_wpnonce=<nonce>
```

The handler independently checks:

- the WordPress user is logged in;
- the WordPress nonce is valid for this action;
- the integration configuration is complete;
- the profile fields pass normalization and validation.

Hiding the menu item from logged-out users is useful UX, but it is not a
security control.

### 5.2 Provisioning JWT

WordPress creates a new JWT for each launch. Production uses RS256 or ES256
with the private key stored outside the plugin directory and web root. The
private key is never sent to the browser or committed to source control.

The token contains only the claims needed for this request:

```json
{
	"iss": "https://www.ligerbots.org",
	"sub": "wordpress-user-12345",
	"aud": "carpool-provisioning",
	"iat": 1791390000,
	"nbf": 1791390000,
	"exp": 1791390060,
	"jti": "unique-request-id",
	"user": {
		"first_name": "First",
		"last_name": "Last",
		"email": "user@example.com",
		"telephone": "+15551234567"
	}
}
```

Required protections:

- allowlist the exact issuer and audience;
- require `kid` and select an allowlisted public key;
- allow only the configured asymmetric algorithm;
- enforce `iat`, `nbf`, and `exp` with a small clock-skew allowance;
- reject a previously consumed `jti`;
- use a target lifetime of approximately 60 seconds;
- send the JWT only in an HTTPS `Authorization: Bearer` header;
- do not log the JWT, authorization header, or profile contents.

### 5.3 Carpool provisioning endpoint

The Carpool server exposes:

```text
POST /api/integration/wordpress/provision
```

The endpoint must:

1. require an authorization header;
2. verify the JWT signature and claims;
3. validate the profile schema and size limits;
4. atomically reject a replayed `jti`;
5. upsert the Directus identity by `(source_system, source_uid)`;
6. assign `rider` only when creating a new identity and preserve the existing
   Carpool role and status on later profile refreshes;
7. reject launch for a Carpool-inactive identity;
8. create a hashed, expiring, single-use launch-code record;
9. return only the opaque launch code and its expiration window.

The endpoint must not return whether an arbitrary UID already exists. Errors
should have a correlation ID and a generic user-safe message; technical
details belong in redacted server logs.

The provisioning store may be PostgreSQL, Redis, or another transactional
store. Code creation and replay consumption must be atomic. Directus should
remain the profile system of record, while the short-lived credential/session
store remains separate from profile data.

### 5.4 Carpool-owned role and lifecycle administration

The Carpool application exposes an admin-only user-management boundary:

```text
GET   /api/users
PATCH /api/users   { id, role, status }
```

The server requires an active Carpool administrator for both operations and
validates the role/status values before writing through the constrained
Directus client. Administrators can promote a rider to driver or admin,
demote a role, deactivate a user, and reactivate a user. The last active
administrator cannot be demoted or deactivated, and an administrator cannot
deactivate their own account.

Deactivation invalidates active local sessions for that user. A later
WordPress launch updates the profile fields but does not reactivate the user
and receives no Carpool launch code until an administrator reactivates the
identity. Existing transportation assignments remain historical records;
inactive users cannot authenticate or submit new transportation decisions.

## 6. Launch and session protocol

WordPress redirects the browser only after validating the provisioning response:

```text
https://carpool.example.org/launch?code=<opaque-one-time-code>
```

The URL must not contain a UID, name, email, telephone number, JWT, or reusable
session token. The launch handler:

1. hashes the supplied code;
2. finds the unexpired, unconsumed record;
3. consumes it atomically;
4. creates a Carpool session with the verified identity and role;
5. sets a `Secure`, `HttpOnly`, `SameSite=Lax` session cookie;
6. redirects to the normal Carpool route, removing the code from the address
   bar.

The session needs normal application controls: idle timeout, absolute timeout,
logout, rotation after authentication, CSRF protection for state-changing
requests, and server-side authorization checks. A successful handshake does
not grant capabilities beyond the Carpool role policy.

Expired, malformed, unknown, or already-used codes receive the same guidance:

> Please log into the Ligerbots web site first and click Resources/Carpools.

### Local lifetime defaults

The local implementation uses these timing defaults:

| Credential or session             |   Lifetime | Behavior                                                                                                 |
| --------------------------------- | ---------: | -------------------------------------------------------------------------------------------------------- |
| WordPress launch code             | 60 seconds | One-time use; it is consumed when `/launch` exchanges it for a Carpool session.                          |
| Carpool session idle window       | 30 minutes | Each authenticated Carpool request refreshes the idle window.                                            |
| Carpool session absolute lifetime |    8 hours | The session expires eight hours after creation, even when active.                                        |
| WordPress simulator session       |    8 hours | Fixed local simulator session lifetime; it is held in memory and disappears when the simulator restarts. |

The Carpool session is also held in memory during local development, so all
Carpool sessions disappear when the SvelteKit server restarts. Returning from
the Carpool app to the simulator does not log out or otherwise revoke the
Carpool session. Deactivating a Carpool user invalidates that user's active
Carpool sessions immediately.

The Carpool values are configured with `CARPOOL_SESSION_IDLE_TIMEOUT_SECONDS`
and `CARPOOL_SESSION_ABSOLUTE_TIMEOUT_SECONDS`. The launch-code value is
configured with `WORDPRESS_LAUNCH_TTL_SECONDS`.

## 7. Carpool application changes

The production implementation will replace the local identity adapter with:

- `WordPressProvisioningService` for JWT validation and profile upsert;
- `LaunchCredentialStore` with hashed, expiring, atomic one-time consumption;
- `CarpoolSessionStore` and request/session middleware;
- an authenticated `CurrentUser` provider used by page loads and API handlers;
- logout and session-expiry behavior;
- an authorization policy that continues to enforce `rider`, `driver`, and
  `admin` permissions independently of WordPress.
- an admin-only user-management boundary for Carpool role assignment and
  active/inactive status, including session invalidation after deactivation.

The current local adapter remains useful for Directus development and should be
explicitly selected only in local/test configuration. It must not be silently
enabled in staging or production.

### Directus identity changes

The current normalized `users` collection is intentionally minimal and uses
local numeric IDs. Migration
[`003-wordpress-identity.json`](../migrations/003-wordpress-identity.json) and
[`003-wordpress-identity.sql`](../migrations/003-wordpress-identity.sql) now add:

- `source_system` (`wordpress`);
- `source_uid` (stable WordPress ID);
- unique `(source_system, source_uid)`;
- approved profile columns (`first_name`, `last_name`, `email`, and optional
  `telephone`); and
- the documented retention policy in the versioned contract.

Migration
[`004-user-lifecycle.sql`](../migrations/004-user-lifecycle.sql) constrains
user status to `active` or `inactive`. The Carpool admin user-management page
uses this status and the existing role constraint; WordPress provisioning can
refresh profile fields but cannot change either value for an existing user.

The database requires `source_system` and `source_uid` and enforces a unique
`(source_system, source_uid)` index. Existing local/demo records are migrated
to the `local` namespace without inventing WordPress profile data. WordPress
profile fields remain nullable for those local records; the future provisioning
boundary must validate required WordPress fields before upserting them.

The migration must preserve the local demo fixture or explicitly document a
development reset. The Directus client must continue to allowlist fields and
must never expose credentials or unrelated WordPress profile data.

## 8. WordPress plugin responsibilities

The production plugin should:

1. update the existing menu item at render time for logged-in users;
2. check login state and nonce in the server-side handler;
3. normalize and validate the approved profile fields;
4. sign an RS256/ES256 JWT with the configured private key;
5. call the provisioning endpoint using `wp_remote_post` with bounded timeouts,
   HTTPS, and TLS verification;
6. validate the response shape and launch-code lifetime;
7. redirect only with the opaque code;
8. show a generic retry-safe error on failure;
9. log a correlation ID and non-sensitive failure reason only.

The plugin should use a maintained PHP JWT library. It must not implement JWT
cryptography manually. Private key, provisioning URL, issuer, audience, and
key ID are deployment configuration, not plugin source constants.

## 9. Local WordPress simulator

### 9.1 Purpose

The simulator makes the navigation experience testable before the production
WordPress plugin and Carpool provisioning endpoint are deployed. It models:

- a WordPress-like login page;
- three local users matching the demo carpool roles;
- a logged-in `Resources / Carpools` menu item;
- a server-side WordPress launch handler;
- a WordPress nonce check;
- navigation to the local Carpool app.

It deliberately does not claim to provide production identity proof. It does
not create RS256 JWTs, provision Directus, or establish a Carpool session. The
production protocol is covered by the research test jigs and future
integration milestones.

### 9.2 Running it

Start the Carpool app in one terminal:

```sh
pnpm dev
```

Start the simulator in another:

```sh
pnpm wordpress:simulator
```

Open <http://localhost:8080>. Choose a demo user and log in. Select
**Resources / Carpools**. The simulator validates the local session and nonce,
then redirects the browser to `WORDPRESS_SIMULATOR_CARPOOL_URL`, which defaults
to <http://localhost:5173/>.

To use another Carpool URL:

```sh
WORDPRESS_SIMULATOR_CARPOOL_URL=http://localhost:5173/events/9001 \
  pnpm wordpress:simulator
```

The simulator supports these local users:

| User         | Role     |     ID |
| ------------ | -------- | -----: |
| Demo Admin   | `admin`  | `9001` |
| Demo Driver  | `driver` | `9002` |
| Demo Rider 1 | `rider`  | `9003` |
| Demo Rider 2 | `rider`  | `9004` |
| Demo Rider 3 | `rider`  | `9005` |
| Demo Rider 4 | `rider`  | `9006` |
| Demo Rider 5 | `rider`  | `9007` |

The app’s current local identity is still controlled by
`CARPOOL_DEV_USER_ID`, `CARPOOL_DEV_USER_NAME`, and `CARPOOL_DEV_USER_ROLE` in
`.env`. Set those values separately when testing role-specific Carpool UI; the
simulator’s selected user does not bypass the current local identity adapter.

### 9.3 Simulator security boundary

The simulator is intentionally host-local and in-memory:

- it binds to `127.0.0.1` by default;
- its WordPress simulator sessions expire after eight hours and disappear on restart;
- user profiles are fixed demo data;
- no password is accepted or stored;
- no profile data is placed into the Carpool URL;
- the launch action requires the simulator session and a nonce;

By default it remains a navigation-only simulator. To exercise the real local
Carpool provisioning and launch boundary, generate a development RSA key pair,
configure the matching public key in the Carpool environment, and start it
with:

```sh
WORDPRESS_SIMULATOR_INTEGRATION_ENABLED=true \\
WORDPRESS_SIMULATOR_PRIVATE_KEY_PATH=/path/to/wordpress-private.pem \\
WORDPRESS_SIMULATOR_PROVISIONING_URL=http://localhost:5173/api/integration/wordpress/provision \\
WORDPRESS_SIMULATOR_LAUNCH_URL=http://localhost:5173/launch \\
pnpm wordpress:simulator
```

In this mode the simulator signs an RS256 token server-side, validates the
Carpool response envelope, and redirects with only the returned one-time code.
It never places the JWT or profile data in the browser URL. The automated
`pnpm wordpress:integration:test` harness uses this mode with ephemeral keys.

- it must never be deployed as a public authentication service.

For full WordPress/PHP plugin testing, continue using the research simulator
under `../ligerbots-carpool-app/research/web-site-integration/simulator/` and
its protocol test jigs. That environment exercises the RS256 plugin boundary;
this repository’s simulator is the lightweight navigation bridge for the
current SvelteKit app.

## 10. Logging, privacy, and operations

Log these events with a shared correlation ID:

- launch started;
- WordPress authentication/nonce failure;
- provisioning request started/completed/failed;
- rejected JWT or replayed `jti`;
- profile upsert completed;
- launch code created/consumed/rejected;
- session created/expired/logged out.

Never log:

- private keys;
- JWTs or authorization headers;
- WordPress nonces;
- launch codes;
- session IDs or cookies;
- email addresses or telephone numbers unless the approved privacy policy
  explicitly permits a separately protected audit field.

Use separate keys, issuers, audiences, and key IDs for development, staging,
and production. During rotation, accept the old and new public keys only for a
bounded overlap window. Keep clocks synchronized. Rate-limit both provisioning
and launch-code exchange. Document key compromise response: disable the
affected `kid`, rotate the WordPress private key, deploy the replacement public
key, and invalidate outstanding launch credentials.

## 11. Implementation milestones

Each milestone is complete only when its implementation, tests, and exit
criteria pass. A later milestone must not compensate for a failed security or
identity boundary in an earlier milestone.

### Milestone 0: Research and contract (**COMPLETE**)

- Review the existing web-site integration research, plugin, simulator, and
  test jigs.
- Choose WordPress as the authentication source.
- Choose asymmetric provisioning JWTs plus opaque one-time launch codes.
- Define the trust boundaries, approved profile fields, generic errors, and
  simulator limitations.

**Exit criteria:** this document is approved as the implementation source of
truth and the local navigation simulator is available.

### Milestone 1: Identity and data contract (**IMPLEMENTED LOCALLY; PRODUCTION APPROVAL PENDING**)

- Confirm the production WordPress URL, Carpool URL, issuer, audience, key IDs,
  and environment-specific configuration.
- Confirm the stable WordPress UID source and approved profile fields.
- Confirm that new WordPress identities start as riders and that Carpool
  administrators own role and active/inactive status changes.
- Add the versioned contract at
  [`wordpress/integration-contract.json`](../wordpress/integration-contract.json).
- Add `source_system`, `source_uid`, and approved WordPress profile fields to
  the Directus migration.
- Namespace existing local/demo users and enforce the unique source identity
  constraint.
- Define retention, profile update, deactivation, and role-change behavior in
  the contract and this document.
- Verify the contract with `pnpm wordpress:contract:test` and verify the live
  Directus migration with `pnpm directus:test`.

**Exit criteria:** the versioned request/response contract and identity data
model are implemented and locally verified. Production completion still
requires approval of the staging/production URLs and key IDs.

### Milestone 2: Carpool provisioning boundary (**IMPLEMENTED LOCALLY; DURABLE STORE AND PRODUCTION APPROVAL PENDING**)

- Implement `POST /api/integration/wordpress/provision`.
- Validate signature, algorithm, `kid`, issuer, audience, subject, time claims,
  profile limits, and replay protection.
- Implement Directus upsert by `(source_system, source_uid)` using a restricted
  server-side client.
- Implement hashed, expiring, single-use launch credentials with atomic
  consumption.
- Add correlation IDs, rate limits, safe responses, and redacted audit logs.

The local implementation is provided by
[`src/routes/api/integration/wordpress/provision/+server.ts`](../src/routes/api/integration/wordpress/provision/+server.ts),
[`src/lib/server/wordpress/provisioning.ts`](../src/lib/server/wordpress/provisioning.ts),
and the constrained `upsertWordPressUser` method in
[`src/lib/server/directus/client.ts`](../src/lib/server/directus/client.ts).
It verifies RS256, `kid`, issuer, audience, time claims, profile limits, and
`jti`; accepts only the `source_system` body field; updates the Directus
identity without changing an existing Carpool role or status; creates new
identities as riders; refuses launch credentials for inactive identities; and
never logs tokens, profile values, or launch codes. The launch credential store hashes codes and
consumes them once, while the replay and rate-limit stores are in-memory for
local development.

The route is disabled unless `WORDPRESS_INTEGRATION_ENABLED=true` and a public
key is configured. The current route supports only the local memory store and
fails closed if `WORDPRESS_PROVISIONING_STORE=external` is selected without an
external adapter. It also fails closed in production while using memory,
because those stores are not durable or shared across application instances.
Before production launch, they must be replaced with a transactional
PostgreSQL/Redis-backed implementation and wired into the route.

Verification is covered by the provisioning and Directus client unit tests,
`pnpm check`, `pnpm lint`, and the passing unit test suite. The live
`pnpm directus:test` check also passes against the Docker PostgreSQL/Directus
services.

**Local exit criteria:** automated tests reject forged, expired, malformed,
wrong-audience, wrong-issuer, replayed, unsupported-field, and
unsupported-algorithm requests. A valid active request creates or updates
exactly one identity and one usable, single-use launch credential; a
deactivated identity is never reactivated by WordPress. **Production exit
criteria remain pending** until the durable credential/replay store and
approved URLs and keys are configured.

### Milestone 3: Carpool session boundary (**IMPLEMENTED LOCALLY; DURABLE STORE AND PRODUCTION APPROVAL PENDING**)

- Implement `GET /launch?code=...`.
- Atomically exchange the code for a `Secure`, `HttpOnly`, `SameSite=Lax`
  Carpool session cookie.
- Remove the code from the address bar with a redirect to the normal app route.
- Add session lookup middleware to protected page loads and API routes.
- Implement logout, idle timeout, absolute timeout, and session invalidation.
- Preserve independent Carpool role and resource authorization checks.

The local defaults are a 30-minute idle timeout and an 8-hour absolute
timeout. The launch credential expires after 60 seconds and is single-use.
Authenticated requests refresh only the idle timeout; they do not extend the
absolute lifetime.

The local implementation is provided by
[`src/routes/launch/+server.ts`](../src/routes/launch/+server.ts),
[`src/lib/server/session.ts`](../src/lib/server/session.ts), and
[`src/routes/api/auth/logout/+server.ts`](../src/routes/api/auth/logout/+server.ts).
The SvelteKit server hook resolves the session into `event.locals`; protected
API handlers and exports use that request identity while retaining the
existing service-layer role checks. Successful launch exchanges the code for a
random opaque session token stored only as a SHA-256 hash, sets an
`HttpOnly`, `SameSite=Lax` cookie, and redirects to the configured local app
destination. Invalid, expired, missing, and replayed codes all redirect to the
same generic guidance. Logout revokes the server-side session and clears the
cookie.

Local sessions use an in-memory store so the Docker development stack can run
without another service. Production rejects insecure cookies and still
requires a durable/shared session and launch-credential store; the current
in-memory stores must not be used across multiple application instances.

Verification is covered by session lifecycle tests, launch exchange tests,
the existing authorization tests, `pnpm check`, `pnpm lint`, and 53 passing
unit tests. **Local exit criteria:** a valid code creates one authenticated
session, idle and absolute timeouts expire it, logout invalidates it, and
protected operations receive no authenticated user without the cookie.
Production completion remains pending the durable store, deployment topology,
approved timeout values, and final CSRF strategy.

### Milestone 4: WordPress production plugin (**IMPLEMENTED LOCALLY; PRODUCTION CONFIGURATION PENDING**)

- Configure the existing menu item to call the nonce-protected launch handler.
- Add WordPress login checks and profile normalization without accepting
  Carpool role or lifecycle status inputs.
- Integrate the maintained PHP JWT library and protected private-key config.
- Implement HTTPS provisioning requests with bounded timeouts and strict
  response validation.
- Provide generic retry-safe errors and correlation IDs.
- Keep the plugin disabled or admin-only until the Carpool boundary is live.

The self-contained plugin is in
[`wordpress/plugin/`](../wordpress/plugin/). It uses the locked
`firebase/php-jwt` dependency, rewrites the existing classic or block-theme
Carpools menu item, checks WordPress login and nonce state, normalizes the
approved profile, sends the request with bounded `wp_remote_post` settings and
TLS verification, validates the Carpool response envelope and code lifetime,
and shows generic retry-safe errors. The plugin is fail-closed unless its
private key and deployment configuration are supplied.

`pnpm wordpress:plugin:test` statically verifies the dependency, auth/nonce
checks, RS256 signing, HTTPS enforcement, response validation, and secret
redaction. **Local exit criteria:** an authenticated plugin launch can be
driven by the simulator; production completion remains pending deployment,
approved URLs/key IDs, and WordPress capability mapping.

### Milestone 5: Simulator and end-to-end verification (**IMPLEMENTED LOCALLY; PRODUCTION E2E PENDING**)

- Keep the lightweight simulator working against the local SvelteKit app.
- Run the research WordPress/PHP simulator and protocol jigs against a
  non-production Carpool integration boundary.
- Test first launch, repeated clicks, refresh, logout, changed profile data,
  expired/replayed codes, key rotation, clock skew, timeout, and rate limits.
- Confirm browser history, referrers, logs, and client bundles contain no
  reusable credentials or unauthorized profile data.
- Add a release check that validates the production configuration cannot use
  the local identity adapter or simulator settings.

The simulator supports both its original navigation-only mode and an explicit
real-integration mode. `pnpm wordpress:integration:test` builds the app,
starts preview plus the simulator, creates a temporary WordPress-source admin
identity in the Docker Directus service, and verifies login, nonce rejection,
provisioning, session exchange, URL cleanup, launch replay rejection, logout,
profile updates, overlapping `kid` key rotation, expired-token rejection, and
client-bundle secret scanning. It removes its temporary identity and key files
on exit. `pnpm wordpress:contract:test` and
`pnpm wordpress:plugin:test` cover the versioned protocol and plugin boundary.

**Local exit criteria:** the simulator/protocol, negative-security, session,
authorization, and client-secret checks pass. Production completion remains
pending the real WordPress deployment and browser/privacy review.

### Milestone 6: Production rollout and operations

- Generate production keys and store them in approved secret/configuration
  systems.
- Deploy public-key validation and session infrastructure before enabling the
  WordPress menu item.
- Perform a smoke test with a dedicated test account.
- Enable the menu item for the intended WordPress audience.
- Monitor provisioning failures, rejected tokens, replay attempts, launch-code
  latency, session failures, and role-mapping errors.
- Document rollback, key compromise, support diagnosis, and data-retention
  procedures.

**Exit criteria:** a production user can complete the full launch flow,
unauthenticated access is denied, role boundaries are enforced, and support can
diagnose failures without requesting tokens or personal data.

## 12. Acceptance scenarios

### Happy path

1. A WordPress user logs in.
2. WordPress renders `Resources / Carpools`.
3. The user activates the menu item.
4. WordPress sends a signed provisioning request.
5. Carpool validates the request and upserts the identity.
6. Carpool returns a short-lived launch code.
7. WordPress redirects to `/launch?code=...`.
8. Carpool consumes the code, creates a session, and redirects to the normal
   application route.
9. Carpool shows only the capabilities allowed for the mapped role.

### Required negative cases

- logged-out WordPress user cannot obtain a launch credential;
- invalid or missing WordPress nonce is rejected;
- forged, expired, wrong-issuer, wrong-audience, wrong-key, or unsupported-
  algorithm JWT is rejected;
- replayed `jti` is rejected;
- duplicate provisioning updates the same identity rather than creating a
  duplicate;
- unknown, expired, malformed, or replayed launch code gives generic guidance;
- direct Carpool access without a session is denied where authentication is
  required;
- a valid session cannot perform operations outside its Carpool role;
- logout invalidates the session;
- WordPress profile refresh does not change a Carpool role or reactivate a
  deactivated user;
- a Carpool administrator can change roles and deactivate/reactivate users;
- a non-administrator cannot access user management;
- credentials and sensitive profile fields are absent from logs and browser
  URLs.

## 13. Decisions pending approval

These choices must be confirmed before Milestone 1 closes:

- the production WordPress issuer URL;
- the stable UID source and whether WordPress numeric IDs are sufficient;
- whether telephone is required for any first-release workflow;
- session store and deployment topology;
- production session idle and absolute timeouts;
- CSRF strategy for the final session cookie;
- key storage, rotation ownership, and incident response contacts;
- whether the production launch destination is the event list or a specific
  event route.
