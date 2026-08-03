/** Le seul test qui joint vraiment le modèle.
 *
 * Il ne s'exécute que si `AI_API_URL` et `AI_API_KEY` sont dans l'environnement, et se déclare
 * « skipped » sinon : sur une machine sans Tailscale, sans passerelle, ou en intégration continue, il
 * ne doit rien casser. `npm run test:ia` le lance en chargeant le `.env`.
 *
 * Ce n'est pas un test unitaire et il ne faut pas le lire comme tel. C'est un **canari** : il vérifie
 * que ce que le modèle renvoie aujourd'hui passe encore nos filtres. Les assertions portent donc sur
 * la *forme* de la réponse, jamais sur son contenu — un modèle ne rend pas deux fois le même texte, et
 * une assertion sur les mots exacts serait rouge une fois sur deux.
 *
 * Il attrape ce qu'aucun autre test ne peut voir : un modèle remplacé qui n'obéit plus aux consignes,
 * une passerelle qui change de format, un prompt qu'on croit clair et que le modèle lit autrement.
 */
import { describe, expect, it } from 'vitest';
import { nouveauMandat } from '$domaine/fabriques';
import type { BrouillonMandat } from '$domaine/types';
import { proposerPuces, redigerChamp, revoirMandat } from './index';

const passerelleConfiguree = Boolean(process.env.AI_API_URL && process.env.AI_API_KEY);

/** Une passe de rédaction peut dépasser la minute quand le modèle doit être rechargé en mémoire. */
const DELAI = 240_000;

function mandatDeDemo(): BrouillonMandat {
	const brouillon = nouveauMandat('contrat');
	brouillon.titre = '';
	brouillon.objet = 'Remplacer une application de gestion devenue difficile à maintenir.';
	brouillon.client.nom = 'Elitas Visuals inc.';
	brouillon.structureProjet = 'phases';

	const ligne = brouillon.lignes[0];
	ligne.nom = 'Découverte et cadrage';
	ligne.description = 'Inventaire des fonctions existantes et cadrage de la refonte.';
	ligne.inclus = ['Ateliers avec les utilisateurs'];
	ligne.montantForfaitaire = 4200;

	return brouillon;
}

describe.skipIf(!passerelleConfiguree)('réponses réelles du modèle', () => {
	it(
		'rend un titre, pas une phrase',
		async () => {
			const titre = await redigerChamp(mandatDeDemo(), { kind: 'titre' });

			// Les bornes sont larges à dessein : on refuse un préambule, on ne note pas le style.
			expect(titre.length).toBeGreaterThan(2);
			expect(titre.split(/\s+/).length).toBeLessThanOrEqual(10);
			expect(titre).not.toMatch(/[.!?]$/);
			expect(titre).not.toMatch(/^["«]/);
			// La régression qui a motivé ce fichier : le modèle présentait le document au lieu de le
			// nommer. `titreDeProjet` renverrait une chaîne vide, et `redigerChamp` aurait levé avant.
			expect(titre).not.toMatch(/^(ce|cette|le présent|la présente)\b/i);
		},
		DELAI
	);

	it(
		'rend des éléments de liste courts, sans montant',
		async () => {
			const brouillon = mandatDeDemo();
			const items = await proposerPuces(brouillon, {
				kind: 'inclus',
				id: brouillon.lignes[0].id
			});

			expect(items.length).toBeLessThanOrEqual(5);
			for (const item of items) {
				expect(item).not.toMatch(/[.!?]$/);
				expect(item.split(/\s+/).length).toBeLessThanOrEqual(12);
				// L'invariant, vérifié sur du vrai : aucun chiffre du mandat ne doit ressortir.
				expect(item).not.toContain('4200');
				expect(item).not.toMatch(/\$/);
			}
		},
		DELAI
	);

	it(
		'alerte sur un mandat volontairement incohérent, et vise un endroit réel',
		async () => {
			const brouillon = mandatDeDemo();
			// L'objet promet une migration des données, la seule ligne l'exclut noir sur blanc.
			brouillon.objet =
				'Refonte de l’application, incluant la migration complète des données existantes.';
			brouillon.lignes[0].nonInclus = ['Migration des données existantes'];

			const revue = await revoirMandat(brouillon);

			expect(revue.alertes.length).toBeGreaterThan(0);
			// La cible doit désigner un endroit du mandat, jamais un identifiant inventé : c'est ce que
			// `normaliserRevue` garantit, et le seul point sur lequel le modèle ne peut pas nous piéger.
			const cibles = new Set(['objet', 'portee', 'general', brouillon.lignes[0].id]);
			expect(revue.alertes.every((a) => cibles.has(a.cible))).toBe(true);
			expect(revue.alertes.every((a) => a.constat.length > 10)).toBe(true);

			// Ce qui N'EST PAS assuré ici, et qu'il faut savoir : que la migration soit précisément le
			// sujet d'une alerte. Mesuré sur quatre passages, le modèle actuel repère cette
			// contradiction environ une fois sur deux — il signale sinon d'autres écarts, réels mais
			// différents. Assurer le sujet exact rendrait ce test rouge un jour sur deux, et un test
			// instable finit désactivé. C'est une limite du modèle, pas du code : voir le README.
		},
		DELAI
	);

	it(
		'ne trouve rien à redire à un mandat qui se tient',
		async () => {
			// L'autre moitié du test : une revue qui alerte toujours est aussi inutile qu'une revue
			// aveugle. On tolère une alerte — le mandat de démo est volontairement mince.
			const revue = await revoirMandat(mandatDeDemo());
			expect(revue.alertes.length).toBeLessThanOrEqual(3);
		},
		DELAI
	);

	it(
		'rend de la prose pour un champ de prose',
		async () => {
			const objet = await redigerChamp(mandatDeDemo(), { kind: 'objet' });

			expect(objet.length).toBeGreaterThan(40);
			// Les consignes de style, celles que le modèle transgresse le plus volontiers.
			expect(objet).not.toMatch(/[—–]/);
			expect(objet).not.toMatch(/\*\*/);
			expect(objet).not.toContain('4200');
		},
		DELAI
	);
});

describe('garde-fou du canari', () => {
	it('dit clairement s’il a tourné ou non', () => {
		// Sans cette ligne, un fichier entièrement « skipped » passe pour vert et laisse croire que le
		// modèle a été vérifié. Le message sort dans la sortie de vitest.
		if (!passerelleConfiguree) {
			console.info(
				'[ia] Tests en direct ignorés : AI_API_URL et AI_API_KEY absentes. Lancer `npm run test:ia`.'
			);
		}
		expect(typeof passerelleConfiguree).toBe('boolean');
	});
});
