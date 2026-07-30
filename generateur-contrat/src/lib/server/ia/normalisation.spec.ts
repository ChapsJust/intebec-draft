import { describe, expect, it } from 'vitest';
import { normaliser, nettoyerProse, normaliserAudit, titreNormalise } from './normalisation';
import { nouveauMandat } from '$domaine/fabriques';
import type { BrouillonMandat, ClauseBibliotheque } from '$domaine/types';

describe('nettoyerProse', () => {
	it('remplace une incise entre tirets cadratins par des virgules', () => {
		expect(nettoyerProse('Les livrables — conçus sur mesure — sont remis au client.')).toBe(
			'Les livrables, conçus sur mesure, sont remis au client.'
		);
	});

	it('remplace un tiret d’apposition par un deux-points', () => {
		expect(nettoyerProse('Le mandat couvre un seul volet — la refonte du site.')).toBe(
			'Le mandat couvre un seul volet : la refonte du site.'
		);
	});

	it('traite aussi le tiret demi-cadratin', () => {
		expect(nettoyerProse('Une portée claire – et rien de plus.')).toBe(
			'Une portée claire : et rien de plus.'
		);
	});

	it('ne laisse aucun tiret long dans le résultat', () => {
		const sale = 'Trois volets — design, intégration — puis la mise en ligne — sans délai.';
		expect(nettoyerProse(sale)).not.toMatch(/[—–]/);
	});

	it('retire les puces et le gras Markdown', () => {
		expect(nettoyerProse('- **Conception** du site')).toBe('Conception du site');
	});

	it('ne double pas les deux-points déjà présents', () => {
		expect(nettoyerProse('Le mandat comprend : — la refonte.')).toBe(
			'Le mandat comprend : la refonte.'
		);
	});

	it('laisse intact un texte déjà propre', () => {
		const propre = 'La refonte porte sur les gabarits principaux et la migration des contenus.';
		expect(nettoyerProse(propre)).toBe(propre);
	});
});

const ids = new Set(['ligne-a', 'ligne-b']);

describe('normaliser', () => {
	it('conserve la prose des lignes connues', () => {
		const r = normaliser(
			{ preambule: 'Intro.', objet: 'Objet.', lignes: { 'ligne-a': 'Description A.' } },
			ids
		);

		expect(r.preambule).toBe('Intro.');
		expect(r.lignes).toEqual({ 'ligne-a': 'Description A.' });
	});

	it('rejette les identifiants de lignes inventés par le modèle', () => {
		const r = normaliser(
			{ lignes: { 'ligne-a': 'Vraie ligne.', 'ligne-fantome': 'Ligne hallucinée.' } },
			ids
		);

		expect(Object.keys(r.lignes)).toEqual(['ligne-a']);
	});

	it('ignore les clés inconnues du niveau racine', () => {
		const r = normaliser({ objet: 'Objet.', total: 99999, clauses: ['inventée'] }, ids);

		expect(r).not.toHaveProperty('total');
		expect(r).not.toHaveProperty('clauses');
	});

	it('ignore les valeurs qui ne sont pas du texte', () => {
		const r = normaliser({ objet: 42, lignes: { 'ligne-a': { texte: 'objet' } } }, ids);

		expect(r.objet).toBe('');
		expect(r.lignes).toEqual({});
	});

	it('écarte les textes vides plutôt que d’écraser la saisie avec du blanc', () => {
		const r = normaliser({ lignes: { 'ligne-a': '   ' } }, ids);

		expect(r.lignes).toEqual({});
	});

	it('survit à une réponse vide ou nulle', () => {
		const r = normaliser(null, ids);

		expect(r.objet).toBe('');
		expect(r.lignes).toEqual({});
	});

	it('horodate et enregistre le modèle utilisé', () => {
		const r = normaliser({ objet: 'X.' }, ids);

		expect(r.genereLe).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(r.modele.length).toBeGreaterThan(0);
	});

	it('repart sans passage refusé : les index de la rédaction précédente ne désignent plus rien', () => {
		const r = normaliser({ objet: 'Refonte.', refuses: { objet: [0, 1] } }, new Set());

		expect(r.refuses).toEqual({});
	});

	it('retient l’empreinte de la saisie qui a produit la prose', () => {
		// C'est elle qui permet plus tard de savoir que la saisie a changé, et donc que cette prose
		// décrit une version antérieure du mandat.
		expect(normaliser({ objet: 'Refonte.' }, ids, 'abc123').empreinte).toBe('abc123');
	});

	it('n’invente pas d’empreinte quand aucune n’est fournie', () => {
		// Une empreinte vide se comporte comme une absence : `redactionCaduque` se tait.
		expect(normaliser({ objet: 'Refonte.' }, ids).empreinte).toBe('');
	});
});

/** Mandat de référence pour l'audit : aucune clause cochée, aucune condition chiffrée, donc
 * tout le catalogue est légitimement suggérable. Chaque test resserre ce qu'il lui faut. */
