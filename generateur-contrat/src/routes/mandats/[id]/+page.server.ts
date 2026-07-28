import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { listClients } from '$lib/server/db/clients';
import { getMandat } from '$lib/server/db/mandats';
import {
	mandatActions,
	archiveMandatAction,
	unarchiveMandatAction,
	deleteMandatAction
} from '$lib/server/mandatActions';

export const load: PageServerLoad = async ({ params }) => {
	const [mandat, clients] = await Promise.all([getMandat(params.id), listClients()]);
	if (!mandat) throw error(404, 'Mandat introuvable.');
	return { mandat, clients };
};

export const actions: Actions = {
	...mandatActions,
	archiver: archiveMandatAction,
	desarchiver: unarchiveMandatAction,
	supprimer: deleteMandatAction
};
