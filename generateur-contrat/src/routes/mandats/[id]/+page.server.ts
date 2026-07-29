import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { listerClients } from '$lib/server/db/clients';
import { obtenirMandat } from '$lib/server/db/mandats';
import {
	mandatActions,
	archiverMandatAction,
	desarchiverMandatAction,
	supprimerMandatAction
} from '$lib/server/mandatActions';

export const load: PageServerLoad = async ({ params }) => {
	const [mandat, clients] = await Promise.all([obtenirMandat(params.id), listerClients()]);
	if (!mandat) throw error(404, 'Mandat introuvable.');
	return { mandat, clients };
};

export const actions: Actions = {
	...mandatActions,
	archiver: archiverMandatAction,
	desarchiver: desarchiverMandatAction,
	supprimer: supprimerMandatAction
};
