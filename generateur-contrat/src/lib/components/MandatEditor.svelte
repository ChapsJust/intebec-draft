<script lang="ts">
	import { enhance, applyAction, deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { ClientRecord, MandatDraft } from '$lib/types';
	import { validateDraft } from '$lib/validation';
	import MandatForm from './MandatForm.svelte';
	import ClientForm from './ClientForm.svelte';
	import ServiceLinesForm from './ServiceLinesForm.svelte';
	import PricingTotals from './PricingTotals.svelte';
	import PaymentTermsForm from './PaymentTermsForm.svelte';
	import ClausesForm from './ClausesForm.svelte';
	import SignatureForm from './SignatureForm.svelte';

	let {
		draft = $bindable(),
		clientId = $bindable(),
		saveAsNewClient = $bindable(),
		clients,
		banner
	}: {
		draft: MandatDraft;
		clientId: string | null;
		saveAsNewClient: boolean;
		clients: ClientRecord[];
		banner?: string;
	} = $props();

	let showPreview = $state(false);
	let attemptedGenerate = $state(false);
	let generationEnCours = $state(false);
	let updatingClient = $state(false);
	let clientUpdateMessage = $state<string | null>(null);

	const errors = $derived(validateDraft(draft));
	const visibleErrors = $derived(attemptedGenerate ? errors : []);
	const paymentHasError = $derived(
		attemptedGenerate && errors.some((e) => e.field.startsWith('modalitesPaiement.'))
	);

	function handleGenerateClick(event: MouseEvent) {
		attemptedGenerate = true;
		if (errors.length > 0) {
			event.preventDefault();
		}
	}

	/** Appelle une form action sans quitter la page. L'en-tête `x-sveltekit-action` est
	 * indispensable : sans lui SvelteKit traite la requête comme une soumission classique et
	 * répond par une redirection HTML, que `deserialize()` ne sait pas lire. */
	async function postAction(action: string, body: FormData) {
		const response = await fetch(action, {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true' },
			body
		});
		return deserialize(await response.text());
	}

	async function updateClientRecord() {
		if (!clientId) return;
		updatingClient = true;
		clientUpdateMessage = null;
		const body = new FormData();
		body.set('id', clientId);
		body.set('payload', JSON.stringify(draft.client));
		const result = await postAction('?/updateClient', body);
		updatingClient = false;
		if (result.type === 'success') {
			clientUpdateMessage = 'Fiche client mise à jour.';
			await invalidateAll();
		}
		await applyAction(result);
	}

	/** Demande une proposition de texte à l'IA locale pour un champ précis. Rien n'est persisté :
	 * la proposition remonte au bouton, qui laisse l'utilisateur l'accepter ou l'ignorer. */
	async function proposerTexte(champ: string): Promise<string> {
		const body = new FormData();
		body.set('payload', JSON.stringify(draft));
		body.set('champ', champ);
		const result = await postAction('?/redigerChamp', body);

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
	<input type="hidden" name="payload" value={JSON.stringify(draft)} />
	<input type="hidden" name="clientId" value={clientId ?? ''} />
	<input type="hidden" name="saveAsNewClient" value={saveAsNewClient ? '1' : ''} />

	{#if banner}
		<div class="rounded-card border border-border-subtle bg-surface-muted p-4 text-sm text-ink">
			{banner}
		</div>
	{/if}

	<MandatForm
		bind:type={draft.type}
		bind:titre={draft.titre}
		bind:structureProjet={draft.structureProjet}
		bind:objet={draft.objet}
		errors={visibleErrors}
		onRediger={proposerTexte}
	/>

	<ClientForm
		bind:client={draft.client}
		bind:clientId
		bind:saveAsNewClient
		{clients}
		errors={visibleErrors}
		onUpdateClientRecord={updateClientRecord}
	/>
	{#if clientUpdateMessage}
		<p class="-mt-4 text-sm text-success">{clientUpdateMessage}</p>
	{/if}

	<ServiceLinesForm
		bind:lignes={draft.lignes}
		structureProjet={draft.structureProjet}
		errors={visibleErrors}
		onRediger={proposerTexte}
	/>

	<PricingTotals
		lignes={draft.lignes}
		bind:rabaisPct={draft.conditions.rabaisPct}
		bind:rabaisMotif={draft.conditions.rabaisMotif}
	/>

	<PaymentTermsForm
		bind:modalitesPaiement={draft.modalitesPaiement}
		bind:abonnement={draft.abonnement}
		hasError={paymentHasError}
	/>

	<ClausesForm bind:conditions={draft.conditions} />

	<SignatureForm
		bind:dateSignature={draft.dateSignature}
		bind:lieuSignature={draft.lieuSignature}
		bind:representantIntebecNom={draft.representantIntebecNom}
		bind:representantIntebecTitre={draft.representantIntebecTitre}
	/>

	{#if attemptedGenerate && errors.length > 0}
		<div class="rounded-card border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
			<p class="font-medium">Le document ne peut pas être généré :</p>
			<ul class="mt-1 list-disc space-y-0.5 pl-5">
				{#each errors as e (e.field)}
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
			onclick={() => (showPreview = !showPreview)}
		>
			{showPreview ? 'Masquer' : 'Voir'} les données du mandat
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
				onclick={handleGenerateClick}
				disabled={generationEnCours}
				class="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600 disabled:opacity-60"
			>
				{generationEnCours ? 'Rédaction par l’IA en cours…' : 'Générer le document'}
			</button>
		</div>
	</div>

	{#if showPreview}
		<pre
			class="overflow-x-auto rounded-card border border-border-subtle bg-ink p-4 text-xs text-white">{JSON.stringify(
				draft,
				null,
				2
			)}</pre>
	{/if}
</form>
