# Standalone carpool visual and interaction punch list

## Objective

Make `carpool-app` look and feel as close as possible to the carpool
experience in `../ligerbots-carpool-app`.

The target is **observable parity**. A returning user should recognize the
same visual language, information hierarchy, terminology, control placement,
feedback patterns, and task flow.

This list deliberately does not require copying the legacy app's architecture,
URLs, framework patterns, data model, CSS framework, server implementation, or
technical limitations. The new app may use different technical solutions as
long as the user-facing result is equivalent or better.

## Required visual changes

### Overall page composition

- [ ] Reproduce the legacy carpool page proportions:
  - centered content area,
  - wide desktop layout,
  - narrower readable content column,
  - deliberate outer margins,
  - compact vertical rhythm.
- [ ] Reproduce the legacy page background treatment:
  - light photographic or textured background,
  - white/light content surface,
  - subtle top fade or shading,
  - clear separation between page background and application content.
- [ ] Match the legacy content frame's border, radius, shadow, and panel
  spacing.
- [ ] Avoid the current generic SaaS appearance:
  - oversized hero headings,
  - excessive rounded corners,
  - large empty areas,
  - floating card grids with unrelated card styling.
- [ ] Establish shared visual tokens for team blue, dark blue hover states,
  panel borders, panel shadows, neutral backgrounds, typography, spacing, and
  control heights.

### Brand header

- [ ] Recreate the recognizable LigerBots brand header from
  `../ligerbots-carpool-app`, adapted to a standalone carpool product.
- [ ] Match the logo/wordmark proportions, alignment, padding, and visual
  weight.
- [ ] Include the team identity prominently enough that the app feels like a
  LigerBots application immediately on arrival.
- [ ] Keep external brand/social links only if they improve the standalone
  app's presentation; do not make them a prerequisite for navigation.
- [ ] Make the header responsive without shrinking the logo into an unusable
  mark.
- [ ] Use meaningful image alternatives and preserve visible keyboard focus.

### Carpool navigation

- [ ] Recreate the legacy navigation bar's appearance:
  - team-blue background,
  - compact height,
  - rounded upper corners where appropriate,
  - subtle shadow,
  - familiar text sizing,
  - clear hover and selected states.
- [ ] Present carpool destinations in the same practical order users expect:
  events first, followed by transportation, vehicles, rider/admin tools, and
  account actions as applicable.
- [ ] Use familiar labels such as “Carpool,” “Events,” “Vehicles,” “Rider
  list,” “Users,” “Login,” and “Logout,” adjusted only where needed for
  clarity.
- [ ] Keep role-specific actions visible in the same navigation context as
  the legacy app.
- [ ] Add a compact, accessible mobile navigation that preserves the same
  hierarchy and terminology.
- [ ] Show the current section clearly without relying on color alone.

### Shared panels and controls

- [ ] Replace inconsistent page-specific containers with a shared legacy-style
  panel treatment:
  - blue heading strip,
  - white body,
  - thin border,
  - restrained radius,
  - subtle drop shadow.
- [ ] Create consistent heading levels and panel title spacing.
- [ ] Match the legacy primary, secondary, neutral, and destructive button
  appearance.
- [ ] Match button height, padding, capitalization, icon placement, hover
  states, disabled states, and focus states.
- [ ] Use compact links and action rows instead of large modern card buttons
  where the legacy app uses inline actions.
- [ ] Standardize form fields, labels, required indicators, help text,
  validation text, and field spacing.
- [ ] Use the same panel treatment for normal content, empty states, errors,
  warnings, confirmations, and success messages.

## Required carpool screen changes

### Landing page

- [ ] Make the event list the unmistakable landing experience for the
  standalone application.
- [ ] Restyle [src/routes/+page.svelte](./src/routes/+page.svelte) as a
  compact carpool dashboard rather than a marketing landing page.
- [ ] Use a prominent legacy-style panel heading such as “Carpool Events” or
  “Upcoming Events.”
