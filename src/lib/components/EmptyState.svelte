<script lang="ts">
	let {
		title = 'Nothing here yet',
		message = 'There is nothing to show right now.'
	}: { title?: string; message?: string } = $props();
</script>

<section class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
	<h2 class="text-xl font-semibold text-slate-900">{title}</h2>
	<p class="mt-2 text-slate-600">{message}</p>
</section>
