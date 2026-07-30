/** Test de contrat sur les actions de formulaire.
 *
 * Les gabarits postent vers `?/nomAction` : des chaînes de caractères, que ni TypeScript ni
 * `svelte-check` ne rapprochent jamais des clés réellement exportées par le `+page.server.ts` en
 * face. Perdre une action au fil d'un déplacement de fichier ne casse donc aucune compilation ; ça
 * ne se voit qu'en cliquant sur le bouton, où SvelteKit répond « No action with name ... ».
 *
 * D'où ce fichier : il fige la surface exacte de chaque route, et vérifie que toute cible `?/…`
 * écrite dans un gabarit atterrit quelque part. C'est l'oracle des réorganisations de
 * `lib/server/` — la seule couche de l'application qu'aucun autre test n'exécute.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import * as accueil from './+page.server';
import * as clients from './clients/+page.server';
import * as ficheClient from './clients/[id]/+page.server';
import * as editeurMandat from './mandats/[id]/+page.server';
import * as apercuMandat from './mandats/[id]/apercu/+page.server';
import * as nouveauMandat from './nouveau/+page.server';

interface RouteTestee {
	chemin: string;
	module: { actions?: Record<string, unknown> };
	/** Les actions attendues, dans n'importe quel ordre. */
	actions: string[];
}

/** Actions partagées par /nouveau et /mandats/[id] : les deux routes étalent le même objet
 * `mandatActions`, la seule différence entre créer et éditer étant la présence de `params.id`. */
const ACTIONS_EDITEUR = [
	'enregistrer',
	'generer',
	'modifierClient',
	'auditerClauses',
	'retenirProposition',
	'redigerChamp'
];

const ROUTES: RouteTestee[] = [
	{
		chemin: '/',
		module: accueil,
		actions: ['dupliquer', 'archiver', 'desarchiver', 'supprimer']
	},
	{
		chemin: '/nouveau',
		module: nouveauMandat,
		actions: ACTIONS_EDITEUR
	},
	{
		chemin: '/clients',
		module: clients,
		actions: ['creer', 'archiver', 'desarchiver', 'supprimer']
	},
	{
		chemin: '/clients/[id]',
		module: ficheClient,
		// Les actions mandat y sont suffixées parce que la fiche porte déjà un archivage et une
		// suppression qui visent le client, pas ses mandats.
		actions: [
			'dupliquer',
			'archiverMandat',
			'desarchiverMandat',
			'supprimerMandat',
			'archiver',
			'desarchiver',
			'supprimer'
		]
	},
	{
		chemin: '/mandats/[id]',
		module: editeurMandat,
		actions: [...ACTIONS_EDITEUR, 'archiver', 'desarchiver', 'supprimer']
	},
	{
		chemin: '/mandats/[id]/apercu',
		module: apercuMandat,
		actions: ['rediger', 'effacerRedaction', 'basculerPassage', 'changerStatut']
	}
];

describe('surface des actions par route', () => {
	it.each(ROUTES)('$chemin expose exactement ses actions', ({ module, actions }) => {
		expect(Object.keys(module.actions ?? {}).sort()).toEqual([...actions].sort());
	});

	it.each(ROUTES)('$chemin n’expose que des fonctions', ({ module }) => {
		const types = Object.values(module.actions ?? {}).map((action) => typeof action);
		expect(new Set(types)).toEqual(new Set(['function']));
	});
});

const RACINE_SRC = fileURLToPath(new URL('..', import.meta.url));

function fichiersSvelte(dossier: string): string[] {
	return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
		const chemin = join(dossier, entree.name);
		if (entree.isDirectory()) return fichiersSvelte(chemin);
		return entree.name.endsWith('.svelte') ? [chemin] : [];
	});
}

/** Toutes les cibles `?/…` écrites dans les gabarits, avec le fichier où elles apparaissent.
 * On ne balaie que les `.svelte` : un `?/` dans un `.ts` est une expression régulière, pas une
 * action (`ollama.ts` en contient une). */
function ciblesDesGabarits(): { cible: string; fichier: string }[] {
	return fichiersSvelte(RACINE_SRC).flatMap((fichier) => {
		const source = readFileSync(fichier, 'utf8');
		return [...source.matchAll(/\?\/(\w+)/g)].map((m) => ({
			cible: m[1],
			fichier: fichier.slice(RACINE_SRC.length).replace(/\\/g, '/')
		}));
	});
}

describe('cibles ?/ des gabarits', () => {
	const connues = new Set(ROUTES.flatMap((route) => route.actions));

	it('le balayage trouve bien des cibles', () => {
		// Garde-fou : si un jour le balayage ne trouve plus rien (dossier déplacé, extension
		// changée), le test suivant passerait à vide en donnant une fausse assurance.
		expect(ciblesDesGabarits().length).toBeGreaterThan(20);
	});

	it('chaque cible correspond à une action déclarée', () => {
		const orphelines = ciblesDesGabarits().filter(({ cible }) => !connues.has(cible));
		expect(orphelines).toEqual([]);
	});
});

describe('chargeurs de page', () => {
	it.each(ROUTES)('$chemin exporte un load', ({ module }) => {
		expect(typeof (module as { load?: unknown }).load).toBe('function');
	});
});
