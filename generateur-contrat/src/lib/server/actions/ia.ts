/** Les actions qui appellent l'IA locale, ou qui gèrent ce qu'elle a produit.
 *
 * Elles traduisent toutes `OllamaIndisponibleError` en 503 plutôt qu'en 500. La nuance compte pour
 * l'utilisateur : 503 veut dire « réessayez », alors qu'un 400 voudrait dire « corrigez votre
 * saisie » et qu'un 500 voudrait dire « c'est un bogue chez nous ».
 */
import { fail, type Action, type Actions } from '@sveltejs/kit';
import { creerClauseBibliotheque, listerClausesBibliotheque } from '$serveur/db/clauses';
import { obtenirMandat, enregistrerRedaction } from '$serveur/db/mandats';
import { SoumissionInvalideError, lireMandat } from '$serveur/mandat/formulaire';
import {
	OllamaIndisponibleError,
	auditerClauses,
	proposerPuces,
	redigerChamp,
	redigerDocument,
	revoirMandat,
	type CibleChamp
} from '$serveur/ia';
import type { BrouillonMandat } from '$domaine/types';
import { ID_MANQUANT, INTROUVABLE, REQUETE_INVALIDE } from './messages';

/** Même plafond que celui appliqué au brouillon : le titre d'une clause devient un titre d'article. */
const MAX_TITRE_CLAUSE = 200;

/** Les champs de prose sont désignés par un mot-clé, les lignes par leur identifiant. Il ne peut pas
 * y avoir de collision entre les deux : un identifiant de ligne est toujours un UUID, donc jamais
 * « titre » ou « objet ». */
function cibleDuChamp(champ: string): CibleChamp {
	if (champ === 'titre') return { kind: 'titre' };
	if (champ === 'objet') return { kind: 'objet' };
	if (champ === 'couverture') return { kind: 'couverture' };
	if (champ === 'notes') return { kind: 'notes' };
	return { kind: 'ligne', id: champ };
}

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

	/** Relit le fond du mandat et renvoie ce qui ne se tient pas. Ne persiste rien : l'utilisateur
	 * corrige lui-même, l'IA n'ayant aucun moyen de savoir ce qu'il a voulu écrire. */
	revoirMandat: async ({ request }) => {
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
			return { ok: true, revue: await revoirMandat(brouillon), message: '' };
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

		try {
			const texte = await redigerChamp(brouillon, cibleDuChamp(champ));
			return { ok: true, champ, texte, message: '' };
		} catch (err) {
			if (err instanceof OllamaIndisponibleError) {
				return fail(503, { ok: false, champ, message: err.message });
			}
			throw err;
		}
	},

	/** Complète une liste d'inclus ou d'exclusions. Renvoie des éléments à cocher, pas un texte : la
	 * décision reste puce par puce. */
	proposerPuces: async ({ request }) => {
		const data = await request.formData();
		const champ = data.get('champ');
		const liste = data.get('liste');

		if (typeof champ !== 'string' || !champ) {
			return fail(400, { ok: false, champ: '', items: [], message: REQUETE_INVALIDE });
		}
		if (liste !== 'inclus' && liste !== 'nonInclus') {
			return fail(400, { ok: false, champ, items: [], message: REQUETE_INVALIDE });
		}

		let brouillon: BrouillonMandat;
		try {
			brouillon = lireMandat(data.get('payload'));
		} catch (err) {
			if (err instanceof SoumissionInvalideError) {
				return fail(400, { ok: false, champ, items: [], message: err.message });
			}
			throw err;
		}

		try {
			const items = await proposerPuces(brouillon, { kind: liste, id: champ });
			return { ok: true, champ, items, message: '' };
		} catch (err) {
			if (err instanceof OllamaIndisponibleError) {
				return fail(503, { ok: false, champ, items: [], message: err.message });
			}
			throw err;
		}
	}
};

/** Passe de rédaction sur un mandat déjà enregistré. C'est le seul endroit qui demande à l'IA de
 * rédiger le document au complet.
 *
 * La prose va dans sa propre colonne `redaction`, à côté de la saisie et jamais par-dessus. On peut
 * donc relancer autant de fois qu'on veut, ou tout effacer, sans jamais perdre ce que
 * l'utilisateur a écrit. */
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

/** Garde ou rejette un passage réécrit par l'IA.
 *
 * Le point important : on enregistre la décision, pas le texte qui en résulte. C'est
 * `texteEffectif` qui recompose le texte au moment de l'afficher. Conséquence, un refus se défait
 * d'un clic, et le PDF suit automatiquement sans rien connaître de tout ça. */
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

	// Quand un champ n'a plus aucun refus, on enlève sa clé au lieu de laisser un tableau vide.
	// `refuses` reste ainsi la liste de ce qui a été écarté, lisible telle quelle en base.
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
