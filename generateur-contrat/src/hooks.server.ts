import { error, redirect, type Handle } from '@sveltejs/kit';
import { NOM_COOKIE, authConfiguree, lireSession } from '$lib/server/auth';

/** Chemins accessibles sans session : l'écran de connexion lui-même, et les ressources que le
 * navigateur charge avant d'avoir pu s'authentifier. */
const PUBLIC = ['/connexion'];

function estPublic(pathname: string): boolean {
	if (PUBLIC.includes(pathname)) return true;
	// Fichiers générés par Vite et fichiers statiques : les bloquer donnerait un écran de connexion
	// sans style ni favicon.
	return pathname.startsWith('/_app/') || pathname === '/favicon.svg' || pathname === '/robots.txt';
}

/** Garde d'accès de l'application entière.
 *
 * Tout passe par ici, y compris les form actions et le téléchargement du PDF : c'est le seul
 * endroit où la règle est écrite une fois, plutôt que répétée dans chaque `load`. La génération du
 * PDF continue de fonctionner parce que la route `/mandats/[id]/pdf` retransmet le cookie de la
 * requête à Chromium, qui visite donc l'aperçu authentifié comme le ferait l'utilisateur. */
export const handle: Handle = async ({ event, resolve }) => {
	// Refus explicite quand l'authentification n'est pas configurée, plutôt qu'un accès libre :
	// une variable d'environnement oubliée ne doit pas ouvrir l'application à tout le monde.
	if (!authConfiguree()) {
		error(
			503,
			"L'authentification n'est pas configurée sur ce serveur. Renseignez AUTH_SECRET et AUTH_UTILISATEURS dans le fichier .env, puis redémarrez. Voir la section « Accès » du README."
		);
	}

	event.locals.utilisateur = lireSession(event.cookies.get(NOM_COOKIE));

	if (!event.locals.utilisateur && !estPublic(event.url.pathname)) {
		// La destination voulue est mémorisée pour y revenir après la connexion : se faire renvoyer
		// à l'accueil après avoir cliqué un lien vers un mandat précis est une petite trahison.
		const suite = event.url.pathname + event.url.search;
		redirect(303, `/connexion?suite=${encodeURIComponent(suite)}`);
	}

	return resolve(event);
};
