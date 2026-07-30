import type { PageServerLoad, Actions } from './$types';
import { listerClients } from '$serveur/db/clients';
import { actionsClient } from '$serveur/actions/client';

export const load: PageServerLoad = async () => {
	const [clients, archives] = await Promise.all([
		listerClients(),
		listerClients({ archives: true })
	]);
	return { clients, archives };
};

export const actions: Actions = actionsClient;
