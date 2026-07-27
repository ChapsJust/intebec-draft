<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from './Icon.svelte';
	import StatusBadge from './StatusBadge.svelte';
	import type { DocumentSummary } from '$lib/types';

	let { doc }: { doc: DocumentSummary } = $props();

	const formatted = $derived(
		new Date(doc.updatedAt).toLocaleDateString('fr-CA', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		})
	);
</script>

<div class="flex items-center gap-4 px-4 py-3 transition hover:bg-surface-muted">
	<a href={`/mandats/${doc.id}`} class="flex min-w-0 flex-1 items-center gap-4">
		<span
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"
		>
			<Icon name={doc.type === 'contrat' ? 'contract' : 'document'} size={18} />
		</span>
		<span class="min-w-0 flex-1">
			<span class="block truncate font-medium text-ink">{doc.title}</span>
			<span class="block truncate text-sm text-ink-muted">{doc.client}</span>
		</span>
	</a>
	<StatusBadge status={doc.status} />
	<span class="hidden w-24 shrink-0 text-right text-sm text-ink-muted sm:block">
		{formatted}
	</span>
	<form method="POST" action="?/dupliquer" use:enhance>
		<input type="hidden" name="id" value={doc.id} />
		<button
			type="submit"
			class="inline-flex shrink-0 items-center justify-center rounded-lg border border-border-subtle p-2 text-ink-muted transition hover:bg-surface hover:text-ink"
			aria-label="Dupliquer ce mandat"
			title="Dupliquer"
		>
			<Icon name="copy" size={14} />
		</button>
	</form>
</div>
