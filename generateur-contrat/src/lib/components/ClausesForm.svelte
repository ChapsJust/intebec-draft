<script lang="ts">
	import type { AuditClauses, ConditionsParticulieres } from '$lib/types';
	import { CLES_CLAUSES, LIBELLES_CLAUSES, libelleSuggestion } from '$lib/document/catalogue';
	import FormSection from './FormSection.svelte';
	import Icon from './Icon.svelte';

	let {
		conditions = $bindable(),
		onAuditer
	}: {
		conditions: ConditionsParticulieres;
		/** Absent tant que l'IA n'est pas configurée : le formulaire reste alors utilisable seul. */
		onAuditer?: () => Promise<AuditClauses>;
	} = $props();

	const clausesActives = $derived(CLES_CLAUSES.filter((cle) => conditions.clauses[cle]).length);

	let auditEnCours = $state(false);
	let audit = $state<AuditClauses | null>(null);
	let erreurAudit = $state<string | null>(null);

	/** Les suggestions déjà appliquées disparaissent d'elles-mêmes : la liste est filtrée sur
	 * l'état réel des cases, pas sur ce que l'IA a répondu. Un audit qui recommande d'activer ce
	 * qui est déjà coché se discrédite en trois secondes. */
	const suggestions = $derived(audit?.suggestions.filter((s) => !conditions.clauses[s.cle]) ?? []);
	const manquesChiffres = $derived(audit?.conditions.filter((c) => conditions[c.champ] <= 0) ?? []);
	const propositions = $derived(audit?.propositions ?? []);
	const rienASignaler = $derived(
		audit !== null &&
			suggestions.length === 0 &&
			manquesChiffres.length === 0 &&
			propositions.length === 0
	);

	async function lancerAudit() {
		if (!onAuditer) return;
		auditEnCours = true;
		erreurAudit = null;
		try {
			audit = await onAuditer();
		} catch (err) {
			erreurAudit = err instanceof Error ? err.message : "L'audit a échoué.";
		} finally {
			auditEnCours = false;
		}
	}
</script>

{#snippet summary()}
	Garantie {conditions.dureeGarantieJours}&nbsp;j · Support {conditions.dureeSupportMois}&nbsp;mois
	·
	{clausesActives}/{CLES_CLAUSES.length} clauses actives
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
			{#each CLES_CLAUSES as cle (cle)}
				<label class="flex items-center gap-2 text-sm text-ink">
					<input
						type="checkbox"
						bind:checked={conditions.clauses[cle]}
						class="rounded text-accent-500 focus:ring-accent-500"
					/>
					{LIBELLES_CLAUSES[cle]}
				</label>
			{/each}
		</div>
	</div>

	{#if onAuditer}
		<div class="border-t border-border-subtle pt-4">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div>
					<span class="field-label mb-0">Relecture du volet contractuel</span>
					<p class="text-xs text-ink-muted">
						L’IA signale ce qui manque. Elle n’active rien et ne rédige aucune clause du document :
						c’est vous qui tranchez.
					</p>
				</div>
				<button
					type="button"
					onclick={lancerAudit}
					disabled={auditEnCours}
					class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface-muted disabled:opacity-60"
				>
					<Icon name="sparkles" size={14} />
					{auditEnCours
						? 'Relecture en cours…'
						: audit
							? 'Relancer la relecture'
							: 'Vérifier les clauses'}
				</button>
			</div>

			{#if erreurAudit}
				<p class="mt-2 text-xs text-warning">{erreurAudit}</p>
			{/if}

			{#if rienASignaler}
				<p class="mt-3 text-sm text-success">
					Rien à signaler : le volet contractuel couvre ce mandat.
				</p>
			{/if}

			{#if suggestions.length > 0}
				<div class="mt-3 space-y-2">
					<p class="text-xs font-medium text-ink-muted">Clauses du catalogue à activer</p>
					{#each suggestions as s (s.cle)}
						<div
							class="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-accent-400/40 bg-accent-500/5 p-3"
						>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium text-ink">{LIBELLES_CLAUSES[s.cle]}</p>
								<p class="mt-0.5 text-xs text-ink-muted">{s.raison}</p>
							</div>
							<button
								type="button"
								onclick={() => (conditions.clauses[s.cle] = true)}
								class="shrink-0 text-xs font-semibold text-accent-600 hover:text-accent-500"
							>
								Activer
							</button>
						</div>
					{/each}
				</div>
			{/if}

			{#if manquesChiffres.length > 0}
				<div class="mt-3 space-y-2">
					<!-- Aucune valeur n'est proposée : l'IA n'a pas à décider d'une durée de garantie
						ni d'un taux horaire. Elle signale le champ, l'utilisateur met le chiffre. -->
					<p class="text-xs font-medium text-ink-muted">
						Conditions laissées à zéro (l’article correspondant est absent du contrat)
					</p>
					{#each manquesChiffres as c (c.champ)}
						<div class="rounded-lg border border-border-subtle bg-surface-muted p-3">
							<p class="text-sm font-medium text-ink">{libelleSuggestion(c.champ)}</p>
							<p class="mt-0.5 text-xs text-ink-muted">{c.raison}</p>
						</div>
					{/each}
				</div>
			{/if}

			{#if propositions.length > 0}
				<div class="mt-3 space-y-2">
					<p class="text-xs font-medium text-warning">Protections que le catalogue ne couvre pas</p>
					<p class="text-xs text-ink-muted">
						Ces brouillons ne sont pas du texte contractuel et n’entrent dans aucun document. À
						faire réviser, puis à ajouter au catalogue s’ils sont retenus.
					</p>
					{#each propositions as prop (prop.titre)}
						<div class="rounded-lg border border-warning/30 bg-warning/5 p-3">
							<p class="text-sm font-medium text-ink">{prop.titre}</p>
							<p class="mt-0.5 text-xs text-ink-muted">{prop.raison}</p>
							<p
								class="mt-2 border-l-2 border-warning/40 pl-3 text-sm whitespace-pre-line text-ink"
							>
								{prop.brouillon}
							</p>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

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
