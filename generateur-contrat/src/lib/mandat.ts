import type {
	CoordonneesClient,
	FicheClient,
	TypeDocument,
	BrouillonMandat,
	LigneService
} from './types';

export function nouveauClient(): CoordonneesClient {
	return {
		nom: '',
		typeClient: 'entreprise',
		adresse: '',
		representantNom: '',
		representantTitre: '',
		courriel: '',
		telephone: '',
		siteWeb: '',
		numeroEntreprise: ''
	};
}

/** Ne garde que les champs de contrat d'un client persisté : exclut id/notes/dates. */
export function coordonneesDuClient(record: FicheClient): CoordonneesClient {
	const {
		nom,
		typeClient,
		adresse,
		representantNom,
		representantTitre,
		courriel,
		telephone,
		siteWeb,
		numeroEntreprise
	} = record;
	return {
		nom,
		typeClient,
		adresse,
		representantNom,
		representantTitre,
		courriel,
		telephone,
		siteWeb,
		numeroEntreprise
	};
}

export function nouvelleLigne(): LigneService {
	return {
		id: crypto.randomUUID(),
		nom: '',
		description: '',
		inclus: [''],
		nonInclus: [],
		pricingMode: 'forfaitaire',
		montantForfaitaire: 0,
		tauxHoraire: 0,
		heuresEstimees: 0,
		items: [],
		delaiEstime: ''
	};
}

export function nouveauMandat(type: TypeDocument = 'soumission'): BrouillonMandat {
	return {
		type,
		titre: '',
		structureProjet: 'blocs',
		objet: '',
		client: nouveauClient(),
		lignes: [nouvelleLigne()],
		modalitesPaiement: { acomptePct: 50, soldePct: 50, delaiJoursSolde: 30 },
		abonnement: {
			actif: false,
			frequence: 'annuel',
			montant: 0,
			couverture: '',
			periodeOfferteMois: 0
		},
		conditions: {
			heuresFormationIncluses: 2,
			dureeGarantieJours: 30,
			dureeSupportMois: 12,
			tauxHoraireHorsPerimetre: 0,
			preavisResiliationJours: 30,
			rabaisPct: 0,
			rabaisMotif: '',
			clauses: {
				confidentialite: true,
				limitationResponsabilite: true,
				propriete: true,
				litiges: true,
				signatureElectronique: true
			},
			notesAdditionnelles: ''
		},
		dateSignature: new Date().toISOString().slice(0, 10),
		lieuSignature: 'Victoriaville',
		representantIntebecNom: 'Justin Chaput',
		representantIntebecTitre: 'Président'
	};
}

/** Copie pour repartir d'un mandat existant sans partager de référence avec l'original. */
export function dupliquerMandat(brouillon: BrouillonMandat): BrouillonMandat {
	const copy = structuredClone(brouillon);
	copy.lignes = copy.lignes.map((ligne) => ({ ...ligne, id: crypto.randomUUID() }));
	copy.dateSignature = new Date().toISOString().slice(0, 10);
	return copy;
}
