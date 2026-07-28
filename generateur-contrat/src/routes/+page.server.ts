import type { PageServerLoad, Actions } from './$types';
import { listMandats } from '$lib/server/db/mandats';
import {
	duplicateMandatAction,
	archiveMandatAction,
	unarchiveMandatAction,
	deleteMandatAction
} from '$lib/server/mandatActions';

export const load: PageServerLoad = async () => {
	const [mandats, archives] = await Promise.all([listMandats(), listMandats({ archives: true })]);
	return { mandats: mandats.slice(0, 8), archives: archives.slice(0, 8) };
};

export const actions: Actions = {
	dupliquer: duplicateMandatAction,
	archiver: archiveMandatAction,
	desarchiver: unarchiveMandatAction,
	supprimer: deleteMandatAction
};
