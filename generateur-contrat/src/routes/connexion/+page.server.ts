import { fail, redirect } from '@sveltejs/kit';
import { NOM_COOKIE, optionsCookie, creerSession, verifierIdentifiants } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

/** Destination de retour après connexion. Seuls les chemins internes sont acceptés : une valeur
 * comme `//exemple.com` serait vue comme une URL absolue par le navigateur, et transformerait
 * l'écran de connexion en tremplin vers un site tiers. */
function suiteSure(brut: string | null): string {
	if (!brut || !brut.startsWith('/') || brut.startsWith('//')) return '/';
	return brut;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	// Déjà connecté : rien à faire ici.
	if (locals.utilisateur) redirect(303, suiteSure(url.searchParams.get('suite')));
	return { suite: suiteSure(url.searchParams.get('suite')) };
};

export const actions: Actions = {
	connexion: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const nom = data.get('nom');
		const suite = suiteSure(
			typeof data.get('suite') === 'string' ? (data.get('suite') as string) : null
		);

		const utilisateur = verifierIdentifiants(nom, data.get('motDePasse'));
		if (!utilisateur) {
			// Un seul message pour les deux causes possibles : préciser laquelle des deux est fausse
			// permettrait de deviner quels comptes existent.
			return fail(401, {
				message: 'Identifiant ou mot de passe incorrect.',
				nom: typeof nom === 'string' ? nom : ''
			});
		}

		cookies.set(NOM_COOKIE, creerSession(utilisateur), optionsCookie(url.protocol === 'https:'));
		redirect(303, suite);
	},

	deconnexion: async ({ cookies, url }) => {
		cookies.delete(NOM_COOKIE, optionsCookie(url.protocol === 'https:'));
		redirect(303, '/connexion');
	}
};
