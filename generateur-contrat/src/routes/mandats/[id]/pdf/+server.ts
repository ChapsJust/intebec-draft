import { error } from '@sveltejs/kit';
import { getMandat } from '$lib/server/db/mandats';
import { genererPdf, origineInterne } from '$lib/server/pdf';
import { PRESTATAIRE } from '$lib/config';
import type { RequestHandler } from './$types';

/** Transforme un titre en nom de fichier sûr : sans accents, sans ponctuation, en minuscules. */
function nomFichier(type: string, titre: string, date: string): string {
	const base = `${type}-${titre}`
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-zA-Z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.toLowerCase();
	return `${base || 'document'}-${date}.pdf`;
}

export const GET: RequestHandler = async ({ params, url, request, fetch: _fetch }) => {
	const mandat = await getMandat(params.id);
	if (!mandat) error(404, 'Mandat introuvable');

	const origine = origineInterne(url.origin);
	const typeLabel = mandat.type === 'contrat' ? 'Contrat de services' : 'Soumission';
	const mention = [PRESTATAIRE.nom, typeLabel, mandat.titre].filter(Boolean).join(' &middot; ');

	let pdf: Uint8Array;
	try {
		pdf = await genererPdf({
			url: `${origine}/mandats/${mandat.id}/apercu`,
			mention,
			cookie: request.headers.get('cookie') ?? undefined
		});
	} catch (cause) {
		console.error('Génération PDF échouée', cause);
		error(
			500,
			"La génération du PDF a échoué. L'aperçu reste imprimable depuis le navigateur (Ctrl+P)."
		);
	}

	const fichier = nomFichier(mandat.type, mandat.titre, mandat.draft.dateSignature);

	return new Response(pdf as BodyInit, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="${fichier}"`,
			'Cache-Control': 'no-store'
		}
	});
};
