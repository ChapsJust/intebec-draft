<script lang="ts">
	import type { MandatDraft, RedactionIA } from '$lib/types';
	import { buildDocument } from '$lib/document/sections';
	// Logo provisoire : à remplacer par le fichier officiel d'Intébec.
	import logo from '$lib/assets/logo-intebec.svg';

	let {
		draft,
		redaction = null
	}: {
		draft: MandatDraft;
		redaction?: RedactionIA | null;
	} = $props();

	const doc = $derived(buildDocument(draft, redaction));
</script>

<article class="document densite-{doc.densite}" lang="fr-CA">
	<header class="entete">
		<p class="entete-type">{doc.typeLabel}</p>
		<h1 class="entete-titre">{doc.titre}</h1>
		<p class="entete-lieu">
			{#if doc.lieu}{doc.lieu}, le {doc.dateLongue}{:else}Le {doc.dateLongue}{/if}
		</p>
	</header>

	<section class="parties">
		{#each doc.parties as partie (partie.role)}
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
		<p class="parties-attendu">{doc.attendu}</p>
	</section>

	{#each doc.sections as section (section.numero)}
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
				{#each section.contenu.entrees as entree, i (i)}
					<div class="portee">
						<div class="portee-entete">
							<h3 class="sous-titre">
								<span class="sous-numero">{section.numero}.{i + 1}</span>
								{entree.nom}
							</h3>
							<span class="portee-label">{entree.label}</span>
						</div>

						<!-- Montant et délai en exergue avant le détail : le lecteur voit l'engagement
							chiffré sans avoir à chercher dans le tableau des honoraires. -->
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
			{:else if section.contenu.kind === 'honoraires'}
				<table class="tableau tableau-honoraires">
					<thead>
						<tr>
							<th scope="col">Désignation</th>
							<th scope="col">Détail</th>
							<th scope="col">Délai</th>
							<th scope="col" class="col-montant">Montant</th>
						</tr>
					</thead>
					<tbody>
						{#each section.contenu.lignes as ligne, i (i)}
							<tr>
								<td>
									<span class="cellule-label">{ligne.label}</span>
									<span class="cellule-nom">{ligne.nom}</span>
								</td>
								<td class="cellule-detail">
									{#each ligne.details as detail (detail)}
										<span>{detail}</span>
									{/each}
								</td>
								<td class="cellule-detail"><span>{ligne.delai || 'À convenir'}</span></td>
								<td class="col-montant">{ligne.montant}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr class="rang-sous-total">
							<td colspan="3">Sous-total</td>
							<td class="col-montant">{section.contenu.sousTotal}</td>
						</tr>
						{#if section.contenu.rabais}
							<tr class="rang-rabais">
								<td colspan="3">
									Rabais ({section.contenu.rabais.pct}&nbsp;%)
									{#if section.contenu.rabais.motif}
										<span class="rabais-motif">{section.contenu.rabais.motif}</span>
									{/if}
								</td>
								<td class="col-montant">{section.contenu.rabais.montant}</td>
							</tr>
						{/if}
						<tr class="rang-total">
							<td colspan="3">Total <span class="rang-total-note">avant taxes</span></td>
							<td class="col-montant">{section.contenu.total}</td>
						</tr>
					</tfoot>
				</table>
			{:else}
				<table class="tableau tableau-echeancier">
					<thead>
						<tr>
							<th scope="col">Versement</th>
							<th scope="col">Échéance</th>
							<th scope="col" class="col-montant">Montant</th>
						</tr>
					</thead>
					<tbody>
						{#each section.contenu.versements as versement, i (i)}
							<tr>
								<td class="cellule-forte">{versement.libelle}</td>
								<td class="cellule-detail"><span>{versement.echeance}</span></td>
								<td class="col-montant">{versement.montant}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{#each section.contenu.notes as note (note)}
					<p class="note">{note}</p>
				{/each}
			{/if}
		</section>
	{/each}

	<section class="signatures">
		<h2 class="section-titre section-titre-nonnumerote">Signatures</h2>
		<p class="para">
			En signant, les parties reconnaissent avoir lu et accepté l'ensemble des conditions énoncées
			aux présentes.
		</p>
		<p class="en-foi-de-quoi">{doc.enFoiDeQuoi}</p>
		<div class="signatures-grille">
			{#each doc.signatures as bloc (bloc.role)}
				<div class="signature">
					<p class="etiquette">{bloc.role}</p>
					{#if bloc.organisation}<p class="signature-organisation">{bloc.organisation}</p>{/if}
					<div class="signature-champ">
						<div class="signature-trait"></div>
						<p class="signature-legende">
							{bloc.nom || 'Nom du signataire'}{#if bloc.titre}, {bloc.titre}{/if}
						</p>
					</div>
					<div class="signature-champ">
						<div class="signature-trait"></div>
						<p class="signature-legende">Date</p>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Bloc-marque fermant le document, rendu une seule fois. Le bandeau répété à chaque page,
		avec la numérotation « Page X sur Y », est produit par Chromium dans la marge lors de la
		génération du PDF serveur : le CSS des navigateurs n'expose pas le nombre total de pages. -->
	<footer class="pied">
		<img class="pied-logo" src={logo} alt="Intébec" />
		<span>{doc.piedDePage}</span>
	</footer>
</article>

<style>
	.document {
		/* Le document a sa propre identité typographique : empattements pour la prose juridique,
			sans-serif de la marque pour les titres, étiquettes et chiffres. */
		--doc-serif: Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', serif;
		--doc-sans: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
		--doc-encre: #16233a;
		--doc-second: #5a6a80;
		--doc-marine: #0f2a4a;
		--doc-filet: #d8dfe8;
		--doc-filet-fort: #9fb0c4;

		/* Échelle d'espacement pilotée par `densite`, calculée dans sections.ts à partir du volume
			réel du document. Toutes les marges verticales en dépendent, donc un seul multiplicateur
			resserre ou aère la mise en page entière. */
		--ec: 1;

		background: #fff;
		color: var(--doc-encre);
		max-width: 45rem;
		margin-inline: auto;
		padding: 3.5rem 3.5rem 4rem;
		font-family: var(--doc-serif);
		font-size: 0.9375rem;
		line-height: 1.6;
	}

	.densite-aere {
		--ec: 1.4;
		line-height: 1.7;
	}

	.densite-compact {
		--ec: 0.72;
		line-height: 1.5;
	}

	/* ---------- En-tête ---------- */

	.entete {
		border-bottom: 3px solid var(--doc-marine);
		padding-bottom: 1.1rem;
		margin-bottom: calc(2.25rem * var(--ec));
	}

	.entete-type {
		font-family: var(--doc-sans);
		text-transform: uppercase;
		letter-spacing: 0.16em;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--doc-marine);
	}

	.entete-titre {
		font-family: var(--doc-sans);
		font-size: 1.75rem;
		font-weight: 600;
		letter-spacing: -0.015em;
		line-height: 1.2;
		margin-top: 0.4rem;
		color: var(--doc-marine);
	}

	.entete-lieu {
		font-family: var(--doc-sans);
		margin-top: 0.55rem;
		font-size: 0.8125rem;
		color: var(--doc-second);
	}

	/* ---------- Étiquettes communes ---------- */

	.etiquette {
		font-family: var(--doc-sans);
		text-transform: uppercase;
		letter-spacing: 0.11em;
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--doc-second);
		margin-bottom: 0.3rem;
	}

	/* ---------- Parties ---------- */

	/* auto-fit plutôt que deux colonnes fixes : si une seule partie est renseignée, elle occupe
		toute la largeur au lieu de laisser une colonne vide. */
	.parties {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 2rem;
		padding: 1.25rem 1.5rem;
		background: #f7f9fc;
		border-left: 3px solid var(--doc-marine);
		margin-bottom: calc(2.5rem * var(--ec));
		break-inside: avoid;
	}

	/* « Entre » / « Et » : la charnière du préambule d'identification, dans la forme consacrée
		des contrats québécois. */
	.partie-connecteur {
		font-family: var(--doc-sans);
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-size: 0.6875rem;
		font-weight: 700;
		color: var(--doc-marine);
		margin-bottom: 0.4rem;
	}

	.partie-nom {
		font-family: var(--doc-sans);
		font-size: 1rem;
		font-weight: 600;
		line-height: 1.3;
		text-transform: uppercase;
		letter-spacing: 0.01em;
	}

	.partie-designation {
		margin-top: 0.4rem;
		font-size: 0.8125rem;
		font-style: italic;
		color: var(--doc-encre);
	}

	.parties-attendu {
		grid-column: 1 / -1;
		border-top: 1px solid var(--doc-filet);
		padding-top: 0.85rem;
		font-size: 0.875rem;
		font-style: italic;
	}

	.partie-coordonnees {
		display: flex;
		flex-direction: column;
		margin-top: 0.4rem;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--doc-second);
	}

	.partie-representant {
		margin-top: 0.5rem;
		font-size: 0.8125rem;
		font-style: italic;
		color: var(--doc-encre);
	}

	/* ---------- Sections ---------- */

	.section {
		margin-bottom: calc(2.25rem * var(--ec));
	}

	.section:last-of-type {
		margin-bottom: 0;
	}

	.section-titre {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		font-family: var(--doc-sans);
		font-size: 1.125rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--doc-marine);
		border-bottom: 1px solid var(--doc-filet-fort);
		padding-bottom: 0.45rem;
		margin-bottom: calc(1rem * var(--ec));
		break-after: avoid;
	}

	/* Le numéro est porté par une pastille pleine : il donne le repère de lecture sans que le
		titre ait besoin d'être plus gros. */
	.section-numero {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.5rem;
		height: 1.5rem;
		padding: 0 0.35rem;
		border-radius: 0.25rem;
		background: var(--doc-marine);
		color: #fff;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0;
	}

	/* Seul titre sans numéro : un filet vertical lui rend le poids visuel que la pastille donne
		aux autres, pour qu'il ne paraisse pas dégradé en fin de document. */
	.section-titre-nonnumerote {
		border-left: 3px solid var(--doc-marine);
		padding-left: 0.7rem;
	}

	.sous-titre {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-family: var(--doc-sans);
		font-size: 0.9375rem;
		font-weight: 600;
		margin-bottom: 0.4rem;
		break-after: avoid;
	}

	.sous-numero {
		flex-shrink: 0;
		color: var(--doc-marine);
		font-variant-numeric: tabular-nums;
	}

	/* ---------- Prose ---------- */

	.para {
		/* Alignement à gauche volontaire : sans césure française, le texte justifié creusait
			des « rivières » entre les mots dans les articles de conditions. */
		text-align: left;
		margin-bottom: calc(0.65rem * var(--ec));
		/* Empêche qu'une seule ligne d'un paragraphe soit reléguée seule en haut ou en bas
			d'une page à l'impression. */
		orphans: 2;
		widows: 2;
	}

	.para:last-child {
		margin-bottom: 0;
	}

	.note {
		font-size: 0.8125rem;
		line-height: 1.55;
		color: var(--doc-second);
		margin-top: 0.5rem;
	}

	.meta {
		font-family: var(--doc-sans);
		font-size: 0.8125rem;
		margin-top: 0.65rem;
	}

	.meta-cle {
		text-transform: uppercase;
		letter-spacing: 0.09em;
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--doc-second);
		margin-right: 0.5rem;
	}

	/* ---------- Portée ---------- */

	.portee {
		margin-bottom: calc(1.5rem * var(--ec));
		break-inside: avoid;
	}

	.portee:last-child {
		margin-bottom: 0;
	}

	.portee-entete {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.4rem;
	}

	.portee-entete .sous-titre {
		margin-bottom: 0;
	}

	.portee-label {
		flex-shrink: 0;
		font-family: var(--doc-sans);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--doc-second);
		border: 1px solid var(--doc-filet);
		border-radius: 999px;
		padding: 0.1rem 0.5rem;
	}

	/* Même logique que le bloc des parties : une seule liste occupe toute la largeur plutôt que
		de laisser un vide à droite. */
	.portee-listes {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 1.25rem;
		margin-top: 0.75rem;
	}

	.liste {
		list-style: none;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.liste li {
		position: relative;
		padding-left: 1rem;
		margin-bottom: 0.15rem;
	}

	.liste li::before {
		position: absolute;
		left: 0;
		font-family: var(--doc-sans);
		font-weight: 600;
	}

	.liste-inclus li::before {
		content: '+';
		color: var(--doc-marine);
	}

	.liste-exclus li::before {
		content: '−';
		color: var(--doc-second);
	}

	.liste-puces li::before {
		content: '•';
		color: var(--doc-marine);
	}

	.liste-puces {
		margin-bottom: calc(0.65rem * var(--ec));
	}

	.liste-puces li {
		margin-bottom: 0.25rem;
	}

	.liste-intro {
		margin-bottom: 0.35rem;
	}

	/* Montant et délai en exergue sous le titre de phase. */
	.portee-exergue {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.45rem;
		font-family: var(--doc-sans);
		margin-bottom: 0.55rem;
	}

	.exergue-montant {
		font-size: 1rem;
		font-weight: 700;
		color: var(--doc-marine);
		font-variant-numeric: tabular-nums;
	}

	.exergue-note {
		text-transform: uppercase;
		letter-spacing: 0.09em;
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--doc-second);
	}

	.exergue-separateur {
		width: 1px;
		align-self: stretch;
		background: var(--doc-filet);
		margin-inline: 0.3rem;
	}

	.exergue-delai {
		font-size: 0.8125rem;
		color: var(--doc-second);
	}

	/* ---------- Tableaux ---------- */

	.tableau {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--doc-sans);
		font-size: 0.8125rem;
		margin-top: 0.25rem;
	}

	.tableau th {
		text-align: left;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--doc-second);
		border-bottom: 1.5px solid var(--doc-marine);
		padding: 0 0.65rem 0.45rem;
	}

	.tableau td {
		border-bottom: 1px solid var(--doc-filet);
		padding: 0.6rem 0.65rem;
		vertical-align: top;
	}

	.tableau tbody tr,
	.tableau tfoot tr {
		break-inside: avoid;
	}

	.tableau-honoraires th:first-child,
	.tableau-honoraires td:first-child {
		width: 42%;
	}

	.tableau-echeancier th:first-child,
	.tableau-echeancier td:first-child {
		width: 28%;
	}

	.cellule-label {
		display: block;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--doc-second);
	}

	/* Pas de `display` ici : cette classe est portée par un `<td>`, et le passer en block le
		sortirait de l'algorithme de colonnes du tableau (le libellé se cassait alors en trois). */
	.cellule-forte {
		font-weight: 500;
		color: var(--doc-encre);
	}

	.cellule-nom {
		display: block;
		font-weight: 500;
		color: var(--doc-encre);
	}

	/* Chaque élément facturé sur sa propre ligne : la concaténation « A ; B ; C » forçait des
		retours de ligne arbitraires au milieu des montants. */
	.cellule-detail {
		display: table-cell;
		color: var(--doc-second);
	}

	.cellule-detail span {
		display: block;
	}

	.col-montant {
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.rang-sous-total td {
		padding-top: 0.7rem;
		color: var(--doc-second);
		border-bottom: none;
	}

	.rang-rabais td {
		color: var(--doc-second);
		border-bottom: none;
		padding-top: 0.2rem;
	}

	.rabais-motif {
		font-style: italic;
	}

	.rang-total td {
		font-size: 0.9375rem;
		font-weight: 700;
		color: var(--doc-marine);
		border-top: 1.5px solid var(--doc-marine);
		border-bottom: none;
		padding-top: 0.6rem;
	}

	.rang-total-note {
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--doc-second);
		text-transform: uppercase;
		letter-spacing: 0.09em;
		margin-left: 0.4rem;
	}

	/* ---------- Signatures ---------- */

	.signatures {
		margin-top: calc(2.75rem * var(--ec));
		break-inside: avoid;
	}

	.signatures-grille {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 2.5rem;
		margin-top: calc(1.5rem * var(--ec));
	}

	.signature {
		break-inside: avoid;
	}

	.signature-organisation {
		font-family: var(--doc-sans);
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.signature-champ {
		margin-top: 1.9rem;
	}

	.signature-trait {
		border-bottom: 1px solid var(--doc-encre);
	}

	.signature-legende {
		font-family: var(--doc-sans);
		font-size: 0.75rem;
		color: var(--doc-second);
		margin-top: 0.35rem;
	}

	/* ---------- Pied de document ---------- */

	.pied {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		margin-top: calc(3rem * var(--ec));
		padding-top: 0.85rem;
		border-top: 1px solid var(--doc-filet);
		font-family: var(--doc-sans);
		font-size: 0.6875rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--doc-second);
		break-inside: avoid;
	}

	.pied-logo {
		height: 2.25rem;
		width: auto;
		flex-shrink: 0;
	}

	.en-foi-de-quoi {
		margin-top: 0.9rem;
		font-weight: 600;
	}

	/* ---------- Impression ---------- */

	@media print {
		.document {
			/* Les marges viennent de `@page` : le padding de l'écran ferait une double marge et
				étranglerait la colonne de texte. */
			max-width: none;
			margin: 0;
			padding: 0;
			font-size: 10.5pt;
			line-height: 1.5;
		}

		/* Le corps de texte suit aussi la densité : un demi-point gagné sur un contrat de dix
			pages économise souvent une page entière. */
		.densite-aere {
			font-size: 11pt;
			line-height: 1.65;
		}

		.densite-compact {
			font-size: 9.8pt;
			line-height: 1.42;
		}

		.entete-titre {
			font-size: 20pt;
		}

		.section-titre {
			font-size: 13pt;
		}

		/* Un titre ne reste jamais seul en bas de page, mais le corps de l'article peut couler
			d'une page à l'autre : le rendre insécable laissait de grands vides en fin de page. */
		.section-titre,
		.sous-titre {
			break-after: avoid;
			break-inside: avoid;
		}

		.section {
			break-inside: auto;
		}

		.tableau {
			break-inside: auto;
		}

		.tableau thead {
			display: table-header-group;
		}

		.parties {
			background: #f7f9fc;
		}

		.pied {
			font-size: 7.5pt;
		}
	}

	/* ---------- Écran étroit ---------- */

	@media screen and (max-width: 640px) {
		.document {
			padding: 1.75rem 1.25rem 2.5rem;
		}

		.parties,
		.portee-listes,
		.signatures-grille {
			grid-template-columns: 1fr;
			gap: 1.25rem;
		}

		.tableau {
			display: block;
			overflow-x: auto;
			white-space: nowrap;
		}
	}
</style>
