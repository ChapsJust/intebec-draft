import { fail, redirect, type Action, type Actions } from '@sveltejs/kit';
import { createClient, updateClient } from './db/clients';
import {
	archiveMandat,
	deleteMandat,
	getMandat,
	saveMandat,
	saveRedaction,
	unarchiveMandat
} from './db/mandats';
import { validateDraft } from '$lib/validation';
import { duplicateDraft } from '$lib/mandat';
import { parseMandatSubmission } from './mandatForm';
import {
	OllamaIndisponibleError,
	auditerClauses,
	redigerChamp,
	redigerDocument,
	type CibleChamp
} from './ollama';
import type { DocumentStatus, MandatDraft } from '$lib/types';

async function persist(
	draft: MandatDraft,
	clientId: string | null,
	saveAsNewClient: boolean,
	statut: DocumentStatus,
	mandatId: string | undefined
) {
	let finalClientId = clientId;
	if (saveAsNewClient && !clientId) {
		const created = await createClient(draft.client);
		finalClientId = created.id;
	}
	return saveMandat(draft, { id: mandatId, clientId: finalClientId, statut });
}

/** Lance la passe de rédaction et la persiste. Renvoie `false` plutôt que de propager lorsque
 * l'IA locale est injoignable : la génération ne doit jamais échouer parce qu'Ollama est éteint,
 * le document déterministe reste valable et la rédaction est rejouable depuis l'aperçu. */
async function appliquerRedaction(id: string, draft: MandatDraft): Promise<boolean> {
	try {
		const redaction = await redigerDocument(draft);
		await saveRedaction(id, redaction);
		return true;
	} catch (err) {
		if (err instanceof OllamaIndisponibleError) return false;
		throw err;
	}
}

/** Actions de sauvegarde partagées entre /nouveau (création) et /mandats/[id] (édition) le seul
 * point de bascule entre les deux est `params.id`, absent sur la première et présent sur la seconde. */
export const mandatActions: Actions = {
	enregistrer: async ({ request, params }) => {
		const { draft, clientId, saveAsNewClient } = await parseMandatSubmission(request);
		const record = await persist(draft, clientId, saveAsNewClient, 'brouillon', params.id);
		throw redirect(303, `/mandats/${record.id}?saved=1`);
	},

	generer: async ({ request, params }) => {
		const { draft, clientId, saveAsNewClient } = await parseMandatSubmission(request);
		const errors = validateDraft(draft);
		if (errors.length > 0) {
			return fail(400, {
				message: 'Le document contient des erreurs à corriger avant de pouvoir être généré.'
			});
		}
		const record = await persist(draft, clientId, saveAsNewClient, 'genere', params.id);

		// Générer, c'est rédiger : la passe IA adapte la prose au client dans la foulée, sans
		// deuxième clic. Si l'IA est injoignable on livre quand même le document déterministe,
		// signalé à l'aperçu, où la rédaction reste relançable.
		const iaReussie = await appliquerRedaction(record.id, draft);
		throw redirect(303, `/mandats/${record.id}/apercu${iaReussie ? '' : '?ia=indisponible'}`);
	},

	updateClient: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id');
		const payload = data.get('payload');
		if (typeof id !== 'string' || typeof payload !== 'string') {
			return fail(400, { message: 'Requête invalide.' });
		}
		await updateClient(id, JSON.parse(payload));
		return { message: 'Fiche client mise à jour.' };
	},

	/** Relit le volet contractuel et renvoie ce qui semble manquer. Comme `redigerChamp`, ne
	 * persiste rien : aucune clause n'est activée sans un geste de l'utilisateur. */
	auditerClauses: async ({ request }) => {
		const data = await request.formData();
		const payload = data.get('payload');
		if (typeof payload !== 'string') {
			return fail(400, { ok: false, message: 'Requête invalide.' });
		}

		const draft = JSON.parse(payload) as MandatDraft;
		try {
			return { ok: true, audit: await auditerClauses(draft), message: '' };
		} catch (err) {
			if (err instanceof OllamaIndisponibleError) {
				return fail(503, { ok: false, message: err.message });
			}
			throw err;
		}
	},

	/** Aide ponctuelle pendant la saisie : renvoie une proposition pour un seul champ, sans rien
	 * persister. C'est l'utilisateur qui décide de l'appliquer ou non. */
	redigerChamp: async ({ request }) => {
		const data = await request.formData();
		const payload = data.get('payload');
		const champ = data.get('champ');
		if (typeof payload !== 'string' || typeof champ !== 'string') {
			return fail(400, { ok: false, champ: '', message: 'Requête invalide.' });
		}

		const draft = JSON.parse(payload) as MandatDraft;
		const cible: CibleChamp = champ === 'objet' ? { kind: 'objet' } : { kind: 'ligne', id: champ };

		try {
			const texte = await redigerChamp(draft, cible);
			return { ok: true, champ, texte, message: '' };
		} catch (err) {
			if (err instanceof OllamaIndisponibleError) {
				return fail(503, { ok: false, champ, message: err.message });
			}
			throw err;
		}
	}
};

