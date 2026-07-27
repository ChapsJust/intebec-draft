import type { ServiceLine } from './types';

export function lineTotal(line: ServiceLine): number {
	if (line.pricingMode === 'forfaitaire') return line.montantForfaitaire;
	if (line.pricingMode === 'horaire') return line.tauxHoraire * line.heuresEstimees;
	return line.items.reduce((sum, item) => sum + item.quantite * item.prixUnitaire, 0);
}

export function subtotal(lignes: ServiceLine[]): number {
	return lignes.reduce((sum, line) => sum + lineTotal(line), 0);
}

export function rabaisAmount(subtotalValue: number, rabaisPct: number): number {
	return subtotalValue * (rabaisPct / 100);
}

export function totalNet(lignes: ServiceLine[], rabaisPct: number): number {
	const st = subtotal(lignes);
	return st - rabaisAmount(st, rabaisPct);
}

export function formatCad(amount: number): string {
	return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(
		Number.isFinite(amount) ? amount : 0
	);
}
