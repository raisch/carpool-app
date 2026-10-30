# Run the Carpool App on Windows

This guide covers running the local Carpool stack on Windows 12 using
PowerShell, Docker Desktop, Node.js, pnpm, and the WordPress simulator.

Complete the initial installation and configuration in
[INSTALL.md](./INSTALL.md) first. This guide assumes that the repository,
dependencies, `.env`, Directus schema, and WordPress simulator keys have
already been configured.

## 1. Prerequisites

Install and start:

- Docker Desktop for Windows with the WSL 2 backend enabled;
- Node.js 20 or newer;
- pnpm;
- Git for Windows.

Open **PowerShell** and verify the tools:

```powershell
node --version
pnpm --version
docker --version
docker compose version
```

Node.js 20 or newer is required when running the simulator directly with
`node --env-file`. Node.js 18.19 and earlier do not support that option.

If pnpm is not installed:

```powershell
corepack enable
corepack prepare pnpm@latest --activate
```

## 2. Run from Windows Terminal

Windows Terminal normally opens a PowerShell tab, so the commands in this
guide can be pasted directly into Windows Terminal. Use three tabs and keep
each long-running command open.

Replace the project path once in each tab:

```powershell
Set-Location C:\path\to\carpool-app
```

### Tab 1: Docker Compose

Start Docker Desktop first, then run:

```powershell
Set-Location C:\path\to\carpool-app
pnpm docker:up
docker compose ps
```

Apply the schema on a new installation:

```powershell
pnpm directus:migrate
pnpm directus:test
```

### Tab 2: Carpool app

```powershell
Set-Location C:\path\to\carpool-app
pnpm dev
```

Leave this tab open while using the app.

### Tab 3: WordPress simulator

```powershell
Set-Location C:\path\to\carpool-app
node --env-file=.env wordpress/simulator/server.mjs
```

Leave this tab open while testing the WordPress-to-Carpool handoff.

### Optional: open tabs from an existing Windows Terminal tab

After setting the correct repository path, Windows Terminal can open the
three tabs with `wt.exe`:

```powershell
$project = 'C:\path\to\carpool-app'
wt.exe `
  new-tab --title 'Carpool Docker' powershell -NoExit -Command "Set-Location '$project'; pnpm docker:up" `
  `; new-tab --title 'Carpool App' powershell -NoExit -Command "Set-Location '$project'; pnpm dev" `
  `; new-tab --title 'WordPress Simulator' powershell -NoExit -Command "Set-Location '$project'; node --env-file=.env wordpress/simulator/server.mjs"
```

The `wt.exe` command starts all three processes at once. Run migrations
separately after Directus has finished starting:

```powershell
Set-Location C:\path\to\carpool-app
pnpm directus:migrate
pnpm directus:test
```

## 3. Open the project

Clone the repository if necessary:

```powershell
git clone <repository-url>
Set-Location carpool-app
```

If the repository is already cloned, change to its directory:

```powershell
Set-Location C:\path\to\carpool-app
```

Install dependencies:

```powershell
pnpm install
```

## 4. Configure `.env`

If `.env` does not exist, create it from the template:

```powershell
Copy-Item .env.example .env
```

Open it in Notepad:

```powershell
notepad .env
```

For the local authenticated simulator flow, confirm these values:

```env
DIRECTUS_URL=http://localhost:8055
DIRECTUS_TOKEN=<directus-static-token>

WORDPRESS_INTEGRATION_ENABLED=true
WORDPRESS_PUBLIC_KEY_PATH=.local/wordpress/carpool-wordpress-public.pem
WORDPRESS_PROVISIONING_STORE=memory
CARPOOL_SESSION_SECURE=false

