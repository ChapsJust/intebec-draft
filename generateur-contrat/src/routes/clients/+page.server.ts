import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { listClients, createClient, archiveClient } from '$lib/server/db/clients';
import type { TypeClient } from '$lib/types';

export const load: PageServerLoad = async () => {
	return { clients: await listClients() };
};

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

	archiver: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id');
		if (typeof id === 'string') await archiveClient(id);
	}
};
