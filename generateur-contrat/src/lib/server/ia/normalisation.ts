/** Ce qu'on garde de la réponse du modèle : la frontière entre « le modèle a dit » et « l'application
 * accepte ». Tout ce qui sort d'ici a été confronté à la structure attendue et au mandat réel.
 */
import type {
	AlerteMandat,
	AuditClauses,
	ChampCondition,
	ClauseBibliotheque,
	ClausesStandards,
	BrouillonMandat,
	GraviteAlerte,
	PropositionClause,
	RedactionIA,
	RevueMandat,
	SuggestionBibliotheque,
	SuggestionClause,
	SuggestionCondition
} from '$domaine/types';
import { CLES_CLAUSES, CLES_CONDITIONS } from '$document/catalogue';
import { titreNormalise } from '$domaine/titres';
import { modeleActif } from './transport';

// Réexporté ici parce que c'est la normalisation qui s'en sert le plus ; l'implémentation est
// partagée avec l'éditeur.
export { titreNormalise };

/** Le tiret cadratin trahit un texte généré, et les modèles en produisent malgré la consigne. On le
 * remplace : en incise par des virgules, en apposition finale par un deux-points. Nettoie au passage
 * les puces et le gras Markdown. */
export function nettoyerProse(brut: string): string {
	return (
		brut
			// Incise encadrée : « les livrables — conçus sur mesure — sont livrés »
			.replace(/\s+[—–]\s+([^—–]+?)\s+[—–]\s+/g, ', $1, ')
			// Tiret d'apposition en fin de phrase : « ... du client — sans frais. »
			.replace(/\s+[—–]\s+/g, ' : ')
			// Tiret collé, souvent une plage ou une liaison : « site—web »
			.replace(/(\S)[—–](\S)/g, '$1, $2')
			.replace(/^\s*[-*•]\s+/gm, '')
			.replace(/\*\*(.+?)\*\*/g, '$1')
			.replace(/[ \t]{2,}/g, ' ')
			// Un deux-points de remplacement peut en suivre un autre déjà présent.
			.replace(/\s*:\s*:/g, ' :')
			.trim()
	);
}

function texte(valeur: unknown): string {
	return typeof valeur === 'string' ? nettoyerProse(valeur) : '';
}

/** Le modèle hallucine des identifiants de lignes : on ne garde que ceux qui existent vraiment. */
export function normaliser(brut: unknown, idsConnus: Set<string>, empreinte = ''): RedactionIA {
	const source = (brut ?? {}) as Record<string, unknown>;
	const lignesBrutes = (source.lignes ?? {}) as Record<string, unknown>;

	const lignes: Record<string, string> = {};
	for (const [id, valeur] of Object.entries(lignesBrutes)) {
		if (!idsConnus.has(id)) continue;
		const contenu = texte(valeur);
		if (contenu) lignes[id] = contenu;
	}

	return {
		preambule: texte(source.preambule),
		objet: texte(source.objet),
		lignes,
		// Une nouvelle rédaction repart sans refus : les index hérités désigneraient un autre texte.
		refuses: {},
		empreinte,
		genereLe: new Date().toISOString(),
		modele: modeleActif()
	};
}

/** Le modèle recommande volontiers d'activer ce qui l'est déjà, invente des clés, ou renvoie un objet
 * là où un tableau est attendu. On ne garde que ce qui désigne une case réellement décochée : une
 * suggestion sans effet décrédibilise l'audit entier. */
