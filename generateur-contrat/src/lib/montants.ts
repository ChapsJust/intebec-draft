import type { LigneService } from './types';

export function totalLigne(line: LigneService): number {
	if (line.pricingMode === 'forfaitaire') return line.montantForfaitaire;
	if (line.pricingMode === 'horaire') return line.tauxHoraire * line.heuresEstimees;
	return line.items.reduce((sum, item) => sum + item.quantite * item.prixUnitaire, 0);
}

export function sousTotal(lignes: LigneService[]): number {
	return lignes.reduce((sum, line) => sum + totalLigne(line), 0);
}

export function montantRabais(valeurSousTotal: number, rabaisPct: number): number {
	return valeurSousTotal * (rabaisPct / 100);
}

export function totalNet(lignes: LigneService[], rabaisPct: number): number {
	const st = sousTotal(lignes);
	return st - montantRabais(st, rabaisPct);
}

export function formatCad(amount: number): string {
	return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(
		Number.isFinite(amount) ? amount : 0
	);
}
