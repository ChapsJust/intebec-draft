/** Mise en forme commune avant comparaison de deux textes courts.
 *
 * Vit dans le domaine parce que trois endroits en ont besoin et doivent s'accorder : le serveur
 * dédoublonne les propositions du modèle avec, l'éditeur filtre les mêmes listes à l'écran avec,
 * et le diff s'en sert pour reconnaître deux phrases identiques. Si j'en avais écrit deux versions,
 * elles auraient fini par diverger, et une clause écartée d'un côté serait réapparue de l'autre.
 */

/** Les accents, une fois détachés de leur lettre par `normalize('NFD')`. C'est l'intervalle Unicode
 * U+0300 à U+036F. Écrit en `\u….` plutôt qu'avec les caractères eux-mêmes, qui sont invisibles
 * dans un éditeur : les crochets auraient l'air vides. */
const ACCENTS_DETACHES = /[\u0300-\u036f]/g;

/** Compare deux textes sans se laisser arrêter par la casse, les accents ni les espaces en trop.
 * Le modèle réécrit « Cession de créance » en « cession de creance » d'une relecture à l'autre :
 * sans ça, la bibliothèque se remplit de doublons typographiques. */
export function titreNormalise(titre: string): string {
	return titre
		.normalize('NFD')
		.replace(ACCENTS_DETACHES, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}
