import type {
	AbonnementRecurrent,
	ClauseRetenue,
	CoordonneesClient,
	ConditionsParticulieres,
	BrouillonMandat,
	ModalitesPaiement,
	LigneQuantite,
	LigneService
} from '$domaine/types';
import { nouveauMandat, nouvelleLigne } from '$lib/mandat';
import { estUuid } from './formulaire';

export interface SoumissionMandat {
	brouillon: BrouillonMandat;
	clientId: string | null;
	enregistrerNouveauClient: boolean;
}

/** Erreur de forme d'une soumission de formulaire : le contenu reçu n'est pas exploitable.
 * Distincte d'une erreur inattendue, pour que les form actions puissent répondre 400 plutôt que
 * de laisser remonter une page 500. */
export class SoumissionInvalideError extends Error {}

/** Plafonds sur les collections. Ils n'existent pas pour brider l'utilisateur — un mandat réel
 * compte quelques lignes — mais pour qu'une requête forgée ne puisse pas faire enregistrer un
 * document de plusieurs mégaoctets, ni rendre l'aperçu impossible à ouvrir ensuite. */
const MAX_LIGNES = 60;
const MAX_ITEMS = 60;
const MAX_PUCES = 40;
const MAX_TEXTE = 20_000;
const MAX_CLAUSES = 20;
/** Le titre d'une clause devient un titre d'article : au-delà, il déborde la mise en page du
 * document au lieu de la renseigner. */
const MAX_TITRE = 200;

function texte(valeur: unknown, defaut = ''): string {
	if (typeof valeur !== 'string') return defaut;
	return valeur.slice(0, MAX_TEXTE);
}

/** Nombre fini borné. Les valeurs hors bornes sont ramenées dans l'intervalle plutôt que refusées :
 * l'éditeur les empêche déjà côté saisie, et un rabais à 300 % doit devenir 100 %, pas casser
 * l'enregistrement. `NaN` et `Infinity` retombent sur le défaut, sans quoi ils se propageraient
 * dans tous les calculs de montants. */
function nombre(valeur: unknown, defaut: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
	const n = typeof valeur === 'number' ? valeur : Number(valeur);
	if (!Number.isFinite(n)) return defaut;
	return Math.min(Math.max(n, min), max);
}

function booleen(valeur: unknown, defaut: boolean): boolean {
	return typeof valeur === 'boolean' ? valeur : defaut;
}

function parmi<T extends string>(valeur: unknown, permises: readonly T[], defaut: T): T {
	return typeof valeur === 'string' && (permises as readonly string[]).includes(valeur)
		? (valeur as T)
		: defaut;
}

/** Liste de puces : on ne garde que des chaînes, et on borne la longueur. Les entrées vides sont
 * conservées ici parce que l'éditeur s'en sert comme champ en attente de saisie ; c'est le rendu
 * du document qui les élimine (`nettoyerListe`). */
function liste(valeur: unknown): string[] {
	if (!Array.isArray(valeur)) return [];
	return valeur.slice(0, MAX_PUCES).map((v) => texte(v));
}

/** Date au format `YYYY-MM-DD`. Tout le document en dépend : `formatDateLongue` la découpe à la
 * main, et le nom du fichier PDF en dérive. */
function dateIso(valeur: unknown, defaut: string): string {
	return typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valeur) ? valeur : defaut;
}

function normaliserItem(brut: unknown, defautId: string): LigneQuantite {
	const source = (brut ?? {}) as Record<string, unknown>;
	return {
		id: texte(source.id) || defautId,
		description: texte(source.description),
		quantite: nombre(source.quantite, 0),
		prixUnitaire: nombre(source.prixUnitaire, 0)
	};
}

function normaliserLigne(brut: unknown, index: number): LigneService {
	const source = (brut ?? {}) as Record<string, unknown>;
	const vide = nouvelleLigne();

	return {
		id: texte(source.id) || vide.id,
		nom: texte(source.nom),
		description: texte(source.description),
		inclus: liste(source.inclus),
		nonInclus: liste(source.nonInclus),
		pricingMode: parmi(source.pricingMode, ['forfaitaire', 'horaire', 'quantite'], 'forfaitaire'),
		montantForfaitaire: nombre(source.montantForfaitaire, 0),
		tauxHoraire: nombre(source.tauxHoraire, 0),
		heuresEstimees: nombre(source.heuresEstimees, 0),
		items: Array.isArray(source.items)
			? source.items
					.slice(0, MAX_ITEMS)
					.map((item, i) => normaliserItem(item, `${index}-${i}-${vide.id}`))
			: [],
		delaiEstime: texte(source.delaiEstime)
	};
}

