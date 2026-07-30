<script lang="ts">
	import type {
		AuditClauses,
		ClauseBibliotheque,
		ConditionsParticulieres,
		PropositionClause
	} from '$domaine/types';
	import { CLES_CLAUSES } from '$document/catalogue';
	import SectionFormulaire from '$composants/ui/SectionFormulaire.svelte';
	import ChampsChiffres from './ChampsChiffres.svelte';
	import Catalogue from './Catalogue.svelte';
	import Personnalisees from './Personnalisees.svelte';
	import Relecture from './Relecture.svelte';

	let {
		conditions = $bindable(),
		clausesBibliotheque = [],
		onAuditer,
		onRetenirProposition
	}: {
		conditions: ConditionsParticulieres;
		/** Clauses hors catalogue déjà connues, réutilisables sur ce mandat. */
		clausesBibliotheque?: ClauseBibliotheque[];
		/** Absent tant que l'IA n'est pas configurée : le formulaire reste alors utilisable seul. */
		onAuditer?: () => Promise<AuditClauses>;
		onRetenirProposition?: (proposition: PropositionClause) => Promise<ClauseBibliotheque>;
	} = $props();

	const clausesActives = $derived(CLES_CLAUSES.filter((cle) => conditions.clauses[cle]).length);
</script>

{#snippet summary()}
	Garantie {conditions.dureeGarantieJours}&nbsp;j · Support {conditions.dureeSupportMois}&nbsp;mois
	·
	{clausesActives}/{CLES_CLAUSES.length} clauses actives{#if conditions.clausesRetenues.length > 0}
		&nbsp;· {conditions.clausesRetenues.length} personnalisée{conditions.clausesRetenues.length > 1
			? 's'
			: ''}{/if}
{/snippet}

<SectionFormulaire
	title="Conditions"
	description="Clauses standards et paramètres habituellement variables d'un contrat à l'autre."
	collapsible
	defaultOpen={false}
	{summary}
>
	<ChampsChiffres bind:conditions />

	<Catalogue bind:conditions />

	<Personnalisees bind:conditions {clausesBibliotheque} />

	{#if onAuditer}
		<Relecture bind:conditions {clausesBibliotheque} {onAuditer} {onRetenirProposition} />
	{/if}

	<div>
		<label class="field-label" for="notes-additionnelles"
			>Conditions particulières additionnelles</label
		>
		<textarea
			id="notes-additionnelles"
			class="field-input"
			rows="3"
			bind:value={conditions.notesAdditionnelles}
			placeholder="Toute clause spécifique à ce mandat…"></textarea>
	</div>
</SectionFormulaire>
