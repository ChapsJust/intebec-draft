import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	listClients,
	createClient,
	archiveClient,
	unarchiveClient,
	deleteClient
} from '$lib/server/db/clients';
import type { TypeClient } from '$lib/types';

export const load: PageServerLoad = async () => {
	const [clients, archives] = await Promise.all([listClients(), listClients({ archives: true })]);
	return { clients, archives };
};

async function idPoste(request: Request): Promise<string | null> {
	const data = await request.formData();
	const id = data.get('id');
	return typeof id === 'string' && id ? id : null;
}

export const actions: Actions = {
	creer: async ({ request }) => {
		const data = await request.formData();
		const nom = (data.get('nom') as string)?.trim();
		if (!nom) {
			return fail(400, { message: 'Le nom du client est requis.' });
		}
		const created = await createClient({
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
	},

	// `notice` plutôt que `message` : ce dernier est réservé aux erreurs du formulaire de création,
	// qui les affiche à sa propre place.
	archiver: async ({ request }) => {
		const id = await idPoste(request);
		if (!id) return fail(400, { notice: 'Identifiant manquant.' });
		await archiveClient(id);
		return { notice: 'Client archivé, avec ses mandats.' };
	},

	desarchiver: async ({ request }) => {
		const id = await idPoste(request);
		if (!id) return fail(400, { notice: 'Identifiant manquant.' });
		await unarchiveClient(id);
		return { notice: 'Client désarchivé.' };
	},

	supprimer: async ({ request }) => {
		const id = await idPoste(request);
		if (!id) return fail(400, { notice: 'Identifiant manquant.' });
		await deleteClient(id);
		return { notice: 'Client et mandats supprimés définitivement.' };
	}
};
