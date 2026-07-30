import { describe, expect, it } from 'vitest';
import { SoumissionInvalideError, lireMandat, normaliserMandat } from './mandatForm';
import { nouveauMandat } from '$domaine/fabriques';
import { totalNet } from '$domaine/montants';

/** Ces tests portent sur le point d'entrée des données : tout ce qui est enregistré passe par là.
 * Le brouillon part dans une colonne `jsonb` que rien ne contraint, donc un objet mal formé accepté
 * ici devient un mandat impossible à réafficher, et le dégât est définitif. */
describe('normaliserMandat', () => {
	it('reconstruit un brouillon vide à partir de rien', () => {
		for (const entree of [null, undefined, {}, 42, 'texte', []]) {
			const brouillon = normaliserMandat(entree);
			expect(brouillon.lignes.length).toBe(1);
			expect(brouillon.titre).toBe('');
			expect(brouillon.modalitesPaiement.acomptePct + brouillon.modalitesPaiement.soldePct).toBe(
				100
			);
		}
	});

	it('conserve une saisie valide', () => {
		const source = nouveauMandat('contrat');
		source.titre = 'Refonte du site';
		source.objet = 'Modernisation.';
		source.client.nom = 'Constructions Rivard';
		source.lignes[0].nom = 'Développement';
		source.lignes[0].montantForfaitaire = 5000;

		const brouillon = normaliserMandat(JSON.parse(JSON.stringify(source)));
		expect(brouillon.type).toBe('contrat');
		expect(brouillon.titre).toBe('Refonte du site');
		expect(brouillon.client.nom).toBe('Constructions Rivard');
		expect(brouillon.lignes[0].montantForfaitaire).toBe(5000);
	});

	it('remplace des lignes qui ne sont pas un tableau par la ligne vide', () => {
		// Le cas qui rendait un mandat inéditable : `brouillon.lignes.map` échouait à chaque affichage.
		for (const lignes of ['oups', 42, null, {}]) {
			const brouillon = normaliserMandat({ lignes });
			expect(Array.isArray(brouillon.lignes)).toBe(true);
			expect(brouillon.lignes.length).toBe(1);
		}
	});

	it('ignore une ligne de service qui n’est pas un objet', () => {
		const brouillon = normaliserMandat({ lignes: [null, 'texte'] });
		expect(brouillon.lignes.length).toBe(2);
		expect(brouillon.lignes[0].nom).toBe('');
		expect(brouillon.lignes[0].pricingMode).toBe('forfaitaire');
	});

	it('ramène les montants non numériques à zéro', () => {
		const brouillon = normaliserMandat({
			lignes: [{ montantForfaitaire: 'beaucoup', tauxHoraire: NaN, heuresEstimees: null }]
		});
		expect(brouillon.lignes[0].montantForfaitaire).toBe(0);
		expect(brouillon.lignes[0].tauxHoraire).toBe(0);
		expect(brouillon.lignes[0].heuresEstimees).toBe(0);
	});

	it('borne le rabais à 100 %, pour qu’un total ne devienne jamais négatif', () => {
		const brouillon = normaliserMandat({
			lignes: [{ montantForfaitaire: 1000 }],
			conditions: { rabaisPct: 300 }
		});
		expect(brouillon.conditions.rabaisPct).toBe(100);
		expect(totalNet(brouillon.lignes, brouillon.conditions.rabaisPct)).toBe(0);
	});

	it('déduit toujours le solde de l’acompte', () => {
		// Un échéancier 50 % + 90 % s'enregistrait, et le document annonçait 140 % du total.
		const brouillon = normaliserMandat({ modalitesPaiement: { acomptePct: 50, soldePct: 90 } });
		expect(brouillon.modalitesPaiement.acomptePct).toBe(50);
		expect(brouillon.modalitesPaiement.soldePct).toBe(50);
	});

	it('accepte un paiement entièrement à la livraison', () => {
		const brouillon = normaliserMandat({ modalitesPaiement: { acomptePct: 0 } });
		expect(brouillon.modalitesPaiement.acomptePct).toBe(0);
		expect(brouillon.modalitesPaiement.soldePct).toBe(100);
	});

	it('rejette les valeurs hors énumération en retombant sur le défaut', () => {
		const brouillon = normaliserMandat({
			type: 'facture',
			structureProjet: 'spirale',
			client: { typeClient: 'extraterrestre' },
			abonnement: { frequence: 'quotidien' },
			lignes: [{ pricingMode: 'troc' }]
		});
		expect(brouillon.type).toBe('soumission');
		expect(brouillon.structureProjet).toBe('blocs');
		expect(brouillon.client.typeClient).toBe('entreprise');
		expect(brouillon.abonnement.frequence).toBe('annuel');
		expect(brouillon.lignes[0].pricingMode).toBe('forfaitaire');
	});

	it('n’accepte comme date qu’un format AAAA-MM-JJ', () => {
		expect(normaliserMandat({ dateSignature: '2026-03-14' }).dateSignature).toBe('2026-03-14');
		// Une date libre casserait `formatDateLongue` et le nom du fichier PDF.
		const defaut = nouveauMandat().dateSignature;
		for (const mauvaise of ['14 mars', '2026/03/14', '', null, 20260314]) {
			expect(normaliserMandat({ dateSignature: mauvaise }).dateSignature).toBe(defaut);
		}
	});

	it('borne le nombre de lignes et de puces', () => {
		const brouillon = normaliserMandat({
			lignes: Array.from({ length: 500 }, () => ({ nom: 'x', inclus: Array(500).fill('y') }))
		});
		expect(brouillon.lignes.length).toBeLessThanOrEqual(60);
		expect(brouillon.lignes[0].inclus.length).toBeLessThanOrEqual(40);
	});

	it('ne laisse passer aucun champ étranger', () => {
		const brouillon = normaliserMandat({ titre: 'ok', statut: 'envoye', id: 'x', admin: true });
		expect(Object.keys(brouillon)).not.toContain('statut');
		expect(Object.keys(brouillon)).not.toContain('id');
		expect(Object.keys(brouillon)).not.toContain('admin');
	});
});

