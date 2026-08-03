<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { AlerteMandat, BrouillonMandat, GraviteAlerte, RevueMandat } from '$domaine/types';
	import { verifierCoherence } from '$domaine/coherence';
	import { libelleLigne } from '$document/format';
	import Icone from '$composants/ui/Icone.svelte';

	// Deux relectures dans un seul endroit, et dans cet ordre : ce que le code prouve, puis ce que
	// l'IA soupçonne. La première est instantanée, hors ligne et exhaustive sur ce qu'elle couvre ;
	// la seconde demande un clic, vingt secondes, et ne trouve pas tout. Les mélanger laisserait
	// croire qu'elles se valent.
	let {
		brouillon,
		onRevoir
	}: {
		brouillon: BrouillonMandat;
		onRevoir: () => Promise<RevueMandat>;
	} = $props();

	const lignes = $derived(brouillon.lignes);

	/** Recalculé à chaque frappe, comme la validation : aucun clic à donner. */
	const incoherences = $derived(
		verifierCoherence(brouillon, libelleLigne(brouillon.structureProjet))
	);

	let enCours = $state(false);
	let revue = $state<RevueMandat | null>(null);
	let erreur = $state<string | null>(null);

	/** Constats écartés. Local à la revue en cours : rien n'est persisté, relancer repart à blanc. */
	let ecartes = $state(new SvelteSet<string>());

	const LIBELLES: Record<GraviteAlerte, string> = {
		incoherence: 'Contradiction',
		manque: 'Non couvert',
		imprecision: 'Trop vague'
	};

	/** L'incohérence est la seule qui rende un contrat attaquable : elle seule est en rouge. */
	const TONS: Record<GraviteAlerte, string> = {
		incoherence: 'border-danger/40 bg-danger/5',
		manque: 'border-warning/30 bg-warning/5',
		imprecision: 'border-border-subtle bg-surface-muted'
	};

	function cle(alerte: AlerteMandat): string {
		return `${alerte.cible}|${alerte.constat}`;
	}

	/** Traduit la cible en repère lisible : « Phase 2 » plutôt qu'un UUID. */
	function ou(cible: string): string {
		if (cible === 'objet') return 'Objet du mandat';
		if (cible === 'portee') return 'Portée';
		if (cible === 'general') return 'Ensemble du mandat';
		if (cible === 'paiement') return 'Paiement';
		if (cible === 'conditions') return 'Conditions';

		const index = lignes.findIndex((l) => l.id === cible);
		if (index === -1) return 'Mandat';

		const nom = lignes[index].nom.trim();
		const rang = `${libelleLigne(brouillon.structureProjet)} ${index + 1}`;
		return nom ? `${rang} — ${nom}` : rang;
	}

	const visibles = $derived(revue?.alertes.filter((a) => !ecartes.has(cle(a))) ?? []);

	/** Les deux relectures doivent être muettes : annoncer « aucun écart » au-dessus d'une
	 * contradiction affichée serait pire que de ne rien dire. */
	const rienASignaler = $derived(
		revue !== null && visibles.length === 0 && incoherences.length === 0
	);

	async function lancer() {
		enCours = true;
		erreur = null;
		ecartes = new SvelteSet();
		try {
			revue = await onRevoir();
		} catch (err) {
			erreur = err instanceof Error ? err.message : 'La revue a échoué.';
		} finally {
			enCours = false;
		}
	}
</script>

<div class="rounded-card border border-border-subtle bg-surface p-6 shadow-sm">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div>
			<h2 class="text-lg font-semibold text-ink">Revue du mandat</h2>
			<p class="mt-1 text-sm text-ink-muted">
				Ce qui se contredit, ce que la portée annonce sans le couvrir, ce qui resterait ambigu en
				cas de désaccord. Rien n’est corrigé automatiquement : vous seul savez ce que vous vouliez
				écrire.
			</p>
		</div>
		<button
			type="button"
			onclick={lancer}
			disabled={enCours}
			class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface-muted disabled:opacity-60"
		>
			<Icone name="sparkles" size={14} />
			{enCours ? 'Revue en cours…' : revue ? 'Relancer la revue IA' : 'Demander l’avis de l’IA'}
		</button>
	</div>

	<!-- D'abord ce qui est certain. Ces avertissements ne demandent aucun clic et ne dépendent
		d'aucun service : ce sont des comparaisons de texte, exhaustives sur ce qu'elles couvrent. -->
	{#if incoherences.length > 0}
		<div class="mt-4 space-y-2">
			<p class="text-xs font-semibold tracking-wide text-ink-muted uppercase">
				Vérifié automatiquement
			</p>
			{#each incoherences as souci (souci.cible + souci.message)}
				<div class="rounded-lg border border-danger/40 bg-danger/5 p-3">
					<span class="text-xs text-ink-muted">{ou(souci.cible)}</span>
					<p class="mt-1 text-sm text-ink">{souci.message}</p>
				</div>
			{/each}
		</div>
	{/if}

	{#if erreur}
		<p class="mt-3 text-xs text-warning">{erreur}</p>
	{/if}

	{#if rienASignaler}
		<p class="mt-4 text-sm text-ink-muted">
			<span class="font-medium text-success">Aucun écart repéré.</span> Cette relecture est partielle
			: elle ne voit que ce qui est écrit, et l’IA ne trouve pas tout. Elle ne remplace pas votre lecture
			du document.
		</p>
	{/if}

	{#if visibles.length > 0}
		<div class="mt-4 space-y-2">
			<p class="text-xs font-semibold tracking-wide text-ink-muted uppercase">
				Soupçonné par l’IA · à vérifier
			</p>
			{#each visibles as alerte (cle(alerte))}
				<div class="rounded-lg border p-3 {TONS[alerte.gravite]}">
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-xs font-semibold tracking-wide text-ink uppercase">
							{LIBELLES[alerte.gravite]}
						</span>
						<span class="text-xs text-ink-muted">· {ou(alerte.cible)}</span>
					</div>
					<p class="mt-1.5 text-sm text-ink">{alerte.constat}</p>
					{#if alerte.suggestion}
						<p class="mt-1 text-xs text-ink-muted">{alerte.suggestion}</p>
					{/if}
					<button
						type="button"
						onclick={() => ecartes.add(cle(alerte))}
						class="mt-2 text-xs font-medium text-ink-muted hover:text-ink"
					>
						Écarter
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>
