import { describe, expect, it } from 'vitest';
import { lineTotal, subtotal, rabaisAmount, totalNet, formatCad } from './pricing';
import { createEmptyLigne } from './mandat';
import type { ServiceLine } from './types';

function ligne(overrides: Partial<ServiceLine>): ServiceLine {
	return { ...createEmptyLigne(), ...overrides };
}

describe('lineTotal', () => {
	it('utilise le montant forfaitaire en mode forfaitaire', () => {
		expect(lineTotal(ligne({ pricingMode: 'forfaitaire', montantForfaitaire: 1500 }))).toBe(1500);
	});

	it('multiplie taux et heures en mode horaire', () => {
		expect(lineTotal(ligne({ pricingMode: 'horaire', tauxHoraire: 100, heuresEstimees: 8 }))).toBe(
			800
		);
	});

	it('additionne quantité × prix unitaire en mode quantité', () => {
		expect(
			lineTotal(
				ligne({
					pricingMode: 'quantite',
					items: [
						{ id: '1', description: 'A', quantite: 2, prixUnitaire: 50 },
						{ id: '2', description: 'B', quantite: 1, prixUnitaire: 25 }
					]
				})
			)
		).toBe(125);
	});
});

describe('subtotal / rabaisAmount / totalNet', () => {
	const lignes = [
		ligne({ pricingMode: 'forfaitaire', montantForfaitaire: 1000 }),
		ligne({ pricingMode: 'forfaitaire', montantForfaitaire: 500 })
	];

	it('additionne le total de toutes les lignes', () => {
		expect(subtotal(lignes)).toBe(1500);
	});

	it('calcule le montant du rabais à partir du pourcentage', () => {
		expect(rabaisAmount(1500, 10)).toBe(150);
	});

	it('soustrait le rabais du sous-total', () => {
		expect(totalNet(lignes, 10)).toBe(1350);
	});

	it('ne soustrait rien quand le rabais est à 0', () => {
		expect(totalNet(lignes, 0)).toBe(1500);
	});
});

describe('formatCad', () => {
	it('formate un montant en dollars canadiens', () => {
		expect(formatCad(1234.5)).toContain('1');
		expect(formatCad(1234.5)).toContain('234');
	});

	it('retombe sur 0 pour un montant non fini', () => {
		expect(formatCad(NaN)).toBe(formatCad(0));
	});
});
