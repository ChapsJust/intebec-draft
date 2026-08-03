/** Appeler une form action sans quitter la page : la relecture par l'IA, la mise à jour de la fiche
 * client, les propositions de texte.
 */
import { deserialize } from '$app/forms';
import type { ActionResult } from '@sveltejs/kit';

/** L'en-tête `x-sveltekit-action` est indispensable : sans lui SvelteKit répond par une redirection
 * HTML, que `deserialize()` ne sait pas lire. */
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
		// La réponse n'est pas un résultat d'action : erreur d'infrastructure renvoyée en HTML. Le 403
		// mérite son propre message, c'est le refus d'origine croisée de SvelteKit et il signale
		// presque toujours un `ORIGIN` mal réglé. Voir la section « Accès » du README.
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
