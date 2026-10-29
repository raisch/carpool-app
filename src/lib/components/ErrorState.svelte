<script lang="ts">
	let { message = 'Something went wrong. Please try again.' }: { message?: string } = $props();
</script>

<section class="rounded-2xl border border-red-200 bg-red-50 p-8" role="alert">
	<h2 class="text-xl font-semibold text-red-950">We couldn’t load carpool data</h2>
	<p class="mt-2 text-red-800">{message}</p>
	<button
		type="button"
		onclick={() => location.reload()}
		class="mt-5 rounded-lg bg-red-900 px-4 py-2 font-medium text-white hover:bg-red-800 focus:outline-2 focus:outline-offset-2 focus:outline-red-900"
	>
		Retry
	</button>
</section>
