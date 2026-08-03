<script lang="ts">
	// « Inclus » et « Non inclus » étaient deux blocs identiques recopiés l'un sous l'autre, à
	// l'étiquette et au placeholder près. Un seul composant paramétré, donc une seule mise en forme
	// à corriger le jour où elle change.
	import Icone from '$composants/ui/Icone.svelte';
	import BoutonElements from '$composants/ia/BoutonElements.svelte';

	let {
		valeurs = $bindable(),
		titre,
		placeholder,
		libelleAjout,
		onProposer
	}: {
		valeurs: string[];
		titre: string;
		placeholder: string;
		libelleAjout: string;
		/** Absent tant que l'IA n'est pas configurée : la liste reste utilisable à la main. */
		onProposer?: () => Promise<string[]>;
	} = $props();

	/** Les propositions retenues remplacent les entrées vides avant de s'ajouter à la suite : sinon un
	 * champ laissé en attente reste coincé au milieu de la liste. */
	function ajouter(elements: string[]) {
		valeurs = [...valeurs.filter((v) => v.trim()), ...elements];
	}
</script>

<div>
	<span class="field-label">{titre}</span>
	<div class="space-y-2">
		{#each valeurs as _, j}
			<div class="flex gap-2">
				<input class="field-input" type="text" bind:value={valeurs[j]} {placeholder} />
				<button
					type="button"
					class="shrink-0 text-ink-muted hover:text-warning"
					onclick={() => valeurs.splice(j, 1)}
					aria-label="Retirer"
				>
					<Icone name="close" size={16} />
				</button>
			</div>
		{/each}
		<button
			type="button"
			class="hover:text-accent-700 text-sm font-medium text-accent-600"
			onclick={() => valeurs.push('')}
		>
			{libelleAjout}
		</button>

		<!-- Sous le bouton d'ajout manuel, pas à côté : le panneau de propositions déplie une liste de
			cases, qui n'a pas sa place sur une ligne de boutons. -->
		{#if onProposer}
			<div>
				<BoutonElements proposer={onProposer} {ajouter} label="Proposer avec l’IA" />
			</div>
		{/if}
	</div>
</div>
