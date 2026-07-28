import { describe, expect, it } from 'vitest';
import {
	analyserBlocSse,
	extraireJson,
	normaliser,
	nettoyerProse,
	normaliserAudit
} from './ollama';
import { createEmptyDraft } from '$lib/mandat';
import type { MandatDraft } from '$lib/types';

describe('extraireJson', () => {
	it('lit un objet JSON nu', () => {
		expect(extraireJson('{"objet":"Refonte."}')).toEqual({ objet: 'Refonte.' });
	});

	it('retire le bloc de code dont le modèle entoure sa réponse', () => {
		expect(extraireJson('```json\n{"objet":"Refonte."}\n```')).toEqual({ objet: 'Refonte.' });
	});

	it('ignore une phrase d’introduction avant l’objet', () => {
		expect(extraireJson('Voici le résultat :\n{"objet":"Refonte."}\nBonne journée.')).toEqual({
			objet: 'Refonte.'
		});
	});

	it('conserve les accolades imbriquées', () => {
		expect(extraireJson('{"lignes":{"a":"Texte."},"objet":"O."}')).toEqual({
			lignes: { a: 'Texte.' },
			objet: 'O.'
		});
	});

	it('lève sur une réponse sans JSON exploitable', () => {
		expect(() => extraireJson('Je ne peux pas répondre.')).toThrow();
	});
});

describe('analyserBlocSse', () => {
	it('lit un fragment de texte', () => {
		expect(analyserBlocSse('data: {"type":"delta","content":"Bonjour"}')).toEqual({
			type: 'delta',
			content: 'Bonjour'
		});
	});

	it('ignore un heartbeat, qui ne porte aucune donnée', () => {
		expect(analyserBlocSse(': heartbeat')).toBeNull();
	});

	it('ignore le marqueur de fin de flux', () => {
		expect(analyserBlocSse('data: [DONE]')).toBeNull();
	});

	it('ignore un bloc illisible plutôt que de casser la génération en cours', () => {
		expect(analyserBlocSse('data: {tronqué')).toBeNull();
	});

	it('remonte une erreur signalée en cours de flux', () => {
		expect(analyserBlocSse('data: {"type":"error","error":"Modèle arrêté."}')).toEqual({
			type: 'error',
			error: 'Modèle arrêté.'
		});
	});

	it('trouve la ligne de données même précédée d’un champ d’événement', () => {
		expect(analyserBlocSse('event: message\ndata: {"type":"status","status":"queued"}')).toEqual({
			type: 'status',
			status: 'queued'
		});
	});
});

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
});

/** Mandat de référence pour l'audit : aucune clause cochée, aucune condition chiffrée, donc
 * tout le catalogue est légitimement suggérable. Chaque test resserre ce qu'il lui faut. */
function draftNu(): MandatDraft {
	const draft = createEmptyDraft('contrat');
	for (const cle of Object.keys(
		draft.conditions.clauses
	) as (keyof typeof draft.conditions.clauses)[]) {
		draft.conditions.clauses[cle] = false;
	}
	draft.conditions.dureeGarantieJours = 0;
	draft.conditions.dureeSupportMois = 0;
	draft.conditions.heuresFormationIncluses = 0;
	draft.conditions.tauxHoraireHorsPerimetre = 0;
	draft.conditions.preavisResiliationJours = 0;
	return draft;
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
		const draft = draftNu();
		draft.conditions.clauses.propriete = true;

		const a = normaliserAudit(
			{ suggestions: [{ cle: 'propriete', raison: 'Déjà cochée.' }] },
			draft
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
		const draft = draftNu();
		draft.conditions.dureeGarantieJours = 90;

		const a = normaliserAudit(
			{
				conditions: [
					{ champ: 'dureeGarantieJours', raison: 'Déjà renseignée.' },
					{ champ: 'preavisResiliationJours', raison: 'Mandat récurrent.' }
				]
			},
			draft
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
