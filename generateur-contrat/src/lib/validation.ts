import type { MandatDraft } from './types';
import { lineTotal } from './pricing';

export interface ValidationError {
	field: string;
	message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateDraft(draft: MandatDraft): ValidationError[] {
	const errors: ValidationError[] = [];

	if (!draft.client.nom.trim()) {
		errors.push({ field: 'client.nom', message: 'Le nom du client est requis.' });
	}
	if (draft.client.courriel && !EMAIL_RE.test(draft.client.courriel)) {
		errors.push({ field: 'client.courriel', message: 'Le courriel du client est invalide.' });
	}
	if (!draft.titre.trim()) {
		errors.push({ field: 'titre', message: 'Le titre du projet est requis.' });
	}
	if (!draft.objet.trim()) {
		errors.push({ field: 'objet', message: "L'objet du mandat est requis." });
	}

	if (draft.lignes.length === 0) {
		errors.push({ field: 'lignes', message: 'Au moins une ligne de service est requise.' });
	}
	draft.lignes.forEach((ligne, i) => {
		if (!ligne.nom.trim()) {
			errors.push({ field: `lignes.${i}.nom`, message: `Le nom de la ligne ${i + 1} est requis.` });
		}
		if (!(lineTotal(ligne) > 0)) {
			errors.push({
				field: `lignes.${i}.montant`,
				message: `Le montant de la ligne ${i + 1} doit être supérieur à 0.`
			});
		}
	});

	const { acomptePct, soldePct, delaiJoursSolde } = draft.modalitesPaiement;
	if (acomptePct < 0 || acomptePct > 100) {
		errors.push({
			field: 'modalitesPaiement.acomptePct',
			message: "L'acompte doit être entre 0 et 100 %."
		});
	}
	// L'échéancier du document répartit le total entre acompte et solde : si les deux ne totalisent
	// pas 100 %, le contrat annonce un montant différent du total facturé. L'éditeur maintient
	// l'égalité tout seul, mais elle doit être vérifiée pour de bon, y compris sur un brouillon
	// enregistré avant que cette règle existe.
	else if (acomptePct + soldePct !== 100) {
		errors.push({
			field: 'modalitesPaiement.soldePct',
			message: `L'acompte et le solde doivent totaliser 100 % (actuellement ${acomptePct + soldePct} %).`
		});
	}
	if (delaiJoursSolde < 0) {
		errors.push({
			field: 'modalitesPaiement.delaiJoursSolde',
			message: 'Le délai de paiement du solde ne peut pas être négatif.'
		});
	}

	// Un rabais supérieur à 100 % rendrait le total négatif, c'est-à-dire un document où le
	// prestataire devrait de l'argent au client.
	const { rabaisPct } = draft.conditions;
	if (rabaisPct < 0 || rabaisPct > 100) {
		errors.push({
			field: 'conditions.rabaisPct',
			message: 'Le rabais doit être entre 0 et 100 %.'
		});
	}

	if (draft.abonnement.actif && !(draft.abonnement.montant > 0)) {
		errors.push({
			field: 'abonnement.montant',
			message: "Le montant de l'abonnement doit être supérieur à 0, ou décochez l'abonnement."
		});
	}

	return errors;
}

export function fieldError(errors: ValidationError[], field: string): string | undefined {
	return errors.find((e) => e.field === field)?.message;
}
