import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { obtenirClient } from '$serveur/db/clients';
import { listerMandats } from '$serveur/db/mandats';
import {
	archiverClientAction,
	desarchiverClientAction,
	supprimerClientAction
} from '$serveur/actions/client';
import {
	dupliquerMandatAction,
	archiverMandatAction,
	desarchiverMandatAction,
	supprimerMandatAction
} from '$serveur/actions/mandat';

export const load: PageServerLoad = async ({ params }) => {
	const [client, mandats, mandatsArchives] = await Promise.all([
		obtenirClient(params.id),
		listerMandats({ clientId: params.id }),
		listerMandats({ clientId: params.id, archives: true })
	]);
	if (!client) throw error(404, 'Client introuvable.');
	return { client, mandats, mandatsArchives };
};

export const actions: Actions = {
	// Les actions mandat sont suffixées ici : la fiche porte déjà un archivage et une suppression,
	// qui visent le client et non ses mandats.
	dupliquer: dupliquerMandatAction,
	archiverMandat: archiverMandatAction,
	desarchiverMandat: desarchiverMandatAction,
	supprimerMandat: supprimerMandatAction,

	archiver: archiverClientAction,
	desarchiver: desarchiverClientAction,
	supprimer: supprimerClientAction
};
