<script lang="ts">
	// « Inclus » et « Non inclus » étaient deux blocs identiques recopiés l'un sous l'autre, à
	// l'étiquette et au placeholder près. Un seul composant paramétré, donc une seule mise en forme
	// à corriger le jour où elle change.
	import Icone from '$composants/ui/Icone.svelte';

	let {
		valeurs = $bindable(),
		titre,
		placeholder,
		libelleAjout
	}: {
		valeurs: string[];
		titre: string;
		placeholder: string;
		libelleAjout: string;
	} = $props();
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
	</div>
</div>
