# App integration baseline

Baseline date: 2026-10-30

This document records the Milestone 0 evidence and decisions for aligning the
new `carpool-app` with the legacy application in `../ligerbots-carpool-app`.

## Scope decision

The new application is a carpool destination, not a replacement for the full
LigerBots public portal. The portal remains outside the new app's scope. The
integration sequence is therefore:

1. Option B — carpool-only legacy skin.
2. Option A — app-owned shared branded shell.

Option C is not selected. This agrees with the product scope in
[`design/design.md`](../design/design.md), which excludes the legacy CMS,
blog, announcements, directory, login pages, and unrelated WordPress
functionality.

## URL and label decisions

| Surface               | Decision                                                                         |
| --------------------- | -------------------------------------------------------------------------------- |
| WordPress entry label | Preserve `Resources / Carpools` exactly.                                         |
| New app landing route | `/` remains the canonical carpool landing route.                                 |
| New event route       | `/events/[eventId]` is canonical.                                                |
| Legacy event route    | Retain `/carpool/[id]` as a compatibility alias or redirect when implemented.    |
| New admin routes      | Use the new route contracts such as `/events/create`, `/vehicles`, and `/users`. |
| External links        | Keep external destinations explicit and do not depend on the legacy runtime.     |

The label and URL decisions preserve the WordPress handoff and old deep links
without making the new application reproduce the old server implementation.

## Asset inventory

The following assets were found in the legacy repository or its public asset
endpoints and are approved for reuse in the new app.

| Asset                  | Source and local copy                                                                                                | Intended use              | Status                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------ |
| Legacy background      | `../ligerbots-carpool-app/static/images/background.jpg` → `static/images/background.jpg`                             | Page background reference | Approved                                               |
| Sponsor bar, wide      | `../ligerbots-carpool-app/static/images/sponsor_bar_full_2024a.svg` → `static/images/sponsor_bar_full_2024a.svg`     | Desktop footer reference  | Approved                                               |
| Sponsor bar, narrow    | `../ligerbots-carpool-app/static/images/sponsor_bar_narrow_2024a.svg` → `static/images/sponsor_bar_narrow_2024a.svg` | Mobile footer reference   | Approved                                               |
| FIRST Robotics mark    | `https://www.ligerbots.org/images/first.svg` → `static/images/first.svg`                                             | Masthead external link    | Approved                                               |
| Masthead wordmark/logo | `https://www.ligerbots.org/images/{masthead_text,liger_head}.svg` → `static/images/`                                 | Option A masthead         | Approved                                               |
| Social/donation icons  | `https://www.ligerbots.org/images/{youtube,twitter,facebook,instagram,flickr,donate}.png` → `static/images/`         | Option A masthead links   | Approved                                               |
| New favicon            | `src/lib/assets/favicon.svg`                                                                                         | New app favicon           | Present in new app; approval not required for baseline |

Only the carpool-relevant legacy assets are copied into the new application's
`static/images` directory. They are approved but are not wired into the UI by
this milestone. Portal/blog imagery and sponsor-page-only graphics
were intentionally excluded. The legacy app's Directus UUID references were
not copied directly; the publicly served equivalents were saved locally under
their original `/images` filenames.

## Baseline screenshots

Screenshots were captured at `http://localhost:5173` for the new app and
`http://127.0.0.1:5174` for the legacy app:

| Surface                          | Desktop (1440x900)                                    | Mobile (390x844)                                     |
| -------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| New app landing page, signed out | [PNG](baseline/2026-10-30/current-home-desktop.png)   | [PNG](baseline/2026-10-30/current-home-mobile.png)   |
| Legacy app home shell            | [PNG](baseline/2026-10-30/legacy-home-desktop.png)    | [PNG](baseline/2026-10-30/legacy-home-mobile.png)    |
| Legacy carpool route shell       | [PNG](baseline/2026-10-30/legacy-carpool-desktop.png) | [PNG](baseline/2026-10-30/legacy-carpool-mobile.png) |

The new-app screenshots are valid signed-out baselines. The legacy screenshots
capture the real masthead, navigation, page geometry, background, and sponsor
footer, but the legacy carpool data request returns HTTP 500 when pointed at
the new local Directus instance. The old app's live event/trip content is
therefore not treated as visually verified by these screenshots.

## Interaction evidence

The legacy source establishes the following interaction reference:

- `/carpool` lists events and provides `View Trips` navigation.
- `/carpool/[id]` presents event metadata, separate destination and return
  trip sections, rides, seat counts, riders, opt-out controls, and confirmation
  actions.
- Admin actions are colocated with events, trips, rides, and riders.
- Event and trip forms open in the current page context; destructive actions
  require a second confirmation step.
- The legacy global layout supplies masthead, navigation, main content frame,
  and sponsor footer around carpool routes.

The new app's corresponding target routes are `/`, `/events/[eventId]`,
`/events/create`, `/vehicles`, and `/users`, with server-side authorization and
explicit identity, loading, empty, and error states preserved.

## Supported viewport and browser baseline

The approved minimum visual baseline is:

| Category | Viewport |
| -------- | -------- |
| Desktop  | 1440x900 |
| Mobile   | 390x844  |

The approved browser acceptance set is Chromium, Firefox, and WebKit at the two
viewports above. The Milestone 1 Playwright configuration now includes all
three projects. Chromium and WebKit visual snapshots are checked in under
`src/routes/milestone1-visual.e2e.ts-snapshots/`; Firefox is configured but is
currently blocked locally because its Playwright binary exits before creating a
headless profile.

## Open baseline item

Milestone 0 cannot be marked fully complete until the product owner confirms
whether the legacy-backend screenshot limitation is acceptable for the
baseline, or a legacy-compatible backend is provided for live screenshots.

The URL and scope decisions are recorded and ready for implementation.
