<script lang="ts">
	// `SvelteSet` et non `Set` : un `Set` nu muté par `add()` ne déclenche aucun `$derived`.
	import { SvelteSet } from 'svelte/reactivity';
	import type {
		AuditClauses,
		ClauseBibliotheque,
		ConditionsParticulieres,
		PropositionClause
	} from '$domaine/types';
	import { titreNormalise } from '$domaine/titres';
	import { LIBELLES_CLAUSES, libelleSuggestion } from '$document/catalogue';
	import Icone from '$composants/ui/Icone.svelte';
	import { retenirClause, titresRetenus } from './bibliotheque';

	let {
		conditions = $bindable(),
		clausesBibliotheque = [],
		onAuditer,
		onRetenirProposition
	}: {
		conditions: ConditionsParticulieres;
		clausesBibliotheque?: ClauseBibliotheque[];
		onAuditer: () => Promise<AuditClauses>;
		onRetenirProposition?: (proposition: PropositionClause) => Promise<ClauseBibliotheque>;
	} = $props();

	let auditEnCours = $state(false);
	let audit = $state<AuditClauses | null>(null);
	let erreurAudit = $state<string | null>(null);
	/** Clause en cours d'enregistrement en bibliothèque, pour n'immobiliser que son bouton. */
	let retenueEnCours = $state<string | null>(null);

	/** Suggestions écartées d'un geste, local à la relecture en cours : l'audit n'est persisté nulle
	 * part, et relancer une relecture doit repartir d'une page blanche. */
	let refusees = $state(new SvelteSet<string>());

	const retenus = $derived(titresRetenus(conditions));

	/** Filtré sur l'état réel des cases, pas sur ce que l'IA a répondu : un audit qui recommande
	 * d'activer ce qui est déjà coché se discrédite en trois secondes. */
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
					!retenus.has(titreNormalise(s.clause.titre))
			)
	);
	const propositions = $derived(
		audit?.propositions.filter(
			(p) => !refusees.has(`prop:${p.titre}`) && !retenus.has(titreNormalise(p.titre))
		) ?? []
	);
	const rienASignaler = $derived(
		audit !== null &&
			suggestions.length === 0 &&
			manquesChiffres.length === 0 &&
			suggestionsBibliotheque.length === 0 &&
			propositions.length === 0
	);

	async function lancerAudit() {
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

	/** La clause entre d'abord dans la bibliothèque, puis dans le mandat : l'ordre compte, c'est la
	 * bibliothèque qui attribue l'identifiant. */
	async function accepterProposition(proposition: PropositionClause) {
		if (!onRetenirProposition) return;
		retenueEnCours = proposition.titre;
		erreurAudit = null;
		try {
			retenirClause(conditions, await onRetenirProposition(proposition));
		} catch (err) {
			erreurAudit = err instanceof Error ? err.message : 'La clause n’a pas pu être enregistrée.';
		} finally {
			retenueEnCours = null;
		}
	}
</script>

<div class="border-t border-border-subtle pt-4">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div>
			<span class="field-label mb-0">Relecture du volet contractuel</span>
			<p class="text-xs text-ink-muted">
				L’IA signale ce qui manque et propose des clauses. Rien n’est appliqué sans votre accord :
				chaque suggestion s’accepte ou se refuse.
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
			<!-- Aucune valeur proposée : l'IA n'a pas à décider d'une durée de garantie. Elle signale
				le champ, l'utilisateur met le chiffre — d'où l'absence de bouton « accepter ». -->
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
			<!-- Réutiliser plutôt que réécrire : l'intérêt d'avoir transmis la bibliothèque au modèle. -->
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
							onclick={() => s.clause && retenirClause(conditions, s.clause)}
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
				Ces brouillons sont un point de départ, pas du texte contractuel définitif. Acceptée, une
				clause entre dans ce mandat et dans votre bibliothèque, et son texte reste modifiable
				ci-dessus.
			</p>
			{#each propositions as prop (prop.titre)}
				<div class="rounded-lg border border-warning/30 bg-warning/5 p-3">
					<p class="text-sm font-medium text-ink">{prop.titre}</p>
					<p class="mt-0.5 text-xs text-ink-muted">{prop.raison}</p>
					<p class="mt-2 border-l-2 border-warning/40 pl-3 text-sm whitespace-pre-line text-ink">
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
