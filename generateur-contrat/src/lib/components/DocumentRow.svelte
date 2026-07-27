<script lang="ts">
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

<a
	href={`/documents/${doc.id}`}
	class="flex items-center gap-4 px-4 py-3 transition hover:bg-surface-muted"
>
	<span
		class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"
	>
		<Icon name={doc.type === 'contrat' ? 'contract' : 'document'} size={18} />
	</span>
	<span class="min-w-0 flex-1">
		<span class="block truncate font-medium text-ink">{doc.title}</span>
		<span class="block truncate text-sm text-ink-muted">{doc.client}</span>
	</span>
	<StatusBadge status={doc.status} />
	<span class="hidden w-24 shrink-0 text-right text-sm text-ink-muted sm:block">
		{formatted}
	</span>
</a>