export function normaliserAudit(
	brut: unknown,
	brouillon: BrouillonMandat,
	bibliotheque: ClauseBibliotheque[] = []
): AuditClauses {
	const source = (brut ?? {}) as Record<string, unknown>;
	const tableau = (v: unknown): Record<string, unknown>[] =>
		Array.isArray(v)
			? v.filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
			: [];

	const retenues = brouillon.conditions.clausesRetenues;
	const titresRetenus = new Set(retenues.map((c) => titreNormalise(c.titre)));
	const idsRetenus = new Set(retenues.map((c) => c.idBibliotheque).filter(Boolean));

	const suggestions: SuggestionClause[] = [];
	for (const entree of tableau(source.suggestions)) {
		const cle = entree.cle as keyof ClausesStandards;
		if (!CLES_CLAUSES.includes(cle)) continue;
		if (brouillon.conditions.clauses[cle]) continue;
		if (suggestions.some((s) => s.cle === cle)) continue;
		suggestions.push({ cle, raison: texte(entree.raison) });
	}

	const conditions: SuggestionCondition[] = [];
	for (const entree of tableau(source.conditions)) {
		const champ = entree.champ as ChampCondition;
		if (!CLES_CONDITIONS.includes(champ)) continue;
		if (brouillon.conditions[champ] > 0) continue;
		if (conditions.some((c) => c.champ === champ)) continue;
		conditions.push({ champ, raison: texte(entree.raison) });
	}

	// Le modèle désigne volontiers un id lu ailleurs dans le prompt : la clause doit exister, ne pas
	// être archivée, et ne pas être déjà retenue.
	const suggestionsBibliotheque: SuggestionBibliotheque[] = [];
	for (const entree of tableau(source.bibliotheque)) {
		const id = texte(entree.id);
		const clause = bibliotheque.find((c) => c.id === id && !c.archiveLe);
		if (!clause) continue;
		if (idsRetenus.has(id) || titresRetenus.has(titreNormalise(clause.titre))) continue;
		if (suggestionsBibliotheque.some((s) => s.id === id)) continue;
		suggestionsBibliotheque.push({ id, raison: texte(entree.raison) });
	}

	// La consigne « ne réécris pas ce qui existe » ne se fait pas obéir : une proposition qui redit une
	// clause déjà en bibliothèque la ferait entrer deux fois, sous un titre à peine différent.
	const titresConnus = new Set([
		...titresRetenus,
		...bibliotheque.filter((c) => !c.archiveLe).map((c) => titreNormalise(c.titre))
	]);

	const propositions: PropositionClause[] = [];
	for (const entree of tableau(source.propositions)) {
		const titre = texte(entree.titre);
		const corps = texte(entree.brouillon);
		if (!titre || !corps) continue;
		if (titresConnus.has(titreNormalise(titre))) continue;
		if (propositions.some((p) => titreNormalise(p.titre) === titreNormalise(titre))) continue;
		propositions.push({ titre, raison: texte(entree.raison), brouillon: corps });
	}

	return {
		suggestions,
		conditions,
		bibliotheque: suggestionsBibliotheque,
		propositions,
		genereLe: new Date().toISOString(),
		modele: modeleActif()
	};
}

/** Le texte d'un champ unique. Exporté pour que `index.ts` applique le même nettoyage. */
export const proseDuChamp = texte;

const GRAVITES: GraviteAlerte[] = ['incoherence', 'manque', 'imprecision'];

/** Les cibles qui ne désignent pas une ligne. Le reste doit être un identifiant réel. */
const CIBLES_GLOBALES = ['objet', 'portee', 'general'];

/** Une revue trop longue ne se lit pas, et un modèle qui trouve dix problèmes en invente huit. */
const MAX_ALERTES = 6;

/** Ce qu'on garde de la revue du fond.
 *
 * Deux filtres. Le modèle désigne volontiers une ligne qui n'existe pas : la cible doit être connue.
 * Et il répète le même constat sous deux formulations : on dédoublonne sur le couple cible + constat.
 *
 * Les alertes sortent triées par gravité, pas dans l'ordre du modèle : une incohérence enterrée sous
 * trois imprécisions passe inaperçue. */
