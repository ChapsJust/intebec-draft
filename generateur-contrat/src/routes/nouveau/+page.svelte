<script lang="ts">
	import { page } from '$app/state';
	import type { MandatDraft, ServiceLine } from '$lib/types';
	import ClientForm from '$lib/components/ClientForm.svelte';
	import MandatForm from '$lib/components/MandatForm.svelte';
	import ServiceLinesForm from '$lib/components/ServiceLinesForm.svelte';
	import PricingSummary from '$lib/components/PricingSummary.svelte';
	import ClausesForm from '$lib/components/ClausesForm.svelte';
	import SignatureForm from '$lib/components/SignatureForm.svelte';

	const initialType = page.url.searchParams.get('type') === 'contrat' ? 'contrat' : 'soumission';

	function createEmptyLigne(): ServiceLine {
		return {
			id: crypto.randomUUID(),
			nom: '',
			description: '',
			inclus: [''],
			nonInclus: [],
			pricingMode: 'forfaitaire',
			montantForfaitaire: 0,
			tauxHoraire: 0,
			heuresEstimees: 0,
			items: [],
			delaiEstime: ''
		};
	}

	let draft = $state<MandatDraft>({
		type: initialType,
		titre: '',
		structureProjet: 'blocs',
		objet: '',
		client: {
			nom: '',
			typeClient: 'entreprise',
			adresse: '',
			representantNom: '',
			representantTitre: '',
			courriel: '',
			telephone: '',
			siteWeb: '',
			numeroEntreprise: ''
		},
		lignes: [createEmptyLigne()],
		modalitesPaiement: { acomptePct: 50, soldePct: 50, delaiJoursSolde: 30 },
		abonnement: {
			actif: false,
			frequence: 'annuel',
			montant: 0,
			couverture: '',
			periodeOfferteMois: 0
		},
		conditions: {
			heuresFormationIncluses: 2,
			dureeGarantieJours: 30,
			dureeSupportMois: 12,
			tauxHoraireHorsPerimetre: 0,
			preavisResiliationJours: 30,
			rabaisPct: 0,
			rabaisMotif: '',
			clauses: {
				confidentialite: true,
				limitationResponsabilite: true,
				propriete: true,
				litiges: true,
				signatureElectronique: true
			},
			notesAdditionnelles: ''
		},
		dateSignature: new Date().toISOString().slice(0, 10),
		lieuSignature: 'Victoriaville',
		representantIntebecNom: 'Justin Chaput',
		representantIntebecTitre: 'Président'
	});

	let showPreview = $state(false);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold text-ink">
			{draft.type === 'contrat' ? 'Nouveau contrat' : 'Nouvelle soumission'}
		</h1>
		<a
			href="/"
			class="inline-flex items-center rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted"
		>
			← Retour à l'accueil
		</a>
	</div>

	<MandatForm
		bind:type={draft.type}
		bind:titre={draft.titre}
		bind:structureProjet={draft.structureProjet}
		bind:objet={draft.objet}
	/>

	<ClientForm bind:client={draft.client} />

	<ServiceLinesForm bind:lignes={draft.lignes} structureProjet={draft.structureProjet} />

	<PricingSummary
		lignes={draft.lignes}
		bind:modalitesPaiement={draft.modalitesPaiement}
		bind:abonnement={draft.abonnement}
		bind:rabaisPct={draft.conditions.rabaisPct}
		bind:rabaisMotif={draft.conditions.rabaisMotif}
	/>

	<ClausesForm bind:conditions={draft.conditions} />

	<SignatureForm
		bind:dateSignature={draft.dateSignature}
		bind:lieuSignature={draft.lieuSignature}
		bind:representantIntebecNom={draft.representantIntebecNom}
		bind:representantIntebecTitre={draft.representantIntebecTitre}
	/>

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
		<button
			type="button"
			class="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600"
		>
			Générer le document
		</button>
	</div>

	{#if showPreview}
		<pre
			class="overflow-x-auto rounded-card border border-border-subtle bg-ink p-4 text-xs text-white">{JSON.stringify(
				draft,
				null,
				2
			)}</pre>
	{/if}
</div>
