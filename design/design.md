# Ligerbots Carpool App Design

## 1. Purpose and scope

This document is the implementation design for a new SvelteKit application that
recreates the carpool capability in this repository, with the carpool event list
as the application landing page. It is intentionally not a design for the
broader Ligerbots WordPress replacement.

The application shall:

- list active carpool events for authenticated team members;
- show a sign-in-required state without loading or displaying event data when no
  authenticated identity is available;
- show the outbound and return transportation options for an event;
- let a team member select at most one ride in each direction;
- let a team member explicitly state that transportation is not needed in a
  direction;
- let administrators manage events, trips, vehicles, assignments, riders, and
  printable/exportable lists;
- use Directus only as the carpool data store and API;
- consume the WordPress-backed identity/session boundary described in
  [`wordpress-integration-design.md`](./wordpress-integration-design.md) and
  enforce Carpool authorization locally.

The application shall not contain the website CMS, blog, announcements,
photo galleries, general directory, public pages, login/signup screens, or
WordPress compatibility layer.

The sibling `../ligerbots-carpool-app` repository is the source of behavioral
evidence. The target application is allowed to correct implementation defects
called out in
["Known gaps and decisions"](#known-gaps-and-decisions), but must preserve the
observable business behavior described below.

## 2. Product model

The primary user journey is:

1. Complete the WordPress-to-Carpool handoff, open `/`, and see active carpool
   events.
2. Select an event.
3. Review event dates, location, and both transportation directions.
4. Choose one available vehicle for the outbound trip and one for the return
   trip, or explicitly opt out of either direction.
5. Save the complete transportation status.
6. Revisit the event to change or remove selections.

When no authenticated identity is available, `/` shows the identity notice and
does not query or render the event list. The event page is the main workspace.
It should not require navigation through
the old website shell. A compact application header may provide the app name,
current-user affordances supplied by the WordPress-backed identity integration,
and an admin or driver link when the current user has the corresponding role.

### Roles

Authentication is provided by the WordPress integration boundary, while the UI
and service layer read the authenticated user’s `role`. The only supported role
values are `rider`, `driver`, and `admin`:

| Capability                                                  | `rider` | `driver` | `admin` |
| ----------------------------------------------------------- | ------: | -------: | ------: |
| View published events and transportation options            |     Yes |      Yes |     Yes |
| Select, change, or clear own transportation                 |     Yes |      Yes |     Yes |
| Create/delete vehicles                                      |      No |       No |     Yes |
| Edit own vehicle details (not ownership or trip assignment) |      No |      Yes |     Yes |
| Add/remove riders from own vehicle’s assigned trip rides    |      No |      Yes |     Yes |
| Create/edit/archive events                                  |      No |       No |     Yes |
| Create/edit/delete trips                                    |      No |       No |     Yes |
| Assign vehicles to trips                                    |      No |       No |     Yes |
| View riders associated with own vehicle                     |      No |      Yes |     Yes |
| View/export event rider lists                               |      No |       No |     Yes |

Admin features must be hidden unless `currentUser.role === 'admin'`, and
driver tools must be hidden unless `currentUser.role === 'driver'` or
`currentUser.role === 'admin'`. Hiding is only a UX optimization; every page,
server action, API route, and corresponding Directus write must independently
enforce the scoped role check and return `403` when it fails. Rider
transportation writes remain allowed for the current rider’s own decisions.
The `driver` role is granted only the scoped permissions listed above: it does
not grant event, trip, vehicle ownership, vehicle assignment, export, or
general administrative access.

The new app consumes an `IdentityProvider`/`CurrentUser` interface and returns
an explicit `not configured` or `unauthenticated` state when identity is
unavailable. It must not contain the website’s login, signup, password, or
WordPress JWT implementation; those remain owned by the integration boundary.

## 3. Functional requirements

### 3.1 Event list

The landing page (`/`) displays published, active events as cards or a
responsive list only when the current identity is authenticated. Each event
displays:

- name;
- description;
- start date and end date;
- location;
- a link/button to view transportation options.

When the configured user has `role = admin`, the card also displays a compact
`Edit` action in its top-right corner linking to `/events/[eventId]/edit`.
The action is hidden for riders and drivers; the destination route remains
server-side protected by the admin role check.

An empty result is a normal state with a clear “No active carpool events”
message. Backend failures are an error state with a retry action; they must not
silently become an empty list.

When identity is `not configured` or `unauthenticated`, the server must not call
the event repository and the page must not render the event section. It shows
the existing identity/sign-in notice instead.

Administrators see actions for creating, editing, archiving, or deleting an
event. Deletion is destructive and requires a confirmation step. Archiving is
the preferred normal lifecycle operation because the event list filters to
`published`.

### 3.2 Event details and transportation status

`/events/[eventId]` (the new canonical route; `/carpool/[id]` may be retained as
a compatibility alias) displays:

- event metadata;
- an outbound (“to event”) trip section;
- a return (“from event”) trip section;
- every assigned vehicle in each section;
- driver name and contact affordances supplied by the identity profile;
- seat capacity, occupied seats, and remaining seats;
- rider names;
- the current user’s selection/opt-out status;
- save, change, and clear actions.

The selection control must make the two directions independent. A user can:

- select one outbound ride and one return ride;
- select one direction and opt out of the other;
- opt out of both directions;
- change either direction later.

Saving is atomic from the user’s perspective: the UI submits both direction
decisions together and refreshes the event state from the server. A partial
success must be reported as an error and reconciled by reloading server state.

### 3.3 Business rules

These rules are mandatory in both the UI and the server/domain service:

1. A user may have no more than one selected ride for a given event direction.
2. A user must have a decision for each direction before registration is
   complete: a ride selection or an explicit opt-out.
3. A user can only join a published trip/ride with available capacity.
4. A user cannot join the same ride twice.
5. A vehicle cannot be assigned to the same trip more than once.
6. A vehicle’s rider count cannot exceed its seat capacity.
7. Only users with `role = admin` may create, delete, or assign vehicles.
   Users with `role = driver` may edit their own vehicle’s details and manage
   riders on trip rides assigned to that vehicle, but may not change its
   primary driver or trip assignments.
8. Removing a vehicle or trip assignment must not leave orphaned assignment or
   rider records.
9. Concurrent reservations must be serialized or rejected with a conflict;
   never allow capacity to become negative.

The domain should represent opt-out explicitly, rather than inferring opt-out
from the absence of an attendee or rider record. This makes the mandatory
decision rule auditable and avoids confusing “not yet decided” with “does not
need transportation.”

### 3.4 Event administration

Users with `role = admin` can create and edit:

- name;
- description;
- start date;
- end date;
- location;
- lifecycle status (`draft`, `published`, `archived`).

Dates must be validated (`start <= end`). The published list must not expose
draft or archived events. Event editing should provide links to create or edit
outbound and return trips.

### 3.5 Trip administration

Each event may have zero or more outbound trips and zero or more return trips.
A trip contains:

- direction (`outbound` or `return`);
- destination/event location;
- departure location;
- departure date;
- departure time;
- optional arrival time;
- lifecycle status.

Users with `role = admin` can create, edit, publish, archive, and delete trips. A trip
cannot be deleted while it has active rider assignments unless the UI first
requires an explicit cleanup/transfer operation.

### 3.6 Vehicle administration

`/vehicles` is an admin and driver management surface. Admins may list and
manage all vehicles. Drivers may see and edit only their own vehicle, where
“own” means `vehicle.primary_driver_id === currentUser.id`. Riders must not
see the navigation link or the page’s management controls.

A vehicle contains a display name, vehicle type, seat capacity, and a primary
driver profile reference. Only admins may create or change the
`primary_driver_id` relationship. A driver may edit the name, vehicle type, and
seat capacity of their own vehicle, subject to capacity validation, but may not
change its owner, delete it, or assign it to a trip. The current code models a
driver relationship as an array; the normalized design uses one
`primary_driver_id`.

Vehicle detail can show trip assignments and current riders. Editing validates a
positive integer seat count and prevents reducing capacity below the current
rider count.

### 3.7 Rider administration

Administrators can manage riders on any vehicle. Drivers can manage riders only
on trip rides assigned to their own vehicle. In both cases:

- add a team member to a ride;
- remove a rider;
- move a rider between rides in the same direction;
- view rider contact details according to the future privacy policy;
- view a printable rider list.

A driver may move a rider only when both the source and destination rides are
assigned to that driver’s vehicle; moving a rider to another vehicle remains an
admin operation.

The normal team-member flow should not require manual rider management. It
updates the user’s own direction decisions and lets the server maintain the
attendee and rider relationships.

### 3.8 Export and print

An event can provide a print-friendly rider list and a machine-readable export
(CSV is sufficient for the first version). The export must include only the
event’s trips, vehicles, and riders, with stable column names and a generated
timestamp. Contact fields must be omitted or masked according to the future
identity/privacy policy.

## 4. Routes and UI composition

The following route map is the target surface. Event-management,
trip-management, vehicle assignment, and export routes are admin-only and must
check `currentUser.role === 'admin'`. Vehicle details/editing and rider
management also support `role = driver` after verifying that the requested
vehicle is owned by the current driver. The route structure itself can be
implemented before the future identity integration exists.

| Route                                  | Purpose                                                |
| -------------------------------------- | ------------------------------------------------------ |
| `/`                                    | Active carpool event landing page                      |
| `/events/[eventId]`                    | Event details, trip options, own transportation status |
| `/events/create`                       | Admin event creation                                   |
| `/events/[eventId]/edit`               | Admin event and trip management                        |
| `/events/[eventId]/riders`             | Printable attendee/rider view                          |
| `/events/[eventId]/export`             | CSV export                                             |
| `/vehicles`                            | Visible vehicle list                                   |
| `/vehicles/create`                     | Admin vehicle creation                                 |
| `/vehicles/[vehicleId]`                | Vehicle details, assignments, riders                   |
| `/vehicles/[vehicleId]/edit`           | Vehicle editing                                        |
| `/api/events`                          | Event list/create/update operations                    |
| `/api/events/[eventId]`                | Event read/update/archive/delete                       |
| `/api/events/[eventId]/transportation` | Atomic two-direction status read/write                 |
| `/api/trips`                           | Trip create/update/delete/assignment operations        |
| `/api/trip-rides/[tripRideId]/riders`  | Rider add/remove/move                                  |
| `/api/vehicles`                        | Vehicle list/create/update/delete                      |

`/carpool` and the existing `/carpool/[id]` URLs may redirect to the canonical
routes during migration. No route outside this table belongs in the new app.

### Component boundaries

Use small, domain-oriented Svelte components:

- `EventList` and `EventCard`;
- `EventHeader`;
- `DirectionSection`;
- `TripOptionList`;
- `TripRideCard`;
- `SeatAvailability`;
- `TransportationStatusForm`;
- `OptOutControl`;
- `VehicleForm`;
- `VehicleCard`;
- `RiderList`;
- `AdminActions`;
- `ErrorState`, `EmptyState`, and `ConfirmDialog`.

The reference repository’s `CarpoolTrip.svelte`, signup dialogs, rider lists,
and vehicle form components are useful behavioral references, but the new app
should not copy the old global `Masthead`, `Navbar`, `Footer`, or CMS blocks.

## 5. Domain and data model

The conceptual relationship is:

```text
Event
 ├── outbound Trips ──┐
 └── return Trips ────┤
                      └── TripRide ── Vehicle ── Primary driver(User)
                              └────── Riders(User)
Event ── Attendees/TransportationDecisions ── User
```

### 5.1 Directus collections retained for the carpool app

Directus should expose only these business collections to the app:

1. `events` (replacement for the current `event`);
2. `outbound_trips` (replacement for `destination_trip`);
3. `return_trips` (replacement for `return_trip`);
4. `vehicles` (replacement for `ride`);
5. `trip_rides` (vehicle assignment to one trip);
6. `trip_ride_riders` (rider-to-assignment junction);
7. `transportation_decisions` (explicit direction decisions);
8. `users` as a minimal, externally owned identity/profile reference.

Because there is no existing data to migrate, the new Directus schema will use
these normalized collection names directly. The application code should use
domain names (`vehicle`, `tripRide`, `outboundTrip`) rather than the old
overloaded “ride” terminology.

### 5.2 Recommended fields

#### `events`

| Field                      | Type         | Required | Notes                            |
| -------------------------- | ------------ | -------: | -------------------------------- |
| `id`                       | integer/UUID |      Yes | Primary key                      |
| `status`                   | enum         |      Yes | `draft`, `published`, `archived` |
| `name`                     | string       |      Yes | Max 255                          |
| `description`              | text         |       No | Max 1024 initially               |
| `start_date`               | date         |      Yes | Inclusive                        |
| `end_date`                 | date         |      Yes | Must not precede start           |
| `location`                 | string       |      Yes | Event location                   |
| `created_at`, `updated_at` | timestamp    |      Yes | Directus metadata                |

#### `outbound_trips` and `return_trips`

| Field                      | Type         | Required | Notes                            |
| -------------------------- | ------------ | -------: | -------------------------------- |
| `id`                       | integer/UUID |      Yes | Primary key                      |
| `event_id`                 | relation     |      Yes | Parent event                     |
| `status`                   | enum         |      Yes | `draft`, `published`, `archived` |
| `destination`              | string       |      Yes | Usually event location           |
| `departs_from`             | string       |      Yes | Pickup/departure location        |
| `departs_on`               | date         |      Yes | Direction-specific date          |
| `departs_at`               | time         |      Yes | Direction-specific time          |
| `arrives_at`               | time         |       No | Estimated arrival                |
| `created_at`, `updated_at` | timestamp    |      Yes | Directus metadata                |

The existing schema stores these as two polymorphic collections linked through
`event_trips`. The normalized schema uses direct `event_id` relations and a
`direction` enum where a single trip collection is appropriate; this is simpler
to query and limits the number of Directus relationship collections.

#### `vehicles`

| Field                      | Type             | Required | Notes                                      |
| -------------------------- | ---------------- | -------: | ------------------------------------------ |
| `id`                       | integer/UUID     |      Yes | Primary key                                |
| `status`                   | enum             |      Yes | `published`, `draft`, `archived`           |
| `name`                     | string           |      Yes | Human-readable vehicle label               |
| `vehicle_type`             | enum/string      |      Yes | Car, Van, Shuttle, Bus, Other              |
| `seats`                    | positive integer |      Yes | Capacity                                   |
| `primary_driver_id`        | user relation    |      Yes | Assigned driver; assignable by admins only |
| `created_at`, `updated_at` | timestamp        |      Yes | Directus metadata                          |

#### `trip_rides`

| Field                      | Type         | Required | Notes                       |
| -------------------------- | ------------ | -------: | --------------------------- |
| `id`                       | integer/UUID |      Yes | Primary key                 |
| `trip_id`                  | relation     |      Yes | One outbound or return trip |
| `vehicle_id`               | relation     |      Yes | Assigned vehicle            |
| `created_at`, `updated_at` | timestamp    |      Yes | Directus metadata           |

Enforce a unique `(trip_id, vehicle_id)` constraint.

#### `trip_ride_riders`

| Field          | Type          | Required | Notes         |
| -------------- | ------------- | -------: | ------------- |
| `id`           | integer/UUID  |      Yes | Primary key   |
| `trip_ride_id` | relation      |      Yes | Assigned ride |
| `user_id`      | user relation |      Yes | Rider         |
| `created_at`   | timestamp     |      Yes | Auditability  |

Enforce a unique `(trip_ride_id, user_id)` constraint. The service must also
enforce one rider assignment per user per direction, because a database
constraint on the junction alone cannot express that rule.

#### `transportation_decisions`

| Field          | Type          |    Required | Notes                |
| -------------- | ------------- | ----------: | -------------------- |
| `id`           | integer/UUID  |         Yes | Primary key          |
| `event_id`     | relation      |         Yes | Event                |
| `user_id`      | user relation |         Yes | Team member          |
| `direction`    | enum          |         Yes | `outbound`, `return` |
| `decision`     | enum          |         Yes | `ride`, `opt_out`    |
| `trip_ride_id` | relation      | Conditional | Required for `ride`  |
| `updated_at`   | timestamp     |         Yes | Audit trail          |

Enforce a unique `(event_id, user_id, direction)` constraint. This collection
is the recommended replacement for treating event attendance plus rider rows as
an implicit opt-out system.

#### `users`

The carpool app must not manage the users collection. It needs only the minimum
profile fields required for display, role checks, and driver selection:

- stable `id`;
- display name (`firstname`, `lastname` or a precomputed `display_name`);
- `email_address` and `phone_number` only where contact display is permitted;
- `role`, an enum whose only values are `rider`, `driver`, and `admin`, defaulting to
  `rider`;
- published/active status.

The `role` field is read-only to the carpool app. Authentication identifiers,
password fields, groups unrelated to carpool, full directory fields, photos,
addresses, emergency information, and CMS metadata must not be queried or
exposed by the carpool app.

### 5.3 Directus permissions and API boundary

Directus is a backend for this app, not a second website CMS. Configure a
dedicated carpool project/schema or a tightly scoped namespace. The app’s
server-side token may access only the collections and fields above.

Required safeguards:

- keep the Directus static token server-side; never expose it to browser code;
- use allowlisted collection/field queries, not arbitrary client-supplied
  GraphQL strings;
- expose published events/trips/vehicles and minimal rider display data only;
- deny access to all old CMS collections (`pages`, `posts`, `announcements`,
  `photo_album`, `docs`, `global`, `languages`, `todo_*`, and similar);
- deny writes to Directus system collections and the users collection;
- apply field-level restrictions to contact information;
- use server-side transactions or a Directus flow/custom endpoint for
  transportation updates and capacity checks;
- record created/updated timestamps and the actor identity once auth exists;
- return only normalized DTOs from SvelteKit server routes.

The existing repository currently uses a broad static-token GraphQL client in
[`src/lib/server/client.js`](../src/lib/server/client.js). The new app should
retain the server-only adapter idea but replace broad query access with a
small typed repository:

```text
EventRepository
TripRepository
VehicleRepository
TransportationRepository
IdentityProfileRepository
```

No page component should call Directus directly.

## 6. Server architecture

Use SvelteKit server load functions and `+server.js`/`+server.ts` endpoints:

```text
Svelte pages/components
        |
        v
SvelteKit load/actions/API routes
        |
        v
Carpool application services
        |
        v
Directus repository (REST or constrained GraphQL)
        |
        v
Directus/PostgreSQL
```

### Application services

- `EventService`: list active events, read event aggregate, create/update/archive
  events.
- `TripService`: create/update/archive trips and attach/detach vehicles.
- `VehicleService`: list all vehicles for admins, or the current driver’s own
  vehicle for drivers; create, assign, delete, and retire vehicles only after
  an `admin` role check, while allowing drivers to update permitted fields on
  their own vehicle.
- `TransportationService`: read and atomically replace a user’s two decisions,
  add/remove riders, enforce capacity and uniqueness, and allow drivers to
  modify riders only on their own vehicle’s assigned trip rides.
- `ExportService`: create event-scoped CSV/print DTOs.

The services must validate inputs before repository calls, enforce
`currentUser.role === 'admin'` for global administrative operations and
`currentUser.role === 'driver'` with an ownership check for scoped driver
operations, and convert backend errors into explicit HTTP outcomes:

| Condition                                                                     | HTTP result                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------- |
| Invalid form or impossible date/capacity                                      | `400`                                             |
| Missing future identity                                                       | `401`/integration-specific “identity unavailable” |
| Identity lacks the required `admin` role or driver ownership for an operation | `403`                                             |
| Event/trip/vehicle not found                                                  | `404`                                             |
| Seat conflict or stale update                                                 | `409`                                             |
| Directus/unexpected failure                                                   | `502` or `500` with server logging                |

Do not catch an error and return an empty list or a success-shaped response.

### Atomic transportation update

`PUT /api/events/[eventId]/transportation` accepts:

```json
{
	"outbound": { "decision": "ride", "tripRideId": "123" },
	"return": { "decision": "opt_out" }
}
```

The service should:

1. validate both direction keys and their decision shapes;
2. load the event, trips, selected rides, current user, and capacities;
3. reject stale or unavailable rides;
4. remove the user’s previous decisions/rider relationships for this event;
5. create the two new decisions and rider relationships;
6. commit as one transaction;
7. return the normalized status and remaining seats.

If Directus cannot provide a transaction across these collections, implement a
single Directus custom endpoint/flow or a database-side transaction. Do not
rely on two independent browser requests.

## 7. UI behavior and accessibility

- Mobile is a primary use case: controls must work at team events and on small
  screens.
- Use semantic headings, labels, buttons, forms, and links.
- Every form field has a visible label and an inline validation message.
- Selection controls expose selected, unavailable, full, and opted-out states
  without relying only on color.
- After save, announce success or failure in an `aria-live` region and focus the
  relevant status.
- Confirmation dialogs must be keyboard accessible and cancellable.
- Rider contact information should be hidden by default unless the future
  policy grants it.
- Include print CSS for rider lists without depending on the old global layout.
- Use a small, consistent design system; do not carry forward the old Bootstrap
  3/static jQuery assets.

Recommended visual hierarchy:

1. event title/date/location;
2. transportation completion banner (“Both directions decided” or actionable
   missing-decision warning);
3. outbound and return sections;
4. trip/vehicle cards with capacity;
5. admin tools below the member workflow, with driver tools visible only to
   `role = driver` or `role = admin` and scoped to the driver's vehicle.

## 8. State, caching, and consistency

- Server load functions provide the initial event snapshot.
- Form actions/API calls invalidate the event data after every mutation.
- Do not keep authoritative rider or seat state in local storage.
- Pending mutations disable the affected controls and show progress.
- A `409` response causes a refresh and explains that another person took the
  seat.
- Use stable IDs and ISO date/time values in DTOs; format only at the UI edge.
- Avoid optimistic seat counts unless the response is reconciled immediately.

## 9. Testing and acceptance criteria

The new project should include tests for:

### Domain/service tests

- one ride per direction;
- explicit opt-out requirement;
- both-direction selection;
- one-direction selection plus opt-out;
- duplicate selection rejection;
- full-vehicle rejection;
- concurrent seat conflict;
- admin role gating for event, trip, vehicle, assignment, rider, and export operations;
- vehicle capacity reduction;
- event/trip lifecycle filtering;
- cleanup of assignments and riders.

### Route/component tests

- `/` renders active events and empty/error states;
- unauthenticated `/` shows the identity notice without querying or rendering
  events;
- event page renders both directions and current status;
- save sends one complete transportation payload;
- vehicle/admin controls are capability-gated;
- rider and export views are event-scoped;
- keyboard and accessible-name checks for all controls.

### Acceptance scenarios

1. An authenticated team member can open the landing page and understand
   available events without seeing the broader website; an unauthenticated
   visitor sees a sign-in notice and no event data.
2. A member can choose one outbound and one return vehicle and sees both
   choices after reload.
3. A member needing only one direction can complete registration by opting out
   of the other.
4. A full vehicle cannot be selected, including when two users submit
   simultaneously.
5. A rider can select their own transportation; an admin can manage all
   events, trips, vehicles, assignments, riders, or exports; and a driver can
   manage only their own vehicle and its associated riders.
6. Draft and archived events are not shown on the landing page.
7. The Directus token cannot read or write non-carpool CMS collections.
8. No login, signup, password, JWT, or authorization implementation is present
   in the new application.

## 10. Development milestones

Each milestone is complete only when its implementation, tests, and acceptance
criteria pass. A later milestone must not silently compensate for a failed
criterion from an earlier one.

### Milestone 1: Application foundation and contracts (**COMPLETE**)

Implement the SvelteKit shell, route structure, DTOs, identity-provider
interface, normalized collection constants, and repository/service interfaces.
Keep authentication out of scope while making the identity-unavailable state
explicit.

**Testing:**

- Run type checking, linting, and unit tests for DTO validation and identity
  states.
- Verify that the root and event routes have deterministic loading, empty, and
  backend-error states.
- Add a static check that the new application does not introduce login,
  signup, password, JWT, or CMS routes.

**Acceptance criteria:**

- `/` is the carpool event landing page.
- Server modules, not page components, own Directus access.
- DTOs expose only the fields defined in this document.
- Missing identity produces an explicit integration-specific response rather
  than an anonymous success response.

### Milestone 2: Normalized persistence and read workflows (**COMPLETE**)

Create the normalized Directus collections and constrained repositories for
events, outbound trips, return trips, vehicles, trip rides, rider junctions,
transportation decisions, and minimal user references.

The schema migration source of truth is
[`migrations/001-normalized-carpool.json`](../migrations/001-normalized-carpool.json)
plus [`migrations/001-normalized-carpool.sql`](../migrations/001-normalized-carpool.sql).
The local development data migration is
[`migrations/002-demo-carpool.json`](../migrations/002-demo-carpool.json) plus
[`migrations/002-demo-carpool.sql`](../migrations/002-demo-carpool.sql). Apply
both to the local Docker stack with `pnpm directus:migrate`; the command is
idempotent and provisions Directus metadata, relations, PostgreSQL checks,
unique indexes, and a complete working demo carpool. Verify the live stack with
`pnpm directus:test`.

**Testing:**

- Apply the migration to the running Docker Directus/PostgreSQL stack and
  rerun it to verify idempotence.
- Run repository contract tests against an isolated Directus instance or
  equivalent test backend, plus the live migration verification script.
- Verify collection and field allowlists, published-status filtering, and
  event-scoped reads.
- Verify that requests for CMS collections, password fields, and unrelated
  user fields are rejected.

**Acceptance criteria:**

- The application uses the normalized collection names with no legacy aliases.
- A repeatable migration provisions all eight normalized collections and their
  relations in Directus, with PostgreSQL constraints for lifecycle values,
  date ordering, positive capacity, explicit decisions, and uniqueness.
- Published events and their transportation options load in one normalized
  event view.
- Draft and archived events are excluded from the landing page.
- No retained workflow requires a website-only collection.

### Milestone 3: Member transportation workflow (**COMPLETE**)

Implement the event workspace and the atomic transportation update for one
outbound and one return decision per member.

The application-side service, route, and UI are implemented. The Directus
atomic endpoint is provided by
[`directus/extensions/endpoints/carpool-transportation/index.js`](../directus/extensions/endpoints/carpool-transportation/index.js),
with the Directus 12 package manifest in
[`directus/extensions/endpoints/package.json`](../directus/extensions/endpoints/package.json).
The local Docker Compose stack bind-mounts this extension, and the configured
identity provider supports the WordPress-backed launch session when enabled and
the local environment identity for role-specific development. Authentication
and session behavior are specified in
[`wordpress-integration-design.md`](./wordpress-integration-design.md).

**Testing:**

- Cover both-direction selection, one-direction selection plus opt-out,
  clearing/changing decisions, duplicate selection rejection, capacity
  validation, stale updates, and concurrent seat conflicts.
- Exercise `PUT /api/events/[eventId]/transportation` with malformed,
  incomplete, unauthorized, not-found, conflict, and successful payloads.
- Run component and accessibility tests for selected, unavailable, full, and
  opted-out states.
- Run `pnpm directus:test:m3` against the running Docker Directus/PostgreSQL
  stack. The live test loads an event through the app, saves both decisions in
  one request, verifies the Directus junction state, rejects a stale update,
  rejects a full vehicle without partial decisions, and verifies clearing a
  ride removes its rider assignment.
- Run `pnpm check`, `pnpm build`, and `pnpm test:unit -- --run`.

**Acceptance criteria:**

- A member can save a complete transportation status with one request.
- A member cannot save two rides in the same direction.
- A member must explicitly decide `ride` or `opt_out` for both directions.
- A full vehicle and a concurrent seat conflict produce `409` without partial
  state.
- Reloading the event shows the persisted decisions and remaining seats.

### Milestone 4: Administrative management (**COMPLETE**)

Implement admin-only event, trip, assignment, and global vehicle management,
plus scoped driver management for a driver's own vehicle and its riders,
including lifecycle filtering and capacity safeguards.

The administrative boundary is implemented by
[`src/lib/server/services/admin-service.ts`](../src/lib/server/services/admin-service.ts)
and the constrained Directus implementation in
[`src/lib/server/repositories/directus.ts`](../src/lib/server/repositories/directus.ts).
The documented API routes now enforce identity, role, ownership, capacity, and
dependent-assignment checks on the server. Management pages are available for
event editing, trip creation and assignment, fleet management, vehicle
editing, and rider add/remove/move operations. Deletes clean up empty child
assignments and reject destructive operations when active riders would be
orphaned.

**Testing:**

- Run service and route authorization tests for every administrative operation
  with `rider`, `driver`, and `admin` identities.
- Verify riders and out-of-scope drivers return `403` even when the UI is
  bypassed.
- Test event/trip lifecycle changes, vehicle capacity reductions, assignment
  cleanup, rider moves/removals, primary-driver updates, and driver ownership
  boundaries.
- Run `pnpm directus:test:m4` against the running Docker Directus/PostgreSQL
  stack. The live test exercises admin event/trip CRUD, vehicle assignment,
  rider management, driver-owned vehicle updates, out-of-scope vehicle
  rejection, global-operation rejection, and assignment cleanup.
- Run `pnpm check`, `pnpm build`, and `pnpm test:unit -- --run`.

**Acceptance criteria:**

- Admin controls are hidden for riders and independently protected server-side.
- Driver controls are hidden for riders, and drivers can update only a vehicle
  whose `primary_driver_id` matches their identity.
- A vehicle has one `primary_driver_id`; the relationship grants scoped vehicle
  and rider permissions but no global administrative permissions.
- Capacity reductions cannot invalidate existing riders without an explicit,
  handled outcome.
- Deleting or archiving a parent cleans up or rejects dependent assignments
  according to the service contract.

### Milestone 5: Export, accessibility, and operational boundary (**COMPLETE**)

Implement event-scoped rider exports and print views, responsive interaction,
error reporting, cache invalidation, and Directus permission hardening.

The admin-only export boundary is implemented by
[`src/lib/server/services/export-service.ts`](../src/lib/server/services/export-service.ts)
and [`src/lib/domain/export.ts`](../src/lib/domain/export.ts). CSV output is
deterministic and limited to event, trip, vehicle, driver, and rider
identifiers/display names; the print route at
`/events/[eventId]/riders` uses the same event-scoped DTO and print CSS. The
server hooks and no-store response headers make backend failures visible while
avoiding exception payloads and cache leaks. The existing constrained Directus
client rejects CMS collections, restricted user fields, and all writes to the
users collection before making a request; the production client bundle is
checked for the server token.

**Testing:**

- Verify CSV and print output contains only the requested event and permitted
  fields.
- Run keyboard navigation, accessible-name, focus-management, and `aria-live`
  checks on member and admin workflows.
- Test mutation invalidation, pending-control states, `409` refresh behavior,
  and explicit `500`/`502` logging paths.
- Run `pnpm directus:test:m5` against the running Docker Directus/PostgreSQL
  stack. The live test verifies event-scoped CSV and print output, admin-only
  export access, rider redaction, no-store headers, and the absence of the
  Directus token in client output.
- Run the Directus boundary unit tests for CMS collection, restricted user
  field, and user-write rejection, plus `pnpm check`, `pnpm build`, and
  `pnpm test:unit -- --run`.

**Acceptance criteria:**

- Export and print views are available only to admins and are event-scoped.
- Every form field has a visible label and inline validation feedback.
- Successful and failed saves announce status and restore useful focus.
- The server token cannot read or write non-carpool collections or restricted
  user fields.

### Milestone 6: Release verification (**COMPLETE**)

Run the complete test suite and the acceptance scenarios against an isolated
deployment configuration before release.

The release gate is
[`scripts/milestone6-release-test.mjs`](../scripts/milestone6-release-test.mjs)
and is exposed as `pnpm release:verify`. It runs the typecheck, lint, unit,
build, Playwright, migration, and live Milestone 3–5 checks sequentially and
writes a timestamped result report under `.release-verification/`. The
scenario-to-check mapping and the latest passing verification are recorded in
[`docs/release-verification.md`](../docs/release-verification.md).

**Testing:**

- Run type checking, linting, unit tests, route/component tests, repository
  contract tests, and integration tests as one release gate.
- Execute every acceptance scenario in section 9 with recorded results.
- Verify a clean build and startup using only the documented environment
  variables.

**Acceptance criteria:**

- All tests and all acceptance scenarios pass.
- The app starts successfully without CMS, login, or legacy collection
  dependencies.
- No unresolved high-severity backend, authorization, data-integrity, or
  accessibility failure remains.
- The release configuration uses the server-only Directus token and contains
  no secrets in browser bundles.

## 11. Migration map from the reference repository

The following existing files are behavioral references, not files to copy
wholesale:

| Current source                                                                                                                   | Use in recreation                                |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [`src/routes/carpool/+page.svelte`](../../ligerbots-carpool-app/src/routes/carpool/+page.svelte)                                 | Event list fields, admin actions, empty state    |
| [`src/routes/carpool/[id]/+page.svelte`](../../ligerbots-carpool-app/src/routes/carpool/%5Bid%5D/+page.svelte)                   | Two-direction selection and event workspace      |
| [`src/lib/components/CarpoolTrip.svelte`](../../ligerbots-carpool-app/src/lib/components/CarpoolTrip.svelte)                     | Trip/vehicle/rider presentation                  |
| [`src/lib/components/CreateOrModifySignup.svelte`](../../ligerbots-carpool-app/src/lib/components/CreateOrModifySignup.svelte)   | Selection/editing interaction reference          |
| [`src/lib/components/CreateOrModifyVehicle.svelte`](../../ligerbots-carpool-app/src/lib/components/CreateOrModifyVehicle.svelte) | Vehicle form fields                              |
| [`src/lib/components/RiderList.svelte`](../../ligerbots-carpool-app/src/lib/components/RiderList.svelte)                         | Rider list and print behavior                    |
| [`src/lib/server/event.js`](../../ligerbots-carpool-app/src/lib/server/event.js)                                                 | Event, trip, assignment, and attendee operations |
| [`src/lib/server/trip.js`](../../ligerbots-carpool-app/src/lib/server/trip.js)                                                   | Trip retrieval/update behavior                   |
| [`src/lib/server/ride.js`](../../ligerbots-carpool-app/src/lib/server/ride.js)                                                   | Vehicle CRUD behavior                            |
| [`src/lib/server/rider.js`](../../ligerbots-carpool-app/src/lib/server/rider.js)                                                 | Rider relationship behavior                      |
| [`src/lib/server/graphql/event.js`](../../ligerbots-carpool-app/src/lib/server/graphql/event.js)                                 | Existing Directus fields and relationships       |
| [`src/lib/server/graphql/trip.js`](../../ligerbots-carpool-app/src/lib/server/graphql/trip.js)                                   | Direction-specific trip operations               |
| [`src/lib/server/graphql/trip_ride.js`](../../ligerbots-carpool-app/src/lib/server/graphql/trip_ride.js)                         | Trip-vehicle assignment operations               |
| [`src/lib/server/graphql/rider.js`](../../ligerbots-carpool-app/src/lib/server/graphql/rider.js)                                 | Rider junction operations                        |
| [`dev-plan/use-cases-summary.md`](../../ligerbots-carpool-app/dev-plan/use-cases-summary.md)                                     | Intended use cases and business rules            |

Do not migrate the old `+layout.svelte`, `Masthead`, `Navbar`, `Footer`,
WordPress/CMS server models, general user directory, login routes, or unrelated
GraphQL query modules.

## 12. Known gaps and decisions

The reference repository documents or demonstrates these incomplete areas:

- explicit opt-out/opt-in endpoints are listed as missing;
- fast reservation is proposed but not implemented;
- trip detail and trip editing routes are inconsistent;
- some join/leave endpoints reference the wrong service and have missing imports;
- some mutations are fire-and-forget, which can create partial updates;
- the current UI mixes server identity, `sessionStorage`, and cookies;
- vehicle-driver relationships are represented inconsistently;
- event/trip relation writes are performed as separate operations;
- broad Directus queries expose more user/CMS data than carpool needs.

The new app resolves these by:

- using one atomic transportation-status command;
- representing opt-out explicitly;
- using one repository/service boundary;
- using a future identity interface whose `CurrentUser.role` is `rider`,
  `driver`, or `admin`, with driver features scoped to the driver’s own
  vehicle and admin features gated by `role = admin`;
- using constrained DTOs and Directus permissions;
- using canonical domain names and direct event/trip relations where possible.

The schema compatibility decision is resolved: there is no existing data to
migrate, so implementation will create and use the normalized collection names
defined in section 5.1. No compatibility aliases for the legacy collection
names are required.

The shared-driver decision is also resolved: each vehicle will have one
`primary_driver_id`. The schema will not preserve the current driver array for
compatibility. Multiple drivers can be added later only if a concrete workflow
requires them. A vehicle's primary driver receives the scoped `driver` role
permissions defined in section 2 for that vehicle and its associated riders,
but only `role = admin` grants global administrative access.

## 13. Definition of done

The recreation is complete when:

- the root route is the carpool event list;
- all member workflows work without the broader website;
- event, trip, vehicle, assignment, rider, and explicit decision data are
  persisted and reloaded correctly;
- capacity and one-per-direction rules are enforced server-side;
- admin UI is present only for `role = admin`, driver UI is scoped to the
  driver’s own vehicle, and Carpool authorization is based on the authenticated
  identity supplied by the WordPress integration;
- Directus exposes only the carpool collections and minimal user fields;
- the app has no CMS, blog, directory, login, signup, password, JWT, or
  unrelated website route;
- the test and acceptance scenarios in this document pass.
