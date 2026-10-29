# Carpool Production Requirements

This document defines what must be implemented, decided, configured, and
verified before the Carpool application can be released to production.

The application and WordPress simulator are locally implemented, but the
current authentication and session stores are in-memory. A local release-gate
pass is not sufficient for production deployment.

Related documents:

- [Carpool design](./design/design.md)
- [WordPress integration design](./design/wordpress-integration-design.md)
- [WordPress installation guide](./WORDPRESS-INTEGRATION.md)
- [Release verification](./docs/release-verification.md)

## 1. Production release blockers

The following are blockers and must be complete before enabling the WordPress
Carpools menu item for production users:

1. Implement a durable, shared provisioning store.
2. Implement a durable, shared Carpool session store.
3. Finalize and implement CSRF protection for state-changing requests.
4. Approve production URLs, keys, identity claims, timeouts, and privacy
   behavior.
5. Deploy and configure the real WordPress plugin over HTTPS.
6. Complete staging end-to-end testing with production-like infrastructure.
7. Complete operational readiness, monitoring, rollback, and support
   procedures.

The current application intentionally fails closed in production when
`WORDPRESS_PROVISIONING_STORE=memory`. The current `external` provisioning
store option also fails closed because its adapter is not implemented.

## 2. Current local status

The following capabilities are implemented and tested locally:

- normalized Directus/PostgreSQL schema and migrations `001` through `004`;
- complete demo carpool data;
- event, trip, vehicle, rider, and transportation workflows;
- server-side admin and driver authorization;
- WordPress identity upsert by `(source_system, source_uid)`;
- new WordPress users defaulting to `role = rider`;
- Carpool-owned role and active/inactive status changes;
- deactivation invalidating active local sessions;
- RS256 JWT validation, claim validation, replay checks, and rate limiting;
- short-lived, single-use launch codes;
- Carpool session idle and absolute timeout behavior;
- local WordPress plugin and Node simulator;
- local browser, unit, Directus, plugin, and integration verification.

These local implementations must be retained as test coverage when production
adapters are introduced.

## 3. Identity and trust requirements

WordPress remains authoritative for authentication and the approved profile
fields. Carpool remains authoritative for application roles and lifecycle
status.

### WordPress may provide

- stable numeric WordPress user ID as `sub`;
- first name;
- last name;
- validated email;
- optional telephone when an approved workflow requires it.

### WordPress may not provide

- Carpool role;
- Carpool active/inactive status;
- Directus credentials;
- a reusable Carpool session token;
- an arbitrary user identity supplied through a URL or browser form.

### Carpool rules

- New WordPress identities are created as active riders.
- Existing Carpool role and status values are preserved during profile refresh.
- Carpool administrators can promote, demote, deactivate, and reactivate users.
- WordPress cannot reactivate a deactivated Carpool user.
- Inactive users cannot obtain a Carpool launch session.
- Unauthenticated users must not receive or see event data.
- Authorization is enforced server-side regardless of UI visibility.

## 4. Durable storage requirements

### 4.1 WordPress provisioning stores

Implement a production adapter for a transactional PostgreSQL, Redis, or
equivalent service. It must support:

- atomic `jti` replay reservation with expiration;
- atomic launch-code creation and single-use consumption;
- hashed storage of launch codes and replay identifiers;
- expiration cleanup without unbounded growth;
- shared visibility across all Carpool application instances;
- safe behavior during connection failures;
- metrics for rejected replays, expired credentials, and storage failures.

The provisioning endpoint must not issue a launch code unless the identity
upsert and credential reservation succeed according to the approved transaction
boundary.

### 4.2 Carpool session store

Implement a durable/shared session store supporting:

- opaque random session tokens;
- SHA-256 or stronger one-way token storage;
- lookup and idle-time refresh;
- absolute expiration;
- explicit revocation on logout;
- invalidation by user ID on deactivation;
- role/status refresh or safe session invalidation after admin changes;
- concurrent access from multiple application instances;
- cleanup of expired records;
- operational metrics and failure handling.

