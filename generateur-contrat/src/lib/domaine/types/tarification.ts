export type ModeTarification = 'forfaitaire' | 'horaire' | 'quantite';

export interface LigneQuantite {
	id: string;
	description: string;
	quantite: number;
	prixUnitaire: number;
}

export interface LigneService {
	id: string;
	nom: string;
	description: string;
	inclus: string[];
	nonInclus: string[];
	pricingMode: ModeTarification;
	montantForfaitaire: number;
	tauxHoraire: number;
	heuresEstimees: number;
	items: LigneQuantite[];
	delaiEstime: string;
}

export interface ModalitesPaiement {
	acomptePct: number;
	soldePct: number;
	delaiJoursSolde: number;
}

export interface AbonnementRecurrent {
	actif: boolean;
	frequence: 'mensuel' | 'annuel';
	montant: number;
	couverture: string;
	periodeOfferteMois: number;
}
