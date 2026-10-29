# LigerBots Carpool App Installation

This guide installs the local development stack:

- the SvelteKit Carpool application;
- PostgreSQL;
- Directus;
- the local WordPress authentication simulator.

The commands below assume macOS or Linux and that they are run from the
repository root.

## 1. Prerequisites

Install the following tools:

- Node.js 20 or newer;
- pnpm;
- Docker Desktop with Docker Compose;
- OpenSSL.

Verify the tools:

```sh
node --version
pnpm --version
docker --version
docker compose version
openssl version
```

Clone the repository and enter it:

```sh
git clone <repository-url>
cd carpool-app
```

## 2. Install JavaScript dependencies

Install the locked dependency versions:

```sh
pnpm install
```

## 3. Create the local environment file

Copy the environment template:

```sh
cp .env.example .env
```

The `.env` file is local configuration and must not be committed. At
minimum, review these values:

```env
POSTGRES_DB=carpool
POSTGRES_USER=directus
POSTGRES_PASSWORD=choose-a-local-password

DIRECTUS_ADMIN_EMAIL=admin@example.com
DIRECTUS_ADMIN_PASSWORD=choose-a-local-admin-password
DIRECTUS_URL=http://localhost:8055
DIRECTUS_TOKEN=

WORDPRESS_INTEGRATION_ENABLED=true
WORDPRESS_PUBLIC_KEY_PATH=.local/wordpress/carpool-wordpress-public.pem
WORDPRESS_PROVISIONING_STORE=memory
CARPOOL_SESSION_SECURE=false
```

The PostgreSQL values must match the values used by Directus. `DIRECTUS_TOKEN`
is used only by the server-side SvelteKit application; it is not exposed to
the browser.

For simulator-only UI work, WordPress integration can remain disabled. To
exercise the complete authenticated handoff, configure the WordPress
integration in section 7.

## 4. Start PostgreSQL and Directus

Start the containers in the background:

```sh
pnpm docker:up
```

This starts:

- PostgreSQL 16 on the private Docker Compose network;
- Directus on <http://localhost:8055>;
- persistent named volumes for PostgreSQL data and Directus uploads.

Check the containers:

```sh
docker compose ps
```

Wait until the services are healthy, then check Directus:

```sh
curl http://localhost:8055/server/health
```

The initial Directus administrator is created from
`DIRECTUS_ADMIN_EMAIL` and `DIRECTUS_ADMIN_PASSWORD` the first time the
database is initialized. Changing those values later does not change an
existing administrator.

## 5. Apply the database and Directus schema

Run the migrations and seed data:

```sh
pnpm directus:migrate
```

The migration command:

- creates the carpool collections and fields in Directus;
- applies the PostgreSQL schema and constraints;
- adds the WordPress identity fields;
- creates the demo carpool data.

Verify the setup:

```sh
pnpm directus:test
```

The additional live workflow checks can be run after the application is
started:

```sh
pnpm directus:test:m3
pnpm directus:test:m4
pnpm directus:test:m5
```

The migrations are designed to be safe to rerun against the local volumes.

## 6. Create a Directus API token

The application needs a Directus static token for server-side API requests.

1. Open <http://localhost:8055>.
2. Sign in with `DIRECTUS_ADMIN_EMAIL` and `DIRECTUS_ADMIN_PASSWORD`.
3. Open **User Directory** and select the administrator account.
4. Create a static token in the account's token field.
5. Copy the token into `.env`:

   ```env
   DIRECTUS_TOKEN=<local-directus-static-token>
   ```

6. Restart the SvelteKit development server after changing `.env`.

Do not put this token in browser code or commit it to the repository.

## 7. Configure the WordPress simulator

The simulator supports two modes:

- navigation-only mode, which tests the logged-in WordPress navigation but
  does not authenticate the Carpool app;
- integration mode, which performs the complete signed provisioning and
  launch-code handoff.

Use integration mode for a complete local installation.

### 7.1 Generate a local RSA key pair

Create a development-only key pair:

```sh
umask 077
mkdir -p .local/wordpress

openssl genpkey \
  -algorithm RSA \
  -pkeyopt rsa_keygen_bits:2048 \
  -out .local/wordpress/carpool-wordpress-private.pem

openssl pkey \
  -in .local/wordpress/carpool-wordpress-private.pem \
  -pubout \
  -out .local/wordpress/carpool-wordpress-public.pem

chmod 600 .local/wordpress/carpool-wordpress-private.pem
chmod 644 .local/wordpress/carpool-wordpress-public.pem
```

The private key is used only by the simulator. The Carpool server uses the
matching public key.

### 7.2 Set integration values in `.env`

Set or update these values:

