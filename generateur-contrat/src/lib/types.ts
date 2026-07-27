export type DocumentType = 'soumission' | 'contrat';

export type DocumentStatus = 'brouillon' | 'genere' | 'envoye';

export interface DocumentSummary {
	id: string;
	title: string;
	client: string;
	type: DocumentType;
	status: DocumentStatus;
	updatedAt: string; // ISO date
}
