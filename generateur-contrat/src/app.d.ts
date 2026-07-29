// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Utilisateur } from '$lib/server/auth';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Session vérifiée par `hooks.server.ts`. `null` seulement sur les routes publiques :
			 * partout ailleurs, le garde a déjà redirigé vers l'écran de connexion. */
			utilisateur: Utilisateur | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
