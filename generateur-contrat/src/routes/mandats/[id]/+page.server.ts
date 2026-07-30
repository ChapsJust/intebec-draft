import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { listerClients } from '$serveur/db/clients';
import { listerClausesBibliotheque } from '$serveur/db/clauses';
import { obtenirMandat } from '$serveur/db/mandats';
import {
	actionsMandat,
	archiverMandatAction,
	desarchiverMandatAction,
	supprimerMandatAction
} from '$serveur/actions/mandat';
import { actionsIaEditeur } from '$serveur/actions/ia';
import { modifierClientAction } from '$serveur/actions/client';

export const load: PageServerLoad = async ({ params }) => {
	const [mandat, clients, clausesBibliotheque] = await Promise.all([
		obtenirMandat(params.id),
		listerClients(),
		listerClausesBibliotheque()
	]);
	if (!mandat) throw error(404, 'Mandat introuvable.');
	return { mandat, clients, clausesBibliotheque };
};

export const actions: Actions = {
	...actionsMandat,
	...actionsIaEditeur,
	modifierClient: modifierClientAction,
	archiver: archiverMandatAction,
	desarchiver: desarchiverMandatAction,
	supprimer: supprimerMandatAction
};