```env
WORDPRESS_INTEGRATION_ENABLED=true
WORDPRESS_ISSUER=https://www.ligerbots.org
WORDPRESS_AUDIENCE=carpool-provisioning
WORDPRESS_KEY_ID=wordpress-development
WORDPRESS_PUBLIC_KEY_PATH=.local/wordpress/carpool-wordpress-public.pem
WORDPRESS_PROVISIONING_STORE=memory
WORDPRESS_LAUNCH_PATH=/launch
WORDPRESS_LAUNCH_DESTINATION=/

WORDPRESS_SIMULATOR_INTEGRATION_ENABLED=true
WORDPRESS_SIMULATOR_ISSUER=https://www.ligerbots.org
WORDPRESS_SIMULATOR_AUDIENCE=carpool-provisioning
WORDPRESS_SIMULATOR_KEY_ID=wordpress-development
WORDPRESS_SIMULATOR_PRIVATE_KEY_PATH=.local/wordpress/carpool-wordpress-private.pem
WORDPRESS_SIMULATOR_PROVISIONING_URL=http://localhost:5173/api/integration/wordpress/provision
WORDPRESS_SIMULATOR_LAUNCH_URL=http://localhost:5173/launch
WORDPRESS_SIMULATOR_CARPOOL_URL=http://localhost:5173/
WORDPRESS_SIMULATOR_URL=http://localhost:8080/
```

The issuer, audience, and key ID must match on both the Carpool and simulator
sides.

## 8. Start the Carpool application

Start the SvelteKit development server:

```sh
pnpm dev
```

Open the application at <http://localhost:5173>.

The development server loads `.env` automatically. Restart it after changing
environment variables.

## 9. Start and use the WordPress simulator

The recommended command starts both the Carpool application and simulator with
`.env` loaded:

```sh
./scripts/run-dev-simulator.sh
```

If `pnpm dev` is already running, start only the simulator in a separate
terminal with:

```sh
node --env-file=.env wordpress/simulator/server.mjs
```

Do not use `pnpm wordpress:simulator` for the integration flow unless all
required variables have already been exported into the shell. That script does
not load `.env`.

Then:

1. Open <http://localhost:8080>.
2. Choose a demo user and select **Log in**.
3. Select **Resources / Carpools**.
4. Confirm the browser reaches <http://localhost:5173/> without a `code`
   query parameter.
5. Confirm the Carpool navigation shows the selected user and **Back to
   simulator**.
6. Open <http://localhost:5173/> directly in a private browser window to
   confirm that an unauthenticated user sees the sign-in notice.

The simulator's WordPress cookie and the Carpool session cookie are separate.
Authentication is transferred through a signed server-to-server provisioning
request and a one-time launch code; the WordPress cookie is not shared with
the Carpool application.

## 10. Useful commands

Run formatting, linting, type checks, and unit tests:

```sh
pnpm check
pnpm lint
pnpm test:unit -- --run
```

Stop the application with `Ctrl+C`, then stop the containers:

```sh
pnpm docker:down
```

To remove the containers and all local database/upload volumes:

```sh
pnpm docker:clear
```

`docker:clear` permanently deletes the local PostgreSQL and Directus data.

## 11. Troubleshooting

### Directus is unavailable

Check container status and logs:

```sh
docker compose ps
docker compose logs directus
docker compose logs postgres
```

Confirm that <http://localhost:8055/server/health> responds before running
`pnpm directus:migrate`.

### Migrations fail to log in to Directus

Confirm that these values in `.env` match the initialized Directus instance:

```env
DIRECTUS_URL
DIRECTUS_ADMIN_EMAIL
DIRECTUS_ADMIN_PASSWORD
```

If the database was initialized with different administrator credentials,
either use those credentials or intentionally remove the local volumes with
`pnpm docker:clear` and initialize the stack again.

### The simulator opens Carpool but the user is not authenticated

This usually means the simulator was started without `.env`. Check that its
process was started with:

```sh
node --env-file=.env wordpress/simulator/server.mjs
```

Also verify:

- `WORDPRESS_SIMULATOR_INTEGRATION_ENABLED=true`;
- `WORDPRESS_INTEGRATION_ENABLED=true`;
- the simulator private key matches the Carpool public key;
- `WORDPRESS_SIMULATOR_KEY_ID` matches `WORDPRESS_KEY_ID`;
- the simulator provisioning URL points to port `5173`.

### The launch URL reports an invalid launch

Launch codes are single-use and expire quickly. Return to the simulator and
start the flow again. Also confirm that the Carpool server has not been
restarted between provisioning and launch when using the in-memory local
stores.

### Directus reports permission errors

Create or update the server-side static token in Directus and set it as
`DIRECTUS_TOKEN` in `.env`. Restart `pnpm dev` after changing it.
