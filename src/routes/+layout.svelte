<script lang="ts">
	import { navigating, page } from '$app/state';
	import LoadingState from '#lib/components/LoadingState.svelte';
	import RoleNavigation from '#lib/components/RoleNavigation.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import SiteMasthead from '#lib/components/SiteMasthead.svelte';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	const isPrintPreview = $derived(page.url.searchParams.get('print') === '1');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if !isPrintPreview}
	<a class="skip-link" href="#main-content">Skip to main content</a>
	<SiteMasthead />
	<RoleNavigation identity={data.identity} simulatorUrl={data.simulatorUrl} />
{/if}

<div class="site-main-frame">{@render children()}</div>

{#if !isPrintPreview}
	<SiteFooter />
{/if}

{#if !isPrintPreview && navigating.to}
	<div class="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md shadow-lg">
		<LoadingState />
	</div>
{/if}
