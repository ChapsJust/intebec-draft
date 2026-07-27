import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listClients } from '$lib/server/db/clients';
import { getMandat } from '$lib/server/db/mandats';
import { mandatActions } from '$lib/server/mandatActions';

export const load: PageServerLoad = async ({ params }) => {
	const [mandat, clients] = await Promise.all([getMandat(params.id), listClients()]);
	if (!mandat) throw error(404, 'Mandat introuvable.');
	return { mandat, clients };
};

export const actions = mandatActions;