The browser cookie must contain only the opaque session token. It must not
contain a JWT, Directus token, role authority, or profile data.

### 4.3 Store configuration

Production configuration must reject:

- in-memory provisioning stores;
- in-memory sessions;
- insecure cookies;
- missing key configuration;
- simulator integration settings;
- local identity adapter settings.

Required production values include:

```env
NODE_ENV=production
WORDPRESS_INTEGRATION_ENABLED=true
WORDPRESS_PROVISIONING_STORE=external
WORDPRESS_PUBLIC_KEY_PATH=/run/secrets/wordpress-public.pem
WORDPRESS_KEY_ID=wordpress-production-2026-01
CARPOOL_SESSION_SECURE=true
```

The exact external-store variables depend on the selected adapter and must be
documented with secret-management instructions.

## 5. Security requirements

### Transport and browser security

- Use HTTPS for WordPress, Carpool, and the provisioning endpoint.
- Keep TLS certificate validation enabled for WordPress outbound requests.
- Set the Carpool cookie to `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`.
- Do not place credentials or profile data in browser URLs.
- Remove the launch code from the address bar immediately after exchange.
- Set `Cache-Control: no-store` on provisioning, launch, session-sensitive,
  and authenticated data responses as appropriate.
- Apply a production Content Security Policy and other approved security
  headers at the deployment boundary.

### JWT and launch protocol

Carpool must validate:

- `RS256` or another explicitly approved asymmetric algorithm;
- `kid` against an allowlisted public-key set;
- exact issuer and audience;
- `sub` type and length;
- `iat`, `nbf`, and `exp` with approved clock skew;
- unique, unconsumed `jti`;
- required profile fields and field-size limits;
- request body size and content type.

The provisioning JWT and launch code should remain valid for approximately 60
seconds. Launch codes must be opaque, hashed at rest, single-use, and consumed
atomically.

### CSRF

Finalize the CSRF strategy before production:

- identify every state-changing browser route and API operation;
- choose synchronizer tokens, signed double-submit tokens, or an equivalent
  approved strategy;
- validate `Origin`/`Referer` where appropriate;
- ensure WordPress launch and Carpool logout semantics are not weakened;
- add positive and negative CSRF tests for browser and API requests;
- document the strategy for future deployments and support staff.

### Logging and privacy

Logs may contain correlation IDs, event names, status codes, and non-sensitive
failure reasons. Logs must not contain:

- JWTs or authorization headers;
- launch codes or session tokens;
- private keys or Directus tokens;
- email addresses, telephone numbers, or unnecessary profile fields;
- WordPress nonces.

Define retention and access rules for profile data, operational logs, and audit
records. Confirm whether telephone is required for the first production
workflow; otherwise do not retain it.

## 6. Production infrastructure requirements

- Run the Carpool application behind a production HTTPS reverse proxy.
- Run Directus and PostgreSQL with backups, health checks, and tested restore
  procedures.
- Use a restricted Directus token only on the server.
- Keep WordPress and Carpool clocks synchronized.
- Define application instance count and session-store topology.
- Configure health/readiness checks for Carpool, Directus, PostgreSQL, and the
  external provisioning/session stores.
- Configure alerting for provisioning failures, replay attempts, launch-code
  latency, session-store failures, Directus failures, and authorization errors.
- Protect secrets with the deployment secret manager.
- Separate development, staging, and production keys, URLs, audiences, and
  key IDs.
- Define rollback and key-compromise procedures before enabling the integration.

## 7. WordPress deployment requirements

Build and deploy the plugin using the instructions in
[`WORDPRESS-INTEGRATION.md`](./WORDPRESS-INTEGRATION.md):

```sh
cd wordpress/plugin
composer install --no-dev --prefer-dist --optimize-autoloader
```

The deployed plugin must include `vendor/`. Store the RSA private key outside
the plugin directory and web root. Configure the plugin with a site-specific
mu-plugin or equivalent trusted configuration:

