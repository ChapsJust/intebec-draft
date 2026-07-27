export type DocumentType = 'soumission' | 'contrat';

export type DocumentStatus = 'brouillon' | 'genere' | 'envoye';

export interface DocumentSummary {
	id: string;
	title: string;
	client: string;
	type: DocumentType;
	status: DocumentStatus;
	updatedAt: string; // ISO date
}

export type PricingMode = 'forfaitaire' | 'horaire' | 'quantite';

export interface QuantityItem {
	id: string;
	description: string;
	quantite: number;
	prixUnitaire: number;
}

export interface ServiceLine {
	id: string;
	nom: string;
	description: string;
	inclus: string[];
	nonInclus: string[];
	pricingMode: PricingMode;
	montantForfaitaire: number;
	tauxHoraire: number;
	heuresEstimees: number;
	items: QuantityItem[];
	delaiEstime: string;
}

export type StructureProjet = 'phases' | 'blocs' | 'recurrent';

export type TypeClient = 'entreprise' | 'obnl' | 'particulier';

export interface ClientInfo {
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

export interface ModalitesPaiement {
	acomptePct: number;
	soldePct: number;
	delaiJoursSolde: number;
}

export interface AbonnementRecurrent {
	actif: boolean;
	frequence: 'mensuel' | 'annuel';
	montant: number;
	couverture: string;
	periodeOfferteMois: number;
}

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
	notesAdditionnelles: string;
}

export interface MandatDraft {
	type: DocumentType;
	titre: string;
	structureProjet: StructureProjet;
	objet: string;
	client: ClientInfo;
	lignes: ServiceLine[];
	modalitesPaiement: ModalitesPaiement;
	abonnement: AbonnementRecurrent;
	conditions: ConditionsParticulieres;
	dateSignature: string;
	lieuSignature: string;
	representantIntebecNom: string;
	representantIntebecTitre: string;
}
