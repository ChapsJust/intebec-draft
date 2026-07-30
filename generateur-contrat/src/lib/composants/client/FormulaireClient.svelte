<script lang="ts">
	import type { CoordonneesClient, FicheClient } from '$domaine/types';
	import { nouveauClient, coordonneesDuClient } from '$domaine/fabriques';
	import type { ErreurValidation } from '$domaine/validation';
	import { erreurDuChamp } from '$domaine/validation';
	import SectionFormulaire from '$composants/ui/SectionFormulaire.svelte';
	import SelecteurClient from './SelecteurClient.svelte';

	let {
		client = $bindable(),
		clientId = $bindable(),
		clients,
		enregistrerNouveauClient = $bindable(),
		erreurs = [],
		onUpdateClientRecord
	}: {
		client: CoordonneesClient;
		clientId: string | null;
		clients: FicheClient[];
		enregistrerNouveauClient: boolean;
		erreurs?: ErreurValidation[];
		onUpdateClientRecord?: () => void;
	} = $props();

	let forceNew = $state(false);
	let forceEdit = $state(false);

	const mode = $derived(
		forceEdit ? 'edit' : clientId ? 'view' : forceNew || clients.length === 0 ? 'new' : 'pick'
	);

	function selectClient(id: string) {
		const found = clients.find((c) => c.id === id);
		if (!found) return;
		clientId = found.id;
		Object.assign(client, coordonneesDuClient(found));
		forceNew = false;
		forceEdit = false;
	}

	function startNewClient() {
		clientId = null;
		Object.assign(client, nouveauClient());
		enregistrerNouveauClient = true;
		forceNew = true;
		forceEdit = false;
	}

	function backToPicker() {
		clientId = null;
		forceNew = false;
		forceEdit = false;
	}
</script>

<SectionFormulaire
	title="Client"
	description="Coordonnées de l'organisation et de son représentant."
>
	{#if mode === 'pick'}
		<SelecteurClient {clients} onselect={selectClient} onnew={startNewClient} />
	{:else}
		{#if mode === 'view'}
			<div
				class="flex items-start justify-between gap-4 rounded-lg border border-border-subtle p-4"
			>
				<div class="min-w-0">
					<p class="font-medium text-ink">{client.nom}</p>
					<p class="text-sm text-ink-muted">
						{[client.representantNom, client.representantTitre].filter(Boolean).join(' · ')}
					</p>
					<p class="text-sm text-ink-muted">
						{[client.courriel, client.telephone].filter(Boolean).join(' · ')}
					</p>
				</div>
				<div class="flex shrink-0 flex-col items-end gap-1 text-sm">
					<button
						type="button"
						class="hover:text-accent-700 font-medium text-accent-600"
						onclick={backToPicker}
					>
						Changer
					</button>
					<button
						type="button"
						class="hover:text-accent-700 font-medium text-accent-600"
						onclick={() => (forceEdit = true)}
					>
						Modifier les coordonnées
					</button>
				</div>
			</div>
		{:else if mode === 'edit'}
			<div
				class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-muted p-3 text-sm"
			>
				<span class="text-ink-muted">Ces modifications s'appliquent à ce mandat seulement.</span>
				<div class="flex shrink-0 gap-4">
					{#if onUpdateClientRecord}
						<button
							type="button"
							class="hover:text-accent-700 font-medium text-accent-600"
							onclick={onUpdateClientRecord}
						>
							Mettre à jour la fiche client
						</button>
					{/if}
					<button
						type="button"
						class="font-medium text-ink hover:underline"
						onclick={() => (forceEdit = false)}
					>
						Terminé
					</button>
				</div>
			</div>
		{/if}

		<div class="grid gap-5 sm:grid-cols-2">
			<div class="sm:col-span-2">
				<label class="field-label" for="client-nom">Nom du client</label>
				<input
					id="client-nom"
					class="field-input"
					type="text"
					bind:value={client.nom}
					placeholder="Ex. Constructions Rivard"
				/>
				{#if erreurDuChamp(erreurs, 'client.nom')}
					<p class="mt-1 text-xs text-warning">{erreurDuChamp(erreurs, 'client.nom')}</p>
				{/if}
			</div>
			<div>
				<label class="field-label" for="client-type">Type</label>
				<select id="client-type" class="field-input" bind:value={client.typeClient}>
					<option value="entreprise">Entreprise</option>
					<option value="obnl">OBNL</option>
					<option value="particulier">Particulier</option>
				</select>
			</div>
			<div>
				<label class="field-label" for="client-ne">Numéro d'entreprise (NE)</label>
				<input
					id="client-ne"
					class="field-input"
					type="text"
					bind:value={client.numeroEntreprise}
					placeholder="Optionnel"
				/>
			</div>
			<div class="sm:col-span-2">
				<label class="field-label" for="client-adresse">Adresse</label>
				<input id="client-adresse" class="field-input" type="text" bind:value={client.adresse} />
			</div>
			<div>
				<label class="field-label" for="client-rep-nom">Représentant</label>
				<input
					id="client-rep-nom"
					class="field-input"
					type="text"
					bind:value={client.representantNom}
				/>
			</div>
			<div>
				<label class="field-label" for="client-rep-titre">Titre</label>
				<input
					id="client-rep-titre"
					class="field-input"
					type="text"
					bind:value={client.representantTitre}
					placeholder="Ex. Directrice"
				/>
			</div>
			<div>
				<label class="field-label" for="client-courriel">Courriel</label>
				<input id="client-courriel" class="field-input" type="email" bind:value={client.courriel} />
				{#if erreurDuChamp(erreurs, 'client.courriel')}
					<p class="mt-1 text-xs text-warning">{erreurDuChamp(erreurs, 'client.courriel')}</p>
				{/if}
			</div>
			<div>
				<label class="field-label" for="client-telephone">Téléphone</label>
				<input id="client-telephone" class="field-input" type="tel" bind:value={client.telephone} />
			</div>
			<div class="sm:col-span-2">
				<label class="field-label" for="client-web">Site web</label>
				<input
					id="client-web"
					class="field-input"
					type="text"
					bind:value={client.siteWeb}
					placeholder="Optionnel"
				/>
			</div>
		</div>

		{#if mode === 'new'}
			<div class="flex flex-wrap items-center justify-between gap-3">
				<label class="flex items-center gap-2 text-sm text-ink">
					<input
						type="checkbox"
						bind:checked={enregistrerNouveauClient}
						class="rounded text-accent-500 focus:ring-accent-500"
					/>
					Enregistrer dans mes clients
				</label>
				{#if clients.length > 0}
					<button
						type="button"
						class="hover:text-accent-700 text-sm font-medium text-accent-600"
						onclick={backToPicker}
					>
						← Choisir un client existant
					</button>
				{/if}
			</div>
		{/if}
	{/if}
</SectionFormulaire>
