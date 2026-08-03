import type { ChampCondition, ClausesStandards } from '$domaine/types';

/** Libellés partagés entre l'interface de saisie et le prompt d'audit : si l'audit désigne une
 * clause, l'utilisateur doit retrouver le même intitulé sur sa case à cocher. */

export const LIBELLES_CLAUSES: Record<keyof ClausesStandards, string> = {
	confidentialite: 'Confidentialité et protection des données (Loi 25, hébergement Canada)',
	limitationResponsabilite: 'Limitation de responsabilité',
	propriete: 'Propriété des données et du travail livré',
	litiges: "Litiges (district d'Arthabaska, lois du Québec)",
	signatureElectronique: 'Reconnaissance de la signature électronique'
};

/** L'article que chaque condition fait naître est nommé dans le libellé : c'est ce qui permet à
 * l'audit de dire ce que l'oubli coûte au contrat. */
export const LIBELLES_CONDITIONS: Record<ChampCondition, string> = {
	heuresFormationIncluses: 'Heures de formation incluses (article « Formation »)',
	dureeGarantieJours: 'Garantie en jours (article « Garantie »)',
	dureeSupportMois: 'Support inclus en mois (article « Support et accompagnement »)',
	tauxHoraireHorsPerimetre:
		'Taux horaire hors périmètre (article « Portée et travaux hors périmètre »)',
	preavisResiliationJours: 'Préavis de résiliation en jours (article « Résiliation »)'
};

export const CLES_CLAUSES = Object.keys(LIBELLES_CLAUSES) as (keyof ClausesStandards)[];
export const CLES_CONDITIONS = Object.keys(LIBELLES_CONDITIONS) as ChampCondition[];

/** Intitulé d'une suggestion d'audit, quel que soit le registre auquel elle appartient. */
export function libelleSuggestion(cle: keyof ClausesStandards | ChampCondition): string {
	return (
		LIBELLES_CLAUSES[cle as keyof ClausesStandards] ??
		LIBELLES_CONDITIONS[cle as ChampCondition] ??
		cle
	);
}
