<script lang="ts">
	import { enhance, applyAction, deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { AuditClauses, FicheClient, BrouillonMandat } from '$lib/types';
	import { verifierMandat } from '$lib/validation';
	import MandatForm from './MandatForm.svelte';
	import ClientForm from './ClientForm.svelte';
	import ServiceLinesForm from './ServiceLinesForm.svelte';
	import PricingTotals from './PricingTotals.svelte';
	import PaymentTermsForm from './PaymentTermsForm.svelte';
	import ClausesForm from './ClausesForm.svelte';
	import SignatureForm from './SignatureForm.svelte';

	let {
		brouillon = $bindable(),
		clientId = $bindable(),
		enregistrerNouveauClient = $bindable(),
		clients,
		banner
	}: {
		brouillon: BrouillonMandat;
		clientId: string | null;
		enregistrerNouveauClient: boolean;
		clients: FicheClient[];
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

	/** Appelle une form action sans quitter la page. L'en-tête `x-sveltekit-action` est
	 * indispensable : sans lui SvelteKit traite la requête comme une soumission classique et
	 * répond par une redirection HTML, que `deserialize()` ne sait pas lire. */
	async function posterAction(action: string, body: FormData) {
		const response = await fetch(action, {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true' },
			body
		});
		const texte = await response.text();
		try {
			return deserialize(texte);
		} catch {
			// Arrive quand la réponse n'est pas un résultat d'action : session expirée renvoyant la
			// page de connexion, ou erreur d'infrastructure en HTML. Le message brut ne veut rien
			// dire pour l'utilisateur, on le remplace par la cause la plus probable.
			throw new Error(
				response.status === 401 || response.status === 403
					? 'Votre session a expiré. Rechargez la page pour vous reconnecter.'
					: 'Le serveur a renvoyé une réponse inattendue. Réessayez.'
			);
		}
	}

	async function majFicheClient() {
		if (!clientId) return;
		majClientEnCours = true;
		messageMajClient = null;
		const body = new FormData();
		body.set('id', clientId);
		body.set('payload', JSON.stringify(brouillon.client));

		// `finally` plutôt qu'une remise à zéro après l'attente : si la requête échoue (réseau
		// coupé, réponse illisible), le bouton restait désactivé jusqu'au rechargement de la page.
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

	/** Fait relire le volet contractuel par l'IA. Le résultat est purement consultatif : il remonte
	 * au formulaire de conditions, qui laisse l'utilisateur activer ou ignorer chaque suggestion. */
	async function auditerClauses(): Promise<AuditClauses> {
		const body = new FormData();
		body.set('payload', JSON.stringify(brouillon));
		const result = await posterAction('?/auditerClauses', body);

		if (result.type === 'success' && result.data?.audit) {
			return result.data.audit as AuditClauses;
		}
		throw new Error(
			result.type === 'failure' && typeof result.data?.message === 'string'
				? result.data.message
				: "L'IA locale n'a pas répondu."
		);
	}

	/** Demande une proposition de texte à l'IA locale pour un champ précis. Rien n'est persisté :
	 * la proposition remonte au bouton, qui laisse l'utilisateur l'accepter ou l'ignorer. */
	async function proposerTexte(champ: string): Promise<string> {
		const body = new FormData();
		body.set('payload', JSON.stringify(brouillon));
		body.set('champ', champ);
		const result = await posterAction('?/redigerChamp', body);

		if (result.type === 'success' && typeof result.data?.texte === 'string') {
			return result.data.texte;
		}
		const message =
			result.type === 'failure' && typeof result.data?.message === 'string'
				? result.data.message
				: "L'IA locale n'a pas répondu.";
		throw new Error(message);
	}
</script>

<form
	method="POST"
	action="?/enregistrer"
	use:enhance={({ action }) => {
		// La génération embarque la passe de rédaction IA : plusieurs dizaines de secondes pendant
		// lesquelles rien ne bouge à l'écran si on ne le dit pas. L'enregistrement, lui, est immédiat.
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

	<MandatForm
		bind:type={brouillon.type}
		bind:titre={brouillon.titre}
		bind:structureProjet={brouillon.structureProjet}
		bind:objet={brouillon.objet}
		erreurs={erreursVisibles}
		onRediger={proposerTexte}
	/>

	<ClientForm
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

	<ServiceLinesForm
		bind:lignes={brouillon.lignes}
		structureProjet={brouillon.structureProjet}
		erreurs={erreursVisibles}
		onRediger={proposerTexte}
	/>

	<PricingTotals
		lignes={brouillon.lignes}
		bind:rabaisPct={brouillon.conditions.rabaisPct}
		bind:rabaisMotif={brouillon.conditions.rabaisMotif}
	/>

	<PaymentTermsForm
		bind:modalitesPaiement={brouillon.modalitesPaiement}
		bind:abonnement={brouillon.abonnement}
		enErreur={erreurPaiement}
	/>

	<ClausesForm bind:conditions={brouillon.conditions} onAuditer={auditerClauses} />

	<SignatureForm
		bind:dateSignature={brouillon.dateSignature}
		bind:lieuSignature={brouillon.lieuSignature}
		bind:representantIntebecNom={brouillon.representantIntebecNom}
		bind:representantIntebecTitre={brouillon.representantIntebecTitre}
	/>

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
