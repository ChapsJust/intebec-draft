<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icone from './Icone.svelte';

	let {
		title,
		description,
		collapsible = false,
		defaultOpen = true,
		summary,
		children
	}: {
		title: string;
		description?: string;
		collapsible?: boolean;
		defaultOpen?: boolean;
		summary?: Snippet;
		children: Snippet;
	} = $props();
</script>

{#if collapsible}
	<details class="section-card group" open={defaultOpen}>
		<summary class="section-summary flex cursor-pointer items-start justify-between gap-4">
			<div>
				<h2 class="text-lg font-semibold text-ink">{title}</h2>
				{#if description}
					<p class="mt-1 text-sm text-ink-muted">{description}</p>
				{/if}
			</div>
			<span class="flex shrink-0 items-center gap-3 pt-0.5">
				{#if summary}
					<span class="hidden text-sm text-ink-muted sm:block">{@render summary()}</span>
				{/if}
				<Icone
					name="chevron-down"
					size={18}
					class="text-ink-muted transition group-open:rotate-180"
				/>
			</span>
		</summary>
		<div class="mt-6 space-y-5">
			{@render children()}
		</div>
	</details>
{:else}
	<section class="section-card">
		<h2 class="text-lg font-semibold text-ink">{title}</h2>
		{#if description}
			<p class="mt-1 text-sm text-ink-muted">{description}</p>
		{/if}
		<div class="mt-6 space-y-5">
			{@render children()}
		</div>
	</section>
{/if}
