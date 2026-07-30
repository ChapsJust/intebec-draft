/** Ce qu'on garde de la réponse du modèle.
 *
 * Un modèle hallucine des clés, des identifiants de lignes et des clauses déjà en place. Tout ce
 * qui sort d'ici a donc été confronté à la structure attendue et au mandat réel : ce module est la
 * frontière entre « le modèle a dit » et « l'application accepte ».
 */
import type {
	AuditClauses,
	ChampCondition,
	ClauseBibliotheque,
	ClausesStandards,
	BrouillonMandat,
	PropositionClause,
	RedactionIA,
	SuggestionBibliotheque,
	SuggestionClause,
	SuggestionCondition
} from '$domaine/types';
import { CLES_CLAUSES, CLES_CONDITIONS } from '$document/catalogue';
import { titreNormalise } from '$domaine/titres';
import { modeleActif } from './transport';

// Réexporté parce que la normalisation est ce qui s'en sert le plus, et que les tests du
// dédoublonnage vivent ici. L'implémentation, elle, est partagée avec l'éditeur.
export { titreNormalise };

/** Le tiret cadratin est la ponctuation qui trahit le plus vite un texte généré, et les modèles
 * continuent d'en produire malgré la consigne. On le remplace donc systématiquement :
 * en incise (« mot — mot — mot ») par des virgules, en apposition finale par un deux-points.
 * Nettoie au passage les puces et le gras Markdown, qui n'ont rien à faire dans un contrat. */
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

/** Le modèle peut halluciner des clés ou des identifiants de lignes : on ne conserve que ce
 * qui correspond à la structure attendue et aux lignes réellement présentes dans le mandat. */
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
		// Une nouvelle rédaction repart sans refus : les passages ne sont plus les mêmes, donc des
		// index hérités de la précédente désigneraient un texte qui n'existe plus.
		refuses: {},
		empreinte,
		genereLe: new Date().toISOString(),
		modele: modeleActif()
	};
}

/** Le modèle recommande volontiers d'activer ce qui l'est déjà, invente des clés, ou renvoie un
 * objet là où un tableau est attendu. On ne garde que ce qui désigne une case réellement
 * décochée : une suggestion sans effet est du bruit qui décrédibilise l'audit entier. */
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

	// Une clause de la bibliothèque n'est proposée que si elle existe vraiment, n'est pas archivée, et
	// n'est pas déjà retenue ici. Le modèle désigne volontiers un id qu'il a lu ailleurs dans le
	// prompt, ou recommande de retenir ce qui l'est déjà.
	const suggestionsBibliotheque: SuggestionBibliotheque[] = [];
	for (const entree of tableau(source.bibliotheque)) {
		const id = texte(entree.id);
		const clause = bibliotheque.find((c) => c.id === id && !c.archiveLe);
		if (!clause) continue;
		if (idsRetenus.has(id) || titresRetenus.has(titreNormalise(clause.titre))) continue;
		if (suggestionsBibliotheque.some((s) => s.id === id)) continue;
		suggestionsBibliotheque.push({ id, raison: texte(entree.raison) });
	}

	// C'est ici que se joue le « sinon recrée » : la consigne du prompt ne se fait pas obéir, et une
	// proposition qui redit une clause déjà en bibliothèque la ferait entrer une seconde fois, sous un
	// titre à peine différent. Les titres déjà connus sont donc écartés d'office.
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

/** Le texte d'un champ unique, tel que renvoyé par `redigerChamp`. Exporté pour que `index.ts`
 * applique le même nettoyage que partout ailleurs. */
export const proseDuChamp = texte;
