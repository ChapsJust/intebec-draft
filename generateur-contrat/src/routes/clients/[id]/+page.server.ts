import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getClient, archiveClient } from '$lib/server/db/clients';
import { listMandats } from '$lib/server/db/mandats';
import { duplicateMandatAction } from '$lib/server/mandatActions';

export const load: PageServerLoad = async ({ params }) => {
	const [client, mandats] = await Promise.all([
		getClient(params.id),
		listMandats({ clientId: params.id })
	]);
	if (!client) throw error(404, 'Client introuvable.');
	return { client, mandats };
};

export const actions: Actions = {
	dupliquer: duplicateMandatAction,
	archiver: async ({ params }) => {
		await archiveClient(params.id);
		throw redirect(303, '/clients');
	}
};
