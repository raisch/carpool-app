<script lang="ts">
	let {
		title = 'Nothing here yet',
		message = 'There is nothing to show right now.'
	}: { title?: string; message?: string } = $props();
</script>

<section class="legacy-panel p-6 text-center">
	<h2 class="text-lg font-semibold text-slate-900">{title}</h2>
	<p class="mt-2 text-sm text-slate-600">{message}</p>
</section>