function draftNu(): BrouillonMandat {
	const brouillon = nouveauMandat('contrat');
	for (const cle of Object.keys(
		brouillon.conditions.clauses
	) as (keyof typeof brouillon.conditions.clauses)[]) {
		brouillon.conditions.clauses[cle] = false;
	}
	brouillon.conditions.dureeGarantieJours = 0;
	brouillon.conditions.dureeSupportMois = 0;
	brouillon.conditions.heuresFormationIncluses = 0;
	brouillon.conditions.tauxHoraireHorsPerimetre = 0;
	brouillon.conditions.preavisResiliationJours = 0;
	return brouillon;
}

describe('normaliserAudit', () => {
	it('conserve une suggestion qui désigne une clause réellement décochée', () => {
		const a = normaliserAudit(
			{
				suggestions: [{ cle: 'confidentialite', raison: 'Le mandat traite des données clients.' }]
			},
			draftNu()
		);

		expect(a.suggestions).toEqual([
			{ cle: 'confidentialite', raison: 'Le mandat traite des données clients.' }
		]);
	});

	it('rejette une clé de clause inventée par le modèle', () => {
		const a = normaliserAudit(
			{
				suggestions: [
					{ cle: 'penaliteRetard', raison: 'Inventée.' },
					{ cle: 'litiges', raison: 'Vraie clé.' }
				]
			},
			draftNu()
		);

		expect(a.suggestions.map((s) => s.cle)).toEqual(['litiges']);
	});

	it('écarte une clause déjà activée : une suggestion sans effet est du bruit', () => {
		const brouillon = draftNu();
		brouillon.conditions.clauses.propriete = true;

		const a = normaliserAudit(
			{ suggestions: [{ cle: 'propriete', raison: 'Déjà cochée.' }] },
			brouillon
		);

		expect(a.suggestions).toEqual([]);
	});

	it('déduplique une clause suggérée deux fois', () => {
		const a = normaliserAudit(
			{
				suggestions: [
					{ cle: 'litiges', raison: 'Première.' },
					{ cle: 'litiges', raison: 'Seconde.' }
				]
			},
			draftNu()
		);

		expect(a.suggestions).toHaveLength(1);
	});

	it('ne retient un manque chiffré que si le champ est bien à zéro', () => {
		const brouillon = draftNu();
		brouillon.conditions.dureeGarantieJours = 90;

		const a = normaliserAudit(
			{
				conditions: [
					{ champ: 'dureeGarantieJours', raison: 'Déjà renseignée.' },
					{ champ: 'preavisResiliationJours', raison: 'Mandat récurrent.' }
				]
			},
			brouillon
		);

		expect(a.conditions.map((c) => c.champ)).toEqual(['preavisResiliationJours']);
	});

	it('rejette un champ de condition inconnu', () => {
		const a = normaliserAudit(
			{ conditions: [{ champ: 'penaliteJournaliere', raison: 'Inventé.' }] },
			draftNu()
		);

		expect(a.conditions).toEqual([]);
	});

	it('exige un titre et un brouillon pour retenir une proposition', () => {
		const a = normaliserAudit(
			{
				propositions: [
					{ titre: 'Disponibilité du service', raison: 'Hébergement.', brouillon: 'Texte.' },
					{ titre: 'Sans corps', raison: 'Vide.' },
					{ raison: 'Sans titre.', brouillon: 'Texte.' }
				]
			},
			draftNu()
		);

		expect(a.propositions).toHaveLength(1);
		expect(a.propositions[0].titre).toBe('Disponibilité du service');
	});

	it('survit à un objet là où un tableau est attendu', () => {
		const a = normaliserAudit({ suggestions: { cle: 'litiges' }, conditions: 'aucune' }, draftNu());

		expect(a.suggestions).toEqual([]);
		expect(a.conditions).toEqual([]);
	});

	it('survit à une réponse vide ou nulle', () => {
		const a = normaliserAudit(null, draftNu());

		expect(a.suggestions).toEqual([]);
		expect(a.conditions).toEqual([]);
		expect(a.propositions).toEqual([]);
	});

	it('horodate et enregistre le modèle utilisé', () => {
		const a = normaliserAudit({}, draftNu());

		expect(a.genereLe).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(a.modele.length).toBeGreaterThan(0);
	});
});

/** Clause de bibliothèque de référence. L'identifiant est un UUID parce que c'est ce que la base
 * produit, et que `normaliserAudit` compare des identifiants réels. */
function clauseBiblio(over: Partial<ClauseBibliotheque> = {}): ClauseBibliotheque {
	return {
		id: '11111111-1111-4111-8111-111111111111',
		titre: 'Disponibilité du service',
		corps: 'Le prestataire vise une disponibilité raisonnable du service.',
		origine: 'ia',
		archiveLe: null,
		creeLe: '2026-01-01T00:00:00.000Z',
		majLe: '2026-01-01T00:00:00.000Z',
		...over
	};
}

