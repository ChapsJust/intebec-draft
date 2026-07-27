<script lang="ts">
	import HeroWelcome from '$lib/components/HeroWelcome.svelte';
	import RecentDocuments from '$lib/components/RecentDocuments.svelte';
	import type { DocumentSummary } from '$lib/types';

	// Données mockées — à remplacer par une requête Drizzle (load côté serveur).
	const documents: DocumentSummary[] = [
		{
			id: '1',
			title: 'Migration infonuagique — phase 1',
			client: 'Constructions Rivard',
			type: 'soumission',
			status: 'brouillon',
			updatedAt: '2026-07-27'
		},
		{
			id: '2',
			title: 'Contrat de service géré',
			client: 'Groupe Lemieux',
			type: 'contrat',
			status: 'genere',
			updatedAt: '2026-07-25'
		},
		{
			id: '3',
			title: 'Audit de cybersécurité',
			client: 'Clinique Beauport',
			type: 'soumission',
			status: 'envoye',
			updatedAt: '2026-07-22'
		}
	];
</script>

<HeroWelcome />
<RecentDocuments {documents} />
