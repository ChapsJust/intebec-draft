import type { PageServerLoad, Actions } from './$types';
import { listerClausesBibliotheque } from '$serveur/db/clauses';
import { actionsClause } from '$serveur/actions/clause';

export const load: PageServerLoad = async () => {
	const [clauses, archives] = await Promise.all([
		listerClausesBibliotheque(),
		listerClausesBibliotheque({ archives: true })
	]);
	return { clauses, archives };
};

export const actions: Actions = actionsClause;
