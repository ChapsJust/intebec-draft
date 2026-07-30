/** Personne identifiée par Tailscale. Défini ici plutôt que dans `server/acces.ts` parce que
 * l'en-tête, qui est du code client, a besoin du type : SvelteKit interdit d'importer quoi que ce
 * soit de `$serveur` depuis le navigateur. */
export interface Utilisateur {
	nom: string;
}
