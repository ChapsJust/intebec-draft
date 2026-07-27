<script lang="ts">
	import type { ServiceLine, ModalitesPaiement, AbonnementRecurrent } from '$lib/types';
	import { subtotal, rabaisAmount, totalNet, formatCad } from '$lib/pricing';
	import FormSection from './FormSection.svelte';

	let {
		lignes,
		modalitesPaiement = $bindable(),
		abonnement = $bindable(),
		rabaisPct = $bindable(),
		rabaisMotif = $bindable()
	}: {
		lignes: ServiceLine[];
		modalitesPaiement: ModalitesPaiement;
		abonnement: AbonnementRecurrent;
		rabaisPct: number;
		rabaisMotif: string;
	} = $props();

	const st = $derived(subtotal(lignes));
	const rabais = $derived(rabaisAmount(st, rabaisPct));
	const total = $derived(totalNet(lignes, rabaisPct));
</script>

<FormSection title="Prix et paiement" description="Récapitulatif calculé à partir des lignes ci-dessus.">
	<div class="rounded-lg bg-surface-muted p-4 text-sm">
		<div class="flex justify-between py-1">
			<span class="text-ink-muted">Sous-total</span>
			<span class="font-medium text-ink">{formatCad(st)}</span>
		</div>
		{#if rabaisPct > 0}
			<div class="flex justify-between py-1">
				<span class="text-ink-muted">Rabais ({rabaisPct}%)</span>
				<span class="font-medium text-ink">-{formatCad(rabais)}</span>
			</div>
		{/if}
		<div class="flex justify-between border-t border-border-subtle py-2 text-base">
			<span class="font-semibold text-ink">Total net (taxes en sus)</span>
			<span class="font-semibold text-ink">{formatCad(total)}</span>
		</div>
	</div>

	<div class="grid gap-5 sm:grid-cols-2">
		<div>
			<label class="field-label" for="rabais-pct">Rabais (%)</label>
			<input
				id="rabais-pct"
				class="field-input"
				type="number"
				min="0"
				max="100"
				step="1"
				bind:value={rabaisPct}
			/>
		</div>
		<div>
			<label class="field-label" for="rabais-motif">Motif du rabais</label>
			<input
				id="rabais-motif"
				class="field-input"
				type="text"
				bind:value={rabaisMotif}
				placeholder="Optionnel"
				disabled={rabaisPct === 0}
			/>
		</div>
	</div>

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
				class="field-input"
				type="number"
				min="0"
				max="100"
				bind:value={modalitesPaiement.soldePct}
			/>
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
