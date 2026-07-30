/** Appeler une form action sans quitter la page.
 *
 * L'éditeur en a besoin pour tout ce qui ne doit pas naviguer : la relecture par l'IA, la mise à
 * jour de la fiche client, les propositions de texte. Isolé du composant parce que c'est de la
 * plomberie HTTP, et qu'elle a ses propres pièges — voir l'en-tête ci-dessous.
 */
import { deserialize } from '$app/forms';
import type { ActionResult } from '@sveltejs/kit';

/** Appelle une form action et rend son résultat désérialisé. L'en-tête `x-sveltekit-action` est
 * indispensable : sans lui SvelteKit traite la requête comme une soumission classique et répond
 * par une redirection HTML, que `deserialize()` ne sait pas lire. */
export async function posterAction(action: string, body: FormData): Promise<ActionResult> {
	const response = await fetch(action, {
		method: 'POST',
		headers: { 'x-sveltekit-action': 'true' },
		body
	});
	const texte = await response.text();
	try {
		return deserialize(texte);
	} catch {
		// Arrive quand la réponse n'est pas un résultat d'action, donc une erreur d'infrastructure
		// renvoyée en HTML. Le message brut ne veut rien dire pour l'utilisateur.
		//
		// Le 403 mérite son propre message : c'est le refus d'origine croisée de SvelteKit, et il
		// signale presque toujours un `ORIGIN` qui ne correspond pas à l'adresse publique du
		// proxy. Voir la section « Accès » du README.
		throw new Error(
			response.status === 403
				? "Le serveur a refusé l'enregistrement (origine non reconnue). Prévenez l'administrateur : la variable ORIGIN est probablement mal réglée."
				: 'Le serveur a renvoyé une réponse inattendue. Réessayez.'
		);
	}
}

/** Le message d'échec renvoyé par l'action, ou le repli fourni. Les actions répondent toutes sur la
 * même forme `{ message }`, mais rien dans le typage ne l'impose : la vérification reste à faire. */
export function messageDechec(result: ActionResult, repli: string): string {
	if (result.type === 'failure' && typeof result.data?.message === 'string') {
		return result.data.message;
	}
	return repli;
}
