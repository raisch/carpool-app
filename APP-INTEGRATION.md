# Carpool app integration plan

## Intent

The new carpool app should look and behave like the legacy LigerBots
application at `../ligerbots-carpool-app`, while keeping the new app's
TypeScript/SvelteKit implementation, Directus data model, identity
integration, accessibility work, and explicit loading/error states.

This is a presentation and interaction alignment plan. It does not recommend
copying the legacy app's server implementation or reintroducing its historical
data-access patterns.

## What the legacy app communicates

The legacy app presents carpool as part of a complete LigerBots web site:

- A branded masthead is always visible above the content. It includes the
  LigerBots logo and links to the team's external social and sponsor
  destinations.
- A persistent, dynamically configured navigation bar sits below the masthead.
  Login/logout state changes the available links, and authenticated links are
  hidden rather than shown as disabled controls.
- The page is centered inside a wide, responsive Bootstrap-style grid. Content
  is organized into blue-headed panels, rows, and bordered sections rather than
  a sequence of isolated application cards.
- The home page is a portal: announcements, blog content, upcoming events,
  social content, and sponsor/footer content share the same visual frame.
- Carpool pages use the same shell and emphasize event/trip information in
  nested sections. Riders are grouped by trip and ride, so a user can scan
  who is driving, who is riding, and which seats remain.
- Administrative actions are close to the data they modify. Create and edit
  workflows open inline/modal forms, and destructive actions use an explicit
  confirmation step.
- The visual language is intentionally familiar and information-dense:
  blue section headings, compact labels, visible borders, modest corner
  radii, and conventional primary/secondary/danger buttons.

The current app has good foundations but communicates a different product:

- `RoleNavigation` is a compact utility bar instead of a branded site header;
  its contents remain the complete top-navbar scope for Option A.
- The landing page uses a large white header and a two-column grid of modern
  rounded cards.
- Identity notices and error/empty states are explicit and accessible, but do
  not yet share the legacy panel vocabulary.
- Admin links are role-aware, but the overall experience does not yet feel
  like a page inside the LigerBots site.

## Alignment options

### Option A — Shared branded shell (follow-up target)

Build a new app-owned shell that reproduces the legacy app's visible
structure:

1. `SiteMasthead`: logo/wordmark, responsive external links, and an accessible
   home link.
2. `SiteNavigation`: only the current Carpool link, role-aware links,
   current-user information, and the existing `Return to Ligerbots` action.
   Masthead, social, sponsor, and other external links do not belong in the
   top navbar.
3. `SiteMainPane`: centered responsive content column with the legacy page
   width, spacing, and panel primitives.
4. `SiteFooter`: sponsor/team links where the required assets and legal
   destinations are available.

Use the new app's server-provided identity and navigation data. Keep all
navigation links SvelteKit-resolved and keep external links explicit. Do not
load the legacy app as an iframe or depend on its runtime.

**Benefits:** strongest visual and behavioral parity, controlled migration,
good accessibility boundary, and no coupling to the old deployment.

**Costs:** requires a small design-system layer and asset/content decisions.

### Option B — Carpool-only legacy skin (first implementation phase)

Keep the current application shell and restyle only carpool pages:

- Replace the large landing-page header with a compact blue panel heading.
- Convert event cards to legacy-style event panels.
- Add trip/ride/rider groupings and inline admin controls.
- Retain the current role navigation and identity notices.

**Benefits:** lowest risk and fastest delivery.

**Costs:** the app will resemble the old app inside carpool screens but still
feel different at the top level, especially on the landing page and during
navigation.

### Option C — Full portal composition

Recreate the old home page composition, including announcements, blog,
upcoming events, social content, and sponsor blocks, then embed the new
carpool event and trip flows into that portal.

**Benefits:** closest overall site experience.

**Costs:** largest scope and highest content/integration dependency. This
should only be selected if the new app is intended to replace the old public
site rather than serve as the carpool destination launched from it.

## Decision and sequence

Pursue **Option B first, followed by Option A**.

Phase 1 uses Option B to bring the event list, trip/ride/rider hierarchy, and
contextual carpool actions into parity with the legacy carpool screens. This
delivers the most important user-facing behavior quickly while preserving the
new app's identity, authorization, accessibility, and data architecture.

