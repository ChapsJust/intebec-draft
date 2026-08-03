import type { Handle } from '@sveltejs/kit';
import { lireIdentite } from '$serveur/acces';

/** Ce fichier ne garde rien, et ce n'est pas un oubli : l'accès est contrôlé une couche plus bas, par
 * le réseau. Le conteneur n'écoute que sur `127.0.0.1` et seul `tailscale serve` atteint ce port, donc
 * une requête qui arrive ici a déjà franchi la porte. Il ne reste qu'à lire qui frappe, pour
 * l'afficher. Voir `server/acces.ts` et la section « Accès » du README. */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.utilisateur = lireIdentite(event.request.headers);
	return resolve(event);
};
