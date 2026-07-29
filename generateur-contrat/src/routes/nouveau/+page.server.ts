import type { PageServerLoad } from './$types';
import { listerClients } from '$lib/server/db/clients';
import { mandatActions } from '$lib/server/mandatActions';

export const load: PageServerLoad = async () => {
	return { clients: await listerClients() };
};

export const actions = mandatActions;
