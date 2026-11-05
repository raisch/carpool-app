<script lang="ts">
	import { navigating } from '$app/state';
	import LoadingState from '#lib/components/LoadingState.svelte';
	import RoleNavigation from '#lib/components/RoleNavigation.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import SiteMasthead from '#lib/components/SiteMasthead.svelte';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a class="skip-link" href="#main-content">Skip to main content</a>
<SiteMasthead />
<RoleNavigation identity={data.identity} simulatorUrl={data.simulatorUrl} />

<div class="site-main-frame">{@render children()}</div>

<SiteFooter />

{#if navigating.to}
	<div class="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md shadow-lg">
		<LoadingState />
	</div>
{/if}
