export type TypeClient = 'entreprise' | 'obnl' | 'particulier';

export interface CoordonneesClient {
	nom: string;
	typeClient: TypeClient;
	adresse: string;
	representantNom: string;
	representantTitre: string;
	courriel: string;
	telephone: string;
	siteWeb: string;
	numeroEntreprise: string;
}

/** Fiche client persistée : source de vérité pour un client réutilisable d'un mandat à l'autre. */
export interface FicheClient extends CoordonneesClient {
	id: string;
	notes: string;
	archiveLe: string | null;
	creeLe: string;
	majLe: string;
}

/** Fiche client accompagnée du nombre de mandats rattachés, pour annoncer les conséquences d'un
 * archivage ou d'une suppression avant de les exécuter. */
export interface FicheClientListee extends FicheClient {
	nbMandats: number;
}
