import type { PageServerLoad } from './$types';
import { listClients } from '$lib/server/db/clients';
import { mandatActions } from '$lib/server/mandatActions';

export const load: PageServerLoad = async () => {
	return { clients: await listClients() };
};

export const actions = mandatActions;
