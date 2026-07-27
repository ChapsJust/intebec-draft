<script lang="ts">
	import FormSection from './FormSection.svelte';

	let {
		dateSignature = $bindable(),
		lieuSignature = $bindable(),
		representantIntebecNom = $bindable(),
		representantIntebecTitre = $bindable()
	}: {
		dateSignature: string;
		lieuSignature: string;
		representantIntebecNom: string;
		representantIntebecTitre: string;
	} = $props();
</script>

<FormSection title="Signature">
	<div class="grid gap-5 sm:grid-cols-2">
		<div>
			<label class="field-label" for="lieu-signature">Lieu</label>
			<input id="lieu-signature" class="field-input" type="text" bind:value={lieuSignature} />
		</div>
		<div>
			<label class="field-label" for="date-signature">Date</label>
			<input id="date-signature" class="field-input" type="date" bind:value={dateSignature} />
		</div>
		<div>
			<label class="field-label" for="rep-intebec-nom">Représentant Intébec</label>
			<input
				id="rep-intebec-nom"
				class="field-input"
				type="text"
				bind:value={representantIntebecNom}
			/>
		</div>
		<div>
			<label class="field-label" for="rep-intebec-titre">Titre</label>
			<input
				id="rep-intebec-titre"
				class="field-input"
				type="text"
				bind:value={representantIntebecTitre}
			/>
		</div>
	</div>
</FormSection>
