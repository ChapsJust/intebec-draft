<script lang="ts">
	import type { ModalitesPaiement, AbonnementRecurrent } from '$lib/types';
	import FormSection from './FormSection.svelte';

	let {
		modalitesPaiement = $bindable(),
		abonnement = $bindable(),
		hasError = false
	}: {
		modalitesPaiement: ModalitesPaiement;
		abonnement: AbonnementRecurrent;
		hasError?: boolean;
	} = $props();

	// Le solde complète toujours l'acompte à 100 % : un split incohérent ne doit pas être représentable.
	$effect(() => {
		modalitesPaiement.soldePct = 100 - modalitesPaiement.acomptePct;
	});
</script>

{#snippet summary()}
	{modalitesPaiement.acomptePct}&nbsp;% / {modalitesPaiement.soldePct}&nbsp;% · net {modalitesPaiement.delaiJoursSolde}&nbsp;j{abonnement.actif
		? ` · abonnement ${abonnement.frequence}`
		: ''}
{/snippet}

<FormSection
	title="Modalités de paiement"
	description="Répartition de l'acompte, délai de paiement du solde, et abonnement récurrent optionnel."
	collapsible
	defaultOpen={hasError}
	{summary}
>
	<div class="grid gap-5 sm:grid-cols-3">
		<div>
			<label class="field-label" for="acompte-pct">Acompte à la signature (%)</label>
			<input
				id="acompte-pct"
				class="field-input"
				type="number"
				min="0"
				max="100"
				bind:value={modalitesPaiement.acomptePct}
			/>
		</div>
		<div>
			<label class="field-label" for="solde-pct">Solde à la livraison (%)</label>
			<input
				id="solde-pct"
				class="field-input bg-surface-muted"
				type="number"
				value={modalitesPaiement.soldePct}
				readonly
			/>
			<p class="field-hint">Calculé automatiquement (100 % − acompte).</p>
		</div>
		<div>
			<label class="field-label" for="delai-solde">Délai de paiement du solde (jours)</label>
			<input
				id="delai-solde"
				class="field-input"
				type="number"
				min="0"
				bind:value={modalitesPaiement.delaiJoursSolde}
			/>
		</div>
	</div>

	<div class="border-t border-border-subtle pt-5">
		<label class="flex items-center gap-2 text-sm font-medium text-ink">
			<input
				type="checkbox"
				bind:checked={abonnement.actif}
				class="rounded text-accent-500 focus:ring-accent-500"
			/>
			Ce mandat inclut un abonnement récurrent (hébergement, maintenance, support…)
		</label>

		{#if abonnement.actif}
			<div class="mt-3 grid gap-5 sm:grid-cols-2">
				<div>
					<label class="field-label" for="abo-frequence">Fréquence</label>
					<select id="abo-frequence" class="field-input" bind:value={abonnement.frequence}>
						<option value="mensuel">Mensuel</option>
						<option value="annuel">Annuel</option>
					</select>
				</div>
				<div>
					<label class="field-label" for="abo-montant">Montant (CAD, taxes en sus)</label>
					<input
						id="abo-montant"
						class="field-input"
						type="number"
						min="0"
						step="0.01"
						bind:value={abonnement.montant}
					/>
				</div>
				<div class="sm:col-span-2">
					<label class="field-label" for="abo-couverture">Ce que couvre l'abonnement</label>
					<textarea
						id="abo-couverture"
						class="field-input"
						rows="2"
						bind:value={abonnement.couverture}
						placeholder="Ex. Hébergement, maintenance, sauvegardes, support technique de base"
					></textarea>
				</div>
				<div>
					<label class="field-label" for="abo-periode-offerte"
						>Période offerte (mois, 0 si aucune)</label
					>
					<input
						id="abo-periode-offerte"
						class="field-input"
						type="number"
						min="0"
						bind:value={abonnement.periodeOfferteMois}
					/>
				</div>
			</div>
		{/if}
	</div>
</FormSection>
