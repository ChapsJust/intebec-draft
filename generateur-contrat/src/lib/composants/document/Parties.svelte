<script lang="ts">
	import type { Partie } from '$document/sections';

	let { parties, attendu }: { parties: Partie[]; attendu: string } = $props();
</script>

<!-- Bloc d'identification des parties, dans la forme consacrée des contrats québécois : « Entre »,
	« Et », puis la formule qui ouvre les articles. La mention « (ci-après … ) » n'est pas décorative,
	c'est elle qui établit la désignation employée dans tout le reste du document. -->
<section class="parties">
	{#each parties as partie (partie.role)}
		<div class="partie">
			<p class="partie-connecteur">{partie.connecteur}</p>
			<p class="partie-nom">{partie.nom}</p>
			<div class="partie-coordonnees">
				{#each partie.lignes as ligne (ligne)}
					<span>{ligne}</span>
				{/each}
			</div>
			{#if partie.representant}
				<p class="partie-representant">Représenté par {partie.representant}</p>
			{/if}
			<p class="partie-designation">(ci-après «&nbsp;{partie.designation}&nbsp;»)</p>
		</div>
	{/each}
	<p class="parties-attendu">{attendu}</p>
</section>
