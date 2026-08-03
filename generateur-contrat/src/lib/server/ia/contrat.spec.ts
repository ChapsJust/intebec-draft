/** Test de contrat sur la surface publique du client IA.
 *
 * `ollama.ts` mêlait transport HTTP, invites et normalisation en 543 lignes ; il est désormais
 * éclaté en trois modules derrière `index.ts`. Ce fichier fige ce que chacun expose, pour qu'un
 * export ne disparaisse pas au prochain déplacement. Il ne teste aucun comportement : les vrais
 * tests sont dans `transport.spec.ts` et `normalisation.spec.ts`.
 */
import { describe, expect, it } from 'vitest';
import * as ia from './index';
import * as transport from './transport';
import * as normalisation from './normalisation';

/** Ce que les actions de formulaire appellent. Rien d'autre du dossier `ia/` ne doit être importé
 * depuis l'extérieur. */
const API_PUBLIQUE = [
	'redigerDocument',
	'auditerClauses',
	'revoirMandat',
	'redigerChamp',
	'proposerPuces',
	'modeleActif'
];

/** Fonctions pures exposées uniquement pour être testées unitairement. Elles restent au contrat :
 * les deplacer sans deplacer leurs tests laisserait des trous silencieux. */
const HELPERS = {
	transport: ['analyserBlocSse', 'extraireJson'],
	normalisation: [
		'nettoyerProse',
		'normaliser',
		'normaliserAudit',
		'normaliserRevue',
		'listeDePuces',
		'titreDeProjet',
		'titreNormalise'
	]
};

describe('surface publique du client IA', () => {
	it.each(API_PUBLIQUE)('index expose %s', (nom) => {
		expect(typeof (ia as Record<string, unknown>)[nom]).toBe('function');
	});

	it('index expose OllamaIndisponibleError comme classe d’erreur', () => {
		const erreur = new ia.OllamaIndisponibleError('indisponible');
		expect(erreur).toBeInstanceOf(Error);
	});
});

describe('fonctions pures testables', () => {
	it.each(HELPERS.transport)('transport expose %s', (nom) => {
		expect(typeof (transport as Record<string, unknown>)[nom]).toBe('function');
	});

	it.each(HELPERS.normalisation)('normalisation expose %s', (nom) => {
		expect(typeof (normalisation as Record<string, unknown>)[nom]).toBe('function');
	});
});
