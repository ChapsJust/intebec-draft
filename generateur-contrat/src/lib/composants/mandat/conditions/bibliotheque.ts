/** Ce que l'éditeur fait de la bibliothèque de clauses.
 *
 * Partagé entre la liste des clauses personnalisées et le panneau de relecture : les deux
 * retiennent une clause de la même façon, et les deux doivent voir disparaître de leurs listes ce
 * qui vient d'être retenu ailleurs.
 */
import type { ClauseBibliotheque, ConditionsParticulieres } from '$domaine/types';
import { titreNormalise } from '$domaine/titres';

/** Titres déjà retenus sur ce mandat, normalisés pour la comparaison. */
export function titresRetenus(conditions: ConditionsParticulieres): Set<string> {
	return new Set(conditions.clausesRetenues.map((c) => titreNormalise(c.titre)));
}

/** Retient une clause de la bibliothèque : c'est une copie du texte qui entre dans le mandat, pas
 * une référence. La bibliothèque peut ensuite évoluer sans réécrire ce contrat. */
export function retenirClause(
	conditions: ConditionsParticulieres,
	clause: ClauseBibliotheque
): void {
	conditions.clausesRetenues = [
		...conditions.clausesRetenues,
		{ idBibliotheque: clause.id, titre: clause.titre, corps: clause.corps }
	];
}

/** Clauses de la bibliothèque encore proposables pour ce mandat : ni archivées, ni déjà retenues,
 * que ce soit par identifiant ou par titre. */
export function clausesDisponibles(
	bibliotheque: ClauseBibliotheque[],
	conditions: ConditionsParticulieres
): ClauseBibliotheque[] {
	const titres = titresRetenus(conditions);
	return bibliotheque.filter(
		(c) =>
			!c.archiveLe &&
			!conditions.clausesRetenues.some((r) => r.idBibliotheque === c.id) &&
			!titres.has(titreNormalise(c.titre))
	);
}
