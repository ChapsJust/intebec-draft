import { describe, expect, it } from 'vitest';
import { comparerMots, comparerPassages, decouperPhrases, texteEffectif } from './diff';

/** Recompose le texte surligné en ne gardant que ce qui figure du côté IA. Sert à vérifier qu'un
 * surlignage n'invente ni ne perd de mot, sans dépendre du découpage en segments. */
const coteApres = (mots: ReturnType<typeof comparerMots>) =>
	mots
		.filter((m) => m.kind !== 'suppression')
		.map((m) => m.texte)
		.join('');

const coteAvant = (mots: ReturnType<typeof comparerMots>) =>
	mots
		.filter((m) => m.kind !== 'ajout')
		.map((m) => m.texte)
		.join('');

describe('decouperPhrases', () => {
	it('coupe sur le point, le point d’interrogation et le point d’exclamation', () => {
		expect(decouperPhrases('Premier point. Deuxième point ? Troisième point !')).toEqual([
			'Premier point.',
			'Deuxième point ?',
			'Troisième point !'
		]);
	});

	it('ne coupe pas sur le deux-points : nettoyerProse en fabrique à partir des tirets cadratins', () => {
		// C'est le cas qui compte le plus : la prose du modèle est retraitée par `nettoyerProse`, qui
		// remplace les tirets cadratins par des deux-points. Couper dessus produirait des
		// demi-phrases impossibles à refuser séparément.
		expect(
			decouperPhrases(
				'Le prestataire livre les travaux : conception, développement et mise en ligne.'
			)
		).toEqual(['Le prestataire livre les travaux : conception, développement et mise en ligne.']);
	});

	it('ne coupe pas sur le point d’une abréviation', () => {
		expect(
			decouperPhrases('Le mandat est confié à Intébec inc. pour une durée déterminée.')
		).toEqual(['Le mandat est confié à Intébec inc. pour une durée déterminée.']);
	});

	it('ne coupe pas sur une initiale isolée', () => {
		expect(decouperPhrases('Le représentant J. Chaput signe le document.')).toEqual([
			'Le représentant J. Chaput signe le document.'
		]);
	});

	it('traite le saut de paragraphe comme une frontière, même sans ponctuation', () => {
		expect(decouperPhrases('Premier paragraphe\n\nSecond paragraphe')).toEqual([
			'Premier paragraphe',
			'Second paragraphe'
		]);
	});

	it('ignore les blancs et les paragraphes vides', () => {
		expect(decouperPhrases('  \n\n  Une seule phrase.  \n\n  ')).toEqual(['Une seule phrase.']);
	});

	it('ne renvoie rien pour un texte vide', () => {
		expect(decouperPhrases('   ')).toEqual([]);
	});
});

describe('comparerPassages', () => {
	it('ne signale rien quand les deux textes sont identiques', () => {
		const texte = 'Le prestataire réalise les travaux. Le client fournit les accès.';
		expect(comparerPassages(texte, texte)).toEqual([]);
	});

	it('ignore une différence de casse, d’accents ou d’espaces : un changement invisible n’en est pas un', () => {
		const avant = 'Le prestataire réalise les travaux.';
		const apres = 'Le  prestataire realise les travaux.';
		expect(comparerPassages(avant, apres)).toEqual([]);
	});

	it('ne renvoie rien quand l’IA n’a produit aucun texte', () => {
		// `normaliser` écarte les chaînes vides : une clé absente veut dire « l'IA n'a rien produit »,
		// pas « l'IA a tout supprimé ». Il n'y a donc rien à trancher.
		expect(comparerPassages('Ma saisie.', '')).toEqual([]);
		expect(comparerPassages('Ma saisie.', '   ')).toEqual([]);
	});

	it('regroupe les phrases modifiées contiguës en un seul passage', () => {
		const avant = 'Phrase stable. Première à changer. Seconde à changer. Phrase finale.';
		const apres = 'Phrase stable. Première réécrite. Seconde réécrite. Phrase finale.';

		const passages = comparerPassages(avant, apres);

		expect(passages).toHaveLength(1);
		expect(passages[0].index).toBe(0);
		expect(passages[0].avant).toBe('Première à changer. Seconde à changer.');
		expect(passages[0].apres).toBe('Première réécrite. Seconde réécrite.');
	});

	it('sépare deux zones de changement que du texte commun éloigne', () => {
		const avant = 'Début modifié. Milieu stable. Fin modifiée.';
		const apres = 'Début réécrit. Milieu stable. Fin réécrite.';

		const passages = comparerPassages(avant, apres);

		expect(passages.map((p) => p.index)).toEqual([0, 1]);
		expect(passages[0].apres).toBe('Début réécrit.');
		expect(passages[1].apres).toBe('Fin réécrite.');
	});

	it('donne un seul passage quand tout est réécrit : c’est le cas courant de redigerDocument', () => {
		const passages = comparerPassages('Refonte du site.', 'Modernisation complète de la vitrine.');

		expect(passages).toHaveLength(1);
		expect(passages[0].avant).toBe('Refonte du site.');
		expect(passages[0].apres).toBe('Modernisation complète de la vitrine.');
	});

	it('expose un passage sans côté « avant » quand la saisie était vide', () => {
		const passages = comparerPassages('', 'Paragraphe rédigé de toutes pièces.');

		expect(passages).toHaveLength(1);
		expect(passages[0].avant).toBe('');
		expect(passages[0].apres).toBe('Paragraphe rédigé de toutes pièces.');
	});

	it('expose un passage sans côté « après » quand l’IA a retiré une phrase', () => {
		const passages = comparerPassages('Phrase gardée. Phrase retirée.', 'Phrase gardée.');

		expect(passages).toHaveLength(1);
		expect(passages[0].avant).toBe('Phrase retirée.');
		expect(passages[0].apres).toBe('');
	});

	it('numérote les passages de façon contiguë, pour servir de clé dans redaction.refuses', () => {
		const avant = 'A modifié. Stable un. B modifié. Stable deux. C modifié.';
		const apres = 'A réécrit. Stable un. B réécrit. Stable deux. C réécrit.';

		expect(comparerPassages(avant, apres).map((p) => p.index)).toEqual([0, 1, 2]);
	});
});

