<script lang="ts">
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import MandatEditor from '$lib/components/MandatEditor.svelte';
	import type { MandatDraft } from '$lib/types';

	let { data }: { data: PageData } = $props();

	let draft = $state<MandatDraft>(structuredClone(data.mandat.draft));
	let clientId = $state<string | null>(data.mandat.clientId);
	let saveAsNewClient = $state(false);

	const banner = $derived(
		page.url.searchParams.get('saved') === '1' ? 'Brouillon enregistré.' : undefined
	);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold text-ink">
			{draft.type === 'contrat' ? 'Contrat' : 'Soumission'} · {draft.titre || 'Sans titre'}
		</h1>
		<div class="flex gap-3">
			<a
				href="/"
				class="inline-flex items-center rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted"
			>
				← Retour à l'accueil
			</a>
			<a
				href="/mandats/{data.mandat.id}/apercu"
				class="inline-flex items-center rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted"
			>
				Voir le document
			</a>
		</div>
	</div>

	<MandatEditor bind:draft bind:clientId bind:saveAsNewClient clients={data.clients} {banner} />
</div>
