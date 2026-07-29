import type { PageServerLoad, Actions } from './$types';
import { listerMandats } from '$lib/server/db/mandats';
import {
	dupliquerMandatAction,
	archiverMandatAction,
	desarchiverMandatAction,
	supprimerMandatAction
} from '$lib/server/mandatActions';

/** Nombre de documents montrés sur l'accueil. La limite est passée à la requête : faire remonter
 * toute la table pour n'en afficher que huit lignes ne tient plus dès quelques dizaines de mandats. */
const RECENTS = 8;

export const load: PageServerLoad = async () => {
	const [mandats, archives] = await Promise.all([
		listerMandats({ limite: RECENTS }),
		listerMandats({ archives: true, limite: RECENTS })
	]);
	return { mandats, archives };
};

export const actions: Actions = {
	dupliquer: dupliquerMandatAction,
	archiver: archiverMandatAction,
	desarchiver: desarchiverMandatAction,
	supprimer: supprimerMandatAction
};
