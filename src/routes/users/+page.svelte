<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import ErrorState from '#lib/components/ErrorState.svelte';
	import IdentityNotice from '#lib/components/IdentityNotice.svelte';
	import type { PageData } from './$types';
	import type { Role, UserStatus } from '#lib/domain/types';

	let { data }: { data: PageData } = $props();
	let pendingUserId = $state<string | null>(null);
	let feedback = $state('');

	async function updateUser(userId: string, role: Role, status: UserStatus): Promise<void> {
		pendingUserId = userId;
		feedback = '';
		try {
			const response = await fetch('/api/users', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify({ id: userId, role, status })
			});
			if (!response.ok) {
				const result: unknown = await response.json().catch(() => null);
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
					return;
				}
				feedback = 'The user change could not be saved.';
				return;
			}
			feedback = 'User changes saved.';
			await invalidateAll();
		} finally {
			pendingUserId = null;
		}
	}
</script>

<svelte:head><title>User management | LigerBots Carpool</title></svelte:head>

<main id="main-content" class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
	<a class="text-sm text-blue-700 hover:underline" href={resolve('/')}>← Back to events</a>
	<div class="mt-3">
		<h1 class="text-3xl font-bold">User management</h1>
		<p class="mt-2 text-slate-600">
			Manage Carpool roles and status. WordPress profile updates never overwrite these decisions.
		</p>
	</div>
	<IdentityNotice identity={data.identity} />

	{#if data.status === 'error'}
		<div class="mt-6"><ErrorState message={data.message} /></div>
	{:else if data.users.length === 0}
		<div class="mt-6">
			<EmptyState
				title="No users available"
				message="No Carpool users have been provisioned yet."
			/>
		</div>
	{:else}
		<div class="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
			<table class="w-full min-w-[44rem] text-left text-sm">
				<caption class="sr-only">Carpool users</caption>
				<thead class="border-b border-slate-200 bg-slate-50">
					<tr>
						<th class="px-4 py-3 font-semibold">User</th>
						<th class="px-4 py-3 font-semibold">Source identity</th>
						<th class="px-4 py-3 font-semibold">Role</th>
						<th class="px-4 py-3 font-semibold">Status</th>
						<th class="px-4 py-3"><span class="sr-only">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.users as user (user.id)}
						<tr class="border-b border-slate-100 last:border-0">
							<td class="px-4 py-4">
								<div class="font-semibold">{user.displayName}</div>
								<div class="text-xs text-slate-500">Carpool ID: {user.id}</div>
							</td>
							<td class="px-4 py-4 text-slate-600">
								{user.sourceSystem} / {user.sourceUid}
							</td>
							<td class="px-4 py-4">
								<label>
									<span class="sr-only">Role for {user.displayName}</span>
									<select
										class="rounded border border-slate-300 px-2 py-1"
										value={user.role}
										disabled={pendingUserId === user.id}
										onchange={(event) =>
											updateUser(
												user.id,
												(event.currentTarget as HTMLSelectElement).value as Role,
												user.status
											)}
									>
										<option value="rider">Rider</option>
										<option value="driver">Driver</option>
										<option value="admin">Admin</option>
									</select>
								</label>
							</td>
							<td class="px-4 py-4 capitalize">{user.status}</td>
							<td class="px-4 py-4 text-right">
								<button
									class="rounded border px-3 py-1.5 text-sm font-semibold {user.status === 'active'
										? 'border-red-300 text-red-800 hover:bg-red-50'
										: 'border-green-300 text-green-800 hover:bg-green-50'}"
									type="button"
									disabled={pendingUserId === user.id}
									onclick={() =>
										updateUser(
											user.id,
											user.role,
											user.status === 'active' ? 'inactive' : 'active'
										)}
								>
									{user.status === 'active' ? 'Deactivate' : 'Reactivate'}
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if feedback}
		<p class="mt-4 text-sm text-slate-700" role="status" aria-live="polite">{feedback}</p>
	{/if}
</main>
