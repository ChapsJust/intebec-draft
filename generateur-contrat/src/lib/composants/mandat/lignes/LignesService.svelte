<script lang="ts">
	import type { LigneService, StructureProjet } from '$domaine/types';
	import { nouvelleLigne } from '$domaine/fabriques';
	import { libelleLigne } from '$document/format';
	import type { ErreurValidation } from '$domaine/validation';
	import { erreurDuChamp } from '$domaine/validation';
	import SectionFormulaire from '$composants/ui/SectionFormulaire.svelte';
	import Icone from '$composants/ui/Icone.svelte';
	import Ligne from './Ligne.svelte';

	let {
		lignes = $bindable(),
		structureProjet,
		erreurs = [],
		onRediger,
		onProposerElements
	}: {
		lignes: LigneService[];
		structureProjet: StructureProjet;
		erreurs?: ErreurValidation[];
		onRediger?: (champ: string) => Promise<string>;
		onProposerElements?: (ligneId: string, liste: 'inclus' | 'nonInclus') => Promise<string[]>;
	} = $props();

	// Même source que le document généré, pour que le vocabulaire ne diverge jamais entre la
	// saisie et le contrat produit.
	const libelle = $derived(libelleLigne(structureProjet));

	const libelleAjout = $derived(
		structureProjet === 'phases'
			? 'une phase'
			: structureProjet === 'blocs'
				? 'un bloc'
				: 'un service'
	);

	function retirer(id: string) {
		const idx = lignes.findIndex((l) => l.id === id);
		if (idx !== -1) lignes.splice(idx, 1);
	}
</script>

<SectionFormulaire
	title="Portée et tarification"
	description="Ajoutez une ligne par {libelle.toLowerCase()}. Le mode de tarification peut varier d'une ligne à l'autre."
>
	<div class="space-y-4">
		{#each lignes as ligne, i (ligne.id)}
			<Ligne
				bind:ligne={lignes[i]}
				numero={i + 1}
				{libelle}
				supprimable={lignes.length > 1}
				erreurNom={erreurDuChamp(erreurs, `lignes.${i}.nom`)}
				erreurMontant={erreurDuChamp(erreurs, `lignes.${i}.montant`)}
				onSupprimer={() => retirer(ligne.id)}
				{onRediger}
				{onProposerElements}
			/>
		{/each}
	</div>

	<button
		type="button"
		class="inline-flex items-center gap-2 rounded-lg border border-dashed border-border-subtle px-4 py-2 text-sm font-medium text-ink-muted transition hover:border-accent-400 hover:text-accent-600"
		onclick={() => lignes.push(nouvelleLigne())}
	>
		<Icone name="plus" size={16} />
		Ajouter {libelleAjout}
	</button>
</SectionFormulaire>
