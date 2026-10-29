# Ligerbots Carpool App

The Ligerbots Carpool App is a SvelteKit application for organizing
transportation to team events. It is being rebuilt from the legacy application
in [`../ligerbots-carpool-app`](../ligerbots-carpool-app).

The target application is intentionally limited to carpool workflows. It does
not include the legacy website CMS, blog, announcements, directory, login
pages, or unrelated WordPress functionality.

## Project status

The repository currently contains:

- a SvelteKit 5 and TypeScript application scaffold;
- Prettier, ESLint, Vitest, and Playwright configuration;
- a local Directus and PostgreSQL development stack;
- the target application design and migration requirements in
  [`design/design.md`](./design/design.md).
- the WordPress authentication and integration design in
  [`design/wordpress-integration-design.md`](./design/wordpress-integration-design.md);
- the WordPress plugin installation and operations guide in
  [`WORDPRESS-INTEGRATION.md`](./WORDPRESS-INTEGRATION.md);
- a local WordPress-like navigation simulator for testing the handoff to the
  Carpool app.

The carpool domain routes, Directus schema, application services, and
transportation workflow are the next implementation milestones. The design
document is the source of truth for the planned routes, roles, data model,
business rules, and acceptance criteria.

## Scope

The planned application supports:

- published carpool event discovery;
- outbound and return transportation options;
- one ride or explicit opt-out per direction;
- vehicle, trip, assignment, and rider administration;
- scoped driver tools;
- event-scoped printable and CSV rider lists;
- Directus-backed persistence.

The planned roles are `rider`, `driver`, and `admin`. Authentication is
deferred, but the application will use an explicit identity-provider boundary
and will enforce authorization on the server.

The production WordPress authentication strategy is documented in
[`design/wordpress-integration-design.md`](./design/wordpress-integration-design.md). For a
local navigation-only simulation, run the Carpool app and then start:

```sh
pnpm wordpress:simulator
```

Open <http://localhost:8080>, choose a demo user, and select **Resources /
Carpools**. The simulator does not establish production authentication; it
only exercises the logged-in WordPress navigation and nonce-protected handoff.

## Requirements

- Node.js compatible with the project toolchain
- pnpm
- Docker Desktop or another Docker Compose implementation

Install dependencies from the repository root:

```sh
pnpm install
```

## Local environment

Create the local environment file from the template:

```sh
cp .env.example .env
```

The repository includes a local `.env` for development. It is ignored by Git
and must never be committed. Replace its credentials before using any shared
or non-local environment.

Important variables include:

| Variable                  | Purpose                                           |
| ------------------------- | ------------------------------------------------- |
| `DIRECTUS_URL`            | URL used by the SvelteKit server to call Directus |
| `DIRECTUS_TOKEN`          | Optional server-side Directus API token           |
| `DIRECTUS_ADMIN_EMAIL`    | Initial local Directus administrator email        |
| `DIRECTUS_ADMIN_PASSWORD` | Initial local Directus administrator password     |
| `DIRECTUS_KEY`            | Directus encryption key                           |
| `DIRECTUS_SECRET`         | Directus signing and encryption secret            |
| `POSTGRES_DB`             | PostgreSQL database name                          |
| `POSTGRES_USER`           | PostgreSQL username                               |
| `POSTGRES_PASSWORD`       | PostgreSQL password                               |

`DIRECTUS_TOKEN` is not used by Docker Compose. It is consumed only by the
SvelteKit server-side Directus repository client and must never be exposed
through browser code.

Before opening the app in Chrome, start Directus/PostgreSQL, apply the schema,
and set a local Directus API token in `.env`:

```sh
pnpm docker:up
pnpm directus:migrate
```

Create a Directus static token for the local server in the Directus admin UI at
<http://localhost:8055>, then set `DIRECTUS_TOKEN=<token>` in `.env`. The dev
and preview scripts load `.env` automatically. Restart `pnpm dev` after editing
the file, then open <http://localhost:5173>.

