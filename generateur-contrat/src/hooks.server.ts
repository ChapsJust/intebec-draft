import type { Handle } from '@sveltejs/kit';
import { lireIdentite } from '$serveur/acces';

/** Ce fichier ne garde rien, et ce n'est pas un oubli.
 *
 * L'accès à l'application est contrôlé une couche plus bas, par le réseau : le conteneur n'écoute
 * que sur `127.0.0.1` (voir `compose.yaml`), et seul `tailscale serve`, qui tourne sur l'hôte,
 * atteint ce port. Tailscale n'y laisse passer que les membres du tailnet, qu'il a déjà
 * authentifiés au niveau de l'appareil. Une requête qui arrive ici a donc déjà franchi la porte.
 *
 * Il ne reste qu'à lire qui frappe, pour l'afficher dans l'en-tête. Rien n'est refusé ici : une
 * requête sans identité est légitime en développement local, et c'est aussi le cas de celle que
 * Chromium adresse au conteneur pour imprimer un PDF. */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.utilisateur = lireIdentite(event.request.headers);
	return resolve(event);
};
