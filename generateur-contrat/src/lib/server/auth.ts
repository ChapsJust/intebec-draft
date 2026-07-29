import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { Utilisateur } from '$lib/types';

/** Authentification volontairement minimale : trois personnes, pas d'inscription, pas de rôles.
 *
 * Les comptes vivent dans une variable d'environnement plutôt qu'en base, parce qu'un compte n'est
 * pas une donnée du domaine ici : il n'est jamais créé depuis l'application, seulement au moment du
 * déploiement. Ça évite une table, une migration et un écran d'administration pour trois lignes.
 *
 * Le mot de passe n'est jamais stocké, seulement son empreinte scrypt salée. `scryptSync` vient de
 * Node : aucune dépendance à installer, et la fonction est conçue pour être lente, ce qui est
 * exactement ce qu'on veut d'un hachage de mot de passe. */

export type { Utilisateur } from '$lib/types';

export const NOM_COOKIE = 'session';

/** Douze heures : assez pour une journée de travail sans reconnexion, assez court pour qu'un poste
 * laissé ouvert ne le reste pas indéfiniment. */
const DUREE_SESSION_MS = 12 * 60 * 60 * 1000;

const SCRYPT_LONGUEUR = 64;

interface Compte {
	sel: string;
	empreinte: string;
}

/** Comptes déclarés dans `AUTH_UTILISATEURS`, au format `nom:sel:empreinte`, séparés par des
 * virgules. Les entrées mal formées sont ignorées : mieux vaut un compte qui ne fonctionne pas
 * qu'un démarrage impossible parce qu'une virgule traîne en fin de liste. */
function comptes(): Map<string, Compte> {
	const map = new Map<string, Compte>();
	for (const entree of (env.AUTH_UTILISATEURS || '').split(',')) {
		const [nom, sel, empreinte] = entree.trim().split(':');
		if (!nom || !sel || !empreinte) continue;
		map.set(nom.toLowerCase(), { sel, empreinte });
	}
	return map;
}

/** Vrai quand l'authentification est configurée pour de bon.
 *
 * Le garde de `hooks.server.ts` refuse tout quand c'est faux, plutôt que de laisser passer. Une
 * protection qu'on désactive en oubliant une variable d'environnement n'en est pas une : le jour où
 * le `.env` de production est incomplet, l'application serait grande ouverte sans que rien ne le
 * signale. */
export function authConfiguree(): boolean {
	return Boolean(env.AUTH_SECRET) && comptes().size > 0;
}

/** Calcule l'empreinte d'un mot de passe pour un sel donné. Partagé entre la vérification et le
 * script de génération, pour qu'ils ne puissent pas diverger. */
export function empreinte(motDePasse: string, sel: string): string {
	return scryptSync(motDePasse, sel, SCRYPT_LONGUEUR).toString('hex');
}

/** Fabrique la ligne `nom:sel:empreinte` à déposer dans `AUTH_UTILISATEURS`. */
export function ligneCompte(nom: string, motDePasse: string): string {
	const sel = randomBytes(16).toString('hex');
	return `${nom.toLowerCase()}:${sel}:${empreinte(motDePasse, sel)}`;
}

/** Comparaison à temps constant. Un `===` sur des empreintes s'arrête au premier caractère
 * différent, ce qui laisse mesurer combien de caractères sont bons. */
function egalite(a: string, b: string): boolean {
	const tampon = Buffer.from(a);
	const autre = Buffer.from(b);
	if (tampon.length !== autre.length) return false;
	return timingSafeEqual(tampon, autre);
}

/** Vérifie un couple identifiant / mot de passe. Renvoie le nom canonique, ou `null`.
 *
 * Le mot de passe est haché même quand le compte n'existe pas, pour que les deux cas prennent le
 * même temps : sinon, la rapidité d'un refus révèle quels noms d'utilisateur existent. */
export function verifierIdentifiants(nom: unknown, motDePasse: unknown): string | null {
	if (typeof nom !== 'string' || typeof motDePasse !== 'string') return null;

	const cle = nom.trim().toLowerCase();
	const compte = comptes().get(cle);
	const sel = compte?.sel ?? 'sel-inexistant';
	const calculee = empreinte(motDePasse, sel);

	if (!compte) return null;
	return egalite(calculee, compte.empreinte) ? cle : null;
}

function signature(charge: string): string {
	return createHmac('sha256', env.AUTH_SECRET || '')
		.update(charge)
		.digest('base64url');
}

/** Valeur du cookie de session : `nom.expiration.signature`.
 *
 * La session est signée, pas chiffrée : elle ne contient rien de secret, seulement un nom et une
 * date. La signature est ce qui empêche de la fabriquer soi-même, et l'expiration est *dans* la
 * charge signée, donc non modifiable côté navigateur, contrairement à la durée de vie du cookie. */
export function creerSession(nom: string): string {
	const charge = `${nom}.${Date.now() + DUREE_SESSION_MS}`;
	return `${charge}.${signature(charge)}`;
}

/** Relit un cookie de session. Renvoie `null` si la signature ne correspond pas ou si la session a
 * expiré. */
export function lireSession(valeur: unknown): Utilisateur | null {
	if (typeof valeur !== 'string') return null;

	const parties = valeur.split('.');
	if (parties.length !== 3) return null;

	const [nom, expiration, recue] = parties;
	if (!egalite(recue, signature(`${nom}.${expiration}`))) return null;

	const echeance = Number(expiration);
	if (!Number.isFinite(echeance) || echeance < Date.now()) return null;

	// Un compte retiré de `AUTH_UTILISATEURS` doit perdre l'accès sans attendre l'expiration de sa
	// session : on revérifie donc que le nom est toujours déclaré.
	if (!comptes().has(nom)) return null;

	return { nom };
}

/** Options du cookie de session. `httpOnly` le rend invisible au JavaScript de la page, `sameSite`
 * empêche qu'un autre site l'utilise, et `secure` est levé en développement où l'app tourne en
 * HTTP simple. */
export function optionsCookie(secure: boolean) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure,
		maxAge: DUREE_SESSION_MS / 1000
	};
}
