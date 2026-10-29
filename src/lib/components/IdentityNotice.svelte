<script lang="ts">
	import type { IdentityState } from '#lib/domain/types';

	let { identity }: { identity: IdentityState } = $props();
</script>

{#if identity.status === 'not-configured'}
	<div
		class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
		role="status"
	>
		<strong>Identity integration pending.</strong>
		{identity.message} Transportation decisions will be enabled when identity is connected.
	</div>
{:else if identity.status === 'unauthenticated'}
	<div
		class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
		role="status"
	>
		<strong>Sign-in required.</strong>
		{identity.message}
	</div>
{/if}
