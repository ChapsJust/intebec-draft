/** Ce que l'éditeur fait de la bibliothèque de clauses. Partagé entre la liste des clauses
 * personnalisées et le panneau de relecture, qui doivent s'accorder sur ce qui est déjà retenu.
 */
import type { ClauseBibliotheque, ConditionsParticulieres } from '$domaine/types';
import { titreNormalise } from '$domaine/titres';

/** Titres déjà retenus sur ce mandat, normalisés pour la comparaison. */
export function titresRetenus(conditions: ConditionsParticulieres): Set<string> {
	return new Set(conditions.clausesRetenues.map((c) => titreNormalise(c.titre)));
}

/** Retient une clause : c'est une copie du texte qui entre dans le mandat, pas une référence. */
export function retenirClause(
	conditions: ConditionsParticulieres,
	clause: ClauseBibliotheque
): void {
	conditions.clausesRetenues = [
		...conditions.clausesRetenues,
		{ idBibliotheque: clause.id, titre: clause.titre, corps: clause.corps }
	];
}

/** Clauses encore proposables : ni archivées, ni déjà retenues, par identifiant ou par titre. */
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