- [ ] Match the legacy event-list density and scanning behavior.
- [ ] Present each event with:
  - event name,
  - date range,
  - location,
  - description,
  - transportation/trip action,
  - contextual administrative actions when appropriate.
- [ ] Restyle [EventCard.svelte](./src/lib/components/EventCard.svelte) as a
  legacy event panel rather than a large rounded card.
- [ ] Use a familiar “View trips” or equivalent primary action.
- [ ] Place create/edit/delete actions beside or within the event panel in the
  same way a legacy user would expect.
- [ ] Keep events in a responsive two-column desktop arrangement where space
  allows and a single-column mobile arrangement.
- [ ] Ensure no event, loading, error, identity, and invalid-launch states use
  the same visual frame as the event list.

### Event details

- [ ] Restyle
  [src/routes/events/[eventId]/+page.svelte](./src/routes/events/[eventId]/+page.svelte)
  to match the legacy event-details screen.
- [ ] Put the event name and key event metadata in a compact header panel.
- [ ] Preserve the legacy information order:
  1. event summary,
  2. outbound transportation,
  3. return transportation,
  4. rides,
  5. riders.
- [ ] Use clear section headings for outbound and return trips.
- [ ] Keep event actions close to the event summary rather than in a
  disconnected toolbar.
- [ ] Use compact back/navigation actions in the same visual style as the rest
  of the page.
- [ ] Show empty trip sections and unavailable transportation clearly without
  collapsing the surrounding hierarchy.

### Trips and rides

- [ ] Update [TripRideCard.svelte](./src/lib/components/TripRideCard.svelte)
  to visually resemble the legacy ride/trip blocks.
- [ ] Present each ride as a compact, scannable section rather than a generic
  application card.
- [ ] Show information in the legacy reading order:
  - driver,
  - vehicle,
  - destination or trip direction,
  - departure/return time,
  - capacity,
  - open seats,
  - riders.
- [ ] Make full rides, rides with open seats, cancelled rides, and unavailable
  rides visually distinct.
- [ ] Keep driver and vehicle details close to the ride they describe.
- [ ] Place join, leave, edit, and manage actions directly beside the affected
  ride.
- [ ] Match the legacy wording for joining, leaving, changing, and managing a
  ride.
- [ ] Make ride sections work cleanly on narrow screens without hiding key
  capacity or rider information.

### Signup and transportation selection

- [ ] Make the signup flow feel like the legacy inline workflow.
- [ ] Allow a user to select outbound transportation, return transportation,
  both, or no transportation.
- [ ] Allow an existing signup to be changed from the event context.
- [ ] Match the legacy field order, labels, defaults, action buttons, and
  confirmation messaging.
- [ ] Keep the user on the relevant event/trip context after saving.
- [ ] Show clear feedback for saved, changed, rejected, and failed actions.
- [ ] Replace generic browser alerts with consistent visible feedback or
  accessible dialogs.
- [ ] Make unavailable, full, opted-out, and incomplete choices understandable
  without requiring users to inspect technical details.

### Rider lists and attendee management

- [ ] Update [RiderManagement.svelte](./src/lib/components/RiderManagement.svelte)
  and
  [src/routes/events/[eventId]/riders/+page.svelte](./src/routes/events/[eventId]/riders/+page.svelte)
  to match the legacy rider-list presentation.
- [ ] Group riders by trip and ride in the same visual hierarchy as the legacy
  app.
- [ ] Use compact rider rows with clear driver, vehicle, and seat context.
- [ ] Distinguish assigned riders, unassigned riders, attendees, and opt-outs.
- [ ] Place rider actions next to the rider or ride they affect.
- [ ] Support the same observable management tasks:
  - add a rider,
  - remove a rider,
  - move a rider,
  - unassign a rider,
  - review rider/attendee status.
- [ ] Use inline forms or focused dialogs that resemble the old app's
  create/modify behavior.
- [ ] Add clear confirmation, cancellation, success, and failure feedback.
- [ ] Keep long rider lists readable and scannable on mobile.

### Admin event and ride workflows

