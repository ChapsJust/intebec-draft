import type { BrouillonMandat } from './types';
import { totalLigne } from './montants';

export interface ErreurValidation {
	champ: string;
	message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function verifierMandat(brouillon: BrouillonMandat): ErreurValidation[] {
	const erreurs: ErreurValidation[] = [];

	if (!brouillon.client.nom.trim()) {
		erreurs.push({ champ: 'client.nom', message: 'Le nom du client est requis.' });
	}
	if (brouillon.client.courriel && !EMAIL_RE.test(brouillon.client.courriel)) {
		erreurs.push({ champ: 'client.courriel', message: 'Le courriel du client est invalide.' });
	}
	if (!brouillon.titre.trim()) {
		erreurs.push({ champ: 'titre', message: 'Le titre du projet est requis.' });
	}
	if (!brouillon.objet.trim()) {
		erreurs.push({ champ: 'objet', message: "L'objet du mandat est requis." });
	}

	if (brouillon.lignes.length === 0) {
		erreurs.push({ champ: 'lignes', message: 'Au moins une ligne de service est requise.' });
	}
	brouillon.lignes.forEach((ligne, i) => {
		if (!ligne.nom.trim()) {
			erreurs.push({
				champ: `lignes.${i}.nom`,
				message: `Le nom de la ligne ${i + 1} est requis.`
			});
		}
		if (!(totalLigne(ligne) > 0)) {
			erreurs.push({
				champ: `lignes.${i}.montant`,
				message: `Le montant de la ligne ${i + 1} doit être supérieur à 0.`
			});
		}
	});

	const { acomptePct, soldePct, delaiJoursSolde } = brouillon.modalitesPaiement;
	if (acomptePct < 0 || acomptePct > 100) {
		erreurs.push({
			champ: 'modalitesPaiement.acomptePct',
			message: "L'acompte doit être entre 0 et 100 %."
		});
	}
	// L'échéancier du document répartit le total entre acompte et solde : si les deux ne totalisent
	// pas 100 %, le contrat annonce un montant différent du total facturé. L'éditeur maintient
	// l'égalité tout seul, mais elle doit être vérifiée pour de bon, y compris sur un brouillon
	// enregistré avant que cette règle existe.
	else if (acomptePct + soldePct !== 100) {
		erreurs.push({
			champ: 'modalitesPaiement.soldePct',
			message: `L'acompte et le solde doivent totaliser 100 % (actuellement ${acomptePct + soldePct} %).`
		});
	}
	if (delaiJoursSolde < 0) {
		erreurs.push({
			champ: 'modalitesPaiement.delaiJoursSolde',
			message: 'Le délai de paiement du solde ne peut pas être négatif.'
		});
	}

	// Un rabais supérieur à 100 % rendrait le total négatif, c'est-à-dire un document où le
	// prestataire devrait de l'argent au client.
	const { rabaisPct } = brouillon.conditions;
	if (rabaisPct < 0 || rabaisPct > 100) {
		erreurs.push({
			champ: 'conditions.rabaisPct',
			message: 'Le rabais doit être entre 0 et 100 %.'
		});
	}

	if (brouillon.abonnement.actif && !(brouillon.abonnement.montant > 0)) {
		erreurs.push({
			champ: 'abonnement.montant',
			message: "Le montant de l'abonnement doit être supérieur à 0, ou décochez l'abonnement."
		});
	}

	return erreurs;
}

export function erreurDuChamp(erreurs: ErreurValidation[], champ: string): string | undefined {
	return erreurs.find((e) => e.champ === champ)?.message;
}
