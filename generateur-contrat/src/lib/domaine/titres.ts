/** Comparaison de titres de clause.
 *
 * Vit dans le domaine parce que les deux côtés en ont besoin et doivent s'accorder : le serveur
 * dédoublonne les propositions du modèle avec, l'éditeur filtre les mêmes listes à l'écran avec.
 * Deux implémentations auraient fini par diverger, et une clause écartée d'un côté serait
 * réapparue de l'autre.
 */

/** Compare deux titres de clause sans se laisser arrêter par la casse ni les accents. Le modèle
 * réécrit « Cession de créance » en « cession de creance » d'une relecture à l'autre : sans cette
 * normalisation, la bibliothèque se serait remplie de doublons typographiques. */
export function titreNormalise(titre: string): string {
	return titre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
