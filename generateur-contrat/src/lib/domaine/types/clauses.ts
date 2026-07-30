export interface ClausesStandards {
	confidentialite: boolean;
	limitationResponsabilite: boolean;
	propriete: boolean;
	litiges: boolean;
	signatureElectronique: boolean;
}

export interface ConditionsParticulieres {
	heuresFormationIncluses: number;
	dureeGarantieJours: number;
	dureeSupportMois: number;
	tauxHoraireHorsPerimetre: number;
	preavisResiliationJours: number;
	rabaisPct: number;
	rabaisMotif: string;
	clauses: ClausesStandards;
	/** Clauses hors catalogue retenues pour ce mandat, dans l'ordre où elles paraissent au contrat. */
	clausesRetenues: ClauseRetenue[];
	notesAdditionnelles: string;
}

/** Champs chiffrés des conditions particulières qui font naître un article lorsqu'ils sont
 * renseignés. Laissés à zéro, l'article correspondant disparaît du contrat : c'est exactement le
 * genre d'oubli que l'audit doit rattraper. (IA) */
export type ChampCondition =
	| 'heuresFormationIncluses'
	| 'dureeGarantieJours'
	| 'dureeSupportMois'
	| 'tauxHoraireHorsPerimetre'
	| 'preavisResiliationJours';

/** Clause rédigée hors catalogue, réutilisable d'un mandat à l'autre. Le catalogue des cinq clauses
 * standards est du code : il porte du texte qui consomme les valeurs du mandat. La bibliothèque, à
 * l'inverse, ne porte que de la prose figée, ce qui est exactement ce qu'une relecture produit. */
export interface ClauseBibliotheque {
	id: string;
	titre: string;
	corps: string;
	/** `ia` = proposée par une relecture puis retenue, `manuelle` = saisie à la main. */
	origine: 'ia' | 'manuelle';
	/** Non nul = clause archivée : elle disparaît des listes sans casser les mandats qui la citent. */
	archiveLe: string | null;
	creeLe: string;
	majLe: string;
}

/** Clause retenue pour CE mandat, texte figé au moment où elle a été retenue.
 *
 * Même raison que `clientId` vs `brouillon.client` : la bibliothèque évolue, un contrat déjà rédigé
 * ne doit pas changer dans son dos. L'identifiant ne sert donc qu'à la traçabilité et au
 * dédoublonnage de la relecture, jamais à retrouver le texte à afficher. */
export interface ClauseRetenue {
	/** Origine dans la bibliothèque. Vide si la clause y a été supprimée depuis. */
	idBibliotheque: string;
	titre: string;
	corps: string;
}
