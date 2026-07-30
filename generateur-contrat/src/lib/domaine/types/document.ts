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

export type StructureProjet = 'phases' | 'blocs' | 'recurrent';
