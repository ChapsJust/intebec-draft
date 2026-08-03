import type { Utilisateur } from '$domaine/types';

/** Identité affichée dans l'en-tête, lue dans les en-têtes que `tailscale serve` ajoute aux requêtes
 * qu'il relaie. Aucune authentification ici : la porte est gardée une couche plus bas, par le réseau.
 *
 * Ces en-têtes ne valent que parce que seul le proxy peut joindre le port. Publier ailleurs qu'en
 * `127.0.0.1` (voir `compose.yaml`) permettrait à n'importe qui de les fabriquer. Ils ne portent
 * aucune autorisation, juste un nom : qui a le droit d'entrer se décide dans la politique du tailnet.
 * Voir la section « Accès » du README. */

export type { Utilisateur } from '$domaine/types';

/** Nom complet quand le compte en a un, courriel sinon. */
const EN_TETE_NOM = 'tailscale-user-name';
const EN_TETE_LOGIN = 'tailscale-user-login';

/** Présent sur les requêtes venues de Funnel, donc de l'Internet public. Funnel retire les en-têtes
 * d'identité : une telle requête est anonyme et doit le rester. */
const EN_TETE_FUNNEL = 'tailscale-funnel-request';

function texte(valeur: string | null): string | null {
	const propre = valeur?.trim();
	return propre ? propre : null;
}

/** L'identité, ou `null` quand la requête n'est pas passée par le proxy. `null` est normal, pas un
 * refus : c'est le cas en développement local, et celui de Chromium quand il imprime un PDF. */
export function lireIdentite(headers: Headers): Utilisateur | null {
	if (headers.get(EN_TETE_FUNNEL) !== null) return null;

	const nom = texte(headers.get(EN_TETE_NOM)) ?? texte(headers.get(EN_TETE_LOGIN));
	return nom ? { nom } : null;
}