- [ ] Make create and edit workflows feel like the legacy
  create/modify forms, whether implemented as panels, dialogs, or routes.
- [ ] Match legacy form layout, field grouping, labels, button order, and
  confirmation behavior.
- [ ] Keep event and ride creation close to the list or detail view where the
  legacy workflow places it.
- [ ] Make destructive actions visibly dangerous and require deliberate
  confirmation.
- [ ] Show progress and completion feedback in the same context as the action.
- [ ] Prevent duplicate submissions and preserve entered values after
  validation failures.

### Vehicle screens

- [ ] Restyle [src/routes/vehicles/+page.svelte](./src/routes/vehicles/+page.svelte)
  and all vehicle detail/create/edit screens to match the legacy vehicle
  pages.
- [ ] Use the same panel, table/list, form, and action-button vocabulary as
  event and rider screens.
- [ ] Match the legacy field labels and visual order for driver, vehicle,
  capacity, description, and availability.
- [ ] Keep driver-owned vehicle actions and administrator actions visually
  distinct but consistent.
- [ ] Show vehicle assignments or usage beside the vehicle when that context
  is needed to complete transportation planning.
- [ ] Match save, cancel, edit, delete, validation, and confirmation behavior.

### User and account presentation

- [ ] Make signed-out, signed-in, driver, rider, and administrator states look
  like variations of the same application rather than separate modern screens.
- [ ] Match the legacy placement and wording of login/logout/account actions.
- [ ] Restyle [src/routes/users/+page.svelte](./src/routes/users/+page.svelte)
  using the same compact list and panel treatment.
- [ ] Show role and transportation-relevant user information in the same
  practical, scan-friendly style as the legacy app.
- [ ] Keep unavailable actions hidden or clearly unavailable in the same
  manner as the old user experience.

## Required responsive and accessibility work

- [ ] Compare desktop, tablet, and phone layouts against the legacy carpool
  screens, not just against the current app.
- [ ] Preserve the legacy information order when panels collapse to one
  column.
- [ ] Ensure event names, descriptions, rider names, and validation messages
  wrap without damaging layout.
- [ ] Make all navigation, forms, dialogs, confirmations, and ride actions
  keyboard accessible.
- [ ] Preserve visible focus indicators while matching the legacy colors.
- [ ] Use semantic headings, landmarks, labels, and status announcements.
- [ ] Ensure color is not the only signal for active, full, dangerous, or
  unavailable states.
- [ ] Verify sufficient contrast for the blue panel headings and button
  combinations.

## Required parity validation

- [ ] Capture side-by-side screenshots of:
  - landing/event list,
  - event details,
  - outbound and return trips,
  - ride with open seats,
  - full ride,
  - rider list,
  - vehicle list,
  - create/edit forms,
  - signed-out view,
  - rider view,
  - driver view,
  - administrator view,
  - mobile layouts.
- [ ] Extend
  [src/routes/milestone1-visual.e2e.ts](./src/routes/milestone1-visual.e2e.ts)
  with visual coverage for the remaining carpool screens.
- [ ] Add behavior checks for:
  - opening an event,
  - selecting outbound and return rides,
  - opting out,
  - changing a signup,
  - joining and leaving a ride,
  - adding, moving, and removing riders,
  - creating and editing events,
  - creating and editing vehicles,
  - confirming and cancelling destructive actions.
- [ ] Test all flows with representative signed-out, rider, driver, and
  administrator states.
- [ ] Review every screen for consistent panel styling, typography, spacing,
  button treatment, terminology, and feedback.
- [ ] Run type checking, linting, unit tests, Playwright tests, visual
  snapshots, and release verification after the visual changes are complete.

## Completion criteria

The work is complete when a user familiar with the legacy carpool app can
recognize the standalone app immediately, scan events and transportation
options in the same order, understand the same labels and statuses, and
complete the same rider, driver, and administrator tasks without learning a
substantially different interaction model.

Technical differences are acceptable. Noticeable differences in visual
hierarchy, control placement, terminology, task flow, responsive behavior, or
feedback are not.
