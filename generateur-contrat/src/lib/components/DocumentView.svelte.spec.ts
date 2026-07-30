import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DocumentView from './DocumentView.svelte';
import { nouveauMandat, nouvelleLigne } from '$domaine/fabriques';
import type { BrouillonMandat, RedactionIA } from '$domaine/types';

/** Filet de sécurité du rendu du document. Le composant ne calcule rien lui-même (tout vient de
 * `construireDocument`, couvert par sections.spec.ts) : ce qui est vérifié ici, c'est que chaque partie
 * du modèle atterrit bien à l'écran, et que la mise en forme du CSS s'applique toujours. */
function mandatComplet(): BrouillonMandat {
	const brouillon = nouveauMandat('contrat');
	brouillon.titre = 'Refonte du site web';
	brouillon.objet = 'Modernisation de la présence numérique.';
	brouillon.lieuSignature = 'Victoriaville';
	brouillon.dateSignature = '2026-03-14';
	brouillon.client.nom = 'Constructions Rivard';
	brouillon.client.adresse = '12 rue Principale';
	brouillon.client.representantNom = 'Chantal Rivard';
	brouillon.client.representantTitre = 'Directrice';

	const ligne = nouvelleLigne();
	ligne.nom = 'Développement';
	ligne.description = 'Intégration des gabarits.';
	ligne.montantForfaitaire = 8000;
	ligne.inclus = ['Maquettes', 'Intégration'];
	ligne.nonInclus = ['Rédaction du contenu'];
	ligne.delaiEstime = '6 semaines';
	brouillon.lignes = [ligne];

	brouillon.conditions.rabaisPct = 10;
	brouillon.conditions.rabaisMotif = 'client de longue date';
	brouillon.conditions.notesAdditionnelles = 'Une disposition particulière.';
	return brouillon;
}

describe('DocumentView', () => {
	it('rend l’en-tête, les parties et leurs désignations', async () => {
		const page = render(DocumentView, { brouillon: mandatComplet() });

		// `.first()` : la mention revient dans le bloc-marque du pied de document.
		await expect.element(page.getByText('Contrat de services').first()).toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Refonte du site web');
		// `.first()` : le lieu et la date reviennent dans la formule « En foi de quoi ».
		await expect
			.element(page.getByText('Victoriaville, le 14 mars 2026').first())
			.toBeInTheDocument();
		await expect.element(page.getByText('Constructions Rivard').first()).toBeInTheDocument();
		await expect
			.element(page.getByText('Représenté par Chantal Rivard, Directrice'))
			.toBeInTheDocument();
	});

	it('numérote les articles et rend la portée', async () => {
		const page = render(DocumentView, { brouillon: mandatComplet() });

		await expect
			.element(page.getByRole('heading', { name: /Objet du mandat/ }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { name: /Portée des travaux/ }))
			.toBeInTheDocument();
		await expect.element(page.getByText('Intégration des gabarits.')).toBeInTheDocument();
		await expect.element(page.getByText('Maquettes')).toBeInTheDocument();
		await expect.element(page.getByText('Rédaction du contenu')).toBeInTheDocument();
		await expect.element(page.getByText('6 semaines').first()).toBeInTheDocument();
	});

	it('rend le tableau des honoraires avec sous-total, rabais et total', async () => {
		const page = render(DocumentView, { brouillon: mandatComplet() });

		await expect
			.element(page.getByRole('columnheader', { name: 'Désignation' }))
			.toBeInTheDocument();
		await expect.element(page.getByText('Sous-total')).toBeInTheDocument();
		await expect.element(page.getByText(/Rabais/)).toBeInTheDocument();
		await expect.element(page.getByText('client de longue date')).toBeInTheDocument();
		// 8000 − 10 % = 7200 (IA ne touche pas aux montants, elle ne rédige que le texte)
		await expect.element(page.getByText(/7\s?200,00/).first()).toBeInTheDocument();
	});

	it('rend l’échéancier et les blocs de signature', async () => {
		const page = render(DocumentView, { brouillon: mandatComplet() });

		await expect.element(page.getByRole('columnheader', { name: 'Échéance' })).toBeInTheDocument();
		await expect.element(page.getByText(/Acompte/)).toBeInTheDocument();
		await expect.element(page.getByRole('heading', { name: 'Signatures' })).toBeInTheDocument();
		await expect.element(page.getByText(/En foi de quoi/)).toBeInTheDocument();
		await expect.element(page.getByText('Date').first()).toBeInTheDocument();
	});

	it('rend les dispositions particulières quand elles sont saisies', async () => {
		const page = render(DocumentView, { brouillon: mandatComplet() });
		await expect.element(page.getByText('Une disposition particulière.')).toBeInTheDocument();
	});

	it('préfère la prose de l’IA à la saisie quand une rédaction existe', async () => {
		const brouillon = mandatComplet();
		const redaction: RedactionIA = {
			preambule: 'Préambule rédigé par le modèle.',
			objet: 'Objet rédigé par le modèle.',
			lignes: { [brouillon.lignes[0].id]: 'Description rédigée par le modèle.' },
			genereLe: '2026-03-14T12:00:00.000Z',
			modele: 'gemma4:latest'
		};

		const page = render(DocumentView, { brouillon, redaction });

		await expect.element(page.getByText('Préambule rédigé par le modèle.')).toBeInTheDocument();
		await expect.element(page.getByText('Description rédigée par le modèle.')).toBeInTheDocument();
		// Les montants restent ceux de la saisie : l'IA n'y touche pas.
		await expect.element(page.getByText(/7\s?200,00/).first()).toBeInTheDocument();
	});

	it('applique le style du document, donc la feuille de styles est bien chargée', async () => {
		// Garde-fou du découpage : si le CSS cessait de s'appliquer, le document resterait lisible
		// mais perdrait toute sa mise en page, et aucune assertion de contenu ne le verrait.
		const page = render(DocumentView, { brouillon: mandatComplet() });

		const article = page.getByRole('article');
		await expect.element(article).toBeInTheDocument();
		const element = article.element() as HTMLElement;
		const style = getComputedStyle(element);

		expect(style.fontFamily.toLowerCase()).toContain('georgia');
		expect(style.backgroundColor).toBe('rgb(255, 255, 255)');
		expect(parseFloat(style.maxWidth)).toBeGreaterThan(0);
	});
});
