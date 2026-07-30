<script lang="ts">
	// `SvelteSet` et non `Set` : un `Set` nu muté par `add()` ne déclenche aucun `$derived`, et les
	// cartes refusées restaient affichées jusqu'à la prochaine frappe dans le formulaire.
	import { SvelteSet } from 'svelte/reactivity';
	import type {
		AuditClauses,
		ClauseBibliotheque,
		ConditionsParticulieres,
		PropositionClause
	} from '$domaine/types';
	import { CLES_CLAUSES, LIBELLES_CLAUSES, libelleSuggestion } from '$document/catalogue';
	import SectionFormulaire from '$composants/ui/SectionFormulaire.svelte';
	import Icone from '$composants/ui/Icone.svelte';

	let {
		conditions = $bindable(),
		clausesBibliotheque = [],
		onAuditer,
		onRetenirProposition
	}: {
		conditions: ConditionsParticulieres;
		/** Clauses hors catalogue déjà connues, réutilisables sur ce mandat. */
		clausesBibliotheque?: ClauseBibliotheque[];
		/** Absent tant que l'IA n'est pas configurée : le formulaire reste alors utilisable seul. */
		onAuditer?: () => Promise<AuditClauses>;
		onRetenirProposition?: (proposition: PropositionClause) => Promise<ClauseBibliotheque>;
	} = $props();

	const clausesActives = $derived(CLES_CLAUSES.filter((cle) => conditions.clauses[cle]).length);

	let auditEnCours = $state(false);
	let audit = $state<AuditClauses | null>(null);
	let erreurAudit = $state<string | null>(null);
	/** Clause en cours d'enregistrement en bibliothèque, pour n'immobiliser que son bouton. */
	let retenueEnCours = $state<string | null>(null);

	/** Suggestions écartées d'un geste. Purement local à la relecture en cours : l'audit n'est
	 * persisté nulle part, donc un refus n'a rien à survivre. Relancer la relecture repart d'une page
	 * blanche, ce qui est le comportement attendu quand on veut un second avis. */
	let refusees = $state(new SvelteSet<string>());

	const titreNormalise = (titre: string) =>
		titre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

	const titresRetenus = $derived(
		new Set(conditions.clausesRetenues.map((c) => titreNormalise(c.titre)))
	);

	/** Les suggestions déjà appliquées disparaissent d'elles-mêmes : la liste est filtrée sur
	 * l'état réel des cases, pas sur ce que l'IA a répondu. Un audit qui recommande d'activer ce
	 * qui est déjà coché se discrédite en trois secondes. */
	const suggestions = $derived(
		audit?.suggestions.filter(
			(s) => !conditions.clauses[s.cle] && !refusees.has(`clause:${s.cle}`)
		) ?? []
	);
	const manquesChiffres = $derived(
		audit?.conditions.filter(
			(c) => conditions[c.champ] <= 0 && !refusees.has(`champ:${c.champ}`)
		) ?? []
	);
	/** Une clause de la bibliothèque déjà retenue entre-temps sort de la liste, comme une case cochée. */
	const suggestionsBibliotheque = $derived(
		(audit?.bibliotheque ?? [])
			.map((s) => ({ ...s, clause: clausesBibliotheque.find((c) => c.id === s.id) }))
			.filter(
				(s) =>
					s.clause &&
					!refusees.has(`biblio:${s.id}`) &&
					!conditions.clausesRetenues.some((c) => c.idBibliotheque === s.id) &&
					!titresRetenus.has(titreNormalise(s.clause.titre))
			)
	);
	const propositions = $derived(
		audit?.propositions.filter(
			(p) => !refusees.has(`prop:${p.titre}`) && !titresRetenus.has(titreNormalise(p.titre))
		) ?? []
	);
	const rienASignaler = $derived(
		audit !== null &&
			suggestions.length === 0 &&
			manquesChiffres.length === 0 &&
			suggestionsBibliotheque.length === 0 &&
			propositions.length === 0
	);

	/** Clauses de la bibliothèque encore disponibles pour ce mandat. */
	const bibliothequeDisponible = $derived(
		clausesBibliotheque.filter(
			(c) =>
				!c.archiveLe &&
				!conditions.clausesRetenues.some((r) => r.idBibliotheque === c.id) &&
				!titresRetenus.has(titreNormalise(c.titre))
		)
	);

	async function lancerAudit() {
		if (!onAuditer) return;
		auditEnCours = true;
		erreurAudit = null;
		refusees = new SvelteSet();
		try {
			audit = await onAuditer();
		} catch (err) {
			erreurAudit = err instanceof Error ? err.message : "L'audit a échoué.";
		} finally {
			auditEnCours = false;
		}
	}

	function refuser(cle: string) {
		refusees.add(cle);
	}

	/** Retient une clause de la bibliothèque : c'est une copie du texte qui entre dans le mandat, pas
	 * une référence. La bibliothèque peut ensuite évoluer sans réécrire ce contrat. */
	function retenirDepuisBibliotheque(clause: ClauseBibliotheque) {
		conditions.clausesRetenues = [
			...conditions.clausesRetenues,
			{ idBibliotheque: clause.id, titre: clause.titre, corps: clause.corps }
		];
	}

	/** Accepte une clause proposée par la relecture : elle entre d'abord dans la bibliothèque, puis
	 * dans le mandat. L'ordre compte, l'identifiant venant de la bibliothèque. */
	async function accepterProposition(proposition: PropositionClause) {
		if (!onRetenirProposition) return;
		retenueEnCours = proposition.titre;
		erreurAudit = null;
		try {
			retenirDepuisBibliotheque(await onRetenirProposition(proposition));
		} catch (err) {
			erreurAudit = err instanceof Error ? err.message : 'La clause n’a pas pu être enregistrée.';
		} finally {
			retenueEnCours = null;
		}
	}

	function retirerClauseRetenue(index: number) {
		conditions.clausesRetenues = conditions.clausesRetenues.filter((_, i) => i !== index);
	}