describe('normaliserAudit et la bibliothèque de clauses', () => {
	it('retient une clause de la bibliothèque réellement disponible', () => {
		const clause = clauseBiblio();
		const a = normaliserAudit(
			{ bibliotheque: [{ id: clause.id, raison: 'Le mandat inclut de l’hébergement.' }] },
			draftNu(),
			[clause]
		);

		expect(a.bibliotheque).toEqual([
			{ id: clause.id, raison: 'Le mandat inclut de l’hébergement.' }
		]);
	});

	it('rejette un identifiant de clause que la bibliothèque ne contient pas', () => {
		const a = normaliserAudit(
			{ bibliotheque: [{ id: '22222222-2222-4222-8222-222222222222', raison: 'Inventé.' }] },
			draftNu(),
			[clauseBiblio()]
		);

		expect(a.bibliotheque).toEqual([]);
	});

	it('rejette une clause archivée : elle a été retirée de la bibliothèque exprès', () => {
		const clause = clauseBiblio({ archiveLe: '2026-06-01T00:00:00.000Z' });
		const a = normaliserAudit(
			{ bibliotheque: [{ id: clause.id, raison: 'Archivée.' }] },
			draftNu(),
			[clause]
		);

		expect(a.bibliotheque).toEqual([]);
	});

	it('écarte une clause déjà retenue pour ce mandat', () => {
		const clause = clauseBiblio();
		const brouillon = draftNu();
		brouillon.conditions.clausesRetenues = [
			{ idBibliotheque: clause.id, titre: clause.titre, corps: clause.corps }
		];

		const a = normaliserAudit(
			{ bibliotheque: [{ id: clause.id, raison: 'Déjà là.' }] },
			brouillon,
			[clause]
		);

		expect(a.bibliotheque).toEqual([]);
	});

	it('déduplique une clause de bibliothèque désignée deux fois', () => {
		const clause = clauseBiblio();
		const a = normaliserAudit(
			{
				bibliotheque: [
					{ id: clause.id, raison: 'Première.' },
					{ id: clause.id, raison: 'Seconde.' }
				]
			},
			draftNu(),
			[clause]
		);

		expect(a.bibliotheque).toHaveLength(1);
	});

	it('écarte une proposition qui redit une clause déjà en bibliothèque, accents et casse confondus', () => {
		// C'est le « sinon recrée » : la consigne du prompt demande de désigner l'existant plutôt que
		// de le réécrire, mais elle ne se fait pas obéir. Sans ce filtre, la bibliothèque se remplissait
		// de doublons typographiques à chaque relecture.
		const a = normaliserAudit(
			{
				propositions: [
					{ titre: 'DISPONIBILITE DU SERVICE', raison: 'Doublon.', brouillon: 'Autre texte.' },
					{ titre: 'Cession de contrat', raison: 'Vraiment neuve.', brouillon: 'Texte.' }
				]
			},
			draftNu(),
			[clauseBiblio()]
		);

		expect(a.propositions.map((p) => p.titre)).toEqual(['Cession de contrat']);
	});

	it('écarte une proposition qui redit une clause déjà retenue pour ce mandat', () => {
		const brouillon = draftNu();
		brouillon.conditions.clausesRetenues = [
			{ idBibliotheque: '', titre: 'Pénalité de retard', corps: 'Texte retenu.' }
		];

		const a = normaliserAudit(
			{
				propositions: [
					{ titre: 'pénalité de retard', raison: 'Doublon.', brouillon: 'Réécriture.' }
				]
			},
			brouillon,
			[]
		);

		expect(a.propositions).toEqual([]);
	});

	it('déduplique deux propositions au même titre dans une seule réponse', () => {
		const a = normaliserAudit(
			{
				propositions: [
					{ titre: 'Cession de contrat', raison: 'Première.', brouillon: 'Texte un.' },
					{ titre: 'Cession de contrat', raison: 'Seconde.', brouillon: 'Texte deux.' }
				]
			},
			draftNu(),
			[]
		);

		expect(a.propositions).toHaveLength(1);
	});

	it('accepte une proposition quand la bibliothèque ne couvre pas le sujet', () => {
		const a = normaliserAudit(
			{ propositions: [{ titre: 'Cession de contrat', raison: 'Neuve.', brouillon: 'Texte.' }] },
			draftNu(),
			[clauseBiblio()]
		);

		expect(a.propositions).toHaveLength(1);
	});

	it('renvoie une bibliothèque vide quand le modèle n’en parle pas', () => {
		expect(normaliserAudit({}, draftNu(), [clauseBiblio()]).bibliotheque).toEqual([]);
	});
});

describe('titreNormalise', () => {
	it('ignore la casse, les accents et les espaces superflus', () => {
		expect(titreNormalise('  Disponibilité   DU Service ')).toBe('disponibilite du service');
	});

	it('rend identiques deux écritures du même titre', () => {
		expect(titreNormalise('Pénalité de retard')).toBe(titreNormalise('PENALITE DE RETARD'));
	});
});
