/** Quelles consignes système partent avec quelle demande.
 *
 * Ce fichier existe à cause d'une régression précise : un titre était demandé sous `CONSIGNES`, qui
 * ordonne « produis uniquement des paragraphes de texte courant ». Le modèle obéissait au système
 * plutôt qu'à la demande et renvoyait un début de préambule. Rien ne pouvait le voir : le prompt est
 * une chaîne, l'appel réseau était le seul endroit où les deux se rencontraient.
 *
 * On intercepte donc `appeler` pour vérifier l'appariement, sans joindre le modèle.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `vi.hoisted` : la fabrique de `vi.mock` est remontée en tête de fichier, donc elle ne peut pas
// lire un `const` déclaré ici. Le reste du module transport (`modeleActif`, la classe d'erreur) est
// gardé tel quel : seul l'aller-retour réseau est intercepté.
const { appeler } = vi.hoisted(() => ({ appeler: vi.fn() }));

vi.mock('./transport', async (importOriginal) => {
	const reel = await importOriginal<typeof import('./transport')>();
	return { ...reel, appeler };
});

import { proposerPuces, redigerChamp, revoirMandat } from './index';
import { CONSIGNES, CONSIGNES_LIBELLE, CONSIGNES_REVUE } from './invites';
import { nouveauMandat } from '$domaine/fabriques';

/** Les consignes passées au modèle lors du dernier appel. */
function consignesEnvoyees(): string {
	return appeler.mock.calls[0][1] as string;
}

/** L'invite passée au modèle lors du dernier appel. */
function inviteEnvoyee(): string {
	return appeler.mock.calls[0][0] as string;
}

beforeEach(() => {
	appeler.mockReset();
});

describe('consignes système appariées à la demande', () => {
	it('un titre part sous les consignes de libellé, pas sous celles de prose', async () => {
		appeler.mockResolvedValue({ texte: 'Refonte du site vitrine' });
		await redigerChamp(nouveauMandat(), { kind: 'titre' });
		expect(consignesEnvoyees()).toBe(CONSIGNES_LIBELLE);
	});

	it('une liste de puces part sous les consignes de libellé', async () => {
		appeler.mockResolvedValue({ items: ['Hébergement'] });
		const brouillon = nouveauMandat();
		await proposerPuces(brouillon, { kind: 'inclus', id: brouillon.lignes[0].id });
		expect(consignesEnvoyees()).toBe(CONSIGNES_LIBELLE);
	});

	it.each([['objet'], ['couverture'], ['notes']] as const)(
		'la prose du champ %s part sous les consignes de prose',
		async (kind) => {
			appeler.mockResolvedValue({ texte: 'Un paragraphe de prose.' });
			await redigerChamp(nouveauMandat(), { kind });
			expect(consignesEnvoyees()).toBe(CONSIGNES);
		}
	);

	it('la revue du fond part sous ses propres consignes', async () => {
		appeler.mockResolvedValue({ alertes: [] });
		await revoirMandat(nouveauMandat());
		expect(consignesEnvoyees()).toBe(CONSIGNES_REVUE);
	});

	it('la description d’une ligne part sous les consignes de prose', async () => {
		appeler.mockResolvedValue({ texte: 'Un paragraphe de prose.' });
		const brouillon = nouveauMandat();
		await redigerChamp(brouillon, { kind: 'ligne', id: brouillon.lignes[0].id });
		expect(consignesEnvoyees()).toBe(CONSIGNES);
	});
});

describe('les deux jeux de consignes ne demandent pas la même chose', () => {
	it('celles de prose exigent des paragraphes, celles de libellé les interdisent', () => {
		// C'est exactement la contradiction qui a produit la régression.
		expect(CONSIGNES).toMatch(/paragraphes de texte courant/);
		expect(CONSIGNES_LIBELLE).not.toMatch(/paragraphe/i);
		expect(CONSIGNES_LIBELLE).toMatch(/groupe nominal/i);
	});
});

describe('ce que le modèle reçoit à lire', () => {
	it('l’invite d’un champ porte tout le mandat, pas seulement le champ visé', async () => {
		appeler.mockResolvedValue({ texte: 'Un paragraphe de prose.' });

		const brouillon = nouveauMandat();
		brouillon.titre = 'Portail des partenaires';
		brouillon.lignes[0].nom = 'Découverte et cadrage';
		brouillon.conditions.dureeGarantieJours = 90;

		await redigerChamp(brouillon, { kind: 'notes' });

		const invite = inviteEnvoyee();
		expect(invite).toContain('Portail des partenaires');
		expect(invite).toContain('Découverte et cadrage');
		expect(invite).toContain('dureeGarantieJours');
	});

	it('aucun montant ne part vers le modèle', async () => {
		appeler.mockResolvedValue({ texte: 'Un paragraphe de prose.' });

		const brouillon = nouveauMandat();
		brouillon.lignes[0].montantForfaitaire = 8400;
		brouillon.conditions.tauxHoraireHorsPerimetre = 125;

		await redigerChamp(brouillon, { kind: 'objet' });

		// L'invariant du projet, vérifié plutôt qu'affirmé. Le taux hors périmètre est une condition
		// chiffrée : il figure au contexte des clauses, mais jamais le prix des lignes.
		expect(inviteEnvoyee()).not.toContain('8400');
	});
});