Phase 2 uses Option A to replace the remaining application-level presentation
differences with an app-owned branded shell. Option A remains the desired
end state, but it should be informed by the validated carpool interaction
parity rather than delaying that work.

### Preserve from the new app

- Type-safe domain DTOs and route data.
- WordPress identity hand-off and unauthenticated/invalid-launch states.
- Role-based authorization enforced on the server, not only hidden in the UI.
- Explicit loading, error, and empty states.
- Keyboard navigation, skip link, focus styles, semantic headings, and
  accessible status messages.
- Existing route contracts and Directus persistence.

### Reproduce from the old app

- Masthead-above-navigation hierarchy.
- Centered, responsive Bootstrap-like content geometry.
- Blue panel headings and compact information sections.
- Event → trip → ride → rider information hierarchy.
- Contextual admin controls and two-step destructive confirmation.
- Familiar labels and navigation placement.

## Target interaction model

### Global shell

1. The user enters through the same branded masthead and navigation on every
   route.
2. The current section is visibly selected.
3. On narrow screens, navigation collapses into an accessible menu without
   changing link destinations.
4. The signed-in identity and role remain visible where the legacy app showed
   login/logout context; “Return to Ligerbots” remains available when supplied.

### Event list

1. The landing page uses a panel titled “Carpool” or “Upcoming carpool
   events,” not a standalone marketing-style hero.
2. Each event shows date range, name, location, description, and a clear
   “View trips” action.
3. Admin actions are grouped in a compact action area associated with the
   event list. Create/edit controls use the existing forms, restyled as a
   legacy modal or panel.
4. Empty, error, and identity states use the same panel frame as normal
   content, with their semantic status behavior retained.

### Event details

1. The event header uses a blue panel heading and a compact summary.
2. Outbound and return trips are separate, clearly labeled sections.
3. Each trip lists rides; each ride exposes driver, vehicle, capacity, and
   current riders in the same scan order used by the legacy rider lists.
4. A user can create or modify one signup without leaving the event context.
5. Admins can add/move/remove riders and manage rides from the surrounding
   section rather than finding controls in a separate dashboard.
6. Destructive actions use an explicit confirmation dialog with a clear
   cancellation path.

## Suggested implementation strategy

### 1. Establish visual tokens and primitives

Create a small app-local styling layer rather than scattering old Bootstrap
classes through the new components:

- `--brand-blue`, `--brand-blue-dark`, neutral border/background colors,
  content max width, panel radius, and standard vertical rhythm.
- `Panel`, `PanelHeading`, `ActionButton`, `StatusPanel`, and responsive
  `ContentGrid` patterns (these may be Svelte components or shared classes).
- A single button vocabulary for primary, secondary, and danger actions.
- Responsive rules for the old wide two-column layout collapsing to one column.

The primitives should be semantic and Tailwind-compatible. Avoid importing the
legacy app's entire CSS bundle because it would reintroduce unused Bootstrap
behavior and make focus/spacing regressions difficult to diagnose.

### 2. Build the shell before changing feature pages

Refactor the current layout around `SiteMasthead`, `SiteNavigation`, and
`SiteMainPane`. Move the current `RoleNavigation` behavior into the new
navigation component rather than duplicating identity logic. Add only the
legacy assets that are licensed, available, and have useful alt text.

The shell should be usable with JavaScript disabled as far as SvelteKit
navigation permits, and the mobile menu must expose its expanded/collapsed
state to assistive technology.

### 3. Restyle the event list

Replace the current rounded-card presentation with a panel/grid composition.
Keep `EventCard` as the data boundary if practical, but change its markup to
support a panel heading, compact metadata row, description, and contextual
actions. Keep date formatting and route resolution in the existing component.

### 4. Align the event-detail hierarchy

Use the legacy app's rider-list grouping as the reference interaction:
event summary, trip sections, ride rows, and rider lists. The existing
`TripRideCard`, `RiderManagement`, and form components should be composed into
that hierarchy rather than replaced with a single large table.

### 5. Add parity checks

Capture screenshots at desktop and mobile widths for:

- landing/event list,
- empty and error states,
- event details with outbound and return trips,
- admin event editing,
- vehicle management,
- signed-out, driver, and admin navigation.

Pair visual checks with Playwright assertions for keyboard navigation, role
visibility, destructive-action confirmation, and the event/trip/rider flows.

## Milestones

### Milestone 0 — Baseline and decisions (**COMPLETE**)

