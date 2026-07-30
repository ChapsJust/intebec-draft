import type { CoordonneesClient } from './client';
import type { StatutDocument, StructureProjet, TypeDocument } from './document';
import type { ConditionsParticulieres } from './clauses';
import type { RedactionIA } from './ia';
import type { AbonnementRecurrent, LigneService, ModalitesPaiement } from './tarification';

/** Brouillon de mandat, tel que saisi par l'utilisateur. Il est stocké tel quel dans la colonne `brouillon` de la table `mandat`. */
export interface BrouillonMandat {
	type: TypeDocument;
	titre: string;
	structureProjet: StructureProjet;
	objet: string;
	client: CoordonneesClient;
	lignes: LigneService[];
	modalitesPaiement: ModalitesPaiement;
	abonnement: AbonnementRecurrent;
	conditions: ConditionsParticulieres;
	dateSignature: string;
	lieuSignature: string;
	representantIntebecNom: string;
	representantIntebecTitre: string;
}

/** Mandat persisté. `brouillon` est le snapshot figé au moment de l'enregistrement : voir clientId vs brouillon.client. */
export interface MandatEnregistre {
	id: string;
	clientId: string | null;
	type: TypeDocument;
	statut: StatutDocument;
	titre: string;
	clientNom: string;
	totalNet: number;
	brouillon: BrouillonMandat;
	redaction: RedactionIA | null;
	/** Non nul = mandat archivé : il disparaît des listes courantes sans être détruit. */
	archiveLe: string | null;
	creeLe: string;
	majLe: string;
}
