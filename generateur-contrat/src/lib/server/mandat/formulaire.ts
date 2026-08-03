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
import { nouveauMandat, nouvelleLigne } from '$domaine/fabriques';
import { estUuid } from '$serveur/formulaire';

export interface SoumissionMandat {
	brouillon: BrouillonMandat;
	clientId: string | null;
	enregistrerNouveauClient: boolean;
}

/** Contenu reçu inexploitable. Distincte d'une erreur inattendue, pour répondre 400 plutôt que 500. */
export class SoumissionInvalideError extends Error {}

/** Plafonds sur les collections : pas pour brider l'utilisateur, mais pour qu'une requête forgée ne
 * fasse pas enregistrer un document de plusieurs mégaoctets. */
const MAX_LIGNES = 60;
const MAX_ITEMS = 60;
const MAX_PUCES = 40;
const MAX_TEXTE = 20_000;
const MAX_CLAUSES = 20;
/** Le titre d'une clause devient un titre d'article : au-delà, il déborde la mise en page. */
const MAX_TITRE = 200;

function texte(valeur: unknown, defaut = ''): string {
	if (typeof valeur !== 'string') return defaut;
	return valeur.slice(0, MAX_TEXTE);
}

/** Nombre fini borné. Hors bornes, la valeur est ramenée dans l'intervalle : un rabais à 300 % doit
 * devenir 100 %, pas casser l'enregistrement. `NaN` et `Infinity` retombent sur le défaut, sinon ils
 * se propagent dans tous les calculs de montants. */
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

/** Liste de puces. Les entrées vides sont gardées : l'éditeur s'en sert comme champ en attente, et
 * c'est le rendu du document qui les élimine (`nettoyerListe`). */
function liste(valeur: unknown): string[] {
	if (!Array.isArray(valeur)) return [];
	return valeur.slice(0, MAX_PUCES).map((v) => texte(v));
}

/** Date au format `YYYY-MM-DD`. `formatDateLongue` la découpe à la main et le nom du PDF en dérive. */
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

/** Seul l'acompte est lu, le solde en est déduit. Accepter un solde posté séparément permettrait un
 * échéancier de 50 % + 90 %, que le document afficherait tel quel. */
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

/** Clauses hors catalogue. Contrairement aux puces, les entrées vides sont écartées : un titre sans
 * corps ne produit aucun article, et le garder ferait réapparaître une ligne fantôme à chaque
 * rechargement. */
function normaliserClausesRetenues(brut: unknown): ClauseRetenue[] {
	if (!Array.isArray(brut)) return [];

	const retenues: ClauseRetenue[] = [];
	for (const entree of brut.slice(0, MAX_CLAUSES)) {
		const source = (entree ?? {}) as Record<string, unknown>;
		const titre = texte(source.titre).slice(0, MAX_TITRE).trim();
		const corps = texte(source.corps).trim();
		if (!titre || !corps) continue;
		// L'identifiant ne sert qu'à la traçabilité : ce qui n'est pas un UUID est ramené à vide, sans
		// quoi il irait se comparer aux ids de la bibliothèque.
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
		// Au-delà de 100 %, le total devient négatif : un contrat où le client serait payé.
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

/** Reconstruit un mandat sûr à partir de données arbitraires : on part d'un brouillon vide et on n'y
 * recopie que ce qui a la forme attendue, plutôt que de faire confiance à l'objet reçu. La colonne
 * `jsonb` ne contraint rien, donc un `lignes` qui n'est pas un tableau s'enregistre sans broncher et
 * casse l'affichage à chaque visite suivante.
 *
 * On normalise au lieu de refuser : l'écart vient presque toujours d'un champ vide, et perdre une
 * saisie complète pour un nombre mal formé serait pire que de le ramener à zéro. */
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
		// L'éditeur affiche toujours au moins une ligne : sans ça le mandat devient inéditable.
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

/** Lit un brouillon depuis une chaîne JSON. Sans le `try`, un corps tronqué donne une page 500. */
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
