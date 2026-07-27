import { describe, expect, it } from 'vitest';
import {
	enLettres,
	nombreContractuel,
	formatDateLongue,
	libelleLigne,
	nettoyerListe,
	elider
} from './format';

describe('enLettres', () => {
	it('écrit les petits nombres', () => {
		expect(enLettres(0)).toBe('zéro');
		expect(enLettres(7)).toBe('sept');
		expect(enLettres(16)).toBe('seize');
	});

	it('écrit les nombres entre 17 et 19', () => {
		expect(enLettres(17)).toBe('dix-sept');
		expect(enLettres(19)).toBe('dix-neuf');
	});

	it('applique le trait d’union et le « et » des dizaines', () => {
		expect(enLettres(21)).toBe('vingt-et-un');
		expect(enLettres(30)).toBe('trente');
		expect(enLettres(45)).toBe('quarante-cinq');
	});

	it('gère les irrégularités de 70 à 99', () => {
		expect(enLettres(70)).toBe('soixante-dix');
		expect(enLettres(71)).toBe('soixante-et-onze');
		expect(enLettres(77)).toBe('soixante-dix-sept');
		expect(enLettres(80)).toBe('quatre-vingts');
		expect(enLettres(90)).toBe('quatre-vingt-dix');
		expect(enLettres(99)).toBe('quatre-vingt-dix-neuf');
	});

	it('gère les centaines', () => {
		expect(enLettres(100)).toBe('cent');
		expect(enLettres(120)).toBe('cent-vingt');
		expect(enLettres(200)).toBe('deux-cents');
		expect(enLettres(365)).toBe('trois-cent-soixante-cinq');
	});

	it('retombe sur les chiffres hors de la plage supportée', () => {
		expect(enLettres(1000)).toBe('1000');
		expect(enLettres(-5)).toBe('-5');
		expect(enLettres(12.5)).toBe('12.5');
	});
});

describe('nombreContractuel', () => {
	it('accole les lettres et les chiffres', () => {
		expect(nombreContractuel(30)).toBe('trente (30)');
	});
});

describe('formatDateLongue', () => {
	it('formate une date ISO en français', () => {
		expect(formatDateLongue('2026-07-27')).toBe('27 juillet 2026');
	});

	it('ne recule pas d’un jour malgré le fuseau horaire', () => {
		// Le piège classique de `new Date('2026-01-01')`, interprété en UTC puis reculé au
		// 31 décembre dans les fuseaux négatifs comme celui du Québec.
		expect(formatDateLongue('2026-01-01')).toBe('1 janvier 2026');
	});

	it('accepte une date-heure ISO complète', () => {
		expect(formatDateLongue('2026-03-15T14:32:00.000Z')).toBe('15 mars 2026');
	});

	it('retourne la valeur telle quelle si elle n’est pas une date', () => {
		expect(formatDateLongue('')).toBe('');
	});
});

describe('libelleLigne', () => {
	it('nomme l’entité selon la structure du projet', () => {
		expect(libelleLigne('phases')).toBe('Phase');
		expect(libelleLigne('blocs')).toBe('Bloc');
		expect(libelleLigne('recurrent')).toBe('Service');
	});
});

describe('elider', () => {
	it('élide devant une voyelle', () => {
		expect(elider('de', 'Intébec')).toBe('d’Intébec');
		expect(elider('le', 'Objet')).toBe('l’Objet');
	});

	it('n’élide pas devant une consonne', () => {
		expect(elider('de', 'Tremblay')).toBe('de Tremblay');
	});

	it('reconnaît les voyelles accentuées', () => {
		expect(elider('de', 'Édouard')).toBe('d’Édouard');
	});
});

describe('nettoyerListe', () => {
	it('retire les entrées vides laissées par l’éditeur', () => {
		expect(nettoyerListe(['Sauvegarde', '  ', '', ' Support '])).toEqual(['Sauvegarde', 'Support']);
	});
});
