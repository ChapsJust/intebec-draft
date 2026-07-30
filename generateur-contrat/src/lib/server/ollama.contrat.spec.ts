/** Test de contrat sur la surface publique du client IA.
 *
 * `ollama.ts` mélange transport HTTP, prompts et normalisation, et va être éclaté en plusieurs
 * modules. Ce fichier fige ce que le reste de l'application a le droit d'en attendre, pour qu'un
 * export ne disparaisse pas en chemin. Il ne teste aucun comportement : les vrais tests sont dans
 * `ollama.spec.ts`.
 */
import { describe, expect, it } from 'vitest';
import * as ia from './ollama';

/** Ce que les actions de formulaire appellent. */
const API_PUBLIQUE = ['redigerDocument', 'auditerClauses', 'redigerChamp', 'modeleActif'];

/** Fonctions pures exposées uniquement pour être testées unitairement. Elles restent dans le
 * contrat : les déplacer sans déplacer leurs tests laisserait des trous silencieux. */
const HELPERS_TESTES = [
	'analyserBlocSse',
	'extraireJson',
	'nettoyerProse',
	'normaliser',
	'normaliserAudit',
	'titreNormalise'
];

describe('surface publique du client IA', () => {
	it.each(API_PUBLIQUE)('expose %s', (nom) => {
		expect(typeof (ia as Record<string, unknown>)[nom]).toBe('function');
	});

	it.each(HELPERS_TESTES)('expose %s', (nom) => {
		expect(typeof (ia as Record<string, unknown>)[nom]).toBe('function');
	});

	it('expose OllamaIndisponibleError comme classe d’erreur', () => {
		const erreur = new ia.OllamaIndisponibleError('indisponible');
		expect(erreur).toBeInstanceOf(Error);
	});
});
