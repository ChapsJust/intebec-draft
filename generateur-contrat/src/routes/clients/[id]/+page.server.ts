import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getClient, archiveClient, unarchiveClient, deleteClient } from '$lib/server/db/clients';
import { listMandats } from '$lib/server/db/mandats';
import {
	duplicateMandatAction,
	archiveMandatAction,
	unarchiveMandatAction,
	deleteMandatAction
} from '$lib/server/mandatActions';

export const load: PageServerLoad = async ({ params }) => {
	const [client, mandats, mandatsArchives] = await Promise.all([
		getClient(params.id),
		listMandats({ clientId: params.id }),
		listMandats({ clientId: params.id, archives: true })
	]);
	if (!client) throw error(404, 'Client introuvable.');
	return { client, mandats, mandatsArchives };
};

export const actions: Actions = {
	dupliquer: duplicateMandatAction,
	archiverMandat: archiveMandatAction,
	desarchiverMandat: unarchiveMandatAction,
	supprimerMandat: deleteMandatAction,

	archiver: async ({ params }) => {
		await archiveClient(params.id);
		return { notice: 'Client archivé, avec ses mandats.' };
	},

	desarchiver: async ({ params }) => {
		await unarchiveClient(params.id);
		return { notice: 'Client désarchivé.' };
	},

	// La fiche affichée disparaît : on ne peut pas rester dessus.
	supprimer: async ({ params }) => {
		const client = await getClient(params.id);
		if (!client) return fail(404, { notice: 'Client introuvable.' });
		await deleteClient(params.id);
		throw redirect(303, '/clients');
	}
};
