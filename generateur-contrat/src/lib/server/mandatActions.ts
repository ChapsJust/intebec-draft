import { fail, redirect, type Action, type Actions } from '@sveltejs/kit';
import { createClient, updateClient } from './db/clients';
import { getMandat, saveMandat } from './db/mandats';
import { validateDraft } from '$lib/validation';
import { duplicateDraft } from '$lib/mandat';
import { parseMandatSubmission } from './mandatForm';
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

/** Actions de sauvegarde partagées entre /nouveau (création) et /mandats/[id] (édition) — le seul
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
		throw redirect(303, `/mandats/${record.id}?genere=1`);
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
	}
};

/** Duplique un mandat existant vers un nouveau brouillon — le raccourci le plus rapide pour un client récurrent. */
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
