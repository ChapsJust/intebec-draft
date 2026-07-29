import type { PageServerLoad } from './$types';
import { listerClients } from '$lib/server/db/clients';
import { listerClausesBibliotheque } from '$lib/server/db/clauses';
import { mandatActions } from '$lib/server/mandatActions';

export const load: PageServerLoad = async () => {
	const [clients, clausesBibliotheque] = await Promise.all([
		listerClients(),
		listerClausesBibliotheque()
	]);
	return { clients, clausesBibliotheque };
};

export const actions = mandatActions;
