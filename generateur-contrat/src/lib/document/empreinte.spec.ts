import { describe, expect, it } from 'vitest';
import { empreinteProse, redactionCaduque } from './empreinte';
import { nouveauMandat, nouvelleLigne } from '$domaine/fabriques';
import type { BrouillonMandat, RedactionIA, LigneService } from '$domaine/types';

function ligne(overrides: Partial<LigneService>): LigneService {
	return { ...nouvelleLigne(), ...overrides };
}

function brouillon(modifier: (d: BrouillonMandat) => void = () => {}): BrouillonMandat {
	const d = nouveauMandat('contrat');
	d.titre = 'Refonte du site';
	d.objet = 'Refonte complète du site web.';
	d.client.nom = 'Boulangerie Tremblay';
	d.lignes = [ligne({ nom: 'Conception', montantForfaitaire: 4000 })];
	modifier(d);
	return d;
}

describe('empreinteProse et redactionCaduque', () => {
	const redaction = (partiel: Partial<RedactionIA>): RedactionIA => ({
		preambule: '',
		objet: '',
		lignes: {},
		genereLe: '2026-07-27T10:00:00.000Z',
		modele: 'llama3.1:8b',
		...partiel
	});

	/** Rédaction fraîche pour ce brouillon-là. */
	const fraiche = (d: BrouillonMandat) => redaction({ empreinte: empreinteProse(d) });

	/** Brouillon de référence, figé une fois pour toutes.
	 *
	 * `brouillon()` passe par `nouvelleLigne()`, qui tire un `id` au hasard : deux appels ne
	 * décrivent donc pas la même saisie, et comparer leurs empreintes ne dirait rien du champ qu'on
	 * prétend tester. On part d'une seule instance et on la clone. */
	const base = brouillon();
	const variante = (modifier: (d: BrouillonMandat) => void): BrouillonMandat => {
		const copie = structuredClone(base);
		modifier(copie);
		return copie;
	};

	it('est stable pour une saisie inchangée', () => {
		expect(empreinteProse(structuredClone(base))).toBe(empreinteProse(base));
	});

	it('change quand l’objet change', () => {
		expect(empreinteProse(variante((x) => (x.objet = 'Autre objet.')))).not.toBe(
			empreinteProse(base)
		);
	});

	it('change quand la description d’une ligne change', () => {
		expect(empreinteProse(variante((x) => (x.lignes[0].description = 'Neuve.')))).not.toBe(
			empreinteProse(base)
		);
	});

	it('change quand le nom d’une ligne change : le prompt le transmet', () => {
		// Le nom n'est pas réécrit par l'IA, mais elle le lit : il oriente la prose.
		expect(empreinteProse(variante((x) => (x.lignes[0].nom = 'Autre nom.')))).not.toBe(
			empreinteProse(base)
		);
	});

	it('change quand une puce « non inclus » change', () => {
		expect(empreinteProse(variante((x) => (x.lignes[0].nonInclus = ['Hébergement'])))).not.toBe(
			empreinteProse(base)
		);
	});

	it('change quand le nom du client change : il compose le préambule par défaut', () => {
		expect(empreinteProse(variante((x) => (x.client.nom = 'Autre client')))).not.toBe(
			empreinteProse(base)
		);
	});

	it('ne change pas quand un montant change : le prompt ne le transmet pas', () => {
		// Le gabarit rend les montants directement. Les faire compter rendrait une rédaction caduque à
		// chaque ajustement de prix, et redemanderait la prose à l'IA pour rien.
		expect(empreinteProse(variante((x) => (x.lignes[0].montantForfaitaire = 9999)))).toBe(
			empreinteProse(base)
		);
	});

	it('ne change pas quand une clause ou une condition change', () => {
		expect(
			empreinteProse(
				variante((x) => {
					x.conditions.dureeGarantieJours = 365;
					x.conditions.clauses.litiges = false;
				})
			)
		).toBe(empreinteProse(base));
	});

	it('ne change pas quand la date ou le lieu de signature change', () => {
		expect(
			empreinteProse(
				variante((x) => {
					x.dateSignature = '2027-01-15';
					x.lieuSignature = 'Québec';
				})
			)
		).toBe(empreinteProse(base));
	});

	it('distingue deux répartitions du même texte entre les champs', () => {
		// Sans séparateur de champs, un objet « A » suivi d'une ligne « B » aurait donné la même
		// empreinte qu'un objet « A B » et une ligne vide.
		const eclate = variante((x) => {
			x.objet = 'A';
			x.lignes[0].description = 'B';
		});
		const fusionne = variante((x) => {
			x.objet = 'A B';
			x.lignes[0].description = '';
		});
		expect(empreinteProse(eclate)).not.toBe(empreinteProse(fusionne));
	});

	it('ne déclare pas caduque une rédaction fraîche', () => {
		expect(redactionCaduque(base, fraiche(base))).toBe(false);
	});

	it('déclare caduque une rédaction dont la saisie a changé depuis', () => {
		const apres = variante((x) => (x.objet = 'Objet modifié après la rédaction.'));
		expect(redactionCaduque(apres, fraiche(base))).toBe(true);
	});

	it('ne déclare rien sans rédaction', () => {
		expect(redactionCaduque(base, null)).toBe(false);
		expect(redactionCaduque(base, undefined)).toBe(false);
	});

	it('se tait sur une rédaction enregistrée avant l’empreinte', () => {
		// On ne peut rien affirmer de sa fraîcheur : alerter sur tous les documents existants serait
		// pire que se taire. C'est `generer` qui tranche l'autre sens, en la refaisant.
		expect(redactionCaduque(base, redaction({}))).toBe(false);
	});
});
