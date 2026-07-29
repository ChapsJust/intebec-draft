import type { LayoutServerLoad } from './$types';

/** Expose la session à toutes les pages, pour que l'en-tête sache qui est connecté sans que chaque
 * route ait à le renvoyer elle-même. */
export const load: LayoutServerLoad = async ({ locals }) => {
	return { utilisateur: locals.utilisateur };
};
