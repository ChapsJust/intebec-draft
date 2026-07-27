<script lang="ts">
	import HeroWelcome from '$lib/components/HeroWelcome.svelte';
	import RecentDocuments from '$lib/components/RecentDocuments.svelte';
	import type { PageData } from './$types';
	import type { DocumentSummary } from '$lib/types';

	let { data }: { data: PageData } = $props();

	const documents: DocumentSummary[] = data.mandats.map((m) => ({
		id: m.id,
		title: m.titre || 'Sans titre',
		client: m.clientNom || '—',
		type: m.type,
		status: m.statut,
		updatedAt: m.majLe
	}));
</script>

<HeroWelcome />
<RecentDocuments {documents} />