/** Relance manuelle de la rédaction sur un mandat déjà enregistré, pour reprendre après une IA
 * injoignable ou simplement retenter une autre formulation. La prose est stockée dans la colonne
 * `redaction`, à côté du draft : la saisie reste intacte et l'opération est rejouable. */
export const redigerDocumentAction: Action = async ({ params }) => {
	const id = params.id;
	if (!id) return fail(400, { ok: false, message: 'Identifiant manquant.' });

	const existing = await getMandat(id);
	if (!existing) return fail(404, { ok: false, message: 'Mandat introuvable.' });

	try {
		const redaction = await redigerDocument(existing.draft);
		await saveRedaction(id, redaction);
		return { ok: true, message: 'Document rédigé par l’IA locale.' };
	} catch (err) {
		if (err instanceof OllamaIndisponibleError) {
			return fail(503, { ok: false, message: err.message });
		}
		throw err;
	}
};

/** Revient à la saisie brute en effaçant la prose générée. */
export const effacerRedactionAction: Action = async ({ params }) => {
	const id = params.id;
	if (!id) return fail(400, { ok: false, message: 'Identifiant manquant.' });
	await saveRedaction(id, null);
	return { ok: true, message: 'Retour à votre saisie.' };
};

/** Duplique un mandat existant vers un nouveau brouillon le raccourci le plus rapide pour un client récurrent. */
export const duplicateMandatAction: Action = async ({ request }) => {
	const data = await request.formData();
	const id = data.get('id');
	if (typeof id !== 'string') return fail(400, { message: 'Identifiant manquant.' });

	const existing = await getMandat(id);
	if (!existing) return fail(404, { message: 'Mandat introuvable.' });

	const draft = duplicateDraft(existing.draft);
	const record = await saveMandat(draft, { clientId: existing.clientId, statut: 'brouillon' });
	throw redirect(303, `/mandats/${record.id}`);
};

/** Cible du geste, toujours postée explicitement : ces actions vivent aussi sur la fiche client,
 * où `params.id` désigne le client et ferait donc une cible fausse. */
async function cibleMandat(request: Request): Promise<string | null> {
	const poste = (await request.formData()).get('id');
	return typeof poste === 'string' && poste ? poste : null;
}

export const archiveMandatAction: Action = async ({ request }) => {
	const id = await cibleMandat(request);
	if (!id) return fail(400, { notice: 'Identifiant manquant.' });
	await archiveMandat(id);
	return { notice: 'Mandat archivé.' };
};

export const unarchiveMandatAction: Action = async ({ request }) => {
	const id = await cibleMandat(request);
	if (!id) return fail(400, { notice: 'Identifiant manquant.' });
	await unarchiveMandat(id);
	return { notice: 'Mandat désarchivé.' };
};

/** Suppression définitive d'un mandat. Si c'est celui qu'on est en train d'éditer, la page n'existe
 * plus après coup : on renvoie à l'accueil plutôt que de laisser un 404. */
export const deleteMandatAction: Action = async ({ request, params }) => {
	const id = await cibleMandat(request);
	if (!id) return fail(400, { notice: 'Identifiant manquant.' });
	await deleteMandat(id);
	if (params.id === id) throw redirect(303, '/');
	return { notice: 'Mandat supprimé.' };
};
