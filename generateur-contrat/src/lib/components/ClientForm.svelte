<script lang="ts">
	import type { ClientInfo } from '$lib/types';
	import FormSection from './FormSection.svelte';

	let { client = $bindable() }: { client: ClientInfo } = $props();
</script>

<FormSection title="Client" description="Coordonnées de l'organisation et de son représentant.">
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
</FormSection>
