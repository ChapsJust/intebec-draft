<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type {
		AuditClauses,
		ClauseBibliotheque,
		FicheClient,
		BrouillonMandat,
		PropositionClause,
		RevueMandat
	} from '$domaine/types';
	import { verifierMandat } from '$domaine/validation';
	import { posterAction } from './action-distante';
	import * as ia from './assistance-ia';
	import InfosGenerales from './InfosGenerales.svelte';
	import FormulaireClient from '$composants/client/FormulaireClient.svelte';
	import LignesService from './lignes/LignesService.svelte';
	import Totaux from './Totaux.svelte';
	import Paiement from './Paiement.svelte';
	import Conditions from './conditions/Conditions.svelte';
	import Signature from './Signature.svelte';
	import RevueMandatPanneau from '$composants/ia/RevueMandat.svelte';

	let {
		brouillon = $bindable(),
		clientId = $bindable(),
		enregistrerNouveauClient = $bindable(),
		clients,
		clausesBibliotheque = [],
		banner
	}: {
		brouillon: BrouillonMandat;
		clientId: string | null;
		enregistrerNouveauClient: boolean;
		clients: FicheClient[];
		clausesBibliotheque?: ClauseBibliotheque[];
		banner?: string;
	} = $props();

	let afficherDonnees = $state(false);
	let generationTentee = $state(false);
	let generationEnCours = $state(false);
	let majClientEnCours = $state(false);
	let messageMajClient = $state<string | null>(null);

	const erreurs = $derived(verifierMandat(brouillon));
	const erreursVisibles = $derived(generationTentee ? erreurs : []);
	const erreurPaiement = $derived(
		generationTentee && erreurs.some((e) => e.champ.startsWith('modalitesPaiement.'))
	);

	function auClicGenerer(event: MouseEvent) {
		generationTentee = true;
		if (erreurs.length > 0) {
			event.preventDefault();
		}
	}

	async function majFicheClient() {
		if (!clientId) return;
		majClientEnCours = true;
		messageMajClient = null;
		const body = new FormData();
		body.set('id', clientId);
		body.set('payload', JSON.stringify(brouillon.client));

		// Le `finally` n'est pas décoratif : sans lui, si la requête échoue, le bouton reste désactivé
		// jusqu'à ce que l'utilisateur recharge la page.
		try {
			const result = await posterAction('?/modifierClient', body);
			if (result.type === 'success') {
				messageMajClient = 'Fiche client mise à jour.';
				await invalidateAll();
			}
			await applyAction(result);
		} catch {
			messageMajClient = 'La fiche client n’a pas pu être enregistrée. Vérifiez la connexion.';
		} finally {
			majClientEnCours = false;
		}
	}

	const auditerClauses = (): Promise<AuditClauses> => ia.auditerClauses(brouillon);

	const revoirMandat = (): Promise<RevueMandat> => ia.revoirMandat(brouillon);

	const proposerTexte = (champ: string): Promise<string> => ia.proposerTexte(brouillon, champ);

	const proposerElements = (ligneId: string, liste: 'inclus' | 'nonInclus'): Promise<string[]> =>
		ia.proposerElements(brouillon, ligneId, liste);

	/** On ajoute aussi la clause à la copie locale de la bibliothèque. Sans ça, elle est bien
	 * enregistrée en base, mais elle n'apparaît dans « Ajouter depuis la bibliothèque » qu'après un
	 * rechargement de la page. */
	async function retenirProposition(proposition: PropositionClause): Promise<ClauseBibliotheque> {
		const clause = await ia.enregistrerClause(proposition);
		clausesBibliotheque = [...clausesBibliotheque, clause];
		return clause;
	}
</script>

<form
	method="POST"
	action="?/enregistrer"
	use:enhance={({ action }) => {
		// Seul « Générer » enchaîne sur la rédaction par l'IA, qui prend de longues secondes. Sans
		// ce drapeau, l'utilisateur reste devant un écran figé sans savoir si son clic a marché.
		// « Enregistrer » est immédiat, donc pas besoin.
		generationEnCours = action.search === '?/generer';
		return async ({ update }) => {
			await update();
			generationEnCours = false;
		};
	}}
	class="space-y-6"
