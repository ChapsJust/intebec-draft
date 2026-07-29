#!/usr/bin/env node
/**
 * Fabrique une entrée de `AUTH_UTILISATEURS`, et un `AUTH_SECRET` si on le demande.
 *
 *   node scripts/compte.mjs justin "mot de passe choisi"
 *   node scripts/compte.mjs --secret
 *
 * Le mot de passe n'est jamais enregistré : seule son empreinte scrypt, salée, part dans le `.env`.
 * Le script duplique volontairement les deux constantes de `src/lib/server/auth.ts` (longueur de
 * clé, taille du sel) plutôt que d'importer le module, qui dépend de `$env/dynamic/private` et ne
 * s'exécute donc que dans SvelteKit.
 */
import { randomBytes, scryptSync } from 'node:crypto';

const SCRYPT_LONGUEUR = 64;
const TAILLE_SEL = 16;

const [arg1, arg2] = process.argv.slice(2);

if (arg1 === '--secret') {
	console.log(`AUTH_SECRET="${randomBytes(32).toString('base64url')}"`);
	process.exit(0);
}

if (!arg1 || !arg2) {
	console.error('Usage : node scripts/compte.mjs <identifiant> <mot-de-passe>');
	console.error('        node scripts/compte.mjs --secret');
	process.exit(1);
}

const nom = arg1.trim().toLowerCase();
if (!/^[a-z0-9._-]+$/.test(nom)) {
	console.error(
		"L'identifiant ne doit contenir que des lettres, chiffres, points, tirets ou soulignés."
	);
	console.error(
		'Le « : » et la « , » sont exclus : ils séparent les champs dans AUTH_UTILISATEURS.'
	);
	process.exit(1);
}
if (arg2.length < 10) {
	console.error('Le mot de passe doit faire au moins 10 caractères.');
	process.exit(1);
}

const sel = randomBytes(TAILLE_SEL).toString('hex');
const empreinte = scryptSync(arg2, sel, SCRYPT_LONGUEUR).toString('hex');

console.log(`${nom}:${sel}:${empreinte}`);
