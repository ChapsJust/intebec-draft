<script lang="ts">
	import type { LigneService, ModeTarification } from '$domaine/types';
	import { totalLigne, formatCad } from '$domaine/montants';
	import Icone from '$composants/ui/Icone.svelte';

	let {
		ligne = $bindable(),
		erreur
	}: {
		ligne: LigneService;
		/** Message de validation portant sur le montant de cette ligne, s'il y en a un. */
		erreur?: string;
	} = $props();

	const modes: { value: ModeTarification; label: string }[] = [
		{ value: 'forfaitaire', label: 'Forfaitaire' },
		{ value: 'horaire', label: 'Taux horaire' },
		{ value: 'quantite', label: 'Lignes détaillées' }
	];

	function ajouterItem() {
		ligne.items.push({ id: crypto.randomUUID(), description: '', quantite: 1, prixUnitaire: 0 });
	}

	function retirerItem(id: string) {
		const idx = ligne.items.findIndex((i) => i.id === id);
		if (idx !== -1) ligne.items.splice(idx, 1);
	}
</script>

<div class="mt-4 border-t border-border-subtle pt-4">
	<span class="field-label">Tarification</span>
	<div class="flex flex-wrap gap-4">
		{#each modes as mode (mode.value)}
			<label class="flex items-center gap-2 text-sm text-ink">
				<input
					type="radio"
					name="pricingMode-{ligne.id}"
					value={mode.value}
					bind:group={ligne.pricingMode}
					class="text-accent-500 focus:ring-accent-500"
				/>
				{mode.label}
			</label>
		{/each}
	</div>

	{#if ligne.pricingMode === 'forfaitaire'}
		<div class="mt-3 max-w-xs">
			<label class="field-label" for="montant-{ligne.id}">Montant forfaitaire (CAD)</label>
			<input
				id="montant-{ligne.id}"
				class="field-input"
				type="number"
				min="0"
				step="0.01"
				bind:value={ligne.montantForfaitaire}
			/>
		</div>
	{:else if ligne.pricingMode === 'horaire'}
		<div class="mt-3 grid max-w-md gap-3 sm:grid-cols-2">
			<div>
				<label class="field-label" for="taux-{ligne.id}">Taux horaire (CAD/h)</label>
				<input
					id="taux-{ligne.id}"
					class="field-input"
					type="number"
					min="0"
					step="0.01"
					bind:value={ligne.tauxHoraire}
				/>
			</div>
			<div>
				<label class="field-label" for="heures-{ligne.id}">Heures estimées</label>
				<input
					id="heures-{ligne.id}"
					class="field-input"
					type="number"
					min="0"
					step="0.5"
					bind:value={ligne.heuresEstimees}
				/>
			</div>
		</div>
	{:else}
		<div class="mt-3 space-y-2">
			{#each ligne.items as item (item.id)}
				<div class="flex flex-wrap items-end gap-2">
					<div class="min-w-40 flex-1">
						<label class="field-label" for="item-desc-{item.id}">Description</label>
						<input
							id="item-desc-{item.id}"
							class="field-input"
							type="text"
							bind:value={item.description}
						/>
					</div>
					<div class="w-24">
						<label class="field-label" for="item-qte-{item.id}">Qté</label>
						<input
							id="item-qte-{item.id}"
							class="field-input"
							type="number"
							min="0"
							step="1"
							bind:value={item.quantite}
						/>
					</div>
					<div class="w-32">
						<label class="field-label" for="item-prix-{item.id}">Prix unit. (CAD)</label>
						<input
							id="item-prix-{item.id}"
							class="field-input"
							type="number"
							min="0"
							step="0.01"
							bind:value={item.prixUnitaire}
						/>
					</div>
					<button
						type="button"
						class="mb-2 shrink-0 text-ink-muted hover:text-warning"
						onclick={() => retirerItem(item.id)}
						aria-label="Retirer"
					>
						<Icone name="close" size={16} />
					</button>
				</div>
			{/each}
			<button
				type="button"
				class="hover:text-accent-700 text-sm font-medium text-accent-600"
				onclick={ajouterItem}
			>
				+ Ajouter une ligne
			</button>
		</div>
	{/if}

	<p class="mt-3 text-sm font-medium text-ink">
		Sous-total de cette ligne : {formatCad(totalLigne(ligne))}
	</p>
	{#if erreur}
		<p class="mt-1 text-xs text-warning">{erreur}</p>
	{/if}
</div>
