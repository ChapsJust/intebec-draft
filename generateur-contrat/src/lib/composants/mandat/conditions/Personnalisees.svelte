<script lang="ts">
	import type { ClauseBibliotheque, ConditionsParticulieres } from '$domaine/types';
	import Icone from '$composants/ui/Icone.svelte';
	import { clausesDisponibles, retenirClause } from './bibliotheque';

	let {
		conditions = $bindable(),
		clausesBibliotheque = []
	}: {
		conditions: ConditionsParticulieres;
		/** Clauses hors catalogue déjà connues, réutilisables sur ce mandat. */
		clausesBibliotheque?: ClauseBibliotheque[];
	} = $props();

	const disponibles = $derived(clausesDisponibles(clausesBibliotheque, conditions));

	function retirer(index: number) {
		conditions.clausesRetenues = conditions.clausesRetenues.filter((_, i) => i !== index);
	}
</script>

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
							onclick={() => retirer(index)}
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

	{#if disponibles.length > 0}
		<details class="mt-2">
			<summary
				class="cursor-pointer text-xs font-medium text-accent-600 transition hover:text-accent-500"
			>
				Ajouter depuis la bibliothèque ({disponibles.length})
			</summary>
			<div class="mt-2 space-y-2">
				{#each disponibles as clause (clause.id)}
					<div
						class="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border-subtle p-3"
					>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium text-ink">{clause.titre}</p>
							<p class="mt-0.5 line-clamp-2 text-xs text-ink-muted">{clause.corps}</p>
						</div>
						<button
							type="button"
							onclick={() => retenirClause(conditions, clause)}
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