</script>

{#snippet summary()}
	Garantie {conditions.dureeGarantieJours}&nbsp;j · Support {conditions.dureeSupportMois}&nbsp;mois
	·
	{clausesActives}/{CLES_CLAUSES.length} clauses actives{#if conditions.clausesRetenues.length > 0}
		&nbsp;· {conditions.clausesRetenues.length} personnalisée{conditions.clausesRetenues.length > 1
			? 's'
			: ''}{/if}
{/snippet}

<SectionFormulaire
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

	<!-- Les clauses hors catalogue vivent ici, et nulle part ailleurs : pas d'entrée de menu ni
		d'écran dédié pour une liste qui compte quelques titres. Le texte reste modifiable, parce
		qu'un brouillon d'IA se corrige presque toujours avant d'être envoyé à un client. -->
	<div>
		<span class="field-label">Clauses personnalisées</span>

		{#if conditions.clausesRetenues.length === 0}
			<p class="field-hint">
				Aucune. La relecture par l’IA en propose, et celles que vous retenez s’ajoutent à votre
				bibliothèque.
			</p>
		{:else}
			<div class="space-y-3">
				{#each conditions.clausesRetenues as clause, index (`${clause.idBibliotheque}-${index}`)}
					<div class="rounded-lg border border-border-subtle bg-surface-muted p-3">
						<div class="flex items-start gap-2">
							<input
								class="field-input flex-1 font-medium"
								bind:value={conditions.clausesRetenues[index].titre}
								aria-label="Titre de la clause"
							/>
							<button
								type="button"
								onclick={() => retirerClauseRetenue(index)}
								class="shrink-0 rounded-lg p-1.5 text-ink-muted transition hover:bg-surface hover:text-danger"
								aria-label="Retirer la clause « {clause.titre} » de ce mandat"
							>
								<Icone name="trash" size={16} />
							</button>
						</div>
						<textarea
							class="field-input mt-2"
							rows="4"
							bind:value={conditions.clausesRetenues[index].corps}
							aria-label="Texte de la clause"></textarea>
					</div>
				{/each}
			</div>
		{/if}

		{#if bibliothequeDisponible.length > 0}
			<details class="mt-2">
				<summary
					class="cursor-pointer text-xs font-medium text-accent-600 transition hover:text-accent-500"
				>
					Ajouter depuis la bibliothèque ({bibliothequeDisponible.length})
				</summary>
				<div class="mt-2 space-y-2">
					{#each bibliothequeDisponible as clause (clause.id)}
						<div
							class="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border-subtle p-3"
						>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium text-ink">{clause.titre}</p>
								<p class="mt-0.5 line-clamp-2 text-xs text-ink-muted">{clause.corps}</p>
							</div>
							<button
								type="button"
								onclick={() => retenirDepuisBibliotheque(clause)}
								class="shrink-0 text-xs font-semibold text-accent-600 hover:text-accent-500"
							>
								Ajouter
							</button>
						</div>
					{/each}
				</div>
			</details>
		{/if}
	</div>

	{#if onAuditer}
		<div class="border-t border-border-subtle pt-4">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div>
					<span class="field-label mb-0">Relecture du volet contractuel</span>
					<p class="text-xs text-ink-muted">
						L’IA signale ce qui manque et propose des clauses. Rien n’est appliqué sans votre accord
						: chaque suggestion s’accepte ou se refuse.
					</p>
				</div>
				<button
					type="button"
					onclick={lancerAudit}
					disabled={auditEnCours}
					class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface-muted disabled:opacity-60"
				>
					<Icone name="sparkles" size={14} />
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
							<div class="flex shrink-0 gap-3">
								<button
									type="button"
									onclick={() => (conditions.clauses[s.cle] = true)}
									class="text-xs font-semibold text-accent-600 hover:text-accent-500"
								>
									Activer
								</button>
								<button
									type="button"
									onclick={() => refuser(`clause:${s.cle}`)}
									class="text-xs font-medium text-ink-muted hover:text-ink"
								>
									Refuser
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if manquesChiffres.length > 0}
				<div class="mt-3 space-y-2">
					<!-- Aucune valeur n'est proposée : l'IA n'a pas à décider d'une durée de garantie
						ni d'un taux horaire. Elle signale le champ, l'utilisateur met le chiffre. C'est
						pourquoi il n'y a rien à « accepter » ici, seulement à écarter. -->
					<p class="text-xs font-medium text-ink-muted">
						Conditions laissées à zéro (l’article correspondant est absent du contrat)
					</p>
					{#each manquesChiffres as c (c.champ)}
						<div
							class="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border-subtle bg-surface-muted p-3"
						>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium text-ink">{libelleSuggestion(c.champ)}</p>
								<p class="mt-0.5 text-xs text-ink-muted">{c.raison}</p>
							</div>
							<button
								type="button"
								onclick={() => refuser(`champ:${c.champ}`)}
								class="shrink-0 text-xs font-medium text-ink-muted hover:text-ink"
							>
								Refuser
							</button>
						</div>
					{/each}
				</div>
			{/if}

			{#if suggestionsBibliotheque.length > 0}
				<div class="mt-3 space-y-2">
					<!-- Réutiliser plutôt que réécrire : c'est tout l'intérêt d'avoir transmis la
						bibliothèque au modèle. -->
					<p class="text-xs font-medium text-ink-muted">Clauses de votre bibliothèque à retenir</p>
					{#each suggestionsBibliotheque as s (s.id)}
						<div
							class="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-accent-400/40 bg-accent-500/5 p-3"
						>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium text-ink">{s.clause?.titre}</p>
								<p class="mt-0.5 text-xs text-ink-muted">{s.raison}</p>
							</div>
							<div class="flex shrink-0 gap-3">
								<button
									type="button"
									onclick={() => s.clause && retenirDepuisBibliotheque(s.clause)}
									class="text-xs font-semibold text-accent-600 hover:text-accent-500"
								>
									Ajouter
								</button>
								<button
									type="button"
									onclick={() => refuser(`biblio:${s.id}`)}
									class="text-xs font-medium text-ink-muted hover:text-ink"
								>
									Refuser
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if propositions.length > 0}
				<div class="mt-3 space-y-2">
					<p class="text-xs font-medium text-warning">Protections que rien ne couvre encore</p>
					<p class="text-xs text-ink-muted">
						Ces brouillons sont un point de départ, pas du texte contractuel définitif. Acceptée,
						une clause entre dans ce mandat et dans votre bibliothèque, et son texte reste
						modifiable ci-dessus.
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
							{#if onRetenirProposition}
								<div class="mt-3 flex gap-3">
									<button
										type="button"
										onclick={() => accepterProposition(prop)}
										disabled={retenueEnCours !== null}
										class="text-xs font-semibold text-accent-600 hover:text-accent-500 disabled:opacity-60"
									>
										{retenueEnCours === prop.titre ? 'Enregistrement…' : 'Accepter'}
									</button>
									<button
										type="button"
										onclick={() => refuser(`prop:${prop.titre}`)}
										class="text-xs font-medium text-ink-muted hover:text-ink"
									>
										Refuser
									</button>
								</div>
							{/if}
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
</SectionFormulaire>
