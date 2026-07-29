import type { Utilisateur } from '$lib/types';

/** Identité de la personne qui consulte l'application, lue dans les en-têtes que `tailscale serve`
 * ajoute à chaque requête qu'il relaie.
 *
 * Il n'y a pas d'authentification applicative ici, et c'est délibéré : l'application n'écoute que
 * sur la boucle locale, et seul le proxy Tailscale peut l'atteindre. La porte est donc gardée par le
 * réseau, une couche plus bas, où Tailscale a déjà vérifié l'appareil et la personne. Redemander un
 * mot de passe derrière ça n'ajouterait qu'une serrure sur une porte déjà fermée.
 *
 * Conséquence à garder en tête : ces en-têtes ne valent que parce que rien d'autre que le proxy ne
 * peut joindre le port. Publier le port ailleurs qu'en `127.0.0.1` (voir `compose.yaml`) permettrait
 * à n'importe qui de les fabriquer. Ils ne portent d'ailleurs aucune autorisation : uniquement un nom
 * à afficher. Qui a le droit d'entrer se décide dans la politique du tailnet, pas ici.
 *
 * Voir la section « Accès » du README pour la mise en service complète. */

export type { Utilisateur } from '$lib/types';

/** Nom affichable, puis identifiant de connexion en repli : `Tailscale-User-Name` porte « Justin
 * Chaput » quand le compte a un nom complet, `Tailscale-User-Login` toujours le courriel. */
const EN_TETE_NOM = 'tailscale-user-name';
const EN_TETE_LOGIN = 'tailscale-user-login';

/** Présent uniquement sur les requêtes venues de Funnel, c'est-à-dire de l'Internet public. Funnel
 * retire les en-têtes d'identité : une telle requête est anonyme et doit le rester. On ne l'active
 * pas, mais le jour où quelqu'un essaie, mieux vaut que le nom reste vide qu'usurpable. */
const EN_TETE_FUNNEL = 'tailscale-funnel-request';

function texte(valeur: string | null): string | null {
	const propre = valeur?.trim();
	return propre ? propre : null;
}

/** L'identité, ou `null` quand la requête n'est pas passée par le proxy Tailscale.
 *
 * `null` est un état normal, pas un refus : c'est le cas en développement local sans Tailscale
 * devant, et celui de la requête interne que Chromium adresse au conteneur pour imprimer un PDF.
 * L'interface se contente alors de ne pas afficher de nom. */
export function lireIdentite(headers: Headers): Utilisateur | null {
	if (headers.get(EN_TETE_FUNNEL) !== null) return null;

	const nom = texte(headers.get(EN_TETE_NOM)) ?? texte(headers.get(EN_TETE_LOGIN));
	return nom ? { nom } : null;
}
