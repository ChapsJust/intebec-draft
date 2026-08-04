import type { Handle } from '@sveltejs/kit';
import { lireIdentite } from '$serveur/acces';

/** Ce hook ne bloque rien, et ce n'est pas un oubli.
 *
 * L'accès est contrôlé une couche plus bas, par le réseau : le conteneur n'écoute que sur
 * `127.0.0.1`, et seul `tailscale serve` peut atteindre ce port. Autrement dit, une requête qui
 * arrive jusqu'ici a déjà passé la porte. Tout ce qui reste à faire, c'est lire qui frappe pour
 * pouvoir l'afficher. Le raisonnement complet est dans `server/acces.ts` et dans la section
 * « Accès » du README. */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.utilisateur = lireIdentite(event.request.headers);
	return resolve(event);
};
