/** Personne connectée. Défini ici plutôt que dans `server/auth.ts` parce que l'en-tête, qui est du
 * code client, a besoin du type : SvelteKit interdit d'importer quoi que ce soit de `$lib/server`
 * depuis le navigateur. */
export interface Utilisateur {
	nom: string;
}

export type TypeDocument = 'soumission' | 'contrat';

export type StatutDocument = 'brouillon' | 'genere' | 'envoye';

export interface ResumeDocument {
	id: string;
	title: string;
	client: string;
	type: TypeDocument;
	status: StatutDocument;
	updatedAt: string; // ISO date
	archived: boolean;
}

export type ModeTarification = 'forfaitaire' | 'horaire' | 'quantite';

export interface LigneQuantite {
	id: string;
	description: string;
	quantite: number;
	prixUnitaire: number;
}

export interface LigneService {
	id: string;
	nom: string;
	description: string;
	inclus: string[];
	nonInclus: string[];
	pricingMode: ModeTarification;
	montantForfaitaire: number;
	tauxHoraire: number;
	heuresEstimees: number;
	items: LigneQuantite[];
	delaiEstime: string;
}

export type StructureProjet = 'phases' | 'blocs' | 'recurrent';

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
 * genre d'oubli que l'audit doit rattraper. (IA) */
export type ChampCondition =
	| 'heuresFormationIncluses'
	| 'dureeGarantieJours'
	| 'dureeSupportMois'
	| 'tauxHoraireHorsPerimetre'
	| 'preavisResiliationJours';

/** Suggestion de clause à inclure dans le contrat. */
export interface SuggestionClause {
	cle: keyof ClausesStandards;
	raison: string;
}

/** Suggestion de valeur pour un champ condition. */
export interface SuggestionCondition {
	champ: ChampCondition;
	raison: string;
}

/** Mention d'une clause que l'IA propose d'inclure dans le contrat. */
export interface PropositionClause {
	titre: string;
	raison: string;
	brouillon: string;
}

/** Audit des clauses par l'IA. Sert à identifier les éléments à revoir dans le contrat. */
export interface AuditClauses {
	suggestions: SuggestionClause[];
	conditions: SuggestionCondition[];
	propositions: PropositionClause[];
	genereLe: string;
	modele: string;
}

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

/** Rédaction produite par l'IA, stockée à côté du brouillon et jamais à sa place. Permet de conserver les modifications apportées par l'IA sans altérer le brouillon original. */
export interface RedactionIA {
	preambule: string;
	objet: string;
	/** Descriptions réécrites, indexées par `LigneService.id`. */
	lignes: Record<string, string>;
	genereLe: string;
	modele: string;
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
