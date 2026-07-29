<script lang="ts">
	import type { SectionDocument } from '$lib/document/sections';
	import DocumentEcheancier from './DocumentEcheancier.svelte';
	import DocumentHonoraires from './DocumentHonoraires.svelte';
	import DocumentPortee from './DocumentPortee.svelte';

	let { section }: { section: SectionDocument } = $props();
</script>

<!-- Un article numéroté du document. Le type de contenu est porté par `section.contenu.kind` :
	l'union discriminée construite dans sections.ts évite d'avoir à deviner ici ce qu'on rend. -->
<section class="section">
	<h2 class="section-titre">
		<span class="section-numero">{section.numero}</span>
		{section.titre}
	</h2>

	{#if section.contenu.kind === 'paragraphes'}
		{#each section.contenu.textes as texte, i (i)}
			<p class="para">{texte}</p>
		{/each}
	{:else if section.contenu.kind === 'blocs'}
		{#each section.contenu.blocs as bloc, i (i)}
			{#if bloc.kind === 'p'}
				<p class="para">{bloc.texte}</p>
			{:else}
				<p class="liste-intro">{bloc.intro}</p>
				<ul class="liste liste-puces">
					{#each bloc.items as item (item)}
						<li>{item}</li>
					{/each}
				</ul>
			{/if}
		{/each}
	{:else if section.contenu.kind === 'portee'}
		<DocumentPortee contenu={section.contenu} numero={section.numero} />
	{:else if section.contenu.kind === 'honoraires'}
		<DocumentHonoraires contenu={section.contenu} />
	{:else}
		<DocumentEcheancier contenu={section.contenu} />
	{/if}
</section>
