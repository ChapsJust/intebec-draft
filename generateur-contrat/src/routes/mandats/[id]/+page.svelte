<script lang="ts">
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import ConfirmAction from '$lib/components/ConfirmAction.svelte';
	import Icon from '$lib/components/Icon.svelte';
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
			{#if !data.mandat.archiveLe}
				<ConfirmAction
					action="?/archiver"
					id={data.mandat.id}
					ton="neutre"
					titre="Archiver ce mandat ?"
					message="« {draft.titre ||
						'Sans titre'} » sortira des listes courantes sans être supprimé. Vous le retrouverez dans les mandats archivés de la fiche client, prêt à être désarchivé."
					confirmLabel="Archiver"
					class="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted"
				>
					<Icon name="archive" size={16} />
					Archiver
				</ConfirmAction>
			{/if}
			<ConfirmAction
				action="?/supprimer"
				id={data.mandat.id}
				titre="Supprimer ce mandat ?"
				message="« {draft.titre ||
					'Sans titre'} » sera supprimé définitivement, avec sa rédaction. Cette action est irréversible : pour le mettre simplement de côté, archivez-le depuis la fiche client."
				confirmLabel="Supprimer définitivement"
				class="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink-muted transition hover:border-danger/40 hover:bg-danger/5 hover:text-danger"
			>
				<Icon name="trash" size={16} />
				Supprimer
			</ConfirmAction>
		</div>
	</div>

	{#if data.mandat.archiveLe}
		<div
			class="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-subtle bg-surface px-4 py-3 text-sm text-ink-muted shadow-sm"
		>
			<span class="inline-flex items-center gap-2">
				<Icon name="archive" size={16} />
				Ce mandat est archivé : il n'apparaît plus dans les listes courantes.
			</span>
			<ConfirmAction
				action="?/desarchiver"
				id={data.mandat.id}
				ton="neutre"
				titre="Désarchiver ce mandat ?"
				message="« {draft.titre || 'Sans titre'} » réapparaîtra dans les listes courantes."
				confirmLabel="Désarchiver"
				class="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-surface-muted"
			>
				<Icon name="archive-restore" size={16} />
				Désarchiver
			</ConfirmAction>
		</div>
	{/if}

	<MandatEditor bind:draft bind:clientId bind:saveAsNewClient clients={data.clients} {banner} />
</div>
