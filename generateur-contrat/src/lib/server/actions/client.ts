/** Actions sur les fiches clients, partagées par /clients et /clients/[id].
 *
 * Chacune lit l'identifiant posté et retombe sur `params.id` : la liste désigne explicitement la
 * ligne visée, la fiche parle d'elle-même, et il n'y a qu'un comportement à maintenir.
 */
import { fail, redirect, type Action, type Actions } from '@sveltejs/kit';
import {
	creerClient,
	modifierClient,
	archiverClient,
	desarchiverClient,
	supprimerClient
} from '$serveur/db/clients';
import { idPoste } from '$serveur/formulaire';
import type { TypeClient } from '$domaine/types';
import { CLIENT_INTROUVABLE, ID_MANQUANT, REQUETE_INVALIDE } from './messages';

/** Cible d'une action client : l'identifiant posté, sinon la fiche affichée. */
async function clientVise(request: Request, params: Partial<Record<string, string>>) {
	return (await idPoste(request)) ?? params.id ?? null;
}

/** Création depuis la liste des clients. Champs à plat, pas en JSON : formulaire HTML ordinaire, qui
 * fonctionne sans JavaScript. */
export const creerClientAction: Action = async ({ request }) => {
	const data = await request.formData();
	const nom = (data.get('nom') as string)?.trim();
	if (!nom) {
		return fail(400, { message: 'Le nom du client est requis.' });
	}
	const created = await creerClient({
		nom,
		typeClient: ((data.get('typeClient') as string) || 'entreprise') as TypeClient,
		adresse: (data.get('adresse') as string) || '',
		representantNom: (data.get('representantNom') as string) || '',
		representantTitre: (data.get('representantTitre') as string) || '',
		courriel: (data.get('courriel') as string) || '',
		telephone: (data.get('telephone') as string) || '',
		siteWeb: (data.get('siteWeb') as string) || '',
		numeroEntreprise: (data.get('numeroEntreprise') as string) || ''
	});
	throw redirect(303, `/clients/${created.id}`);
};

// `notice` plutôt que `message` : ce dernier est réservé aux erreurs du formulaire de création,
// qui les affiche à sa propre place.
export const archiverClientAction: Action = async ({ request, params }) => {
	const id = await clientVise(request, params);
	if (!id) return fail(400, { notice: ID_MANQUANT });
	if (!(await archiverClient(id))) return fail(404, { notice: CLIENT_INTROUVABLE });
	return { notice: 'Client archivé, avec ses mandats.' };
};

export const desarchiverClientAction: Action = async ({ request, params }) => {
	const id = await clientVise(request, params);
	if (!id) return fail(400, { notice: ID_MANQUANT });
	if (!(await desarchiverClient(id))) return fail(404, { notice: CLIENT_INTROUVABLE });
	return { notice: 'Client désarchivé.' };
};

export const supprimerClientAction: Action = async ({ request, params }) => {
	const id = await clientVise(request, params);
	if (!id) return fail(400, { notice: ID_MANQUANT });
	if (!(await supprimerClient(id))) return fail(404, { notice: CLIENT_INTROUVABLE });
	// La fiche affichée disparaît : on ne peut pas rester dessus. Depuis la liste, on y reste.
	if (params.id === id) throw redirect(303, '/clients');
	return { notice: 'Client et mandats supprimés définitivement.' };
};

/** Mise à jour depuis l'éditeur de mandat, sans quitter le document en cours. Corps en JSON, cette
 * fois. */
export const modifierClientAction: Action = async ({ request }) => {
	const data = await request.formData();
	const id = data.get('id');
	const payload = data.get('payload');
	if (typeof id !== 'string' || typeof payload !== 'string') {
		return fail(400, { message: REQUETE_INVALIDE });
	}

	let champs: unknown;
	try {
		champs = JSON.parse(payload);
	} catch {
		return fail(400, { message: "La fiche client n'a pas pu être lue." });
	}

	const record = await modifierClient(id, champs as Record<string, string>);
	if (!record) return fail(404, { message: "Cette fiche client n'existe plus." });
	return { message: 'Fiche client mise à jour.' };
};

/** Le jeu complet exposé par /clients et /clients/[id]. */
export const actionsClient: Actions = {
	creer: creerClientAction,
	archiver: archiverClientAction,
	desarchiver: desarchiverClientAction,
	supprimer: supprimerClientAction
};
