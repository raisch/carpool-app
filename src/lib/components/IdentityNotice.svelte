<script lang="ts">
	import type { IdentityState } from '#lib/domain/types';

	let { identity }: { identity: IdentityState } = $props();
</script>

{#if identity.status === 'not-configured'}
	<div class="legacy-alert text-sm" role="status">
		<strong>Identity integration pending.</strong>
		{identity.message} Transportation decisions will be enabled when identity is connected.
	</div>
{:else if identity.status === 'unauthenticated'}
	<div class="legacy-alert text-sm" role="status">
		<strong>Sign-in required.</strong>
		{identity.message}
	</div>
{/if}
