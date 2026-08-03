<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import Rendu from '$composants/document/Rendu.svelte';
	import RevueRedaction from '$composants/ia/RevueRedaction.svelte';
	import Icone from '$composants/ui/Icone.svelte';
	import EtiquetteStatut from '$composants/ui/EtiquetteStatut.svelte';
	import { formatDateLongue } from '$document/format';
	import { identiteIncomplete } from '$domaine/config';

	const manques = identiteIncomplete();

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let redactionEnCours = $state(false);
	let formulaireRediger = $state<HTMLFormElement | null>(null);

	const mandat = $derived(data.mandat);
	const redaction = $derived(mandat.redaction);

	/** Déclenche la rédaction dès l'arrivée quand « Générer » vient de nous envoyer ici. L'appel dure
	 * jusqu'à quelques minutes, d'où sa propre requête plutôt que l'enregistrement du mandat. */
	let redactionLancee = false;
	$effect(() => {
		if (!data.redactionAFaire || redactionLancee || !formulaireRediger) return;
		redactionLancee = true;
		formulaireRediger.requestSubmit();
	});
</script>

<svelte:head>
	<title>{mandat.titre || 'Document'} · aperçu</title>
</svelte:head>

<div class="space-y-4 print:space-y-0">
	<div
		class="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-subtle bg-surface p-4 shadow-sm print:hidden"
	>
		<div class="flex items-center gap-3">
			<a
				href="/mandats/{mandat.id}"
				class="inline-flex items-center gap-2 text-sm font-medium text-ink-muted transition hover:text-ink"
			>
				← Modifier le mandat
			</a>
			<EtiquetteStatut status={mandat.statut} />
		</div>
		<div class="flex flex-wrap gap-3">
			<form
				method="POST"
				action="?/rediger"
				bind:this={formulaireRediger}
				use:enhance={() => {
					redactionEnCours = true;
					return async ({ update }) => {
						await update();
						redactionEnCours = false;
					};
				}}
			>
				<button
					type="submit"
					disabled={redactionEnCours}
					class="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted disabled:opacity-60"
				>
					<Icone name="sparkles" size={16} />
					{redactionEnCours
						? 'Rédaction en cours…'
						: redaction
							? 'Relancer la rédaction'
							: 'Rédiger avec l’IA'}
				</button>
			</form>

			{#if redaction}
				<form method="POST" action="?/effacerRedaction" use:enhance>
					<button
						type="submit"
						class="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink"
					>
						Revenir à ma saisie
					</button>
				</form>
			{/if}

			<!-- Statut déclaratif : l'application n'envoie rien elle-même, elle note que vous l'avez
				fait. -->
			<form method="POST" action="?/changerStatut" use:enhance>
				<input
					type="hidden"
					name="statut"
					value={mandat.statut === 'envoye' ? 'genere' : 'envoye'}
				/>
				<button
					type="submit"
					class="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink"
				>
					<Icone name={mandat.statut === 'envoye' ? 'archive-restore' : 'send'} size={16} />
					{mandat.statut === 'envoye' ? 'Marquer comme non envoyé' : 'Marquer comme envoyé'}
				</button>
			</form>

			<!-- PDF produit côté serveur : seule voie pour « Page X sur Y », le nombre total de pages
				n'étant pas accessible au CSS. -->
			<a
				href="/mandats/{mandat.id}/pdf"
				class="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600"
			>
				<Icone name="download" size={16} />
				Télécharger le PDF
			</a>
		</div>
	</div>

	{#if redactionEnCours}
		<div
			class="flex flex-wrap items-center gap-2 rounded-card border border-accent-400/30 bg-accent-500/5 p-3 text-sm text-ink-muted print:hidden"
		>
			<Icone name="sparkles" size={16} />
			<span>
				L’IA locale rédige le document. Cela prend de quelques secondes à quelques minutes selon que
				le modèle doit être rechargé en mémoire. Le mandat est déjà enregistré : vous pouvez quitter
				cette page et revenir.
			</span>
		</div>
	{/if}

	{#if manques.length > 0}
		<div
			class="flex flex-wrap items-center gap-2 rounded-card border border-warning/30 bg-warning/5 p-3 text-sm text-warning print:hidden"
		>
			<span>
				Identité du prestataire incomplète : il manque {manques.join(' et ')}. À renseigner dans
				<code>src/lib/domaine/config.ts</code> avant d'envoyer un document à un client.
			</span>
		</div>
	{/if}

	{#if form?.message}
		<div
			class="rounded-card border p-4 text-sm print:hidden {form.ok
				? 'border-success/30 bg-success/5 text-success'
				: 'border-warning/30 bg-warning/5 text-warning'}"
		>
			{form.message}
		</div>
	{/if}

	<!-- Le dire vaut mieux qu'afficher un diff entre la saisie d'aujourd'hui et la prose d'hier, qui
		se lirait comme des modifications que l'IA n'a jamais faites. -->
	{#if data.redactionCaduque}
		<div
			class="flex flex-wrap items-center gap-2 rounded-card border border-warning/30 bg-warning/5 p-3 text-sm text-warning print:hidden"
		>
			<Icone name="sparkles" size={16} />
			<span>
				Votre saisie a changé depuis cette rédaction : la prose affichée décrit la version
				précédente du mandat. Relancez la rédaction pour la mettre à jour, ou revenez à votre
				saisie.
			</span>
		</div>
	{:else if redaction}
		<div
			class="flex flex-wrap items-center gap-2 rounded-card border border-accent-400/30 bg-accent-500/5 p-3 text-sm text-ink-muted print:hidden"
		>
			<Icone name="sparkles" size={16} />
			<span>
				La prose affichée a été rédigée par l’IA locale ({redaction.modele}) le
				{formatDateLongue(redaction.genereLe)}. Les montants, dates et clauses restent ceux de votre
				saisie. Le détail de ce qui a changé est juste en dessous.
			</span>
		</div>

		<RevueRedaction brouillon={mandat.brouillon} {redaction} />
	{/if}

	<div
		class="overflow-hidden rounded-card border border-border-subtle shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none"
	>
		<Rendu brouillon={mandat.brouillon} {redaction} />
	</div>
</div>
