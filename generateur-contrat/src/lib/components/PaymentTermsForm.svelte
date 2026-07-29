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

	type ModePaiement = 'livraison' | 'acompte-solde' | 'signature';

	/** Le mode se déduit de l'acompte plutôt que d'être stocké à part : un seul champ fait foi, et
	 * les brouillons enregistrés avant l'ajout de ce choix se rouvrent dans le bon mode. */
	const mode = $derived<ModePaiement>(
		modalitesPaiement.acomptePct <= 0
			? 'livraison'
			: modalitesPaiement.acomptePct >= 100
				? 'signature'
				: 'acompte-solde'
	);

	const MODES: { valeur: ModePaiement; titre: string; detail: string }[] = [
		{
			valeur: 'livraison',
			titre: 'Tout à la livraison',
			detail: 'Un seul versement, une fois le livrable terminé.'
		},
		{
			valeur: 'acompte-solde',
			titre: 'Acompte puis solde',
			detail: 'Une partie à la signature, le reste à la livraison.'
		},
		{
			valeur: 'signature',
			titre: 'Tout à la signature',
			detail: 'Un seul versement, payable d’avance.'
		}
	];

	function choisirMode(nouveau: ModePaiement) {
		if (nouveau === mode) return;
		if (nouveau === 'livraison') modalitesPaiement.acomptePct = 0;
		else if (nouveau === 'signature') modalitesPaiement.acomptePct = 100;
		else modalitesPaiement.acomptePct = 50;
	}

	// Espace insécable : le pourcentage ne doit pas se couper de son symbole.
	const NB = '\u00a0';

	const resume = $derived(
		mode === 'livraison'
			? `100${NB}% à la livraison`
			: mode === 'signature'
				? `100${NB}% à la signature`
				: `${modalitesPaiement.acomptePct}${NB}% / ${modalitesPaiement.soldePct}${NB}%`
	);
</script>

{#snippet summary()}
	{resume}{mode === 'signature'
		? ''
		: ` · net ${modalitesPaiement.delaiJoursSolde} j`}{abonnement.actif
		? ` · abonnement ${abonnement.frequence}`
		: ''}
{/snippet}

<FormSection
	title="Modalités de paiement"
	description="Moment du paiement, délai de règlement, et abonnement récurrent optionnel."
	collapsible
	defaultOpen={hasError}
	{summary}
>
	<fieldset>
		<legend class="field-label">Quand le mandat est-il payé ?</legend>
		<div class="mt-1 grid gap-2 sm:grid-cols-3">
			{#each MODES as option (option.valeur)}
				<label
					class="flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition {mode ===
					option.valeur
						? 'border-accent-500 bg-accent-500/5'
						: 'border-border-subtle hover:bg-surface-muted'}"
				>
					<span class="flex items-center gap-2 font-medium text-ink">
						<input
							type="radio"
							name="mode-paiement"
							value={option.valeur}
							checked={mode === option.valeur}
							onchange={() => choisirMode(option.valeur)}
							class="text-accent-500 focus:ring-accent-500"
						/>
						{option.titre}
					</span>
					<span class="pl-6 text-xs text-ink-muted">{option.detail}</span>
				</label>
			{/each}
		</div>
	</fieldset>

	<div class="grid gap-5 sm:grid-cols-3">
		{#if mode === 'acompte-solde'}
			<div>
				<label class="field-label" for="acompte-pct">Acompte à la signature (%)</label>
				<input
					id="acompte-pct"
					class="field-input"
					type="number"
					min="1"
					max="99"
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
		{/if}

		<!-- Sans solde à venir, un délai de règlement n'a rien à retarder. -->
		{#if mode !== 'signature'}
			<div>
				<label class="field-label" for="delai-solde">
					Délai de paiement {mode === 'livraison' ? '' : 'du solde '}(jours)
				</label>
				<input
					id="delai-solde"
					class="field-input"
					type="number"
					min="0"
					bind:value={modalitesPaiement.delaiJoursSolde}
				/>
				<p class="field-hint">0 = payable à la livraison.</p>
			</div>
		{/if}
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
