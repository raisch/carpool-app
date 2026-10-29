# Release verification

Milestone 6 is verified with one release gate:

```sh
pnpm release:verify
```

The gate runs type checking, repository-wide linting, the full Vitest suite,
the production build, Playwright route acceptance tests, the idempotent
Directus migration, WordPress production-configuration/plugin checks, and the
live Milestone 3–5 Docker integration tests. Live tests create temporary
fixtures and remove them in their cleanup paths.

The latest local verification was completed on 2026-10-29 with all checks
passing. The command records detailed command results and timestamps in
`.release-verification/last-run.json`.

Acceptance scenario coverage:

| Scenario                                                     | Verification                                   |
| ------------------------------------------------------------ | ---------------------------------------------- |
| 1. Landing page is carpool-only and understandable           | Playwright route acceptance                    |
| 2. Both-direction selection persists                         | `directus:test:m3`                             |
| 3. One direction plus opt-out                                | `directus:test:m3`                             |
| 4. Full/concurrent vehicle conflicts                         | `directus:test:m3`                             |
| 5. Admin, driver, rider, and export boundaries               | `directus:test:m4`, `directus:test:m5`         |
| 6. Draft and archived events are hidden                      | `directus:test`, repository tests              |
| 7. CMS/restricted Directus access and browser token boundary | unit boundary tests, `directus:test:m5`        |
| 8. No login/signup/password/JWT implementation               | route boundary test, lint, browser bundle scan |