```php
add_filter('ligerbots_carpool_config', static function (array $config): array {
    $config['provisioning_url'] = 'https://carpool.example.org/api/integration/wordpress/provision';
    $config['launch_url'] = 'https://carpool.example.org/launch';
    $config['issuer'] = 'https://www.ligerbots.org';
    $config['audience'] = 'carpool-provisioning';
    $config['key_id'] = 'wordpress-production-2026-01';
    return $config;
});
```

Before activation:

- verify the existing `Resources / Carpools` menu item;
- verify logged-out users cannot launch;
- verify required WordPress profile fields;
- verify the WordPress server can reach the provisioning URL;
- verify the user browser can reach the launch URL;
- verify PHP, Composer dependency, OpenSSL, and TLS requirements.

## 8. Key management and rotation

For each environment:

1. Generate a new RSA key pair.
2. Store the private key in the WordPress secret manager or protected file.
3. Store the public key in the Carpool secret manager.
4. Configure a unique key ID.
5. Verify a launch before enabling users.

For rotation:

1. Add the new public key to Carpool while retaining the old key.
2. Deploy the new private key and key ID to WordPress.
3. Verify new launches.
4. Wait for the JWT lifetime plus clock-skew allowance.
5. Remove the old public key.

Document key ownership, rotation approval, emergency revocation, and
compromise response.

## 9. Data and Directus requirements

Before production deployment:

- apply and verify migrations `001` through `004`;
- confirm PostgreSQL constraints and unique source identity indexes;
- confirm the Directus API token can access only the carpool collections and
  approved user fields;
- confirm CMS collections and user writes are rejected by the server boundary;
- confirm production data backups and restore tests;
- confirm Directus WYSIWYG/editor configuration does not block required event
  descriptions;
- confirm initial administrators and ownership of role changes.

The Directus token must never be sent to WordPress or browser code.

## 10. Implementation milestones

Each milestone is complete only when its implementation, tests, and exit
criteria pass. Milestones may be implemented in parallel only when their
dependencies are preserved.

### Milestone 1: Approve the production contract

Tasks:

- approve the production WordPress origin;
- approve the Carpool origin and launch destination;
- approve issuer, audience, key IDs, and profile fields;
- approve the stable WordPress UID source;
- approve telephone retention and privacy requirements;
- approve production session idle and absolute timeouts;
- approve CSRF strategy;
- approve key ownership, rotation, and incident contacts;
- approve session and provisioning store topology.

Exit criteria:

- decisions are recorded in the integration contract;
- staging and production environment variable manifests are reviewed;
- no unresolved identity or privacy decision remains.

### Milestone 2: Implement durable provisioning storage

Tasks:

- define the adapter interface for replay, launch credentials, and rate limits;
- implement the PostgreSQL/Redis adapter;
- hash replay identifiers and launch codes;
- enforce atomic replay reservation;
- enforce atomic single-use launch-code consumption;
- add expiration cleanup and metrics;
- handle store outages without issuing credentials;
- add multi-instance and restart tests;
- remove the production fail-closed limitation only after the adapter is
  verified.

Exit criteria:

- two application instances share replay and launch-code state;
- a restart does not permit replay or destroy valid state unexpectedly;
- concurrent provisioning cannot issue conflicting reusable credentials;
- production configuration accepts only the durable adapter.

### Milestone 3: Implement durable Carpool sessions

Tasks:

- implement the durable/shared `SessionStore`;
- preserve opaque-token hashing;
- preserve idle and absolute expiration;
- support logout, user deactivation, and role/status invalidation;
- add cleanup and store-health metrics;
- test simultaneous requests and multiple application instances;
- verify secure cookie behavior behind the production proxy.

Exit criteria:

- sessions survive an application restart according to policy;
- sessions are available consistently across instances;
- deactivation revokes sessions promptly;
- expired and revoked sessions cannot access pages or APIs;
- production no longer depends on `MemorySessionStore`.

### Milestone 4: Complete CSRF and browser security

Tasks:

- implement the approved CSRF mechanism;
- protect all state-changing Carpool routes;
- validate origin/referrer policy where required;
- add browser and server negative tests;
- configure production security headers and Content Security Policy;
- test launch, logout, forms, fetch mutations, and cross-site requests.

