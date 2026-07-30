/** Les trois choses que l'application demande à l'IA locale.
 *
 * Chacune suit la même chaîne : une invite construite dans `invites.ts`, un aller-retour par
 * `transport.ts`, un passage obligé par `normalisation.ts`. Rien d'autre du dossier `ia/` n'a
 * vocation à être importé d'ailleurs.
 */
import type {
	AuditClauses,
	BrouillonMandat,
	ClauseBibliotheque,
	RedactionIA
} from '$domaine/types';
import { empreinteProse } from '$document/empreinte';
import {
	CONSIGNES,
	CONSIGNES_AUDIT,
	invitePourAudit,
	invitePourChamp,
	invitePourDocument,
	type CibleChamp
} from './invites';
import { normaliser, normaliserAudit, proseDuChamp } from './normalisation';
import { appeler, OllamaIndisponibleError } from './transport';

export { OllamaIndisponibleError, modeleActif } from './transport';
export type { CibleChamp } from './invites';

/** Passe complète : réécrit toute la prose du document d'un coup, de façon cohérente. */
export async function redigerDocument(brouillon: BrouillonMandat): Promise<RedactionIA> {
	const idsConnus = new Set(brouillon.lignes.map((l) => l.id));
	const brut = await appeler(invitePourDocument(brouillon), CONSIGNES);
	return normaliser(brut, idsConnus, empreinteProse(brouillon));
}

/** Relit le mandat et signale ce qui manque au volet contractuel. Ne modifie rien : l'utilisateur
 * reste seul à décider d'activer une clause, et les brouillons partent en révision, pas au document. */
export async function auditerClauses(
	brouillon: BrouillonMandat,
	bibliotheque: ClauseBibliotheque[] = []
): Promise<AuditClauses> {
	const brut = await appeler(invitePourAudit(brouillon, bibliotheque), CONSIGNES_AUDIT);
	return normaliserAudit(brut, brouillon, bibliotheque);
}

/** Aide ponctuelle : étoffe un seul champ pendant la saisie, sans rien persister. */
export async function redigerChamp(brouillon: BrouillonMandat, cible: CibleChamp): Promise<string> {
	const brut = (await appeler(invitePourChamp(brouillon, cible), CONSIGNES)) as Record<
		string,
		unknown
	>;
	const resultat = proseDuChamp(brut?.texte);
	if (!resultat) throw new OllamaIndisponibleError("L'IA locale n'a pas produit de texte.");
	return resultat;
}
