# Standalone carpool development punch list

## Scope

This list defines the remaining work to make the standalone carpool app feel
as close as practical to the carpool experience in
`../ligerbots-carpool-app`.

The app is **not** intended to recreate the legacy site's public-site framing.
The carpool app itself is the landing page. Do not add the legacy blog,
announcements, calendar, social feeds, sponsor portal, public-site masthead, or
unrelated directory pages unless a later product decision expands the scope.

Preserve the new app's TypeScript/SvelteKit implementation, Directus
persistence, WordPress identity hand-off, server-side authorization,
accessibility behavior, and explicit loading/error states.

## Required changes

### Standalone carpool shell

- [ ] Keep the application focused on carpool and make the event list the
  landing page.
- [ ] Replace the current generic utility navigation with a compact,
  carpool-specific navigation that exposes only relevant destinations:
  events, vehicles, users/admin functions, and return to the simulator when
  available.
- [ ] Retain the LigerBots visual identity where it helps users recognize the
  app, but do not reproduce the legacy public site's full masthead/social
  navigation.
- [ ] Decide whether the existing [SiteMasthead.svelte](./src/lib/components/SiteMasthead.svelte)
  and [SiteFooter.svelte](./src/lib/components/SiteFooter.svelte)
  should remain as a lightweight app brand bar or be replaced with a smaller
  standalone carpool header.
- [ ] Make the selected navigation item, signed-in user, role, logout action,
  and simulator return link visible and consistent on every route.
- [ ] Add an accessible responsive menu for narrow screens with explicit
  expanded/collapsed state.
- [ ] Preserve the skip link, focus styles, semantic landmarks, and keyboard
  access while changing the visual treatment.

### Standalone visual language

- [ ] Define shared visual tokens in
  [layout.css](./src/routes/layout.css):
  team blue, darker hover blue, neutral backgrounds, borders, panel shadow,
  radius, content width, typography, and spacing.
- [ ] Recreate the legacy carpool visual language without importing the entire
  legacy Bootstrap/CSS runtime:
  - blue panel headings,
  - bordered white panel bodies,
  - modest corner radii,
  - compact labels and metadata,
  - conventional primary/secondary/danger buttons,
  - visible but restrained shadows,
  - dense, information-oriented spacing.
- [ ] Add reusable panel, panel-heading, panel-body, status-panel, action
  button, metadata-row, form-row, and dialog styles/components.
- [ ] Remove inconsistent one-off combinations of Tailwind classes and local
  button styles from the carpool screens.
- [ ] Match the legacy carpool typography and heading hierarchy without
  retaining unrelated public-site page treatments.
- [ ] Ensure the visual system works at desktop, tablet, and phone widths.

### Event landing page

- [ ] Restyle [src/routes/+page.svelte](./src/routes/+page.svelte)
  so the app opens directly to a compact “Carpool events” or “Upcoming
  carpool events” panel rather than a modern marketing-style hero.
- [ ] Convert [EventCard.svelte](./src/lib/components/EventCard.svelte)
  from a rounded modern card into a legacy-style event panel.
- [ ] Show the same high-value event information as the legacy app:
  event name, date range, location, description, and transportation action.
- [ ] Use familiar action labels such as “View trips,” “Edit event,” and
  “Delete event.”
- [ ] Keep admin actions close to the event list and visually group create,
  edit, and delete controls.
- [ ] Preserve the existing empty, error, loading, identity, and invalid-launch
  behavior while presenting each state inside the shared panel vocabulary.
- [ ] Keep the event list responsive: two columns where appropriate and one
  column on narrow screens.
- [ ] Match the legacy density and avoid oversized headings, excessive padding,
  and large rounded cards.

### Event details and trip hierarchy

- [ ] Rework
  [src/routes/events/[eventId]/+page.svelte](./src/routes/events/[eventId]/+page.svelte)
  around the legacy hierarchy:
  1. event summary,
  2. outbound trip,
  3. return trip,
  4. rides within each trip,
  5. riders within each ride.
- [ ] Make outbound and return transportation visually distinct and easy to
  scan.
- [ ] Update [TripRideCard.svelte](./src/lib/components/TripRideCard.svelte)
  to show driver, vehicle, destination, timing, capacity, open seats, and
  current riders in a predictable order.
- [ ] Match legacy labels for trip direction, ride status, available seats,
  full rides, unassigned riders, and opt-outs.
- [ ] Keep the event summary compact and place event-level actions in the
  surrounding panel rather than in a separate dashboard.
- [ ] Provide clear back navigation to the event list and preserve deep-link
  behavior.

### Signup and transportation behavior

- [ ] Ensure a user can choose outbound transportation, return transportation,
  both, or opt out, matching the legacy workflow.
- [ ] Allow users to edit an existing signup from the event context without
  losing the event/trip view.
- [ ] Match the legacy form field order, labels, defaults, confirmation
  feedback, and post-save behavior.
- [ ] Keep the existing server-side validation and authorization as the source
  of truth.
- [ ] Present success, validation, and server failures in visible,
  actionable, accessible feedback.
- [ ] Avoid browser-default alerts or silent refreshes where an inline status
  or accessible dialog is more appropriate.
- [ ] Preserve behavior for users with no available rides, full rides, no
  vehicle, or incomplete identity integration.

### Ride and admin management

- [ ] Add contextual admin controls to create, edit, and remove trips and
  rides.
