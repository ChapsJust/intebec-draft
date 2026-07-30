<script lang="ts">
	import type { BrouillonMandat, RedactionIA } from '$domaine/types';
	import { construireDocument } from '$lib/document/sections';
	// Logo provisoire : à remplacer par le fichier officiel d'Intébec.
	import logo from '$lib/assets/logo-intebec.svg';
	// Mise en page du document. Sortie du composant pour que les sous-composants ci-dessous la
	// partagent : la portée automatique de Svelte s'arrêterait à la frontière de chacun.
	import './document.css';
	import DocumentArticle from './DocumentArticle.svelte';
	import DocumentParties from './DocumentParties.svelte';
	import DocumentSignatures from './DocumentSignatures.svelte';

	let {
		brouillon,
		redaction = null
	}: {
		brouillon: BrouillonMandat;
		redaction?: RedactionIA | null;
	} = $props();

	const doc = $derived(construireDocument(brouillon, redaction));
</script>

<article class="document densite-{doc.densite}" lang="fr-CA">
	<header class="entete">
		<p class="entete-type">{doc.typeLabel}</p>
		<h1 class="entete-titre">{doc.titre}</h1>
		<p class="entete-lieu">
			{#if doc.lieu}{doc.lieu}, le {doc.dateLongue}{:else}Le {doc.dateLongue}{/if}
		</p>
	</header>

	<DocumentParties parties={doc.parties} attendu={doc.attendu} />

	{#each doc.sections as section (section.numero)}
		<DocumentArticle {section} />
	{/each}

	<DocumentSignatures signatures={doc.signatures} enFoiDeQuoi={doc.enFoiDeQuoi} />

	<!-- Bloc-marque fermant le document, rendu une seule fois. Le bandeau répété à chaque page,
		avec la numérotation « Page X sur Y », est produit par Chromium dans la marge lors de la
		génération du PDF serveur : le CSS des navigateurs n'expose pas le nombre total de pages. -->
	<footer class="pied">
		<img class="pied-logo" src={logo} alt="Intébec" />
		<span>{doc.piedDePage}</span>
	</footer>
</article>