>
	<input type="hidden" name="payload" value={JSON.stringify(brouillon)} />
	<input type="hidden" name="clientId" value={clientId ?? ''} />
	<input
		type="hidden"
		name="enregistrerNouveauClient"
		value={enregistrerNouveauClient ? '1' : ''}
	/>

	{#if banner}
		<div class="rounded-card border border-border-subtle bg-surface-muted p-4 text-sm text-ink">
			{banner}
		</div>
	{/if}

	<InfosGenerales
		bind:type={brouillon.type}
		bind:titre={brouillon.titre}
		bind:structureProjet={brouillon.structureProjet}
		bind:objet={brouillon.objet}
		erreurs={erreursVisibles}
		onRediger={proposerTexte}
	/>

	<FormulaireClient
		bind:client={brouillon.client}
		bind:clientId
		bind:enregistrerNouveauClient
		{clients}
		erreurs={erreursVisibles}
		onUpdateClientRecord={majFicheClient}
	/>
	{#if messageMajClient}
		<p class="-mt-4 text-sm text-success">{messageMajClient}</p>
	{/if}

	<LignesService
		bind:lignes={brouillon.lignes}
		structureProjet={brouillon.structureProjet}
		erreurs={erreursVisibles}
		onRediger={proposerTexte}
		onProposerElements={proposerElements}
	/>

	<Totaux
		lignes={brouillon.lignes}
		bind:rabaisPct={brouillon.conditions.rabaisPct}
		bind:rabaisMotif={brouillon.conditions.rabaisMotif}
	/>

	<Paiement
		bind:modalitesPaiement={brouillon.modalitesPaiement}
		bind:abonnement={brouillon.abonnement}
		enErreur={erreurPaiement}
		onRediger={proposerTexte}
	/>

	<Conditions
		bind:conditions={brouillon.conditions}
		{clausesBibliotheque}
		onAuditer={auditerClauses}
		onRetenirProposition={retenirProposition}
		onRediger={proposerTexte}
	/>

	<Signature
		bind:dateSignature={brouillon.dateSignature}
		bind:lieuSignature={brouillon.lieuSignature}
		bind:representantIntebecNom={brouillon.representantIntebecNom}
		bind:representantIntebecTitre={brouillon.representantIntebecTitre}
	/>

	<!-- Placé en dernier, juste avant « Générer », parce que la revue porte sur le mandat au complet :
		elle n'a aucun intérêt tant que le formulaire n'est pas rempli. -->
	<RevueMandatPanneau {brouillon} onRevoir={revoirMandat} />

	{#if generationTentee && erreurs.length > 0}
		<div class="rounded-card border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
			<p class="font-medium">Le document ne peut pas être généré :</p>
			<ul class="mt-1 list-disc space-y-0.5 pl-5">
				{#each erreurs as e (e.champ)}
					<li>{e.message}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div
		class="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-subtle bg-surface p-6 shadow-sm"
	>
		<button
			type="button"
			class="text-sm font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
			onclick={() => (afficherDonnees = !afficherDonnees)}
		>
			{afficherDonnees ? 'Masquer' : 'Voir'} les données du mandat
		</button>
		<div class="flex gap-3">
			<button
				type="submit"
				formaction="?/enregistrer"
				disabled={generationEnCours}
				class="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-muted disabled:opacity-60"
			>
				Enregistrer le brouillon
			</button>
			<button
				type="submit"
				formaction="?/generer"
				onclick={auClicGenerer}
				disabled={generationEnCours}
				class="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600 disabled:opacity-60"
			>
				{generationEnCours ? 'Rédaction par l’IA en cours…' : 'Générer le document'}
			</button>
		</div>
	</div>

	{#if afficherDonnees}
		<pre
			class="overflow-x-auto rounded-card border border-border-subtle bg-ink p-4 text-xs text-white">{JSON.stringify(
				brouillon,
				null,
				2
			)}</pre>
	{/if}
</form>
