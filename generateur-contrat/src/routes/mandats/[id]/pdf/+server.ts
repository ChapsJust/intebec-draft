import { error } from '@sveltejs/kit';
import { obtenirMandat } from '$lib/server/db/mandats';
import { genererPdf, nomFichier, origineInterne } from '$lib/server/pdf';
import { PRESTATAIRE } from '$lib/config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const mandat = await obtenirMandat(params.id);
	if (!mandat) error(404, 'Mandat introuvable');

	const origine = origineInterne(url.origin);
	const typeLabel = mandat.type === 'contrat' ? 'Contrat de services' : 'Soumission';
	const mention = [PRESTATAIRE.nom, typeLabel, mandat.titre].filter(Boolean).join(' &middot; ');

	let pdf: Uint8Array;
	try {
		pdf = await genererPdf({
			url: `${origine}/mandats/${mandat.id}/apercu`,
			mention
		});
	} catch (cause) {
		console.error('Génération PDF échouée', cause);
		error(
			500,
			"La génération du PDF a échoué. L'aperçu reste imprimable depuis le navigateur (Ctrl+P)."
		);
	}

	const fichier = nomFichier(mandat.type, mandat.titre, mandat.brouillon.dateSignature);

	return new Response(pdf as BodyInit, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="${fichier}"`,
			'Cache-Control': 'no-store'
		}
	});
};
