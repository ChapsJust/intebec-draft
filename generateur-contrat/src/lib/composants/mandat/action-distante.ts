/** Appeler une form action sans quitter la page : la relecture par l'IA, la mise à jour de la fiche
 * client, les propositions de texte.
 */
import { deserialize } from '$app/forms';
import type { ActionResult } from '@sveltejs/kit';

/** L'en-tête `x-sveltekit-action` est obligatoire. C'est lui qui dit à SvelteKit « je suis un appel
 * en JavaScript, pas une soumission de formulaire classique ». Sans lui, SvelteKit répond par une
 * redirection HTML, et `deserialize()` ne sait pas quoi en faire. */
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
		// Si on arrive ici, la réponse n'est pas un résultat d'action : c'est une erreur
		// d'infrastructure renvoyée en HTML. Le 403 a droit à son propre message parce que c'est le
		// refus d'origine croisée de SvelteKit, et dans les faits ça veut presque toujours dire que la
		// variable ORIGIN est mal réglée. Voir la section « Accès » du README.
		throw new Error(
			response.status === 403
				? "Le serveur a refusé l'enregistrement (origine non reconnue). Prévenez l'administrateur : la variable ORIGIN est probablement mal réglée."
				: 'Le serveur a renvoyé une réponse inattendue. Réessayez.'
		);
	}
}

/** Le message d'échec renvoyé par l'action, ou celui qu'on fournit en repli. Toutes les actions
 * répondent avec un `{ message }`, mais le type d'`ActionResult` ne le garantit pas, donc on
 * vérifie avant de lire. */
export function messageDechec(result: ActionResult, repli: string): string {
	if (result.type === 'failure' && typeof result.data?.message === 'string') {
		return result.data.message;
	}
	return repli;
}
