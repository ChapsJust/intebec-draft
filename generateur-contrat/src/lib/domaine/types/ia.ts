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
