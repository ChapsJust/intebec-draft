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

/** Le contenu reçu est inutilisable. Une classe à part plutôt qu'une `Error` générique, pour que les
 * actions puissent répondre 400 (« corrigez ») au lieu de 500 (« c'est nous »). */
export class SoumissionInvalideError extends Error {}

/** Plafonds sur les collections. Ils ne sont pas là pour brider l'utilisateur (personne n'écrit
 * soixante phases), mais pour qu'une requête fabriquée à la main ne puisse pas faire enregistrer un
 * document de plusieurs mégaoctets. */
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

/** Un nombre fini, ramené dans l'intervalle. Un rabais à 300 % devient 100 %, il ne fait pas échouer
 * l'enregistrement.
 *
 * Le cas `NaN` / `Infinity` mérite son test à part : sans lui ils passeraient les comparaisons et se
 * propageraient dans tous les calculs de montants, jusqu'à afficher « $NaN » au contrat. */
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

/** Liste de puces. On garde les entrées vides, contrairement aux clauses plus bas : dans l'éditeur,
 * une puce vide est un champ que l'utilisateur vient d'ajouter et qu'il n'a pas encore rempli. C'est
 * le rendu du document qui les enlève, via `nettoyerListe`. */
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

/** On ne lit que l'acompte et on déduit le solde. Si on acceptait les deux valeurs séparément, une
 * requête pourrait poster un échéancier de 50 % + 90 %, et le document l'afficherait tel quel. */
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

/** Clauses hors catalogue. Ici, au contraire des puces, on jette les entrées incomplètes : un titre
 * sans corps ne produit aucun article au document, et le garder ferait réapparaître une ligne
 * fantôme dans l'éditeur à chaque rechargement. */
function normaliserClausesRetenues(brut: unknown): ClauseRetenue[] {
	if (!Array.isArray(brut)) return [];

	const retenues: ClauseRetenue[] = [];
	for (const entree of brut.slice(0, MAX_CLAUSES)) {
		const source = (entree ?? {}) as Record<string, unknown>;
		const titre = texte(source.titre).slice(0, MAX_TITRE).trim();
		const corps = texte(source.corps).trim();
		if (!titre || !corps) continue;
		// Cet identifiant ne sert qu'à savoir de quelle clause de bibliothèque vient la copie. Tout ce
		// qui n'est pas un UUID est ramené à vide, sinon il irait se comparer aux vrais ids.
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

/** Reconstruit un mandat sûr à partir de données dont on ne sait rien.
 *
 * Le principe : on part d'un brouillon vide et on y recopie seulement ce qui a la bonne forme, au
 * lieu de faire confiance à l'objet reçu. C'est important parce que la colonne `jsonb` de Postgres
 * n'impose aucune structure : un `lignes` qui ne serait pas un tableau s'enregistrerait sans erreur,
 * et casserait l'affichage à toutes les visites suivantes.
 *
 * Deuxième choix : on corrige au lieu de refuser. Dans les faits l'écart vient presque toujours d'un
 * champ laissé vide, et faire perdre une saisie complète à cause d'un nombre mal formé serait bien
 * pire que de le ramener à zéro. */
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

/** Lit un brouillon depuis la chaîne JSON postée. Sans le `try`, un corps de requête tronqué fait
 * planter `JSON.parse` et l'utilisateur tombe sur une page 500. */
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