- [ ] Support driver and vehicle assignment from the event workflow where the
  legacy app supports it.
- [ ] Keep routine ride changes on the event page or in an adjacent dialog;
  do not require unnecessary navigation to a separate administration area.
- [ ] Use consistent accessible dialogs for create/edit and destructive
  actions.
- [ ] Require explicit confirmation before deleting events, trips, rides,
  vehicles, or rider assignments.
- [ ] Show operation-in-progress, success, and failure states without
  allowing duplicate submissions.

### Rider and attendee management

- [ ] Update [RiderManagement.svelte](./src/lib/components/RiderManagement.svelte)
  and
  [src/routes/events/[eventId]/riders/+page.svelte](./src/routes/events/[eventId]/riders/+page.svelte)
  to match the legacy rider-list grouping by trip and ride.
- [ ] Show rider name, ride, driver, vehicle, capacity, and assignment status
  in the legacy scan order.
- [ ] Add/remove a rider from a ride.
- [ ] Move a rider between rides.
- [ ] Support unassigning a rider and restoring the rider to an unassigned
  state.
- [ ] Show opt-outs and attendees in the same context as the legacy carpool
  workflow where those views are part of the supported product.
- [ ] Add confirmation and actionable failure feedback for rider changes.
- [ ] Keep all rider-management permissions enforced by server handlers.
- [ ] Retain export access from the event/rider context if the legacy workflow
  provides it.

### Vehicle management

- [ ] Restyle [src/routes/vehicles/+page.svelte](./src/routes/vehicles/+page.svelte),
  vehicle detail, create, and edit pages using the same compact legacy panel
  and form treatment.
- [ ] Match legacy vehicle labels and field order for driver, capacity,
  description, availability, and ownership.
- [ ] Allow drivers to manage their own vehicle using the same role-aware
  navigation pattern as the legacy app.
- [ ] Allow administrators to view, edit, and remove vehicles where permitted.
- [ ] Show vehicle usage or assigned rides when that context is needed to make
  the workflow equivalent to the legacy app.
- [ ] Match validation messages, required indicators, save/cancel actions,
  confirmation behavior, and post-save navigation.

### User, identity, and role behavior

- [ ] Match the legacy login/logout labels and placement within the standalone
  carpool shell.
- [ ] Make signed-out, authenticated rider, driver, admin, invalid-launch, and
  identity-not-configured states visually consistent with the rest of the app.
- [ ] Compare [src/routes/users/+page.svelte](./src/routes/users/+page.svelte)
  with the legacy user-management behavior and add only carpool-relevant
  user/role actions.
- [ ] Do not reproduce unrelated public directory or site-account features.
- [ ] Continue hiding unavailable controls for usability, but never rely on
  hidden controls as the security boundary.

### Route and terminology compatibility

- [ ] Decide which legacy carpool URLs must remain valid:
  - `/carpool`
  - `/carpool/:id`
  - `/carpool/:id/riderlist`
  - `/carpool/:id/attendees`
  - `/carpool/vehicles`
  - `/carpool/vehicle/:id`
- [ ] Add redirects or compatibility routes for any required old bookmarks,
  WordPress links, simulator links, or shared URLs.
- [ ] Align route titles, page headings, button labels, and status messages with
  legacy carpool terminology.
- [ ] Document intentional URL or terminology differences.

### Verification

- [ ] Capture side-by-side screenshots for:
  - standalone landing/event list,
  - event details,
  - outbound and return trips,
  - rider list,
  - vehicle list/detail,
  - create/edit forms,
  - signed-out state,
  - rider state,
  - driver state,
  - admin state,
  - mobile layout.
- [ ] Extend the existing visual coverage in
  [milestone1-visual.e2e.ts](./src/routes/milestone1-visual.e2e.ts)
  with the event/trip/rider and vehicle screens.
- [ ] Add behavioral tests for:
  - event selection,
  - outbound/return signup,
  - opt-out,
  - editing a signup,
  - joining/leaving a ride,
  - adding/moving/removing riders,
  - creating/editing/deleting events,
  - creating/editing/deleting vehicles,
  - login/logout and simulator return behavior.
- [ ] Add keyboard and accessibility tests for navigation, panels, forms,
  dialogs, confirmation flows, and status messages.
- [ ] Add route compatibility tests for every retained legacy URL.
- [ ] Run type checking, linting, unit tests, Playwright tests, visual
  snapshots, and release-verification scripts.
- [ ] Test with representative signed-out, rider, driver, and admin
  identities.

## Explicitly out of scope

- [ ] Do **not** recreate the legacy site's full public masthead and social
  navigation.
- [ ] Do **not** add announcements, blog posts, public calendar blocks,
  Twitter/social embeds, sponsor portal blocks, or unrelated public content to
  the carpool landing page.
- [ ] Do **not** copy the legacy app's server modules or historical data-access
  implementation.
- [ ] Do **not** weaken the new app's identity, authorization, validation,
  accessibility, or error-handling behavior for visual similarity.

## Completion criteria

The standalone app is close enough to the legacy carpool app when a returning
user can recognize the same event/trip/ride/rider information hierarchy, use
the same signup and management workflows, understand the same labels and
statuses, and complete the same tasks without learning a substantially
different interaction model. The app should still clearly be a focused
carpool product rather than a copy of the legacy public website.