describe('normaliserMandat : clauses retenues', () => {
	const retenues = (valeur: unknown) =>
		normaliserMandat({ conditions: { clausesRetenues: valeur } }).conditions.clausesRetenues;

	const uuid = '11111111-1111-4111-8111-111111111111';

	it('conserve une clause complète', () => {
		expect(retenues([{ idBibliotheque: uuid, titre: 'Cession', corps: 'Texte.' }])).toEqual([
			{ idBibliotheque: uuid, titre: 'Cession', corps: 'Texte.' }
		]);
	});

	it('écarte une clause sans titre ou sans corps', () => {
		// Ni l'une ni l'autre ne peut produire d'article : les garder ferait réapparaître une ligne
		// fantôme dans l'éditeur à chaque rechargement.
		expect(
			retenues([
				{ idBibliotheque: uuid, titre: '   ', corps: 'Texte.' },
				{ idBibliotheque: uuid, titre: 'Cession', corps: '  ' }
			])
		).toEqual([]);
	});

	it('vide un identifiant qui n’est pas un UUID plutôt que de le recopier', () => {
		// Un identifiant bricolé irait ensuite se comparer aux ids réels de la bibliothèque.
		expect(
			retenues([{ idBibliotheque: '../../admin', titre: 'Cession', corps: 'Texte.' }])[0]
				.idBibliotheque
		).toBe('');
	});

	it('borne le nombre de clauses et la longueur du titre', () => {
		const nombreuses = retenues(
			Array.from({ length: 200 }, () => ({ titre: 'x'.repeat(500), corps: 'Texte.' }))
		);
		expect(nombreuses.length).toBeLessThanOrEqual(20);
		expect(nombreuses[0].titre.length).toBeLessThanOrEqual(200);
	});

	it('ne laisse passer aucun champ étranger sur une clause', () => {
		const clause = retenues([
			{ idBibliotheque: uuid, titre: 'Cession', corps: 'Texte.', origine: 'manuelle', admin: true }
		])[0];
		expect(Object.keys(clause)).toEqual(['idBibliotheque', 'titre', 'corps']);
	});

	it('retombe sur une liste vide pour tout ce qui n’est pas un tableau', () => {
		for (const mauvais of [undefined, null, 'clause', 42, { titre: 'x' }]) {
			expect(retenues(mauvais)).toEqual([]);
		}
	});

	it('ignore une entrée qui n’est pas un objet', () => {
		expect(retenues(['texte', null, 42])).toEqual([]);
	});
});

/** Un brouillon enregistré avant l'ajout d'un champ n'a pas ce champ : la colonne est un `jsonb` que
 * rien ne migre. C'est exactement ce qui a mis toutes les pages d'édition en 500 quand
 * `clausesRetenues` est apparu, alors que les brouillons en base étaient intacts. `obtenirMandat`
 * normalise donc à la lecture, et ces tests décrivent ce que cette lecture doit garantir. */
describe('normaliserMandat : brouillon enregistré avant l’ajout d’un champ', () => {
	/** Brouillon tel qu'il existait en base avant cette fonctionnalité : conditions complètes, mais
	 * sans `clausesRetenues`. */
	function brouillonAncien(): Record<string, unknown> {
		const complet = structuredClone(nouveauMandat('contrat')) as unknown as Record<string, unknown>;
		const conditions = complet.conditions as Record<string, unknown>;
		delete conditions.clausesRetenues;
		return complet;
	}

	it('rétablit clausesRetenues plutôt que de laisser undefined', () => {
		const brouillon = normaliserMandat(brouillonAncien());

		expect(brouillon.conditions.clausesRetenues).toEqual([]);
	});

	it('rend le brouillon utilisable sans lever, jusqu’aux champs qui n’existaient pas', () => {
		// Le symptôme réel était un `Cannot read properties of undefined (reading 'length')` au rendu.
		const brouillon = normaliserMandat(brouillonAncien());

		expect(() => brouillon.conditions.clausesRetenues.length).not.toThrow();
	});

	it('ne perd rien de ce qui était déjà enregistré', () => {
		const ancien = brouillonAncien();
		ancien.titre = 'Refonte application';
		(ancien.conditions as Record<string, unknown>).dureeGarantieJours = 90;

		const brouillon = normaliserMandat(ancien);

		expect(brouillon.titre).toBe('Refonte application');
		expect(brouillon.conditions.dureeGarantieJours).toBe(90);
	});

	it('est idempotent : renormaliser ne change plus rien', () => {
		// C'est la propriété qui autorise à normaliser à la lecture comme à l'écriture sans dériver.
		const une = normaliserMandat(brouillonAncien());
		expect(normaliserMandat(une)).toEqual(une);
	});
});

describe('lireMandat', () => {
	it('lit une charge JSON valide', () => {
		const brouillon = lireMandat(JSON.stringify({ titre: 'Refonte' }));
		expect(brouillon.titre).toBe('Refonte');
	});

	it('signale un JSON illisible au lieu de laisser remonter une erreur brute', () => {
		// Ce qui produisait une page 500 : `JSON.parse` sur un corps tronqué.
		expect(() => lireMandat('{"titre": "trongu')).toThrow(SoumissionInvalideError);
	});

	it('signale une charge absente', () => {
		for (const entree of [null, undefined, 42]) {
			expect(() => lireMandat(entree)).toThrow(SoumissionInvalideError);
		}
	});
});
