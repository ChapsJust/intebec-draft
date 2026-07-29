import { describe, expect, it } from 'vitest';
import { lireIdentite } from './acces';

/** Ces en-têtes sont la seule source d'identité de l'application. Ils ne décident d'aucun droit —
 * la garde est le binding boucle locale et la politique du tailnet — mais un nom faux affiché à
 * l'écran resterait un mensonge, et une requête Funnel ne doit jamais ressembler à une session. */
describe('lireIdentite', () => {
	it('préfère le nom affichable', () => {
		const headers = new Headers({
			'tailscale-user-name': 'Justin Chaput',
			'tailscale-user-login': 'justin.chaput@intebec.ca'
		});
		expect(lireIdentite(headers)).toEqual({ nom: 'Justin Chaput' });
	});

	it("retombe sur l'identifiant de connexion quand le nom manque", () => {
		const headers = new Headers({ 'tailscale-user-login': 'justin.chaput@intebec.ca' });
		expect(lireIdentite(headers)).toEqual({ nom: 'justin.chaput@intebec.ca' });
	});

	it('lit les en-têtes sans tenir compte de la casse', () => {
		// Tailscale les écrit en `Tailscale-User-Login` ; `Headers` normalise, mais le test fixe
		// l'attente pour que personne ne « corrige » les constantes en capitales un jour.
		const headers = new Headers({ 'Tailscale-User-Login': 'justin.chaput@intebec.ca' });
		expect(lireIdentite(headers)).toEqual({ nom: 'justin.chaput@intebec.ca' });
	});

	it("n'invente pas de nom sans proxy devant", () => {
		// Développement local, et requête interne de Chromium pour le PDF : cas normaux.
		expect(lireIdentite(new Headers())).toBeNull();
	});

	it('ignore un en-tête vide ou blanc', () => {
		expect(lireIdentite(new Headers({ 'tailscale-user-login': '' }))).toBeNull();
		expect(lireIdentite(new Headers({ 'tailscale-user-name': '   ' }))).toBeNull();
	});

	it('retombe sur la connexion quand le nom est blanc', () => {
		const headers = new Headers({
			'tailscale-user-name': '  ',
			'tailscale-user-login': 'justin.chaput@intebec.ca'
		});
		expect(lireIdentite(headers)).toEqual({ nom: 'justin.chaput@intebec.ca' });
	});

	it('rogne les espaces autour de la valeur', () => {
		const headers = new Headers({ 'tailscale-user-name': '  Justin Chaput  ' });
		expect(lireIdentite(headers)).toEqual({ nom: 'Justin Chaput' });
	});

	it('refuse toute identité sur une requête Funnel', () => {
		// Funnel expose publiquement et retire les en-têtes d'identité. Si les deux arrivent
		// ensemble, c'est qu'on cherche à se faire passer pour quelqu'un.
		const headers = new Headers({
			'tailscale-funnel-request': '?1',
			'tailscale-user-login': 'justin.chaput@intebec.ca',
			'tailscale-user-name': 'Justin Chaput'
		});
		expect(lireIdentite(headers)).toBeNull();
	});

	it("refuse aussi quand l'en-tête Funnel est vide", () => {
		// Sa seule présence suffit : la valeur n'est pas spécifiée et ne doit pas servir de condition.
		const headers = new Headers({
			'tailscale-funnel-request': '',
			'tailscale-user-login': 'justin.chaput@intebec.ca'
		});
		expect(lireIdentite(headers)).toBeNull();
	});
});
