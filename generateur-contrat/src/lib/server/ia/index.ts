/** Les trois choses que l'application demande à l'IA locale. Chacune suit la même chaîne : une invite
 * (`invites.ts`), un aller-retour (`transport.ts`), une normalisation (`normalisation.ts`). Rien
 * d'autre du dossier `ia/` n'a vocation à être importé d'ailleurs.
 */
import type {
	AuditClauses,
	BrouillonMandat,
	ClauseBibliotheque,
	RedactionIA,
	RevueMandat
} from '$domaine/types';
import { empreinteProse } from '$document/empreinte';
import {
	CONSIGNES,
	CONSIGNES_AUDIT,
	CONSIGNES_LIBELLE,
	CONSIGNES_REVUE,
	invitePourAudit,
	invitePourChamp,
	invitePourDocument,
	invitePourPuces,
	invitePourRevue,
	type CibleChamp,
	type CiblePuces
} from './invites';
import {
	listeDePuces,
	normaliser,
	normaliserAudit,
	normaliserRevue,
	proseDuChamp,
	titreDeProjet
} from './normalisation';
import { appeler, OllamaIndisponibleError } from './transport';

export { OllamaIndisponibleError, modeleActif } from './transport';
export type { CibleChamp, CiblePuces } from './invites';

/** Passe complète : réécrit toute la prose du document d'un coup, de façon cohérente. */
export async function redigerDocument(brouillon: BrouillonMandat): Promise<RedactionIA> {
	const idsConnus = new Set(brouillon.lignes.map((l) => l.id));
	const brut = await appeler(invitePourDocument(brouillon), CONSIGNES);
	return normaliser(brut, idsConnus, empreinteProse(brouillon));
}

/** Relit le **fond** du mandat : contradictions entre deux endroits, promesses que rien ne réalise,
 * textes trop vagues pour être opposables. Ne modifie rien, ne persiste rien. C'est le pendant de
 * `auditerClauses`, qui ne regarde que le volet contractuel. */
export async function revoirMandat(brouillon: BrouillonMandat): Promise<RevueMandat> {
	const brut = await appeler(invitePourRevue(brouillon), CONSIGNES_REVUE);
	return normaliserRevue(brut, brouillon);
}

/** Relit le mandat et signale ce qui manque. Ne modifie rien : les brouillons partent en révision,
 * pas au document. */
export async function auditerClauses(
	brouillon: BrouillonMandat,
	bibliotheque: ClauseBibliotheque[] = []
): Promise<AuditClauses> {
	const brut = await appeler(invitePourAudit(brouillon, bibliotheque), CONSIGNES_AUDIT);
	return normaliserAudit(brut, brouillon, bibliotheque);
}

/** Aide ponctuelle : étoffe un seul champ pendant la saisie, sans rien persister.
 *
 * Le titre suit un chemin à part de bout en bout : ce n'est pas de la prose, donc ni les mêmes
 * consignes système, ni le même nettoyage. */
export async function redigerChamp(brouillon: BrouillonMandat, cible: CibleChamp): Promise<string> {
	const titre = cible.kind === 'titre';
	const brut = (await appeler(
		invitePourChamp(brouillon, cible),
		titre ? CONSIGNES_LIBELLE : CONSIGNES
	)) as Record<string, unknown>;

	const resultat = titre ? titreDeProjet(brut?.texte) : proseDuChamp(brut?.texte);
	if (!resultat) {
		throw new OllamaIndisponibleError(
			titre
				? 'L’IA locale a répondu par une phrase plutôt que par un titre. Réessayez, ou saisissez-le vous-même.'
				: "L'IA locale n'a pas produit de texte."
		);
	}
	return resultat;
}

/** Complète une liste d'inclus ou d'exclusions. Renvoie une liste vide quand le modèle juge qu'il
 * n'y a rien à ajouter : c'est une réponse valable, pas un échec. */
export async function proposerPuces(
	brouillon: BrouillonMandat,
	cible: CiblePuces
): Promise<string[]> {
	const ligne = brouillon.lignes.find((l) => l.id === cible.id);
	const dejaLa = (cible.kind === 'inclus' ? ligne?.inclus : ligne?.nonInclus) ?? [];
	// Mêmes consignes que le titre : une puce est un libellé, pas un paragraphe.
	const brut = await appeler(invitePourPuces(brouillon, cible), CONSIGNES_LIBELLE);
	return listeDePuces(brut, dejaLa);
}