function normaliserClient(brut: unknown, defaut: CoordonneesClient): CoordonneesClient {
	const source = (brut ?? {}) as Record<string, unknown>;
	return {
		nom: texte(source.nom),
		typeClient: parmi(source.typeClient, ['entreprise', 'obnl', 'particulier'], defaut.typeClient),
		adresse: texte(source.adresse),
		representantNom: texte(source.representantNom),
		representantTitre: texte(source.representantTitre),
		courriel: texte(source.courriel),
		telephone: texte(source.telephone),
		siteWeb: texte(source.siteWeb),
		numeroEntreprise: texte(source.numeroEntreprise)
	};
}

/** L'acompte est la seule valeur retenue : le solde en est déduit, exactement comme le fait
 * l'éditeur. Accepter un solde posté séparément permettrait d'enregistrer un échéancier de
 * 50 % + 90 %, que le document afficherait tel quel. */
function normaliserPaiement(brut: unknown, defaut: ModalitesPaiement): ModalitesPaiement {
	const source = (brut ?? {}) as Record<string, unknown>;
	const acomptePct = nombre(source.acomptePct, defaut.acomptePct, 0, 100);
	return {
		acomptePct,
		soldePct: 100 - acomptePct,
		delaiJoursSolde: nombre(source.delaiJoursSolde, defaut.delaiJoursSolde, 0, 3650)
	};
}

function normaliserAbonnement(brut: unknown, defaut: AbonnementRecurrent): AbonnementRecurrent {
	const source = (brut ?? {}) as Record<string, unknown>;
	return {
		actif: booleen(source.actif, false),
		frequence: parmi(source.frequence, ['mensuel', 'annuel'], defaut.frequence),
		montant: nombre(source.montant, 0),
		couverture: texte(source.couverture),
		periodeOfferteMois: nombre(source.periodeOfferteMois, 0, 0, 120)
	};
}

/** Clauses hors catalogue retenues pour le mandat. À la différence des puces, les entrées vides sont
 * écartées : un titre sans corps, ou l'inverse, ne peut produire aucun article, et le garder ferait
 * réapparaître une ligne fantôme dans l'éditeur à chaque rechargement. */
function normaliserClausesRetenues(brut: unknown): ClauseRetenue[] {
	if (!Array.isArray(brut)) return [];

	const retenues: ClauseRetenue[] = [];
	for (const entree of brut.slice(0, MAX_CLAUSES)) {
		const source = (entree ?? {}) as Record<string, unknown>;
		const titre = texte(source.titre).slice(0, MAX_TITRE).trim();
		const corps = texte(source.corps).trim();
		if (!titre || !corps) continue;
		// L'identifiant ne sert qu'à la traçabilité : une valeur qui n'est pas un UUID est ramenée à
		// vide plutôt que recopiée, sans quoi elle irait ensuite se comparer aux ids de la bibliothèque.
		const idBibliotheque = texte(source.idBibliotheque);
		retenues.push({
			idBibliotheque: estUuid(idBibliotheque) ? idBibliotheque : '',
			titre,
			corps
		});
	}
	return retenues;
}

