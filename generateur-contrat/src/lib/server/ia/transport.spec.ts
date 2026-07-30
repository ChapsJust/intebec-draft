import { describe, expect, it } from 'vitest';
import { analyserBlocSse, extraireJson } from './transport';

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
