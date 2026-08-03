<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import type { ClauseBibliotheque } from '$domaine/types';
	import ConfirmationAction from '$composants/ui/ConfirmationAction.svelte';
	import SectionFormulaire from '$composants/ui/SectionFormulaire.svelte';
	import Icone from '$composants/ui/Icone.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** Clause dépliée pour édition. Une seule à la fois : deux textareas ouverts côte à côte sur des
	 * pavés de prose donnent une page illisible. */
	let enEdition = $state<string | null>(null);

	let ajoutOuvert = $state(false);
</script>

<svelte:head>
	<title>Bibliothèque de clauses</title>
</svelte:head>

{#snippet etiquetteOrigine(clause: ClauseBibliotheque)}
	<span
		class="shrink-0 rounded-full border border-border-subtle px-2 py-0.5 text-[0.625rem] font-semibold tracking-wide text-ink-muted uppercase"
	>
		{clause.origine === 'ia' ? 'Proposée par l’IA' : 'Saisie à la main'}
	</span>
{/snippet}

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold text-ink">Bibliothèque de clauses</h1>
			<p class="mt-1 text-sm text-ink-muted">
				Les clauses hors catalogue, réutilisables d’un mandat à l’autre. Ce qu’un mandat retient en
				est une copie : modifier une clause ici ne change aucun document déjà rédigé.
			</p>
		</div>
		<button
			type="button"
			onclick={() => (ajoutOuvert = !ajoutOuvert)}
			class="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600"
		>
			<Icone name="plus" size={16} />
			Nouvelle clause
		</button>
	</div>

	{#if form?.notice}
		<div class="rounded-card border border-border-subtle bg-surface-muted p-4 text-sm text-ink">
			{form.notice}
		</div>
	{/if}

	{#if ajoutOuvert}
		<SectionFormulaire
			title="Nouvelle clause"
			description="Elle rejoint la bibliothèque et devient proposable sur n’importe quel mandat."
		>
			<form
				method="POST"
				action="?/creer"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						ajoutOuvert = false;
					};
				}}
				class="space-y-3"
			>
				<div>
					<label class="field-label" for="nouveau-titre">Titre</label>
					<input id="nouveau-titre" name="titre" class="field-input" required />
				</div>
				<div>
					<label class="field-label" for="nouveau-corps">Texte de la clause</label>
					<textarea id="nouveau-corps" name="corps" class="field-input" rows="6" required
					></textarea>
					<p class="field-hint">
						Un paragraphe par bloc, séparés par une ligne vide. Ils deviennent les alinéas de
						l’article.
					</p>
				</div>
				<div class="flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (ajoutOuvert = false)}
						class="rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted"
					>
						Annuler
					</button>
					<button
						type="submit"
						class="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600"
					>
						Ajouter
					</button>
				</div>
			</form>
		</SectionFormulaire>
	{/if}

	<section class="space-y-3">
		{#if data.clauses.length === 0}
			<div
				class="rounded-card border border-border-subtle bg-surface p-6 text-sm text-ink-muted shadow-sm"
			>
				Aucune clause pour l’instant. Ajoutez-en une, ou laissez la relecture par l’IA vous en
				proposer depuis l’éditeur d’un mandat.
			</div>
		{/if}

		{#each data.clauses as clause (clause.id)}
			<article class="rounded-card border border-border-subtle bg-surface p-4 shadow-sm">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="flex min-w-0 flex-1 items-center gap-2">
						<h2 class="truncate text-sm font-semibold text-ink">{clause.titre}</h2>
						{@render etiquetteOrigine(clause)}
					</div>
					<div class="flex shrink-0 items-center gap-2">
						<button
							type="button"
							onclick={() => (enEdition = enEdition === clause.id ? null : clause.id)}
							class="rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface-muted"
						>
							{enEdition === clause.id ? 'Fermer' : 'Modifier'}
						</button>
						<ConfirmationAction
							action="?/archiver"
							id={clause.id}
							ton="neutre"
							titre="Archiver « {clause.titre} » ?"
							message="La clause sort de la bibliothèque et la relecture cesse de la proposer. Les mandats qui l'ont déjà retenue gardent leur copie du texte, intacte."
							confirmLabel="Archiver"
							ariaLabel="Archiver cette clause"
							class="inline-flex items-center justify-center rounded-lg border border-border-subtle p-2 text-ink-muted transition hover:bg-surface-muted hover:text-ink"
						>
							<Icone name="archive" size={16} />
						</ConfirmationAction>
					</div>
				</div>

				{#if enEdition === clause.id}
					<form
						method="POST"
						action="?/modifier"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
								enEdition = null;
							};
						}}
						class="mt-3 space-y-3 border-t border-border-subtle pt-3"
					>
						<input type="hidden" name="id" value={clause.id} />
						<div>
							<label class="field-label" for="titre-{clause.id}">Titre</label>
							<input
								id="titre-{clause.id}"
								name="titre"
								class="field-input"
								value={clause.titre}
								required
							/>
						</div>
						<div>
							<label class="field-label" for="corps-{clause.id}">Texte</label>
							<textarea id="corps-{clause.id}" name="corps" class="field-input" rows="8" required
								>{clause.corps}</textarea
							>
						</div>
						<div class="flex justify-end">
							<button
								type="submit"
								class="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600"
							>
								Enregistrer
							</button>
						</div>
					</form>
				{:else}
					<p class="mt-2 line-clamp-3 text-sm whitespace-pre-line text-ink-muted">{clause.corps}</p>
				{/if}
			</article>
		{/each}
	</section>

	{#if data.archives.length > 0}
		<details class="rounded-card border border-border-subtle bg-surface p-4 shadow-sm">
			<summary class="cursor-pointer text-sm font-medium text-ink-muted">
				Clauses archivées ({data.archives.length})
			</summary>
			<div class="mt-3 space-y-2">
				{#each data.archives as clause (clause.id)}
					<div
						class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle p-3"
					>
						<div class="flex min-w-0 flex-1 items-center gap-2">
							<span class="truncate text-sm text-ink">{clause.titre}</span>
							{@render etiquetteOrigine(clause)}
						</div>
						<ConfirmationAction
							action="?/desarchiver"
							id={clause.id}
							ton="neutre"
							titre="Désarchiver « {clause.titre} » ?"
							message="La clause revient dans la bibliothèque et la relecture pourra de nouveau la proposer."
							confirmLabel="Désarchiver"
							ariaLabel="Désarchiver cette clause"
							class="inline-flex shrink-0 items-center justify-center rounded-lg border border-border-subtle p-2 text-ink-muted transition hover:bg-surface-muted hover:text-ink"
						>
							<Icone name="archive-restore" size={16} />
						</ConfirmationAction>
					</div>
				{/each}
			</div>
		</details>
	{/if}
</div>
