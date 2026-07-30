/** Les trois demandes que l'éditeur adresse à l'IA locale pendant la saisie.
 *
 * Aucune ne persiste le mandat : elles renvoient une proposition que l'utilisateur applique ou
 * ignore. Séparées du composant parce que ce sont trois allers-retours réseau à la forme
 * identique, et que les lire à la suite ici est plus parlant que dispersés dans 300 lignes de
 * gabarit.
 */
import type {
	AuditClauses,
	BrouillonMandat,
	ClauseBibliotheque,
	PropositionClause
} from '$domaine/types';
import { messageDechec, posterAction } from './action-distante';

const PAS_DE_REPONSE = "L'IA locale n'a pas répondu.";
const CLAUSE_NON_ENREGISTREE = 'La clause n’a pas pu être enregistrée.';

/** Fait relire le volet contractuel. Le résultat est purement consultatif : il remonte au
 * formulaire de conditions, qui laisse l'utilisateur activer ou ignorer chaque suggestion. */
export async function auditerClauses(brouillon: BrouillonMandat): Promise<AuditClauses> {
	const body = new FormData();
	body.set('payload', JSON.stringify(brouillon));
	const result = await posterAction('?/auditerClauses', body);

	if (result.type === 'success' && result.data?.audit) {
		return result.data.audit as AuditClauses;
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

/** Demande une proposition de texte pour un champ précis. Rien n'est persisté : la proposition
 * remonte au bouton, qui laisse l'utilisateur l'accepter ou l'ignorer. */
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
