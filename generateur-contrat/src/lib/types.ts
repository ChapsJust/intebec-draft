/** Personne identifiée par Tailscale. Défini ici plutôt que dans `server/acces.ts` parce que
 * l'en-tête, qui est du code client, a besoin du type : SvelteKit interdit d'importer quoi que ce
 * soit de `$lib/server` depuis le navigateur. */
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

/** Clause déjà présente en bibliothèque que l'IA propose de retenir pour ce mandat, plutôt que d'en
 * rédiger une variante. Sans ce registre, chaque relecture réécrivait sa propre version d'une
 * protection déjà retenue ailleurs, et la bibliothèque se peuplait de doublons approximatifs. */
export interface SuggestionBibliotheque {
	id: string;
	raison: string;
}

/** Audit des clauses par l'IA. Sert à identifier les éléments à revoir dans le contrat. */
export interface AuditClauses {
	suggestions: SuggestionClause[];
	conditions: SuggestionCondition[];
	bibliotheque: SuggestionBibliotheque[];
	propositions: PropositionClause[];
	genereLe: string;
	modele: string;
}

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
	/** Passages rejetés par l'utilisateur, par champ (`preambule`, `objet`, ou un `LigneService.id`) :
	 * les index des passages du diff qu'il a refusés.
	 *
	 * On stocke la décision, pas son résultat : le texte affiché est recomposé à la lecture par
	 * `texteEffectif`. Fusionner en dur aurait obligé à écraser soit la saisie, soit la prose de
	 * l'IA, et un refus serait devenu irréversible. Le PDF passant par le même `construireDocument`,
	 * il suit les refus sans avoir à les connaître.
	 *
	 * Optionnel, et pas par commodité : les rédactions enregistrées avant l'arrivée de la revue
	 * passage par passage n'ont pas la clé, et la colonne `jsonb` ne les a pas migrées. Le type dit
	 * donc la vérité de ce qui sort de la base, ce qui force le `??` là où on le lit. */
	refuses?: Record<string, number[]>;
	/** Empreinte de la saisie dont cette prose est dérivée, via `empreinteProse`.
	 *
	 * Sans elle, une rédaction survivait à la saisie qui l'a produite sans que rien ne le signale :
	 * on modifiait le mandat, on relançait « Générer », et le document continuait d'afficher la prose
	 * de la version précédente. Les refus enregistrés étaient caducs eux aussi, leurs index ayant
	 * glissé sous le nouveau découpage.
	 *
	 * Optionnelle, comme `refuses` : les rédactions antérieures n'en ont pas, et on ne peut alors rien
	 * affirmer sur leur fraîcheur. */
	empreinte?: string;
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
