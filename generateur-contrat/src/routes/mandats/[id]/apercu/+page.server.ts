import { error } from '@sveltejs/kit';
import { redactionCaduque } from '$lib/document/sections';
import { obtenirMandat } from '$lib/server/db/mandats';
import {
	basculerPassageAction,
	changerStatutAction,
	effacerRedactionAction,
	redigerDocumentAction
} from '$lib/server/mandatActions';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const mandat = await obtenirMandat(params.id);
	if (!mandat) error(404, 'Mandat introuvable');

	return {
		mandat,
		// Posé par l'action `generer` : le mandat vient d'être enregistré et la rédaction reste à
		// faire. La page la déclenche elle-même, dans sa propre requête, pour que l'enregistrement
		// ne dépende plus de la durée de l'appel à l'IA.
		//
		// Le `!mandat.redaction` protège du rechargement : réappuyer sur F5 avec `?rediger=1` encore
		// dans l'adresse ne doit pas relancer une passe de quatre minutes. C'est `generer` qui écarte
		// une rédaction devenue caduque, en amont, pour que la condition redevienne vraie.
		redactionAFaire: url.searchParams.get('rediger') === '1' && !mandat.redaction,
		// Arrivée par « Voir le document » sur un mandat modifié depuis : on le signale au lieu de
		// déclencher une génération que personne n'a demandée.
		redactionCaduque: redactionCaduque(mandat.brouillon, mandat.redaction)
	};
};

export const actions: Actions = {
	rediger: redigerDocumentAction,
	effacerRedaction: effacerRedactionAction,
	basculerPassage: basculerPassageAction,
	changerStatut: changerStatutAction
};
