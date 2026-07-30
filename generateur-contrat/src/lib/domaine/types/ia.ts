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
