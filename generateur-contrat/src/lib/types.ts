export type DocumentType = 'soumission' | 'contrat';

export type DocumentStatus = 'brouillon' | 'genere' | 'envoye';

export interface DocumentSummary {
	id: string;
	title: string;
	client: string;
	type: DocumentType;
	status: DocumentStatus;
	updatedAt: string; // ISO date
	archived: boolean;
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

/** Champs chiffrés des conditions particulières qui font naître un article lorsqu'ils sont
 * renseignés. Laissés à zéro, l'article correspondant disparaît du contrat : c'est exactement le
 * genre d'oubli que l'audit doit rattraper. */
export type ChampCondition =
	| 'heuresFormationIncluses'
	| 'dureeGarantieJours'
	| 'dureeSupportMois'
	| 'tauxHoraireHorsPerimetre'
	| 'preavisResiliationJours';

/** Clause du catalogue que l'IA recommande d'activer. Elle ne désigne qu'une case à cocher
 * existante : le corps juridique reste celui, vérifié, de `clauses.ts`. */
export interface SuggestionClause {
	cle: keyof ClausesStandards;
	raison: string;
}

/** Condition chiffrée laissée à zéro alors que le mandat semble l'appeler. L'IA signale le
 * manque mais ne propose aucune valeur : les chiffres restent la décision de l'utilisateur. */
export interface SuggestionCondition {
	champ: ChampCondition;
	raison: string;
}

/** Manque que le catalogue ne couvre pas. `brouillon` n'est **jamais** rendu dans un document :
 * c'est une piste à réviser, puis à intégrer à `clauses.ts` si elle est retenue. Une clause revue
 * une fois et versionnée vaut mieux qu'une clause regénérée à chaque contrat. */
export interface PropositionClause {
	titre: string;
	raison: string;
	brouillon: string;
}

/** Audit des clauses par l'IA. Purement consultatif : rien n'est activé ni écrit d'office. */
export interface AuditClauses {
	suggestions: SuggestionClause[];
	conditions: SuggestionCondition[];
	propositions: PropositionClause[];
	genereLe: string;
	modele: string;
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

/** Fiche client persistée : source de vérité pour un client réutilisable d'un mandat à l'autre. */
export interface ClientRecord extends ClientInfo {
	id: string;
	notes: string;
	archiveLe: string | null;
	creeLe: string;
	majLe: string;
}

/** Fiche client accompagnée du nombre de mandats rattachés, pour annoncer les conséquences d'un
 * archivage ou d'une suppression avant de les exécuter. */
export interface ClientListItem extends ClientRecord {
	nbMandats: number;
}

/** Prose produite par l'IA locale, stockée **à côté** du draft et jamais à sa place.
 * C'est ce qui rend la passe de rédaction rejouable : la saisie de l'utilisateur reste intacte,
 * on peut relancer la génération, comparer, ou revenir en arrière en effaçant la rédaction.
 * L'IA ne touche qu'à la prose : montants, dates et clauses restent calculés par le template. */
export interface RedactionIA {
	preambule: string;
	objet: string;
	/** Descriptions réécrites, indexées par `ServiceLine.id`. */
	lignes: Record<string, string>;
	genereLe: string;
	modele: string;
}

/** Mandat persisté. `draft` est le snapshot figé au moment de l'enregistrement : voir clientId vs draft.client. */
export interface MandatRecord {
	id: string;
	clientId: string | null;
	type: DocumentType;
	statut: DocumentStatus;
	titre: string;
	clientNom: string;
	totalNet: number;
	draft: MandatDraft;
	redaction: RedactionIA | null;
	/** Non nul = mandat archivé : il disparaît des listes courantes sans être détruit. */
	archiveLe: string | null;
	creeLe: string;
	majLe: string;
}
