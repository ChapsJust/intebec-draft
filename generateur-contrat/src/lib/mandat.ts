import type { ClientInfo, ClientRecord, DocumentType, MandatDraft, ServiceLine } from './types';

export function createEmptyClient(): ClientInfo {
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
export function clientRecordToInfo(record: ClientRecord): ClientInfo {
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

export function createEmptyLigne(): ServiceLine {
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

export function createEmptyDraft(type: DocumentType = 'soumission'): MandatDraft {
	return {
		type,
		titre: '',
		structureProjet: 'blocs',
		objet: '',
		client: createEmptyClient(),
		lignes: [createEmptyLigne()],
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
export function duplicateDraft(draft: MandatDraft): MandatDraft {
	const copy = structuredClone(draft);
	copy.lignes = copy.lignes.map((ligne) => ({ ...ligne, id: crypto.randomUUID() }));
	copy.dateSignature = new Date().toISOString().slice(0, 10);
	return copy;
}