Exit criteria:

- forged state-changing requests are rejected;
- valid application requests continue to work with progressive enhancement;
- security headers and cookie attributes are verified in staging.

### Milestone 5: Deploy staging infrastructure

Tasks:

- provision staging Carpool, Directus, PostgreSQL, and durable stores;
- configure staging secrets and separate RSA keys;
- apply migrations and least-privilege Directus permissions;
- deploy the built WordPress plugin to staging WordPress;
- configure the existing Carpools menu item;
- configure HTTPS, reverse proxy, health checks, backups, and monitoring;
- confirm staging logs are redacted.

Exit criteria:

- a real staging WordPress user can complete the full launch flow;
- staging has no simulator or local identity configuration enabled;
- restart and multi-instance tests pass;
- backups and restores are demonstrated.

### Milestone 6: Run staging end-to-end verification

Tasks:

- run `pnpm release:verify` against the approved staging configuration;
- test first launch, refresh, logout, and return-to-WordPress navigation;
- test new identity provisioning and profile refresh;
- test role preservation after profile refresh;
- test admin role changes and user deactivation;
- test expired and replayed JWTs and launch codes;
- test invalid nonce, issuer, audience, key, and signature;
- test key rotation with overlapping key IDs;
- test session idle and absolute expiration;
- test unauthenticated access to pages and APIs;
- test Directus outage, store outage, WordPress timeout, and retry behavior;
- perform browser, privacy, accessibility, and mobile checks.

Exit criteria:

- every production acceptance scenario passes in staging;
- no high-severity security, authorization, privacy, or data-integrity issue
  remains;
- the release report is archived with the deployment version.

### Milestone 7: Production rollout and operations

Tasks:

- generate and install production keys;
- deploy durable stores and production configuration;
- deploy the WordPress plugin and configuration;
- run a smoke test with a dedicated production test account;
- enable the Carpools menu item for the intended audience;
- monitor the first launches and authorization decisions;
- document rollback, support diagnosis, and key compromise response;
- schedule post-release review and restore test.

Exit criteria:

- a production user completes the full launch flow;
- unauthenticated access does not expose event data;
- role and resource boundaries are enforced;
- operators can identify and recover from provisioning, session, and Directus
  failures without requesting user credentials or tokens.

## 11. Production acceptance checklist

### Application and storage

- [ ] Durable provisioning replay store implemented and tested.
- [ ] Durable launch-code store implemented and tested.
- [ ] Shared rate limiter implemented and tested.
- [ ] Durable/shared Carpool session store implemented and tested.
- [ ] CSRF protection implemented and tested.
- [ ] Production configuration rejects memory stores and local identity mode.

### Identity and security

- [ ] Production issuer, audience, URLs, and key IDs approved.
- [ ] Production RSA private key stored outside the web root.
- [ ] Matching public key configured on Carpool.
- [ ] Key rotation and emergency revocation procedure documented.
- [ ] HTTPS and TLS verification enabled.
- [ ] Secure, HttpOnly, SameSite session cookie verified.
- [ ] JWTs, launch codes, tokens, and profile data absent from logs and URLs.
- [ ] Origin/CSRF strategy verified in staging.

### WordPress and Directus

- [ ] Plugin built with production Composer dependencies.
- [ ] Plugin installed and activated on the intended WordPress instance.
- [ ] Existing Carpools menu item configured.
- [ ] WordPress profile requirements verified.
- [ ] Directus migrations `001` through `004` applied.
- [ ] Directus token is restricted and server-only.
- [ ] Backups and restore procedure tested.

### Verification and operations

- [ ] Staging end-to-end flow passes.
- [ ] `pnpm release:verify` passes against the release candidate.
- [ ] Multi-instance and restart tests pass.
- [ ] Monitoring and alerting are active.
- [ ] Support and rollback runbooks are available.
- [ ] Dedicated production smoke-test account is ready.
- [ ] Production launch is approved by application, WordPress, and operations
      owners.
