<script lang="ts">
	import type { ConditionsParticulieres, ClausesStandards } from '$lib/types';
	import FormSection from './FormSection.svelte';

	let { conditions = $bindable() }: { conditions: ConditionsParticulieres } = $props();

	const clauseOptions: { key: keyof ClausesStandards; label: string }[] = [
		{
			key: 'confidentialite',
			label: 'Confidentialité et protection des données (Loi 25, hébergement Canada)'
		},
		{ key: 'limitationResponsabilite', label: 'Limitation de responsabilité' },
		{ key: 'propriete', label: 'Propriété des données et du travail livré' },
		{ key: 'litiges', label: "Litiges — district d'Arthabaska, lois du Québec" },
		{ key: 'signatureElectronique', label: 'Reconnaissance de la signature électronique' }
	];

	const clausesActives = $derived(
		clauseOptions.filter((opt) => conditions.clauses[opt.key]).length
	);
</script>

{#snippet summary()}
	Garantie {conditions.dureeGarantieJours}&nbsp;j · Support {conditions.dureeSupportMois}&nbsp;mois
	·
	{clausesActives}/{clauseOptions.length} clauses actives
{/snippet}

<FormSection
	title="Conditions"
	description="Clauses standards et paramètres habituellement variables d'un contrat à l'autre."
	collapsible
	defaultOpen={false}
	{summary}
>
	<div class="grid gap-5 sm:grid-cols-2">
		<div>
			<label class="field-label" for="heures-formation">Heures de formation incluses</label>
			<input
				id="heures-formation"
				class="field-input"
				type="number"
				min="0"
				bind:value={conditions.heuresFormationIncluses}
			/>
		</div>
		<div>
			<label class="field-label" for="garantie-jours">Garantie (jours)</label>
			<input
				id="garantie-jours"
				class="field-input"
				type="number"
				min="0"
				bind:value={conditions.dureeGarantieJours}
			/>
		</div>
		<div>
			<label class="field-label" for="support-mois">Support inclus (mois)</label>
			<input
				id="support-mois"
				class="field-input"
				type="number"
				min="0"
				bind:value={conditions.dureeSupportMois}
			/>
		</div>
		<div>
			<label class="field-label" for="preavis-jours">Préavis de résiliation (jours)</label>
			<input
				id="preavis-jours"
				class="field-input"
				type="number"
				min="0"
				bind:value={conditions.preavisResiliationJours}
			/>
		</div>
		<div class="sm:col-span-2">
			<label class="field-label" for="taux-hors-perimetre"
				>Taux horaire pour travaux hors périmètre (CAD/h)</label
			>
			<input
				id="taux-hors-perimetre"
				class="field-input"
				type="number"
				min="0"
				step="0.01"
				bind:value={conditions.tauxHoraireHorsPerimetre}
				placeholder="0 = non applicable"
			/>
		</div>
	</div>

	<div>
		<span class="field-label">Clauses standards à inclure</span>
		<div class="space-y-2">
			{#each clauseOptions as opt (opt.key)}
				<label class="flex items-center gap-2 text-sm text-ink">
					<input
						type="checkbox"
						bind:checked={conditions.clauses[opt.key]}
						class="rounded text-accent-500 focus:ring-accent-500"
					/>
					{opt.label}
				</label>
			{/each}
		</div>
	</div>

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
</FormSection>
