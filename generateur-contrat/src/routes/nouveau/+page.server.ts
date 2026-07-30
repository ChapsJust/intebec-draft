import type { PageServerLoad, Actions } from './$types';
import { listerClients } from '$serveur/db/clients';
import { listerClausesBibliotheque } from '$serveur/db/clauses';
import { actionsMandat } from '$serveur/actions/mandat';
import { actionsIaEditeur } from '$serveur/actions/ia';
import { modifierClientAction } from '$serveur/actions/client';

export const load: PageServerLoad = async () => {
	const [clients, clausesBibliotheque] = await Promise.all([
		listerClients(),
		listerClausesBibliotheque()
	]);
	return { clients, clausesBibliotheque };
};

/** L'éditeur est le même qu'en modification : il poste les mêmes actions, la seule différence
 * étant l'absence de `params.id`, qui fait basculer `enregistrer` de la mise à jour vers la
 * création. */
export const actions: Actions = {
	...actionsMandat,
	...actionsIaEditeur,
	modifierClient: modifierClientAction
};
