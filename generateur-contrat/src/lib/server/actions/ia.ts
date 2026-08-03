/** Actions qui font appel à l'IA locale, ou qui arbitrent ce qu'elle a produit. Toutes traduisent
 * `OllamaIndisponibleError` en 503, le code qui dit « réessayez » là où un 400 dit « corrigez ».
 */
import { fail, type Action, type Actions } from '@sveltejs/kit';
import { creerClauseBibliotheque, listerClausesBibliotheque } from '$serveur/db/clauses';
import { obtenirMandat, enregistrerRedaction } from '$serveur/db/mandats';
import { SoumissionInvalideError, lireMandat } from '$serveur/mandat/formulaire';
import {
	OllamaIndisponibleError,
	auditerClauses,
	redigerChamp,
	redigerDocument,
	type CibleChamp
} from '$serveur/ia';
import type { BrouillonMandat } from '$domaine/types';
import { ID_MANQUANT, INTROUVABLE, REQUETE_INVALIDE } from './messages';

/** Même plafond que celui appliqué au brouillon : le titre d'une clause devient un titre d'article. */
const MAX_TITRE_CLAUSE = 200;

/** Actions déclenchées depuis l'éditeur pendant la saisie. Aucune ne persiste le mandat : elles
 * renvoient une proposition que l'utilisateur applique ou non. */
export const actionsIaEditeur: Actions = {
	/** Relit le volet contractuel et renvoie ce qui semble manquer. La bibliothèque est transmise au
	 * modèle pour qu'il y puise plutôt que de rédiger une variante de plus. */
	auditerClauses: async ({ request }) => {
		const data = await request.formData();

		let brouillon: BrouillonMandat;
		try {
			brouillon = lireMandat(data.get('payload'));
		} catch (err) {
			if (err instanceof SoumissionInvalideError) {
				return fail(400, { ok: false, message: err.message });
			}
			throw err;
		}

		try {
			const bibliotheque = await listerClausesBibliotheque();
			return { ok: true, audit: await auditerClauses(brouillon, bibliotheque), message: '' };
		} catch (err) {
			if (err instanceof OllamaIndisponibleError) {
				return fail(503, { ok: false, message: err.message });
			}
			throw err;
		}
	},

	/** Retient une clause proposée par une relecture : elle entre dans la bibliothèque, et l'éditeur
	 * en pousse ensuite une copie figée dans le mandat. Aucun appel à l'IA ici, donc pas de 503. */
	retenirProposition: async ({ request }) => {
		const data = await request.formData();
		const titre = data.get('titre');
		const corps = data.get('corps');

		if (typeof titre !== 'string' || typeof corps !== 'string') {
			return fail(400, { ok: false, message: REQUETE_INVALIDE });
		}
		if (!titre.trim() || !corps.trim()) {
			return fail(400, { ok: false, message: 'Une clause a besoin d’un titre et d’un texte.' });
		}

		const clause = await creerClauseBibliotheque({
			titre: titre.trim().slice(0, MAX_TITRE_CLAUSE),
			corps: corps.trim(),
			origine: 'ia'
		});
		return { ok: true, clause, message: 'Clause ajoutée à votre bibliothèque.' };
	},

	/** Aide ponctuelle : une proposition pour un seul champ, sans rien persister. */
	redigerChamp: async ({ request }) => {
		const data = await request.formData();
		const champ = data.get('champ');
		if (typeof champ !== 'string') {
			return fail(400, { ok: false, champ: '', message: REQUETE_INVALIDE });
		}

		let brouillon: BrouillonMandat;
		try {
			brouillon = lireMandat(data.get('payload'));
		} catch (err) {
			if (err instanceof SoumissionInvalideError) {
				return fail(400, { ok: false, champ, message: err.message });
			}
			throw err;
		}

		const cible: CibleChamp = champ === 'objet' ? { kind: 'objet' } : { kind: 'ligne', id: champ };

		try {
			const texte = await redigerChamp(brouillon, cible);
			return { ok: true, champ, texte, message: '' };
		} catch (err) {
			if (err instanceof OllamaIndisponibleError) {
				return fail(503, { ok: false, champ, message: err.message });
			}
			throw err;
		}
	}
};

/** Passe de rédaction sur un mandat enregistré : le seul chemin qui appelle l'IA pour le document
 * entier. La prose va dans la colonne `redaction`, donc l'opération est rejouable. */
export const redigerDocumentAction: Action = async ({ params }) => {
	const id = params.id;
	if (!id) return fail(400, { ok: false, message: ID_MANQUANT });

	const existing = await obtenirMandat(id);
	if (!existing) return fail(404, { ok: false, message: 'Mandat introuvable.' });

	try {
		const redaction = await redigerDocument(existing.brouillon);
		if (!(await enregistrerRedaction(id, redaction))) {
			return fail(404, { ok: false, message: INTROUVABLE });
		}
		return { ok: true, message: 'Document rédigé par l’IA locale.' };
	} catch (err) {
		if (err instanceof OllamaIndisponibleError) {
			return fail(503, { ok: false, message: err.message });
		}
		throw err;
	}
};

/** Garde ou rejette un passage réécrit par l'IA. On enregistre la décision, pas son résultat :
 * `texteEffectif` recompose le texte à la lecture, donc un refus se défait et le PDF le suit sans
 * rien connaître. */
export const basculerPassageAction: Action = async ({ request, params }) => {
	const id = params.id;
	if (!id) return fail(400, { ok: false, message: ID_MANQUANT });

	const data = await request.formData();
	const champ = data.get('champ');
	const index = Number(data.get('index'));
	const refuse = data.get('refuse') === '1';

	if (typeof champ !== 'string' || !champ) {
		return fail(400, { ok: false, message: REQUETE_INVALIDE });
	}
	if (!Number.isInteger(index) || index < 0) {
		return fail(400, { ok: false, message: 'Passage inconnu.' });
	}

	const existing = await obtenirMandat(id);
	if (!existing) return fail(404, { ok: false, message: INTROUVABLE });
	if (!existing.redaction) {
		return fail(409, { ok: false, message: 'Ce document n’a pas de rédaction à réviser.' });
	}

	const refuses = { ...(existing.redaction.refuses ?? {}) };
	const actuels = new Set(refuses[champ] ?? []);
	if (refuse) actuels.add(index);
	else actuels.delete(index);

	// Un champ sans refus perd sa clé : `refuses` reste la liste de ce qui a été écarté, lisible
	// telle quelle en base.
	if (actuels.size > 0) refuses[champ] = [...actuels].sort((a, b) => a - b);
	else delete refuses[champ];

	const redaction = { ...existing.redaction, refuses };
	if (!(await enregistrerRedaction(id, redaction))) {
		return fail(404, { ok: false, message: INTROUVABLE });
	}
	return {
		ok: true,
		message: refuse ? 'Passage revenu à votre saisie.' : 'Passage de l’IA conservé.'
	};
};

/** Revient à la saisie brute en effaçant la prose générée. */
export const effacerRedactionAction: Action = async ({ params }) => {
	const id = params.id;
	if (!id) return fail(400, { ok: false, message: ID_MANQUANT });
	if (!(await enregistrerRedaction(id, null))) {
		return fail(404, { ok: false, message: INTROUVABLE });
	}
	return { ok: true, message: 'Retour à votre saisie.' };
};
