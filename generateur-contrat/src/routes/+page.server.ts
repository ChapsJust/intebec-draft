import type { PageServerLoad, Actions } from './$types';
import { listMandats } from '$lib/server/db/mandats';
import { duplicateMandatAction } from '$lib/server/mandatActions';

export const load: PageServerLoad = async () => {
	const mandats = await listMandats();
	return { mandats: mandats.slice(0, 8) };
};

export const actions: Actions = {
	dupliquer: duplicateMandatAction
};
