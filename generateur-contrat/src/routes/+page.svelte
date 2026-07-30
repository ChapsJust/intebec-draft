<script lang="ts">
	import HeroWelcome from '$lib/components/HeroWelcome.svelte';
	import RecentDocuments from '$lib/components/RecentDocuments.svelte';
	import type { PageData } from './$types';
	import type { ResumeDocument, MandatEnregistre } from '$domaine/types';

	let { data }: { data: PageData } = $props();

	const resume = (m: MandatEnregistre): ResumeDocument => ({
		id: m.id,
		title: m.titre || 'Sans titre',
		client: m.clientNom || 'Client à définir',
		type: m.type,
		status: m.statut,
		updatedAt: m.majLe,
		archived: m.archiveLe !== null
	});

	const documents = $derived(data.mandats.map(resume));
	const archives = $derived(data.archives.map(resume));
</script>

<HeroWelcome />
<RecentDocuments {documents} {archives} />
