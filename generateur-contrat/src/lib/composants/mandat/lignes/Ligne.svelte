<script lang="ts">
	import type { LigneService } from '$domaine/types';
	import Icone from '$composants/ui/Icone.svelte';
	import BoutonAssistance from '$composants/ia/BoutonAssistance.svelte';
	import ListeTextes from './ListeTextes.svelte';
	import Tarification from './Tarification.svelte';

	let {
		ligne = $bindable(),
		numero,
		libelle,
		supprimable,
		erreurNom,
		erreurMontant,
		onSupprimer,
		onRediger,
		onProposerElements
	}: {
		ligne: LigneService;
		/** Rang affiché, à partir de 1. */
		numero: number;
		/** « Phase », « Bloc » ou « Service », selon la structure du projet. */
		libelle: string;
		/** Faux sur la dernière ligne : un mandat sans aucune ligne n'a pas de sens. */
		supprimable: boolean;
		erreurNom?: string;
		erreurMontant?: string;
		onSupprimer: () => void;
		/** Absents tant que l'IA n'est pas configurée. */
		onRediger?: (champ: string) => Promise<string>;
		onProposerElements?: (ligneId: string, liste: 'inclus' | 'nonInclus') => Promise<string[]>;
	} = $props();
</script>

<div class="rounded-lg border border-border-subtle p-4">
	<div class="flex items-start justify-between gap-3">
		<div class="flex-1">
			<label class="field-label" for="ligne-nom-{ligne.id}"
				>Nom : {libelle.toLowerCase()} {numero}</label
			>
			<input
				id="ligne-nom-{ligne.id}"
				class="field-input"
				type="text"
				bind:value={ligne.nom}
				placeholder="Ex. Gestion documentaire"
			/>
			{#if erreurNom}
				<p class="mt-1 text-xs text-warning">{erreurNom}</p>
			{/if}
		</div>
		{#if supprimable}
			<button
				type="button"
				class="mt-6 shrink-0 text-ink-muted transition hover:text-warning"
				onclick={onSupprimer}
				aria-label="Retirer cette ligne"
			>
				<Icone name="trash" size={18} />
			</button>
		{/if}
	</div>

	<div class="mt-3">
		<label class="field-label" for="ligne-desc-{ligne.id}">Description</label>
		<textarea id="ligne-desc-{ligne.id}" class="field-input" rows="2" bind:value={ligne.description}
		></textarea>
		{#if onRediger}
			<div class="mt-2">
				<BoutonAssistance
					champ={ligne.id}
					rediger={onRediger}
					appliquer={(texte) => (ligne.description = texte)}
					label="Étoffer avec l’IA"
				/>
			</div>
		{/if}
	</div>

	<div class="mt-3 grid gap-4 sm:grid-cols-2">
		<ListeTextes
			bind:valeurs={ligne.inclus}
			titre="Inclus"
			placeholder="Ex. Sauvegarde automatique"
			libelleAjout="+ Ajouter un élément inclus"
			onProposer={onProposerElements && (() => onProposerElements(ligne.id, 'inclus'))}
		/>
		<ListeTextes
			bind:valeurs={ligne.nonInclus}
			titre="Non inclus (optionnel)"
			placeholder="Ex. Rédaction des textes"
			libelleAjout="+ Ajouter une exclusion"
			onProposer={onProposerElements && (() => onProposerElements(ligne.id, 'nonInclus'))}
		/>
	</div>

	<Tarification bind:ligne erreur={erreurMontant} />

	<div class="mt-3 max-w-xs">
		<label class="field-label" for="delai-{ligne.id}">Délai estimé</label>
		<input
			id="delai-{ligne.id}"
			class="field-input"
			type="text"
			bind:value={ligne.delaiEstime}
			placeholder="Ex. Six (6) semaines suivant la signature"
		/>
	</div>
</div>