export function normaliserRevue(brut: unknown, brouillon: BrouillonMandat): RevueMandat {
	const source = (brut ?? {}) as Record<string, unknown>;
	const brutes = Array.isArray(source.alertes) ? source.alertes : [];

	const ciblesConnues = new Set([...CIBLES_GLOBALES, ...brouillon.lignes.map((l) => l.id)]);
	const vues = new Set<string>();
	const alertes: AlerteMandat[] = [];

	for (const entree of brutes) {
		if (!entree || typeof entree !== 'object') continue;
		const champs = entree as Record<string, unknown>;

		const gravite = champs.gravite as GraviteAlerte;
		if (!GRAVITES.includes(gravite)) continue;

		const cible = texte(champs.cible);
		if (!ciblesConnues.has(cible)) continue;

		const constat = texte(champs.constat);
		if (!constat) continue;

		const cle = `${cible}|${titreNormalise(constat)}`;
		if (vues.has(cle)) continue;
		vues.add(cle);

		alertes.push({ gravite, cible, constat, suggestion: texte(champs.suggestion) });
	}

	alertes.sort((a, b) => GRAVITES.indexOf(a.gravite) - GRAVITES.indexOf(b.gravite));

	return {
		alertes: alertes.slice(0, MAX_ALERTES),
		genereLe: new Date().toISOString(),
		modele: modeleActif()
	};
}

/** Un titre ne dépasse pas une poignée de mots. On plafonne en **mots** et non en caractères : une
 * coupe à la longueur tombe au milieu d'un mot et produit une bouillie du genre « …Inc., pour ». */
const MAX_MOTS_TITRE = 10;

/** Amorces d'une phrase qui présente le document au lieu de le nommer. Le modèle y retombe quand il
 * confond le titre avec le préambule ; mieux vaut ne rien proposer qu'un faux titre. */
const AMORCE_DE_PHRASE = /^(ce|cet|cette|ces|le présent|la présente|il s'agit|voici)\b/i;

/** Un titre de projet proposé par le modèle. Il devient l'en-tête du document et le nom du fichier
 * PDF, donc il doit être un groupe nominal nu.
 *
 * Renvoie une chaîne vide quand la réponse est une phrase : `redigerChamp` la traite alors comme une
 * absence de réponse, ce qui affiche une erreur franche au lieu d'un titre bancal. */
export function titreDeProjet(brut: unknown): string {
	const premiereLigne = texte(brut).split('\n')[0];

	const nettoye = premiereLigne
		// « Titre : Refonte du site » — le modèle annonce parfois ce qu'il répond.
		.replace(/^\s*titre\s*:\s*/i, '')
		.replace(/^["«'`\s]+|["»'`\s]+$/g, '')
		.trim();

	if (!nettoye || AMORCE_DE_PHRASE.test(nettoye)) return '';

	// Une réponse trop bavarde s'arrête à sa première ponctuation forte plutôt que d'être tronquée.
	const mots = nettoye
		.split(/[.!?;]/)[0]
		.trim()
		.split(/\s+/)
		.filter(Boolean);

	return mots
		.slice(0, MAX_MOTS_TITRE)
		.join(' ')
		.replace(/[,;:]+$/, '')
		.trim();
}

/** Plafond sur ce qu'une passe de puces peut ajouter d'un coup. Le modèle en propose volontiers
 * quinze quand la portée n'en justifie que trois. */
const MAX_PUCES_PROPOSEES = 5;

/** Les éléments d'une liste proposée par le modèle : nettoyés, dédoublonnés entre eux et contre ce
 * qui est déjà saisi, plafonnés. Le modèle renvoie souvent une chaîne au lieu d'un tableau, ou
 * repropose mot pour mot ce que le prompt lui a montré comme déjà présent. */
export function listeDePuces(brut: unknown, dejaLa: string[] = []): string[] {
	const source = (brut ?? {}) as Record<string, unknown>;
	if (!Array.isArray(source.items)) return [];

	const vus = new Set(dejaLa.map(titreNormalise).filter(Boolean));
	const retenus: string[] = [];

	for (const item of source.items) {
		// La puce Markdown survit parfois à `nettoyerProse`, qui ne la retire qu'en début de ligne.
		const valeur = texte(item)
			.replace(/^[-*•]\s*/, '')
			.trim();
		if (!valeur) continue;

		const cle = titreNormalise(valeur);
		if (vus.has(cle)) continue;
		vus.add(cle);

		retenus.push(valeur);
		if (retenus.length >= MAX_PUCES_PROPOSEES) break;
	}

	return retenus;
}
