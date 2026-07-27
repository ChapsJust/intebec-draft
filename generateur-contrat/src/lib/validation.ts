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

	const { acomptePct } = draft.modalitesPaiement;
	if (acomptePct < 0 || acomptePct > 100) {
		errors.push({
			field: 'modalitesPaiement.acomptePct',
			message: "L'acompte doit être entre 0 et 100 %."
		});
	}

	return errors;
}

export function fieldError(errors: ValidationError[], field: string): string | undefined {
	return errors.find((e) => e.field === field)?.message;
}