WORDPRESS_SIMULATOR_INTEGRATION_ENABLED=true
WORDPRESS_SIMULATOR_PRIVATE_KEY_PATH=.local/wordpress/carpool-wordpress-private.pem
WORDPRESS_SIMULATOR_PROVISIONING_URL=http://localhost:5173/api/integration/wordpress/provision
WORDPRESS_SIMULATOR_LAUNCH_URL=http://localhost:5173/launch
WORDPRESS_SIMULATOR_CARPOOL_URL=http://localhost:5173/
WORDPRESS_SIMULATOR_URL=http://localhost:8080/
```

Use Windows paths only if the key files are stored outside the repository.
For example:

```env
WORDPRESS_PUBLIC_KEY_PATH=C:\Users\you\carpool-app\.local\wordpress\carpool-wordpress-public.pem
WORDPRESS_SIMULATOR_PRIVATE_KEY_PATH=C:\Users\you\carpool-app\.local\wordpress\carpool-wordpress-private.pem
```

Forward slashes also work in Node.js configuration values:

```env
WORDPRESS_PUBLIC_KEY_PATH=C:/Users/you/carpool-app/.local/wordpress/carpool-wordpress-public.pem
```

Do not commit `.env`, the Directus token, or the simulator private key.

## 5. Start Docker Compose

Start Docker Desktop and wait until it reports that the Docker engine is
running. From the repository directory, run:

```powershell
pnpm docker:up
```

This starts PostgreSQL and Directus in the background. Check their status:

```powershell
docker compose ps
```

Check Directus:

```powershell
Invoke-WebRequest http://localhost:8055/server/health
```

The Directus admin UI is available at:

<http://localhost:8055>

If this is a new installation, apply the schema:

```powershell
pnpm directus:migrate
pnpm directus:test
```

If `DIRECTUS_TOKEN` is empty, sign in to Directus, create a static token for
the application server, and add it to `.env`. Restart the Carpool app after
changing `.env`.

## 6. Start the Carpool app

Open a new PowerShell window and change to the project directory:

```powershell
Set-Location C:\path\to\carpool-app
```

Start SvelteKit:

```powershell
pnpm dev
```

Keep this window open. The app is available at:

<http://localhost:5173>

The `pnpm dev` script loads `.env` automatically.

## 7. Start the WordPress simulator

Open another PowerShell window and change to the project directory:

```powershell
Set-Location C:\path\to\carpool-app
```

With Node.js 20 or newer, start the simulator with:

```powershell
node --env-file=.env wordpress/simulator/server.mjs
```

The simulator is available at:

<http://localhost:8080>

The `pnpm wordpress:simulator` script does not load `.env` in the current
repository version. If you use that command, export the required variables
into the PowerShell session first, or use the `node --env-file=.env` command
above.

## 8. Test the authenticated flow

1. Open <http://localhost:8080>.
2. Select a demo user.
3. Click **Log in**.
4. Click **Resources / Carpools**.
5. Confirm that the browser reaches <http://localhost:5173/>.
6. Confirm that the Carpool app displays the selected identity.
7. Confirm that **Back to simulator** returns to
   <http://localhost:8080/>.

The WordPress and Carpool cookies are intentionally separate because the
services use different origins. The simulator transfers authentication through
a signed server-to-server provisioning request and a one-time launch code.

## 9. Run all services with one command

From PowerShell, you can start the Carpool app and simulator together:

```powershell
pnpm dev
```

Then open a second PowerShell window for the simulator:

```powershell
node --env-file=.env wordpress/simulator/server.mjs
```

Docker Compose remains independent and should be started first with:

```powershell
pnpm docker:up
```

Keep all three processes running:

| Process                 | Command                                               | URL                     |
| ----------------------- | ----------------------------------------------------- | ----------------------- |
| PostgreSQL and Directus | `pnpm docker:up`                                      | <http://localhost:8055> |
| Carpool app             | `pnpm dev`                                            | <http://localhost:5173> |
| WordPress simulator     | `node --env-file=.env wordpress/simulator/server.mjs` | <http://localhost:8080> |

## 10. Stop the services

In the PowerShell windows running Node processes, press:

```text
Ctrl+C
```

Stop Docker Compose:

```powershell
pnpm docker:down
```

This stops the containers without deleting their data.

To delete the local PostgreSQL and Directus volumes as well:

```powershell
pnpm docker:clear
```

This permanently removes the local database and Directus uploads.

## 11. Windows troubleshooting

### Port already in use

Check which process is using a port:

```powershell
Get-NetTCPConnection -LocalPort 5173,8055,8080 -ErrorAction SilentlyContinue
```

Stop the process using its specific process ID if it is an old development
server:

```powershell
Stop-Process -Id <process-id>
```

Do not stop Docker Desktop or unrelated system processes.

### `node --env-file` is not recognized

Check the Node.js version:

```powershell
node --version
```

Upgrade to Node.js 20 or newer, then open a new PowerShell window. Node.js
18.19 does not support `--env-file`.

### Directus cannot connect to PostgreSQL

Check the Compose services and logs:

```powershell
docker compose ps
docker compose logs directus
docker compose logs postgres
```

Confirm that Docker Desktop is running and that the PostgreSQL settings in
`.env` match the values used when the database volume was first initialized.

### The simulator redirects to Carpool without logging the user in

Confirm that:

- `WORDPRESS_SIMULATOR_INTEGRATION_ENABLED=true`;
- `WORDPRESS_INTEGRATION_ENABLED=true`;
- `WORDPRESS_PUBLIC_KEY_PATH` points to the public key;
- `WORDPRESS_SIMULATOR_PRIVATE_KEY_PATH` points to the matching private key;
- `WORDPRESS_KEY_ID` and `WORDPRESS_SIMULATOR_KEY_ID` match;
- the simulator was started with `node --env-file=.env`;
- `pnpm dev` was restarted after changing `.env`.

### Windows firewall or browser connection errors

The local services should be accessed through `localhost`. If Windows
Firewall prompts for Node.js access, allow access on private networks. Do not
expose the development ports to public networks.
