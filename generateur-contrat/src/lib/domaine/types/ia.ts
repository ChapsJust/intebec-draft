import type { ChampCondition, ClausesStandards } from './clauses';

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

/** Clause déjà en bibliothèque que l'IA propose de retenir, plutôt que d'en rédiger une variante.
 * Sans ça, chaque relecture repeuplait la bibliothèque de doublons approximatifs. */
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

/** Ce qui cloche dans le fond du mandat, par ordre décroissant de gravité.
 *
 * `incoherence` : deux endroits du mandat se contredisent. `manque` : la portée annonce quelque chose
 * dont aucune ligne ne parle. `imprecision` : un texte trop vague pour être opposable. */
export type GraviteAlerte = 'incoherence' | 'manque' | 'imprecision';

/** Un constat de la revue du mandat. L'IA signale, elle ne corrige pas : c'est l'utilisateur qui
 * sait ce qu'il a voulu écrire. */
export interface AlerteMandat {
	gravite: GraviteAlerte;
	/** Où regarder : `objet`, `portee`, `general`, ou un `LigneService.id`. */
	cible: string;
	/** Ce qui cloche, en une phrase. */
	constat: string;
	/** Ce qu'on pourrait faire. Jamais appliqué d'office. */
	suggestion: string;
}

/** Revue du fond du mandat, par opposition à `AuditClauses` qui ne regarde que le volet contractuel.
 * Comme l'audit, elle n'est persistée nulle part : relancer repart d'une page blanche. */
export interface RevueMandat {
	alertes: AlerteMandat[];
	genereLe: string;
	modele: string;
}

/** Prose produite par l'IA, stockée à côté du brouillon et jamais à sa place : la saisie reste
 * intacte et la rédaction est rejouable. */
export interface RedactionIA {
	preambule: string;
	objet: string;
	/** Descriptions réécrites, indexées par `LigneService.id`. */
	lignes: Record<string, string>;
	/** Index des passages refusés, par champ (`preambule`, `objet`, ou un `LigneService.id`).
	 *
	 * On stocke la décision, pas son résultat : `texteEffectif` recompose le texte à la lecture, donc
	 * un refus se défait et le PDF le suit sans rien connaître.
	 *
	 * Optionnel : les rédactions enregistrées avant la revue passage par passage n'ont pas la clé, et
	 * la colonne `jsonb` ne les a pas migrées. */
	refuses?: Record<string, number[]>;
	/** Empreinte de la saisie dont cette prose est dérivée (`empreinteProse`). Sans elle, une
	 * rédaction survit à la saisie qui l'a produite sans que rien ne le signale. Optionnelle pour la
	 * même raison que `refuses`. */
	empreinte?: string;
	genereLe: string;
	modele: string;
}
