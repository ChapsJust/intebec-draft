import { error } from '@sveltejs/kit';
import { getMandat } from '$lib/server/db/mandats';
import { redigerDocumentAction, effacerRedactionAction } from '$lib/server/mandatActions';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const mandat = await getMandat(params.id);
	if (!mandat) error(404, 'Mandat introuvable');
	// Posé par l'action `generer` quand la passe IA n'a pas pu aboutir : le document affiché est
	// alors la saisie brute, et l'utilisateur doit pouvoir le comprendre sans deviner.
	return { mandat, iaIndisponible: url.searchParams.get('ia') === 'indisponible' };
};

export const actions: Actions = {
	rediger: redigerDocumentAction,
	effacerRedaction: effacerRedactionAction
};
