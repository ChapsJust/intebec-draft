import { describe, expect, it } from 'vitest';
import { verifierCoherence } from './coherence';
import { nouveauMandat, nouvelleLigne } from './fabriques';
import type { BrouillonMandat } from './types';

/** Un mandat qui se tient : sert de base, et sert aussi à vérifier qu'on ne crie pas dans le vide. */
function mandatSain(): BrouillonMandat {
	const brouillon = nouveauMandat('contrat');
	brouillon.titre = 'Refonte du site vitrine';
	brouillon.objet = 'Moderniser la présence numérique.';

	const ligne = brouillon.lignes[0];
	ligne.nom = 'Conception';
	ligne.description = 'Maquettes et parcours utilisateur.';
	ligne.inclus = ['Maquettes haute fidélité'];
	ligne.nonInclus = ['Rédaction des contenus'];
	ligne.montantForfaitaire = 3200;

	return brouillon;
}

/** Ajoute une seconde ligne prête à être malmenée. */
function avecDeuxLignes(brouillon: BrouillonMandat) {
	const seconde = nouvelleLigne();
	seconde.nom = 'Développement';
	seconde.description = 'Intégration des gabarits.';
	seconde.montantForfaitaire = 5000;
	brouillon.lignes.push(seconde);
	return seconde;
}

const messages = (brouillon: BrouillonMandat, libelle = 'Phase') =>
	verifierCoherence(brouillon, libelle).map((a) => a.message);

describe('verifierCoherence', () => {
	it('ne signale rien sur un mandat qui se tient', () => {
		expect(verifierCoherence(mandatSain(), 'Phase')).toEqual([]);
	});

	describe('contradictions entre inclus et exclus', () => {
		it('repère le même élément inclus et exclu dans la même ligne', () => {
			const brouillon = mandatSain();
			brouillon.lignes[0].nonInclus = ['Maquettes haute fidélité'];

			const trouves = verifierCoherence(brouillon, 'Phase');
			expect(trouves).toHaveLength(1);
			expect(trouves[0].message).toContain('à la fois inclus et exclu');
			expect(trouves[0].cible).toBe(brouillon.lignes[0].id);
		});

		it('repère un élément inclus dans une ligne et exclu dans une autre', () => {
			// La contradiction exacte que la relecture par l'IA ratait une fois sur deux.
			const brouillon = mandatSain();
			const seconde = avecDeuxLignes(brouillon);
			seconde.nonInclus = ['Maquettes haute fidélité'];

			const trouves = verifierCoherence(brouillon, 'Phase');
			expect(trouves).toHaveLength(1);
			expect(trouves[0].message).toContain('inclus dans la phase 1');
			expect(trouves[0].message).toContain('exclu dans la phase 2');
		});

		it('ignore la casse et les accents, comme le ferait un lecteur', () => {
			const brouillon = mandatSain();
			const seconde = avecDeuxLignes(brouillon);
			seconde.nonInclus = ['MAQUETTES HAUTE FIDELITE'];

			expect(verifierCoherence(brouillon, 'Phase')).toHaveLength(1);
		});

		it('ne confond pas deux éléments simplement voisins', () => {
			const brouillon = mandatSain();
			const seconde = avecDeuxLignes(brouillon);
			seconde.nonInclus = ['Maquettes basse fidélité'];

			expect(verifierCoherence(brouillon, 'Phase')).toEqual([]);
		});
	});

	describe('doublons', () => {
		it('repère un élément listé deux fois dans la même liste', () => {
			const brouillon = mandatSain();
			brouillon.lignes[0].inclus = ['Maquettes haute fidélité', 'maquettes haute fidelite'];

			expect(messages(brouillon)).toEqual([
				expect.stringContaining('listé deux fois dans les éléments inclus')
			]);
		});

		it('repère deux lignes qui portent le même nom', () => {
			const brouillon = mandatSain();
			const seconde = avecDeuxLignes(brouillon);
			seconde.nom = 'Conception';

			expect(messages(brouillon)).toEqual([
				expect.stringContaining('porte le même nom que la phase 1')
			]);
		});

		it('ne signale rien quand deux lignes sont encore sans nom', () => {
			// À la saisie, les lignes naissent vides : deux noms absents ne sont pas un doublon.
			const brouillon = nouveauMandat();
			avecDeuxLignes(brouillon).nom = '';
			brouillon.lignes[0].nom = '';

			expect(verifierCoherence(brouillon, 'Phase')).toEqual([]);
		});
	});

	describe('ce qui produirait un document bancal', () => {
		it('repère un montant sans aucun travail décrit', () => {
			const brouillon = mandatSain();
			brouillon.lignes[0].description = '';
			brouillon.lignes[0].inclus = [];

			expect(messages(brouillon)).toEqual([expect.stringContaining('un prix sans contrepartie')]);
		});

		it('se tait quand la ligne est décrite par ses seuls éléments inclus', () => {
			const brouillon = mandatSain();
			brouillon.lignes[0].description = '';

			expect(verifierCoherence(brouillon, 'Phase')).toEqual([]);
		});

		it('repère un abonnement dont on ne dit pas ce qu’il couvre', () => {
			const brouillon = mandatSain();
			brouillon.abonnement = {
				actif: true,
				frequence: 'mensuel',
				montant: 120,
				couverture: '   ',
				periodeOfferteMois: 0
			};

			const trouves = verifierCoherence(brouillon, 'Phase');
			expect(trouves).toHaveLength(1);
			expect(trouves[0].cible).toBe('paiement');
		});

		it('repère un rabais sans motif', () => {
			const brouillon = mandatSain();
			brouillon.conditions.rabaisPct = 15;
			brouillon.conditions.rabaisMotif = '';

			const trouves = verifierCoherence(brouillon, 'Phase');
			expect(trouves).toHaveLength(1);
			expect(trouves[0].cible).toBe('conditions');
			expect(trouves[0].message).toContain('15 %');
		});
	});

	it('emploie le vocabulaire de la structure choisie', () => {
		const brouillon = mandatSain();
		avecDeuxLignes(brouillon).nom = 'Conception';

		expect(messages(brouillon, 'Bloc')[0]).toContain('bloc 1');
		expect(messages(brouillon, 'Service')[0]).toContain('service 1');
	});
});
