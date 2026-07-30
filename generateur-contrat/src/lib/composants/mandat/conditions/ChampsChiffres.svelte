<script lang="ts">
	import type { ConditionsParticulieres } from '$domaine/types';

	let { conditions = $bindable() }: { conditions: ConditionsParticulieres } = $props();
</script>

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
