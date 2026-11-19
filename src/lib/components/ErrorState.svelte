<script lang="ts">
	let { message = 'Something went wrong. Please try again.' }: { message?: string } = $props();
</script>

<section class="border border-red-200 bg-red-50 p-6" role="alert">
	<h2 class="text-lg font-semibold text-red-950">We couldn’t load carpool data</h2>
	<p class="mt-2 text-sm text-red-800">{message}</p>
	<button
		type="button"
		onclick={() => location.reload()}
		class="legacy-action mt-4 border-red-900 bg-red-900 text-white hover:bg-red-800"
	>
		Retry
	</button>
</section>
