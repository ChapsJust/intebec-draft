import { fail, redirect, type Action, type Actions } from '@sveltejs/kit';
import { creerClient, modifierClient } from './db/clients';
import { creerClauseBibliotheque, listerClausesBibliotheque } from './db/clauses';
import {
	archiverMandat,
	supprimerMandat,
	obtenirMandat,
	enregistrerMandat,
	enregistrerRedaction,
	changerStatutMandat,
	desarchiverMandat
} from './db/mandats';
import { verifierMandat } from '$lib/validation';
import { empreinteProse } from '$lib/document/sections';
import { dupliquerMandat } from '$lib/mandat';
import { SoumissionInvalideError, lireMandat, lireSoumissionMandat } from './mandatForm';
import { idPoste } from './formulaire';
import {
	OllamaIndisponibleError,
	auditerClauses,
	redigerChamp,
	redigerDocument,
	type CibleChamp
} from './ollama';
import type { StatutDocument, BrouillonMandat, MandatEnregistre } from '$lib/types';

/** Statuts qu'une requête a le droit de poser. `brouillon` n'y figure pas : on ne revient pas en
 * arrière sur un document déjà sorti. */
const STATUTS_POSABLES: StatutDocument[] = ['genere', 'envoye'];

/** Même plafond que celui appliqué au brouillon : le titre d'une clause devient un titre d'article. */
const MAX_TITRE_CLAUSE = 200;

async function persist(
	brouillon: BrouillonMandat,
	clientId: string | null,
	enregistrerNouveauClient: boolean,
	statut: StatutDocument,
	mandatId: string | undefined
): Promise<MandatEnregistre | null> {
	let finalClientId = clientId;
	if (enregistrerNouveauClient && !clientId) {
		const created = await creerClient(brouillon.client);
		finalClientId = created.id;
	}
	return enregistrerMandat(brouillon, { id: mandatId, clientId: finalClientId, statut });
}

/** Message rendu quand le mandat visé n'existe plus. Le cas arrive vraiment : deux onglets
 * ouverts, suppression dans l'un, enregistrement dans l'autre. */
const INTROUVABLE =
	"Ce mandat n'existe plus. Il a probablement été supprimé depuis un autre onglet.";

/** Actions de sauvegarde partagées entre /nouveau (création) et /mandats/[id] (édition) : le seul
 * point de bascule entre les deux est `params.id`, absent sur la première et présent sur la seconde. */
