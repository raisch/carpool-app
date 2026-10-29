<script lang="ts">
	import { navigating } from '$app/state';
	import RoleNavigation from '#lib/components/RoleNavigation.svelte';
	import LoadingState from '#lib/components/LoadingState.svelte';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a class="skip-link" href="#main-content">Skip to main content</a>
<RoleNavigation identity={data.identity} simulatorUrl={data.simulatorUrl} />

{@render children()}

{#if navigating.to}
	<div class="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md shadow-lg">
		<LoadingState />
	</div>
{/if}