- [x] Confirm whether the app is a carpool destination or a future
      replacement for the full public portal.
- [x] Inventory candidate logo, sponsor, social, and favicon assets and record
      their approval status.
- [x] Record baseline screenshots and interaction behavior from both apps,
      including the legacy backend limitation.
- [x] Decide whether legacy navigation labels and URLs must remain exact.
- [x] Approve the minimum supported viewport sizes and browser set.

**Status:** scope, URL/label decisions, asset inventory, baseline evidence, and
the viewport/browser baseline are recorded in
[`docs/app-integration-baseline.md`](docs/app-integration-baseline.md). The
assets are approved. The milestone remains open pending resolution or
acceptance of the legacy-backend screenshot limitation.

**Exit criteria:** approved sequence (Option B first, then Option A), approved
asset list, URL/label decision, and baseline evidence are recorded.

### Milestone 1 — Carpool-only legacy skin (Option B)

- [x] Convert the landing page to legacy panel geometry and information
      density.
- [x] Align event metadata, action labels, admin action placement, and
      empty/error/identity panels.
- [x] Present outbound/return trips as distinct sections.
- [x] Present rides with driver, vehicle, capacity, and riders in a predictable
      scan order.
- [x] Keep signup, rider management, and vehicle forms in context.
- [x] Add confirmation and feedback behavior for destructive actions.
- [x] Add visual snapshots at desktop and mobile widths.

**Status:** the Option B skin is implemented in the existing application shell.
The Playwright visual suite covers the approved 1440×900 and 390×844 widths;
Chromium and WebKit snapshots pass locally. Firefox is configured in the
approved browser matrix but its local Playwright binary exits before creating
a headless profile in the current macOS environment.

**Exit criteria:** a signed-in user can identify an event and reach its trips
with the same number of meaningful steps as in the old app, and driver, rider,
and admin flows are behaviorally equivalent while using the new API and
authorization model.

### Milestone 2 — Shared branded shell (Option A)

- [ ] Add masthead, responsive navigation, content frame, and footer
      composition.
- [ ] Preserve identity states, role visibility, simulator return link, and
      server-side authorization.
- [ ] Add responsive and keyboard-accessibility tests.

**Exit criteria:** every existing route renders in the branded frame without
route or authentication regressions.

### Milestone 3 — Content and polish

- [ ] Add only the legacy portal blocks that have an owner and current data
      source; do not create stale placeholder content.
- [ ] Tune colors, typography, spacing, borders, and responsive breakpoints
      against approved screenshots.
- [ ] Verify asset loading, alt text, external-link behavior, and performance.

**Exit criteria:** product owner accepts the visual comparison and the
accessibility/performance checks pass.

### Milestone 4 — Release and deprecation

- [ ] Run the existing release verification and Playwright suites.
- [ ] Run a side-by-side pilot with representative signed-out, rider, driver,
      and admin users.
- [ ] Document any intentional differences from the old app.
- [ ] Retire duplicated presentation paths only after production verification.

**Exit criteria:** rollback path is known, release evidence is captured, and
the old carpool entry point can be redirected or decommissioned safely.

## Risks and guardrails

| Risk                                                      | Guardrail                                                                                       |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Copying legacy CSS creates hidden Bootstrap dependencies  | Recreate the visual language with scoped tokens/primitives.                                     |
| Visual parity weakens accessibility                       | Preserve semantic landmarks, focus indicators, labels, and status roles as acceptance criteria. |
| Hidden role links become a security assumption            | Continue enforcing every permission in server handlers.                                         |
| Portal content becomes stale                              | Add content blocks only with an owner and an actual source.                                     |
| Mobile layout becomes a desktop shrink                    | Design and test the single-column mobile composition explicitly.                                |
| Old and new URLs drift apart                              | Decide URL compatibility in Milestone 0 and add redirect/contract tests.                        |
| Reusing old assets creates licensing or deployment issues | Inventory and approve assets before wiring them into the shell.                                 |

## Definition of “like the old app”

The work is complete when a returning LigerBots user can recognize the app
before reading the page title, navigate using familiar placement and labels,
scan events/trips/riders in the old information order, and complete the same
create/edit/signup/remove tasks without learning a new interaction model.
Differences that are intentional for accessibility, security, responsive
behavior, or the new identity/data architecture should be documented rather
than hidden.
