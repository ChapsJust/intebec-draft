import type { LayoutServerLoad } from './$types';

/** Expose l'identité Tailscale à toutes les pages, pour que l'en-tête sache quel nom afficher sans
 * que chaque route ait à le renvoyer elle-même. */
export const load: LayoutServerLoad = async ({ locals }) => {
	return { utilisateur: locals.utilisateur };
};
