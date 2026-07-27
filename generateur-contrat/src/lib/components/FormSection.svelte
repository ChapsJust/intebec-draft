<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		children
	}: { title: string; description?: string; children: Snippet } = $props();
</script>

<section class="section-card">
	<h2 class="text-lg font-semibold text-ink">{title}</h2>
	{#if description}
		<p class="mt-1 text-sm text-ink-muted">{description}</p>
	{/if}
	<div class="mt-6 space-y-5">
		{@render children()}
	</div>
</section>
