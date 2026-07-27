<script lang="ts">
	import type { ServiceLine, PricingMode, StructureProjet } from '$lib/types';
	import { lineTotal, formatCad } from '$lib/pricing';
	import { createEmptyLigne } from '$lib/mandat';
	import type { ValidationError } from '$lib/validation';
	import { fieldError } from '$lib/validation';
	import FormSection from './FormSection.svelte';
	import Icon from './Icon.svelte';

	let {
		lignes = $bindable(),
		structureProjet,
		errors = []
	}: {
		lignes: ServiceLine[];
		structureProjet: StructureProjet;
		errors?: ValidationError[];
	} = $props();

	function addLigne() {
		lignes.push(createEmptyLigne());
	}

	function removeLigne(id: string) {
		const idx = lignes.findIndex((l) => l.id === id);
		if (idx !== -1) lignes.splice(idx, 1);
	}

	function addTexte(ligne: ServiceLine, list: 'inclus' | 'nonInclus') {
		ligne[list].push('');
	}

	function removeTexte(ligne: ServiceLine, list: 'inclus' | 'nonInclus', index: number) {
		ligne[list].splice(index, 1);
	}

	function addItem(ligne: ServiceLine) {
		ligne.items.push({ id: crypto.randomUUID(), description: '', quantite: 1, prixUnitaire: 0 });
	}

	function removeItem(ligne: ServiceLine, id: string) {
		const idx = ligne.items.findIndex((i) => i.id === id);
		if (idx !== -1) ligne.items.splice(idx, 1);
	}

	const lineLabel = $derived(
		structureProjet === 'phases' ? 'Phase' : structureProjet === 'blocs' ? 'Bloc' : 'Service'
	);

	const pricingModes: { value: PricingMode; label: string }[] = [
		{ value: 'forfaitaire', label: 'Forfaitaire' },
		{ value: 'horaire', label: 'Taux horaire' },
		{ value: 'quantite', label: 'Lignes détaillées' }
	];
</script>

<FormSection
	title="Portée et tarification"
	description="Ajoutez une ligne par {lineLabel.toLowerCase()}. Le mode de tarification peut varier d'une ligne à l'autre."
>
	<div class="space-y-4">
		{#each lignes as ligne, i (ligne.id)}
			<div class="rounded-lg border border-border-subtle p-4">
				<div class="flex items-start justify-between gap-3">
					<div class="flex-1">
						<label class="field-label" for="ligne-nom-{ligne.id}">{lineLabel} {i + 1} — nom</label>
						<input
							id="ligne-nom-{ligne.id}"
							class="field-input"
							type="text"
							bind:value={ligne.nom}
							placeholder="Ex. Gestion documentaire"
						/>
						{#if fieldError(errors, `lignes.${i}.nom`)}
							<p class="mt-1 text-xs text-warning">{fieldError(errors, `lignes.${i}.nom`)}</p>
						{/if}
					</div>
					{#if lignes.length > 1}
						<button
							type="button"
							class="mt-6 shrink-0 text-ink-muted transition hover:text-warning"
							onclick={() => removeLigne(ligne.id)}
							aria-label="Retirer cette ligne"
						>
							<Icon name="trash" size={18} />
						</button>
					{/if}
				</div>

				<div class="mt-3">
					<label class="field-label" for="ligne-desc-{ligne.id}">Description</label>
					<textarea
						id="ligne-desc-{ligne.id}"
						class="field-input"
						rows="2"
						bind:value={ligne.description}></textarea>
				</div>

				<div class="mt-3 grid gap-4 sm:grid-cols-2">
					<div>
						<span class="field-label">Inclus</span>
						<div class="space-y-2">
							{#each ligne.inclus as _, j}
								<div class="flex gap-2">
									<input
										class="field-input"
										type="text"
										bind:value={ligne.inclus[j]}
										placeholder="Ex. Sauvegarde automatique"
									/>
									<button
										type="button"
										class="shrink-0 text-ink-muted hover:text-warning"
										onclick={() => removeTexte(ligne, 'inclus', j)}
										aria-label="Retirer"
									>
										<Icon name="close" size={16} />
									</button>
								</div>
							{/each}
							<button
								type="button"
								class="hover:text-accent-700 text-sm font-medium text-accent-600"
								onclick={() => addTexte(ligne, 'inclus')}
							>
								+ Ajouter un élément inclus
							</button>
						</div>
					</div>
					<div>
						<span class="field-label">Non inclus (optionnel)</span>
						<div class="space-y-2">
							{#each ligne.nonInclus as _, j}
								<div class="flex gap-2">
									<input
										class="field-input"
										type="text"
										bind:value={ligne.nonInclus[j]}
										placeholder="Ex. Rédaction des textes"
									/>
									<button
										type="button"
										class="shrink-0 text-ink-muted hover:text-warning"
										onclick={() => removeTexte(ligne, 'nonInclus', j)}
										aria-label="Retirer"
									>
										<Icon name="close" size={16} />
									</button>
								</div>
							{/each}
							<button
								type="button"
								class="hover:text-accent-700 text-sm font-medium text-accent-600"
								onclick={() => addTexte(ligne, 'nonInclus')}
							>
								+ Ajouter une exclusion
							</button>
						</div>
					</div>
				</div>

				<div class="mt-4 border-t border-border-subtle pt-4">
					<span class="field-label">Tarification</span>
					<div class="flex flex-wrap gap-4">
						{#each pricingModes as mode (mode.value)}
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
										onclick={() => removeItem(ligne, item.id)}
										aria-label="Retirer"
									>
										<Icon name="close" size={16} />
									</button>
								</div>
							{/each}
							<button
								type="button"
								class="hover:text-accent-700 text-sm font-medium text-accent-600"
								onclick={() => addItem(ligne)}
							>
								+ Ajouter une ligne
							</button>
						</div>
					{/if}

					<p class="mt-3 text-sm font-medium text-ink">
						Sous-total de cette ligne : {formatCad(lineTotal(ligne))}
					</p>
					{#if fieldError(errors, `lignes.${i}.montant`)}
						<p class="mt-1 text-xs text-warning">{fieldError(errors, `lignes.${i}.montant`)}</p>
					{/if}
				</div>

				<div class="mt-3 max-w-xs">
					<label class="field-label" for="delai-{ligne.id}">Délai estimé</label>
					<input
						id="delai-{ligne.id}"
						class="field-input"
						type="text"
						bind:value={ligne.delaiEstime}
						placeholder="Ex. Six (6) semaines suivant la signature"
					/>
				</div>
			</div>
		{/each}
	</div>

	<button
		type="button"
		class="inline-flex items-center gap-2 rounded-lg border border-dashed border-border-subtle px-4 py-2 text-sm font-medium text-ink-muted transition hover:border-accent-400 hover:text-accent-600"
		onclick={addLigne}
	>
		<Icon name="plus" size={16} />
		Ajouter {structureProjet === 'phases'
			? 'une phase'
			: structureProjet === 'blocs'
				? 'un bloc'
				: 'un service'}
	</button>
</FormSection>