function normaliserConditions(
	brut: unknown,
	defaut: ConditionsParticulieres
): ConditionsParticulieres {
	const source = (brut ?? {}) as Record<string, unknown>;
	const clauses = (source.clauses ?? {}) as Record<string, unknown>;

	return {
		heuresFormationIncluses: nombre(source.heuresFormationIncluses, 0, 0, 9999),
		dureeGarantieJours: nombre(source.dureeGarantieJours, 0, 0, 3650),
		dureeSupportMois: nombre(source.dureeSupportMois, 0, 0, 600),
		tauxHoraireHorsPerimetre: nombre(source.tauxHoraireHorsPerimetre, 0),
		preavisResiliationJours: nombre(source.preavisResiliationJours, 0, 0, 3650),
		// Un rabais supérieur à 100 % produisait un total négatif, donc un contrat où le client
		// serait payé pour recevoir les travaux.
		rabaisPct: nombre(source.rabaisPct, 0, 0, 100),
		rabaisMotif: texte(source.rabaisMotif),
		clauses: {
			confidentialite: booleen(clauses.confidentialite, defaut.clauses.confidentialite),
			limitationResponsabilite: booleen(
				clauses.limitationResponsabilite,
				defaut.clauses.limitationResponsabilite
			),
			propriete: booleen(clauses.propriete, defaut.clauses.propriete),
			litiges: booleen(clauses.litiges, defaut.clauses.litiges),
			signatureElectronique: booleen(
				clauses.signatureElectronique,
				defaut.clauses.signatureElectronique
			)
		},
		clausesRetenues: normaliserClausesRetenues(source.clausesRetenues),
		notesAdditionnelles: texte(source.notesAdditionnelles)
	};
}

/** Reconstruit un mandat sûr à partir de données arbitraires.
 *
 * Le principe est de partir d'un brouillon vide et de n'y recopier que ce qui a la forme attendue,
 * plutôt que de faire confiance à l'objet reçu. Le brouillon est stocké tel quel en base, dans une
 * colonne `jsonb` que rien ne contraint : un `lignes` qui n'était pas un tableau s'enregistrait
 * sans broncher, puis faisait échouer l'affichage du mandat à *chaque* visite suivante. Un
 * brouillon abîmé était donc définitif.
 *
 * On normalise au lieu de refuser : les écarts viennent presque toujours d'un champ laissé vide,
 * pas d'une attaque, et perdre une saisie complète pour un nombre mal formé serait pire que de le
 * ramener à zéro. */
export function normaliserMandat(brut: unknown): BrouillonMandat {
	const source = (brut ?? {}) as Record<string, unknown>;
	const defaut = nouveauMandat();

	const lignesBrutes = Array.isArray(source.lignes) ? source.lignes.slice(0, MAX_LIGNES) : [];
	const lignes = lignesBrutes.map((ligne, i) => normaliserLigne(ligne, i));

	return {
		type: parmi(source.type, ['soumission', 'contrat'], defaut.type),
		titre: texte(source.titre),
		structureProjet: parmi(
			source.structureProjet,
			['phases', 'blocs', 'recurrent'],
			defaut.structureProjet
		),
		objet: texte(source.objet),
		client: normaliserClient(source.client, defaut.client),
		// Un mandat sans aucune ligne n'est pas représentable dans l'éditeur, qui en affiche
		// toujours au moins une : on rétablit la ligne vide plutôt que de rendre le mandat
		// inéditable.
		lignes: lignes.length > 0 ? lignes : defaut.lignes,
		modalitesPaiement: normaliserPaiement(source.modalitesPaiement, defaut.modalitesPaiement),
		abonnement: normaliserAbonnement(source.abonnement, defaut.abonnement),
		conditions: normaliserConditions(source.conditions, defaut.conditions),
		dateSignature: dateIso(source.dateSignature, defaut.dateSignature),
		lieuSignature: texte(source.lieuSignature),
		representantIntebecNom: texte(source.representantIntebecNom),
		representantIntebecTitre: texte(source.representantIntebecTitre)
	};
}

/** Lit un brouillon depuis une chaîne JSON. Le `try` n'est pas décoratif : `JSON.parse` sur un
 * corps tronqué levait une erreur que personne n'attrapait, donc une page 500. */
export function lireMandat(payload: unknown): BrouillonMandat {
	if (typeof payload !== 'string') {
		throw new SoumissionInvalideError('Le contenu du formulaire est absent.');
	}
	let brut: unknown;
	try {
		brut = JSON.parse(payload);
	} catch {
		throw new SoumissionInvalideError("Le contenu du formulaire n'a pas pu être lu.");
	}
	return normaliserMandat(brut);
}

export async function lireSoumissionMandat(request: Request): Promise<SoumissionMandat> {
	const data = await request.formData();
	const clientId = data.get('clientId');

	return {
		brouillon: lireMandat(data.get('payload')),
		clientId: typeof clientId === 'string' && clientId ? clientId : null,
		enregistrerNouveauClient: data.get('enregistrerNouveauClient') === '1'
	};
}
