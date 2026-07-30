<script lang="ts">
	import { enhance } from '$app/forms';
	import ConfirmationAction from '$composants/ui/ConfirmationAction.svelte';
	import Icone from '$composants/ui/Icone.svelte';
	import EtiquetteStatut from '$composants/ui/EtiquetteStatut.svelte';
	import type { ResumeDocument } from '$domaine/types';

	let { doc }: { doc: ResumeDocument } = $props();

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
			<Icone name={doc.type === 'contrat' ? 'contract' : 'document'} size={18} />
		</span>
		<span class="min-w-0 flex-1">
			<span class="block truncate font-medium text-ink">{doc.title}</span>
			<span class="block truncate text-sm text-ink-muted">{doc.client}</span>
		</span>
	</a>
	<EtiquetteStatut status={doc.status} />
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
			<Icone name="copy" size={14} />
		</button>
	</form>

	{#if doc.archived}
		<ConfirmationAction
			action="?/desarchiver"
			id={doc.id}
			ton="neutre"
			titre="Désarchiver ce document ?"
			message="« {doc.title} » réapparaîtra dans les documents récents."
			confirmLabel="Désarchiver"
			ariaLabel="Désarchiver ce mandat"
			class="inline-flex shrink-0 items-center justify-center rounded-lg border border-border-subtle p-2 text-ink-muted transition hover:bg-surface hover:text-ink"
		>
			<Icone name="archive-restore" size={14} />
		</ConfirmationAction>
	{:else}
		<ConfirmationAction
			action="?/archiver"
			id={doc.id}
			ton="neutre"
			titre="Archiver ce document ?"
			message="« {doc.title} » sortira des documents récents sans être supprimé. Vous le retrouverez dans les documents archivés, prêt à être désarchivé."
			confirmLabel="Archiver"
			ariaLabel="Archiver ce mandat"
			class="inline-flex shrink-0 items-center justify-center rounded-lg border border-border-subtle p-2 text-ink-muted transition hover:bg-surface hover:text-ink"
		>
			<Icone name="archive" size={14} />
		</ConfirmationAction>
	{/if}

	<ConfirmationAction
		action="?/supprimer"
		id={doc.id}
		titre="Supprimer ce document ?"
		message="« {doc.title} » ({doc.client}) sera supprimé définitivement, avec sa rédaction et son historique. Cette action est irréversible."
		confirmLabel="Supprimer définitivement"
		ariaLabel="Supprimer ce mandat"
		class="inline-flex shrink-0 items-center justify-center rounded-lg border border-border-subtle p-2 text-ink-muted transition hover:border-danger/40 hover:bg-danger/5 hover:text-danger"
	>
		<Icone name="trash" size={14} />
	</ConfirmationAction>
</div>
