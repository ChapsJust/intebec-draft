import { describe, expect, it } from 'vitest';
import { verifierMandat, erreurDuChamp } from './validation';
import { nouveauMandat } from './fabriques';

describe('verifierMandat', () => {
	it('signale les champs requis manquants sur un brouillon vide', () => {
		const erreurs = verifierMandat(nouveauMandat());
		const champs = erreurs.map((e) => e.champ);
		expect(champs).toContain('client.nom');
		expect(champs).toContain('titre');
		expect(champs).toContain('objet');
		expect(champs).toContain('lignes.0.montant');
	});

	it('accepte un brouillon complet', () => {
		const brouillon = nouveauMandat();
		brouillon.client.nom = 'Constructions Rivard';
		brouillon.titre = 'Refonte du site web';
		brouillon.objet = 'Modernisation de la présence numérique.';
		brouillon.lignes[0].nom = 'Développement';
		brouillon.lignes[0].montantForfaitaire = 5000;

		expect(verifierMandat(brouillon)).toEqual([]);
	});

	it('rejette un courriel client mal formé', () => {
		const brouillon = nouveauMandat();
		brouillon.client.courriel = 'pas-un-courriel';
		const erreurs = verifierMandat(brouillon);
		expect(erreurs.some((e) => e.champ === 'client.courriel')).toBe(true);
	});

	it("n'exige pas de courriel quand il est vide", () => {
		const brouillon = nouveauMandat();
		brouillon.client.courriel = '';
		const erreurs = verifierMandat(brouillon);
		expect(erreurs.some((e) => e.champ === 'client.courriel')).toBe(false);
	});

	it("rejette un acompte hors de l'intervalle 0-100", () => {
		const brouillon = nouveauMandat();
		brouillon.modalitesPaiement.acomptePct = 150;
		const erreurs = verifierMandat(brouillon);
		expect(erreurs.some((e) => e.champ === 'modalitesPaiement.acomptePct')).toBe(true);
	});

	/** Brouillon minimal mais valide, pour n'observer que la règle testée. */
	function mandatValide() {
		const brouillon = nouveauMandat();
		brouillon.client.nom = 'Constructions Rivard';
		brouillon.titre = 'Refonte du site web';
		brouillon.objet = 'Modernisation de la présence numérique.';
		brouillon.lignes[0].nom = 'Développement';
		brouillon.lignes[0].montantForfaitaire = 5000;
		return brouillon;
	}

	it('rejette un acompte et un solde qui ne totalisent pas 100 %', () => {
		// Sans cette règle, le contrat annonçait 140 % du total dans son échéancier.
		const brouillon = mandatValide();
		brouillon.modalitesPaiement.acomptePct = 50;
		brouillon.modalitesPaiement.soldePct = 90;
		const erreurs = verifierMandat(brouillon);
		expect(erreurs.some((e) => e.champ === 'modalitesPaiement.soldePct')).toBe(true);
	});

	it('accepte un paiement entièrement à la livraison', () => {
		const brouillon = mandatValide();
		brouillon.modalitesPaiement.acomptePct = 0;
		brouillon.modalitesPaiement.soldePct = 100;
		expect(verifierMandat(brouillon)).toEqual([]);
	});

	it('accepte un paiement entièrement à la signature', () => {
		const brouillon = mandatValide();
		brouillon.modalitesPaiement.acomptePct = 100;
		brouillon.modalitesPaiement.soldePct = 0;
		expect(verifierMandat(brouillon)).toEqual([]);
	});

	it('rejette un rabais supérieur à 100 %', () => {
		// Un rabais de 150 % produisait un document au montant négatif.
		const brouillon = mandatValide();
		brouillon.conditions.rabaisPct = 150;
		const erreurs = verifierMandat(brouillon);
		expect(erreurs.some((e) => e.champ === 'conditions.rabaisPct')).toBe(true);
	});

	it('rejette un délai de paiement négatif', () => {
		const brouillon = mandatValide();
		brouillon.modalitesPaiement.delaiJoursSolde = -5;
		const erreurs = verifierMandat(brouillon);
		expect(erreurs.some((e) => e.champ === 'modalitesPaiement.delaiJoursSolde')).toBe(true);
	});

	it('rejette un abonnement actif sans montant', () => {
		const brouillon = mandatValide();
		brouillon.abonnement.actif = true;
		brouillon.abonnement.montant = 0;
		const erreurs = verifierMandat(brouillon);
		expect(erreurs.some((e) => e.champ === 'abonnement.montant')).toBe(true);
	});
});

describe('erreurDuChamp', () => {
	it('retourne le message associé à un champ', () => {
		const erreurs = [{ champ: 'titre', message: 'Le titre du projet est requis.' }];
		expect(erreurDuChamp(erreurs, 'titre')).toBe('Le titre du projet est requis.');
	});

	it('retourne undefined pour un champ sans erreur', () => {
		expect(erreurDuChamp([], 'titre')).toBeUndefined();
	});
});
