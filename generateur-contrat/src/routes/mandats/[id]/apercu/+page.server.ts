import { error } from '@sveltejs/kit';
import { getMandat } from '$lib/server/db/mandats';
import { redigerDocumentAction, effacerRedactionAction } from '$lib/server/mandatActions';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const mandat = await getMandat(params.id);
	if (!mandat) error(404, 'Mandat introuvable');
	return { mandat };
};

export const actions: Actions = {
	rediger: redigerDocumentAction,
	effacerRedaction: effacerRedactionAction
};
