// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Utilisateur } from '$domaine/types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Personne identifiée par les en-têtes de `tailscale serve`, lus dans `hooks.server.ts`.
			 * Sert à afficher un nom, jamais à autoriser quoi que ce soit : l'accès est gardé par le
			 * réseau. `null` est un état normal — développement local sans Tailscale devant, ou
			 * requête interne de Chromium pour le PDF — et non un refus. */
			utilisateur: Utilisateur | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
