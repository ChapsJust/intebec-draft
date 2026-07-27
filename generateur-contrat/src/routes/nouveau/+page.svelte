<script lang="ts">
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import { createEmptyDraft } from '$lib/mandat';
	import MandatEditor from '$lib/components/MandatEditor.svelte';

	let { data }: { data: PageData } = $props();

	const initialType = page.url.searchParams.get('type') === 'contrat' ? 'contrat' : 'soumission';

	let draft = $state(createEmptyDraft(initialType));
	let clientId = $state<string | null>(null);
	let saveAsNewClient = $state(true);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold text-ink">
			{draft.type === 'contrat' ? 'Nouveau contrat' : 'Nouvelle soumission'}
		</h1>
		<a
			href="/"
			class="inline-flex items-center rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted"
		>
			← Retour à l'accueil
		</a>
	</div>

	<MandatEditor bind:draft bind:clientId bind:saveAsNewClient clients={data.clients} />
</div>