## Local Directus and PostgreSQL

Start both containers:

```sh
docker compose up -d
```

This starts:

- PostgreSQL 16 on the private Compose network;
- Directus connected to PostgreSQL by the `postgres` service name;
- Directus on <http://localhost:8055>;
- persistent named volumes for PostgreSQL data, Directus uploads, and
  extensions.

Check service status:

```sh
docker compose ps
```

Check Directus health:

```sh
curl http://localhost:8055/server/health
```

Apply and verify the normalized carpool schema against the running containers:

```sh
pnpm directus:migrate
pnpm directus:test
pnpm directus:test:m3
pnpm directus:test:m4
pnpm directus:test:m5
pnpm release:verify
```

The migrations are safe to rerun. They provision the eight carpool collections,
their relations, PostgreSQL checks, uniqueness constraints, and a complete
development carpool without resetting the local volumes. Migration 002 creates
the `Demo Admin`, `Demo Driver`, and `Demo Rider` users, a published `Demo
Carpool` event, outbound and return trips, a shared `Demo Van`, both trip rides,
rider assignments, and persisted rider decisions. The Milestone 3 test also exercises the live
SvelteKit transportation route and mounted Directus atomic endpoint with
temporary fixtures, then removes those fixtures. The Milestone 4 test verifies
live admin and driver authorization, CRUD, assignment, rider, and cleanup
workflows using temporary fixtures.
Migration 003 adds the WordPress source identity key and approved profile
columns while preserving local/demo users in the `local` namespace. Validate
the versioned WordPress contract with `pnpm wordpress:contract:test`.
The Milestone 5 test verifies admin-only event-scoped CSV and print output,
restricted-field redaction, no-store responses, and that the server Directus
token is absent from browser build output. The constrained Directus client
rejects CMS collections, restricted user fields, and all user writes before
making a backend request.

Run the complete release gate with `pnpm release:verify`. It records the
individual check results in `.release-verification/last-run.json`; the checked-
in scenario matrix is in [`docs/release-verification.md`](./docs/release-verification.md).

The local Directus administrator credentials are the values in `.env`, not
the values in source control. Directus reads the initial administrator
settings only when the database is first initialized.

Stop the containers while preserving local data:

```sh
docker compose down
```

Reset the disposable local database and Directus files:

```sh
docker compose down -v
docker compose up -d
```

Use `down -v` only when deleting local development data is acceptable.

## Development commands

Start the SvelteKit development server:

```sh
pnpm dev
```

Run type checking and Svelte diagnostics:

```sh
pnpm check
```

Run formatting and lint checks:

```sh
pnpm lint
```

Format source files:

```sh
pnpm format
```

Build the production application:

```sh
pnpm build
```

Run unit and component tests:

```sh
pnpm test:unit -- --run
```

Install the Playwright browser used by browser tests when needed:

```sh
pnpm exec playwright install chromium
```

Run end-to-end tests:

```sh
pnpm test:e2e
```

## Planned architecture

The application will use the following server-side boundary:

```text
Svelte pages and components
        |
SvelteKit load functions, form actions, and API routes
        |
Carpool application services
        |
Constrained Directus repository
        |
Directus / PostgreSQL
```

Directus access belongs in server-only modules. Components should consume
typed DTOs and must not contain Directus credentials or unrestricted backend
queries.

The normalized Directus collections are planned to be:

- `events`
- `outbound_trips`
- `return_trips`
- `vehicles`
- `trip_rides`
- `trip_ride_riders`
- `transportation_decisions`
- minimal externally owned `users`

## Design and reference implementation

- [Project design](./design/design.md)
- [Legacy reference repository](../ligerbots-carpool-app)

The reference implementation provides behavioral evidence only. New code
should follow the normalized model and security boundaries described in
`design/design.md`, rather than copying the legacy CMS shell or authentication
implementation.