export const mandatActions: Actions = {
	enregistrer: async ({ request, params }) => {
		let soumission;
		try {
			soumission = await lireSoumissionMandat(request);
		} catch (err) {
			if (err instanceof SoumissionInvalideError) return fail(400, { message: err.message });
			throw err;
		}

		const { brouillon, clientId, enregistrerNouveauClient } = soumission;
		const record = await persist(
			brouillon,
			clientId,
			enregistrerNouveauClient,
			'brouillon',
			params.id
		);
		if (!record) return fail(404, { message: INTROUVABLE });
		throw redirect(303, `/mandats/${record.id}?saved=1`);
	},

	generer: async ({ request, params }) => {
		let soumission;
		try {
			soumission = await lireSoumissionMandat(request);
		} catch (err) {
			if (err instanceof SoumissionInvalideError) return fail(400, { message: err.message });
			throw err;
		}

		const { brouillon, clientId, enregistrerNouveauClient } = soumission;
		const erreurs = verifierMandat(brouillon);
		if (erreurs.length > 0) {
			return fail(400, {
				message: 'Le document contient des erreurs à corriger avant de pouvoir être généré.'
			});
		}

		const record = await persist(
			brouillon,
			clientId,
			enregistrerNouveauClient,
			'genere',
			params.id
		);
		if (!record) return fail(404, { message: INTROUVABLE });

		// « Générer » veut dire « produis le document à partir de ma saisie actuelle ». Une rédaction
		// dérivée d'une version antérieure est donc à jeter : sans cela, on modifiait le mandat, on
		// relançait « Générer », et l'aperçu affichait imperturbablement la prose d'avant, puisque
		// `redactionAFaire` se tait dès qu'une rédaction existe. La modification semblait perdue.
		//
		// On ne conserve la rédaction que si l'on peut **prouver** qu'elle correspond encore à la
		// saisie. Une rédaction sans empreinte est antérieure à ce mécanisme : sa fraîcheur est
		// indémontrable, et sur une demande explicite de génération, mieux vaut la refaire que
		// réafficher une prose peut-être périmée. La bannière de l'aperçu, elle, se tait dans ce cas :
		// alarmer sur tous les documents déjà générés n'aiderait personne.
		//
		// Régénérer un mandat inchangé conserve donc la rédaction et les passages déjà arbitrés, au
		// lieu de les redemander à l'IA. Pour seulement relire le document, il y a « Voir le document ».
		const redactionAJour = record.redaction?.empreinte === empreinteProse(record.brouillon);
		if (record.redaction && !redactionAJour) {
			await enregistrerRedaction(record.id, null);
		}

		// La passe de rédaction n'est plus faite ici. Elle prend jusqu'à quatre minutes quand le
		// modèle doit être rechargé, et l'enregistrement se retrouvait suspendu à sa durée : un
		// proxy ou le navigateur abandonnait avant la fin, l'utilisateur voyait une erreur réseau
		// alors que le mandat, lui, était bien enregistré. L'aperçu la déclenche maintenant dans sa
		// propre requête, avec un état visible et une annulation possible.
		throw redirect(303, `/mandats/${record.id}/apercu?rediger=1`);
	},

	modifierClient: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id');
		const payload = data.get('payload');
		if (typeof id !== 'string' || typeof payload !== 'string') {
			return fail(400, { message: 'Requête invalide.' });
		}

		let champs: unknown;
		try {
			champs = JSON.parse(payload);
		} catch {
			return fail(400, { message: "La fiche client n'a pas pu être lue." });
		}

		const record = await modifierClient(id, champs as Record<string, string>);
		if (!record) return fail(404, { message: "Cette fiche client n'existe plus." });
		return { message: 'Fiche client mise à jour.' };
	},

	/** Relit le volet contractuel et renvoie ce qui semble manquer. Ne persiste rien : aucune
	 * clause n'est activée sans un geste de l'utilisateur.
	 *
	 * La bibliothèque est transmise au modèle pour qu'il propose d'y puiser plutôt que de rédiger une
	 * variante de plus d'une protection déjà retenue ailleurs. */
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
	 * en pousse ensuite une copie figée dans le mandat. Aucun appel à l'IA ici, donc pas de 503 : le
	 * texte a déjà été rédigé, il ne s'agit que de le conserver. */
	retenirProposition: async ({ request }) => {
		const data = await request.formData();
		const titre = data.get('titre');
		const corps = data.get('corps');

		if (typeof titre !== 'string' || typeof corps !== 'string') {
			return fail(400, { ok: false, message: 'Requête invalide.' });
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

	/** Aide ponctuelle pendant la saisie : renvoie une proposition pour un seul champ, sans rien
	 * persister. C'est l'utilisateur qui décide de l'appliquer ou non. */
	redigerChamp: async ({ request }) => {
		const data = await request.formData();
		const champ = data.get('champ');
		if (typeof champ !== 'string') {
			return fail(400, { ok: false, champ: '', message: 'Requête invalide.' });
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

/** Passe de rédaction sur un mandat déjà enregistré. C'est le seul chemin qui appelle l'IA pour le
 * document entier : déclenché par l'aperçu, il a sa propre requête et son propre état d'attente.
 * La prose va dans la colonne `redaction`, à côté du brouillon, donc l'opération est rejouable. */
export const redigerDocumentAction: Action = async ({ params }) => {
	const id = params.id;
	if (!id) return fail(400, { ok: false, message: 'Identifiant manquant.' });

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
 * On enregistre la décision, pas son résultat : le texte affiché est recomposé à la lecture par
 * `texteEffectif`, donc la saisie et la prose du modèle restent l'une et l'autre intactes, et un
 * refus se défait. C'est aussi ce qui fait suivre le PDF sans qu'il ait à connaître les refus, la
 * génération passant par le même `construireDocument`. */
export const basculerPassageAction: Action = async ({ request, params }) => {
	const id = params.id;
	if (!id) return fail(400, { ok: false, message: 'Identifiant manquant.' });

	const data = await request.formData();
	const champ = data.get('champ');
	const index = Number(data.get('index'));
	const refuse = data.get('refuse') === '1';

	if (typeof champ !== 'string' || !champ) {
		return fail(400, { ok: false, message: 'Requête invalide.' });
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

	// Un champ sans refus perd sa clé plutôt que de garder un tableau vide : `refuses` reste ainsi la
	// liste de ce qui a été écarté, lisible telle quelle en base.
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
	if (!id) return fail(400, { ok: false, message: 'Identifiant manquant.' });
	if (!(await enregistrerRedaction(id, null))) {
		return fail(404, { ok: false, message: INTROUVABLE });
	}
	return { ok: true, message: 'Retour à votre saisie.' };
};

/** Marque un document comme envoyé, ou le ramène à « généré ». Le statut est purement déclaratif :
 * l'application n'envoie rien elle-même, elle enregistre que vous l'avez fait. */
export const changerStatutAction: Action = async ({ request, params }) => {
	const data = await request.formData();
	const statut = data.get('statut');
	const id = params.id;

	if (!id) return fail(400, { ok: false, message: 'Identifiant manquant.' });
	if (typeof statut !== 'string' || !STATUTS_POSABLES.includes(statut as StatutDocument)) {
		return fail(400, { ok: false, message: 'Statut inconnu.' });
	}

	if (!(await changerStatutMandat(id, statut as StatutDocument))) {
		return fail(404, { ok: false, message: INTROUVABLE });
	}
	return {
		ok: true,
		message: statut === 'envoye' ? 'Document marqué comme envoyé.' : 'Document remis en « généré ».'
	};
};

/** Duplique un mandat existant vers un nouveau brouillon : le raccourci le plus rapide pour un
 * client récurrent. */
export const dupliquerMandatAction: Action = async ({ request }) => {
	const id = await idPoste(request);
	if (!id) return fail(400, { message: 'Identifiant manquant.' });

	const existing = await obtenirMandat(id);
	if (!existing) return fail(404, { message: 'Mandat introuvable.' });

	const brouillon = dupliquerMandat(existing.brouillon);
	const record = await enregistrerMandat(brouillon, {
		clientId: existing.clientId,
		statut: 'brouillon'
	});
	if (!record) return fail(500, { message: 'La copie du mandat a échoué.' });
	throw redirect(303, `/mandats/${record.id}`);
};

export const archiverMandatAction: Action = async ({ request }) => {
	const id = await idPoste(request);
	if (!id) return fail(400, { notice: 'Identifiant manquant.' });
	if (!(await archiverMandat(id))) {
		return fail(404, { notice: 'Ce mandat est introuvable, ou déjà archivé.' });
	}
	return { notice: 'Mandat archivé.' };
};

export const desarchiverMandatAction: Action = async ({ request }) => {
	const id = await idPoste(request);
	if (!id) return fail(400, { notice: 'Identifiant manquant.' });
	if (!(await desarchiverMandat(id))) return fail(404, { notice: 'Mandat introuvable.' });
	return { notice: 'Mandat désarchivé.' };
};

/** Suppression définitive d'un mandat. Si c'est celui qu'on est en train d'éditer, la page n'existe
 * plus après coup : on renvoie à l'accueil plutôt que de laisser un 404. */
export const supprimerMandatAction: Action = async ({ request, params }) => {
	const id = await idPoste(request);
	if (!id) return fail(400, { notice: 'Identifiant manquant.' });
	if (!(await supprimerMandat(id))) return fail(404, { notice: 'Mandat introuvable.' });
	if (params.id === id) throw redirect(303, '/');
	return { notice: 'Mandat supprimé.' };
};
