import type { Utilisateur } from '$domaine/types';

/** Le nom affiché dans l'en-tête de la page, lu dans les en-têtes HTTP que `tailscale serve` ajoute
 * aux requêtes qu'il relaie.
 *
 * Il n'y a aucune authentification ici, et ce n'est pas un oubli : l'accès est contrôlé une couche
 * plus bas, par le réseau. Le raisonnement, en une phrase : ces en-têtes ne sont crédibles que parce
 * que le proxy est le seul à pouvoir joindre le port. Si on publiait ailleurs que sur `127.0.0.1`
 * (voir `compose.yaml`), n'importe qui pourrait les fabriquer à la main.
 *
 * Et même là, ils ne donnent aucun droit : c'est juste un nom. Qui a le droit d'entrer se décide
 * dans la politique du tailnet, pas ici. Le détail est dans la section « Accès » du README. */

export type { Utilisateur } from '$domaine/types';

/** Nom complet quand le compte en a un, courriel sinon. */
const EN_TETE_NOM = 'tailscale-user-name';
const EN_TETE_LOGIN = 'tailscale-user-login';

/** Cet en-tête n'est présent que sur les requêtes arrivées par Funnel, donc depuis l'Internet
 * public. Funnel retire les en-têtes d'identité : ces requêtes sont anonymes et doivent le rester,
 * d'où le retour immédiat plus bas. */
const EN_TETE_FUNNEL = 'tailscale-funnel-request';

function texte(valeur: string | null): string | null {
	const propre = valeur?.trim();
	return propre ? propre : null;
}

/** L'identité, ou `null` quand la requête n'est pas passée par le proxy. Attention : `null` n'est pas
 * un refus, c'est un cas normal. Ça arrive quand je développe en local, et aussi quand Chromium
 * visite la page d'aperçu pour imprimer le PDF. */
export function lireIdentite(headers: Headers): Utilisateur | null {
	if (headers.get(EN_TETE_FUNNEL) !== null) return null;

	const nom = texte(headers.get(EN_TETE_NOM)) ?? texte(headers.get(EN_TETE_LOGIN));
	return nom ? { nom } : null;
}
