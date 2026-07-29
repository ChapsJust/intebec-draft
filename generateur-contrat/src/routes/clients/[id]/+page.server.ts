import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	obtenirClient,
	archiverClient,
	desarchiverClient,
	supprimerClient
} from '$lib/server/db/clients';
import { listerMandats } from '$lib/server/db/mandats';
import {
	dupliquerMandatAction,
	archiverMandatAction,
	desarchiverMandatAction,
	supprimerMandatAction
} from '$lib/server/mandatActions';

export const load: PageServerLoad = async ({ params }) => {
	const [client, mandats, mandatsArchives] = await Promise.all([
		obtenirClient(params.id),
		listerMandats({ clientId: params.id }),
		listerMandats({ clientId: params.id, archives: true })
	]);
	if (!client) throw error(404, 'Client introuvable.');
	return { client, mandats, mandatsArchives };
};

export const actions: Actions = {
	dupliquer: dupliquerMandatAction,
	archiverMandat: archiverMandatAction,
	desarchiverMandat: desarchiverMandatAction,
	supprimerMandat: supprimerMandatAction,

	archiver: async ({ params }) => {
		if (!(await archiverClient(params.id))) return fail(404, { notice: 'Client introuvable.' });
		return { notice: 'Client archivé, avec ses mandats.' };
	},

	desarchiver: async ({ params }) => {
		if (!(await desarchiverClient(params.id))) return fail(404, { notice: 'Client introuvable.' });
		return { notice: 'Client désarchivé.' };
	},

	// La fiche affichée disparaît : on ne peut pas rester dessus.
	supprimer: async ({ params }) => {
		if (!(await supprimerClient(params.id))) return fail(404, { notice: 'Client introuvable.' });
		throw redirect(303, '/clients');
	}
};
