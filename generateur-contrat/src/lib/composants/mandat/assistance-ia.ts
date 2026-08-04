/** Les demandes que l'éditeur adresse à l'IA locale pendant la saisie.
 *
 * Aucune n'enregistre le mandat. Elles renvoient une proposition, et c'est l'utilisateur qui décide
 * de l'appliquer ou de l'ignorer. Rien ne se retrouve dans le document sans un clic de sa part.
 */
import type {
	AuditClauses,
	BrouillonMandat,
	ClauseBibliotheque,
	PropositionClause,
	RevueMandat
} from '$domaine/types';
import { messageDechec, posterAction } from './action-distante';

const PAS_DE_REPONSE = "L'IA locale n'a pas répondu.";
const CLAUSE_NON_ENREGISTREE = 'La clause n’a pas pu être enregistrée.';

/** Fait relire le volet contractuel. Résultat purement consultatif : rien n'est appliqué sans un
 * geste de l'utilisateur. */
export async function auditerClauses(brouillon: BrouillonMandat): Promise<AuditClauses> {
	const body = new FormData();
	body.set('payload', JSON.stringify(brouillon));
	const result = await posterAction('?/auditerClauses', body);

	if (result.type === 'success' && result.data?.audit) {
		return result.data.audit as AuditClauses;
	}
	throw new Error(messageDechec(result, PAS_DE_REPONSE));
}

/** Fait relire le fond du mandat : contradictions, promesses non couvertes, textes trop vagues. */
export async function revoirMandat(brouillon: BrouillonMandat): Promise<RevueMandat> {
	const body = new FormData();
	body.set('payload', JSON.stringify(brouillon));
	const result = await posterAction('?/revoirMandat', body);

	if (result.type === 'success' && result.data?.revue) {
		return result.data.revue as RevueMandat;
	}
	throw new Error(messageDechec(result, PAS_DE_REPONSE));
}

/** Ajoute à la bibliothèque une clause proposée par la relecture, et renvoie la fiche créée pour
 * que l'appelant en pousse une copie figée dans le mandat. */
export async function enregistrerClause(
	proposition: PropositionClause
): Promise<ClauseBibliotheque> {
	const body = new FormData();
	body.set('titre', proposition.titre);
	body.set('corps', proposition.brouillon);
	const result = await posterAction('?/retenirProposition', body);

	if (result.type === 'success' && result.data?.clause) {
		return result.data.clause as ClauseBibliotheque;
	}
	throw new Error(messageDechec(result, CLAUSE_NON_ENREGISTREE));
}

/** Demande une proposition de texte pour un champ précis. */
export async function proposerTexte(brouillon: BrouillonMandat, champ: string): Promise<string> {
	const body = new FormData();
	body.set('payload', JSON.stringify(brouillon));
	body.set('champ', champ);
	const result = await posterAction('?/redigerChamp', body);

	if (result.type === 'success' && typeof result.data?.texte === 'string') {
		return result.data.texte;
	}
	throw new Error(messageDechec(result, PAS_DE_REPONSE));
}

/** Demande des éléments à ajouter à une liste d'inclus ou d'exclusions. Un tableau vide est une
 * réponse valable : le modèle n'a rien de pertinent à ajouter. */
export async function proposerElements(
	brouillon: BrouillonMandat,
	ligneId: string,
	liste: 'inclus' | 'nonInclus'
): Promise<string[]> {
	const body = new FormData();
	body.set('payload', JSON.stringify(brouillon));
	body.set('champ', ligneId);
	body.set('liste', liste);
	const result = await posterAction('?/proposerPuces', body);

	if (result.type === 'success' && Array.isArray(result.data?.items)) {
		return result.data.items as string[];
	}
	throw new Error(messageDechec(result, PAS_DE_REPONSE));
}
