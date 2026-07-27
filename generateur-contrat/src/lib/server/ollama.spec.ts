import { describe, expect, it } from 'vitest';
import { normaliser, nettoyerProse } from './ollama';

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
