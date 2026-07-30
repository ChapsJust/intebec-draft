/** Le modele de vue d'un document rendu.
 *
 * Ces types decrivent ce que les composants de `composants/document/` recoivent, pas ce que
 * l'utilisateur saisit : la saisie, c'est `BrouillonMandat`. Les separer evite au rendu de
 * recalculer quoi que ce soit, et rend visible la frontiere entre le metier et l'affichage.
 */
import type { BlocArticle } from './clauses';

export interface Partie {
	/** « ENTRE » / « ET » : la charnière du préambule d'identification. */
	connecteur: string;
	role: string;
	nom: string;
	lignes: string[];
	representant: string;
	/** Désignation abrégée employée dans tout le reste du contrat. La mention « (ci-après … ) »
	 * n'est pas décorative : c'est elle qui définit le terme, sans quoi les articles renvoient
	 * à une désignation qui n'a jamais été établie. */
	designation: string;
}

export interface PorteeEntree {
	/** « Phase 1 », affiché en exergue et séparé du nom pour permettre une hiérarchie visuelle. */
	label: string;
	nom: string;
	description: string;
	inclus: string[];
	nonInclus: string[];
	delai: string;
	montant: string;
	tarification: string[];
}

export interface LigneHonoraires {
	label: string;
	nom: string;
	/** Une entrée par élément facturé : le tableau les empile au lieu de les concaténer. */
	details: string[];
	delai: string;
	montant: string;
}

export interface Versement {
	libelle: string;
	echeance: string;
	montant: string;
}

export interface BlocSignature {
	role: string;
	organisation: string;
	nom: string;
	titre: string;
}

/** Chaque section rend un type de contenu différent : l'union discriminée évite au composant de
 * rendu de deviner ce qu'il manipule, et garde toute la logique métier ici. */
export type ContenuSection =
	| { kind: 'paragraphes'; textes: string[] }
	| { kind: 'portee'; entrees: PorteeEntree[] }
	| {
			kind: 'honoraires';
			lignes: LigneHonoraires[];
			sousTotal: string;
			rabais: { pct: number; motif: string; montant: string } | null;
			total: string;
	  }
	| { kind: 'echeancier'; versements: Versement[]; notes: string[] }
	| { kind: 'blocs'; blocs: BlocArticle[] };

export interface SectionDocument {
	numero: number;
	titre: string;
	contenu: ContenuSection;
}

/** Réglage d'espacement appliqué au document entier.
 * `aere` étire une soumission courte pour qu'elle ne flotte pas en haut d'une page vide ;
 * `compact` resserre un contrat chargé pour éviter les pages qui débordent de trois lignes. */
export type Densite = 'aere' | 'normal' | 'compact';

export interface ModeleDocument {
	typeLabel: string;
	titre: string;
	dateLongue: string;
	lieu: string;
	parties: Partie[];
	sections: SectionDocument[];
	/** Formule liminaire fermant l'identification des parties, avant le premier article. */
	attendu: string;
	signatures: BlocSignature[];
	/** Formule de clôture consacrée, juste avant les blocs de signature. */
	enFoiDeQuoi: string;
	/** Ligne discrète fermant le document. */
	piedDePage: string;
	densite: Densite;
	/** Vrai lorsque la prose affichée provient de l'IA plutôt que de la saisie brute. */
	redigeParIA: boolean;
}
