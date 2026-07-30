<script lang="ts">
	import type { ContenuSection } from '$document/modele';

	let {
		contenu,
		numero
	}: { contenu: Extract<ContenuSection, { kind: 'portee' }>; numero: number } = $props();
</script>

{#each contenu.entrees as entree, i (i)}
	<div class="portee">
		<div class="portee-entete">
			<h3 class="sous-titre">
				<span class="sous-numero">{numero}.{i + 1}</span>
				{entree.nom}
			</h3>
			<span class="portee-label">{entree.label}</span>
		</div>

		<!-- Montant et délai en exergue avant le détail : le lecteur voit l'engagement chiffré sans
			avoir à le chercher dans le tableau des honoraires. -->
		<p class="portee-exergue">
			<span class="exergue-montant">{entree.montant}</span>
			<span class="exergue-note">avant taxes</span>
			{#if entree.delai}
				<span class="exergue-separateur"></span>
				<span class="exergue-delai">{entree.delai}</span>
			{/if}
		</p>

		{#if entree.description}
			<p class="para">{entree.description}</p>
		{/if}

		{#if entree.inclus.length > 0 || entree.nonInclus.length > 0}
			<div class="portee-listes">
				{#if entree.inclus.length > 0}
					<div>
						<p class="etiquette">Compris</p>
						<ul class="liste liste-inclus">
							{#each entree.inclus as item (item)}
								<li>{item}</li>
							{/each}
						</ul>
					</div>
				{/if}
				{#if entree.nonInclus.length > 0}
					<div>
						<p class="etiquette">Non compris</p>
						<ul class="liste liste-exclus">
							{#each entree.nonInclus as item (item)}
								<li>{item}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/each}
