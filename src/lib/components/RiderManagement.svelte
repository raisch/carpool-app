<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { UserProfileDto, VehicleAssignmentDto } from '#lib/domain/types';

	let { assignments, riders }: { assignments: VehicleAssignmentDto[]; riders: UserProfileDto[] } =
		$props();
	let selectedRider = $state<Record<string, string>>({});
	let destinations = $state<Record<string, string>>({});
	let feedback = $state('');

	async function request(path: string, method: string, body: unknown): Promise<boolean> {
		const response = await fetch(path, {
			method,
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify(body)
		});
		if (!response.ok) {
			try {
				const result: unknown = await response.json();
				if (
					typeof result === 'object' &&
					result !== null &&
					'error' in result &&
					typeof result.error === 'object' &&
					result.error !== null &&
					'message' in result.error &&
					typeof result.error.message === 'string'
				) {
					feedback = result.error.message;
					return false;
				}
			} catch {
				// Use the generic message below.
			}
			feedback = 'The rider change could not be saved.';
			return false;
		}
		feedback = 'Rider changes saved.';
		await invalidateAll();
		return true;
	}

	async function add(assignment: VehicleAssignmentDto): Promise<void> {
		const userId = selectedRider[assignment.tripRideId];
		if (userId)
			await request(
				resolve('/api/trip-rides/[tripRideId]/riders', { tripRideId: assignment.tripRideId }),
				'POST',
				{ userId }
			);
	}

	async function remove(assignment: VehicleAssignmentDto, userId: string): Promise<void> {
		await request(
			resolve('/api/trip-rides/[tripRideId]/riders', { tripRideId: assignment.tripRideId }),
			'DELETE',
			{ userId }
		);
	}

	async function move(assignment: VehicleAssignmentDto, userId: string): Promise<void> {
		const destinationTripRideId = destinations[`${assignment.tripRideId}:${userId}`];
		if (destinationTripRideId)
			await request(
				resolve('/api/trip-rides/[tripRideId]/riders', { tripRideId: assignment.tripRideId }),
				'PATCH',
				{ userId, destinationTripRideId }
			);
	}
</script>

<section
	class="mt-8 rounded-2xl border border-slate-200 bg-white p-5"
	aria-labelledby="rider-management-heading"
>
	<h2 id="rider-management-heading" class="text-xl font-semibold">Rider management</h2>
	<p class="mt-2 text-sm text-slate-600">
		Add, remove, or move riders while capacity and one-direction assignment rules are enforced on
		the server.
	</p>
	<div class="mt-4 space-y-5">
		{#each assignments as assignment (assignment.tripRideId)}
			<div class="border-t border-slate-200 pt-4">
				<h3 class="font-semibold">{assignment.trip.direction} · {assignment.trip.destination}</h3>
				{#if assignment.riders.length > 0}
					<ul class="mt-3 space-y-3">
						{#each assignment.riders as rider (rider.id)}
							<li class="rounded-lg bg-slate-50 p-3">
								<div class="flex flex-wrap items-center justify-between gap-3">
									<span class="font-medium">{rider.displayName}</span><button
										class="rounded border border-red-300 px-2 py-1 text-sm text-red-800"
										type="button"
										onclick={() => remove(assignment, rider.id)}>Remove</button
									>
								</div>
								<label class="mt-2 block text-sm text-slate-600"
									>Move to<select
										class="ml-2 rounded border border-slate-300 px-2 py-1"
										value={destinations[`${assignment.tripRideId}:${rider.id}`] ?? ''}
										onchange={(event) => {
											destinations[`${assignment.tripRideId}:${rider.id}`] =
												event.currentTarget.value;
										}}
										><option value="">Choose assignment…</option
										>{#each assignments.filter((candidate) => candidate.tripRideId !== assignment.tripRideId && candidate.trip.direction === assignment.trip.direction) as destination (destination.tripRideId)}<option
												value={destination.tripRideId}
												>{destination.trip.destination} · {destination.trip.departsOn}</option
											>{/each}</select
									></label
								>
								<button
									class="mt-2 rounded border border-slate-300 px-2 py-1 text-sm"
									type="button"
									onclick={() => move(assignment, rider.id)}>Move rider</button
								>
							</li>
						{/each}
					</ul>
				{:else}<p class="mt-2 text-sm text-slate-500">No riders assigned.</p>{/if}
				<div class="mt-3 flex flex-wrap items-end gap-2">
					<label class="text-sm font-medium"
						>Add rider<select
							class="ml-2 rounded border border-slate-300 px-2 py-1"
							value={selectedRider[assignment.tripRideId] ?? ''}
							onchange={(event) => {
								selectedRider[assignment.tripRideId] = event.currentTarget.value;
							}}
							><option value="">Choose rider…</option>{#each riders as rider (rider.id)}<option
									value={rider.id}>{rider.displayName}</option
								>{/each}</select
						></label
					><button
						class="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
						type="button"
						onclick={() => add(assignment)}>Add</button
					>
				</div>
			</div>
		{/each}
	</div>
	{#if feedback}<p
			tabindex="-1"
			class="mt-4 text-sm text-slate-700"
			role="status"
			aria-live="polite"
		>
			{feedback}
		</p>{/if}
</section>