describe('comparerMots', () => {
	it('ne marque ni ajout ni suppression sur un mot inchangé', () => {
		const mots = comparerMots('le site web', 'le site web');
		expect(mots.every((m) => m.kind === 'egal')).toBe(true);
	});

	it('isole le mot remplacé et laisse le reste en commun', () => {
		const mots = comparerMots('Refonte du site.', 'Refonte du portail.');

		expect(mots.filter((m) => m.kind === 'suppression').map((m) => m.texte.trim())).toEqual([
			'site.'
		]);
		expect(mots.filter((m) => m.kind === 'ajout').map((m) => m.texte.trim())).toEqual(['portail.']);
	});

	it('reconstitue chacun des deux textes à partir du surlignage', () => {
		const avant = 'Le prestataire livre les travaux convenus.';
		const apres = 'Le prestataire livre sans délai les travaux.';
		const mots = comparerMots(avant, apres);

		expect(coteAvant(mots)).toBe(avant);
		expect(coteApres(mots)).toBe(apres);
	});

	it('rend un ajout pur quand il n’y avait rien avant', () => {
		const mots = comparerMots('', 'Texte neuf.');
		expect(mots).toEqual([{ kind: 'ajout', texte: 'Texte neuf.' }]);
	});
});

describe('texteEffectif', () => {
	const saisie = 'Phrase stable. Phrase saisie.';
	const ia = 'Phrase stable. Phrase réécrite.';

	it('rend la saisie quand l’IA n’a rien produit', () => {
		expect(texteEffectif(saisie, undefined)).toBe(saisie);
		expect(texteEffectif(saisie, '')).toBe(saisie);
		expect(texteEffectif(saisie, '   ')).toBe(saisie);
	});

	it('rend la prose de l’IA quand aucun passage n’est refusé', () => {
		expect(texteEffectif(saisie, ia)).toBe(ia);
		expect(texteEffectif(saisie, ia, [])).toBe(ia);
	});

	it('rend la phrase saisie pour le passage refusé', () => {
		expect(texteEffectif(saisie, ia, [0])).toBe(saisie);
	});

	it('ne perd pas les autres réécritures du champ quand un seul passage est refusé', () => {
		const avant = 'Début saisi. Milieu stable. Fin saisie.';
		const apres = 'Début réécrit. Milieu stable. Fin réécrite.';

		// Passage 0 refusé, passage 1 gardé : le résultat est un mélange des deux versions, ce qui est
		// exactement l'intérêt de trancher passage par passage plutôt que champ par champ.
		expect(texteEffectif(avant, apres, [0])).toBe('Début saisi. Milieu stable. Fin réécrite.');
		expect(texteEffectif(avant, apres, [1])).toBe('Début réécrit. Milieu stable. Fin saisie.');
		expect(texteEffectif(avant, apres, [0, 1])).toBe(avant);
	});

	it('retire le passage quand l’IA a supprimé une phrase et que la suppression est gardée', () => {
		expect(texteEffectif('Phrase gardée. Phrase retirée.', 'Phrase gardée.')).toBe(
			'Phrase gardée.'
		);
	});

	it('rétablit la phrase supprimée quand la suppression est refusée', () => {
		expect(texteEffectif('Phrase gardée. Phrase retirée.', 'Phrase gardée.', [0])).toBe(
			'Phrase gardée. Phrase retirée.'
		);
	});

	it('vide le champ quand on refuse un ajout fait sur une saisie vide', () => {
		expect(texteEffectif('', 'Paragraphe rédigé de toutes pièces.', [0])).toBe('');
	});

	it('rétablit les sauts de paragraphe malgré un refus', () => {
		// Le découpage en phrases perd les `\n\n` : sans marque interne, refuser un seul passage
		// aplatissait tout le champ en un bloc, y compris les paragraphes que l'IA n'avait pas touchés.
		const avant = 'Premier saisi.\n\nSecond stable.';
		const apres = 'Premier réécrit.\n\nSecond stable.';

		expect(texteEffectif(avant, apres, [0])).toBe('Premier saisi.\n\nSecond stable.');
		expect(texteEffectif(avant, apres, [])).toBe(apres);
	});

	it('rend un paragraphe ajouté par l’IA quand il est conservé', () => {
		const avant = 'Un seul paragraphe.';
		const apres = 'Un seul paragraphe.\n\nUn second, ajouté.';

		expect(texteEffectif(avant, apres, [])).toBe(apres);
		expect(texteEffectif(avant, apres, [0])).toBe(avant);
	});

	it('ignore un index hors bornes plutôt que d’empêcher l’affichage du document', () => {
		// Le cas arrive si le brouillon est modifié après un refus : le découpage change sous les index
		// déjà stockés. Retomber sur la prose de l'IA est préférable à une page en erreur.
		expect(texteEffectif(saisie, ia, [7])).toBe(ia);
		expect(texteEffectif(saisie, ia, [0, 7])).toBe(saisie);
	});
});
