<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import Icone from '$composants/ui/Icone.svelte';

	// Pendant de `BoutonAssistance`, pour les listes plutôt que pour la prose. La différence tient à
	// la décision : un paragraphe se prend ou se laisse en bloc, une liste se coche élément par
	// élément. D'où des cases plutôt qu'un « Utiliser ce texte ».
	let {
		proposer,
		ajouter,
		label = 'Proposer des éléments'
	}: {
		proposer: () => Promise<string[]>;
		ajouter: (elements: string[]) => void;
		label?: string;
	} = $props();

	let enCours = $state(false);
	let propositions = $state<string[] | null>(null);
	let erreur = $state<string | null>(null);

	/** Tout est coché d'entrée : la liste est déjà filtrée côté serveur, décocher est l'exception. */
	let retenus = $state(new SvelteSet<string>());

	async function demander() {
		enCours = true;
		erreur = null;
		propositions = null;
		try {
			const items = await proposer();
			propositions = items;
			retenus = new SvelteSet(items);
		} catch (err) {
			erreur = err instanceof Error ? err.message : 'La proposition a échoué.';
		} finally {
			enCours = false;
		}
	}

	function basculer(element: string) {
		if (retenus.has(element)) retenus.delete(element);
		else retenus.add(element);
	}

	function appliquer() {
		if (propositions) ajouter(propositions.filter((e) => retenus.has(e)));
		propositions = null;
	}
</script>

<button
	type="button"
	onclick={demander}
	disabled={enCours}
	class="inline-flex items-center gap-1.5 text-xs font-medium text-accent-600 transition hover:text-accent-500 disabled:opacity-60"
>
	<Icone name="sparkles" size={14} />
	{enCours ? 'Recherche…' : label}
</button>

{#if erreur}
	<p class="mt-1 text-xs text-warning">{erreur}</p>
{/if}

{#if propositions?.length === 0}
	<p class="mt-1 text-xs text-ink-muted">
		L’IA ne voit rien à ajouter ici, compte tenu du reste du mandat.
	</p>
{/if}

{#if propositions && propositions.length > 0}
	<div class="mt-2 rounded-lg border border-accent-400/40 bg-accent-500/5 p-3">
		<p class="text-xs font-medium text-ink-muted">Propositions de l’IA locale</p>
		<div class="mt-2 space-y-1.5">
			{#each propositions as element (element)}
				<label class="flex cursor-pointer items-start gap-2 text-sm text-ink">
					<input
						type="checkbox"
						checked={retenus.has(element)}
						onchange={() => basculer(element)}
						class="mt-0.5 shrink-0"
					/>
					<span>{element}</span>
				</label>
			{/each}
		</div>
		<div class="mt-3 flex gap-3">
			<button
				type="button"
				onclick={appliquer}
				disabled={retenus.size === 0}
				class="text-xs font-semibold text-accent-600 hover:text-accent-500 disabled:opacity-60"
			>
				Ajouter {retenus.size > 0 ? `(${retenus.size})` : ''}
			</button>
			<button
				type="button"
				onclick={() => (propositions = null)}
				class="text-xs font-medium text-ink-muted hover:text-ink"
			>
				Ignorer
			</button>
		</div>
	</div>
{/if}
