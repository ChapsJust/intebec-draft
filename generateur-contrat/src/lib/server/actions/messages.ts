/** Libellés partagés par plusieurs actions. Regroupés ici pour que le même incident produise le
 * même message quelle que soit la page où il se produit. */

/** Rendu quand le mandat visé n'existe plus. Le cas arrive vraiment : deux onglets ouverts,
 * suppression dans l'un, enregistrement dans l'autre. */
export const INTROUVABLE =
	"Ce mandat n'existe plus. Il a probablement été supprimé depuis un autre onglet.";

export const ID_MANQUANT = 'Identifiant manquant.';

export const MANDAT_INTROUVABLE = 'Mandat introuvable.';

export const CLIENT_INTROUVABLE = 'Client introuvable.';

export const REQUETE_INVALIDE = 'Requête invalide.';
