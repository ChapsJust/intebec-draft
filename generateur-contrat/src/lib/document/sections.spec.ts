import { describe, expect, it } from 'vitest';
import { buildDocument } from './sections';
import { createEmptyDraft, createEmptyLigne } from '$lib/mandat';
import { formatCad, totalNet } from '$lib/pricing';
import type { MandatDraft, RedactionIA, ServiceLine } from '$lib/types';

function ligne(overrides: Partial<ServiceLine>): ServiceLine {
	return { ...createEmptyLigne(), ...overrides };
}

function draft(modifier: (d: MandatDraft) => void = () => {}): MandatDraft {
	const d = createEmptyDraft('contrat');
	d.titre = 'Refonte du site';
	d.objet = 'Refonte complète du site web.';
	d.client.nom = 'Boulangerie Tremblay';
	d.lignes = [ligne({ nom: 'Conception', montantForfaitaire: 4000 })];
	modifier(d);
	return d;
}

const section = (d: MandatDraft, titre: string) =>
	buildDocument(d).sections.find((s) => s.titre === titre);

describe('buildDocument : structure', () => {
	it('numérote les sections séquentiellement à partir de 1', () => {
		const numeros = buildDocument(draft()).sections.map((s) => s.numero);
		expect(numeros).toEqual(numeros.map((_, i) => i + 1));
	});

	it('distingue contrat et soumission', () => {
		expect(buildDocument(draft((d) => (d.type = 'contrat'))).typeLabel).toBe('Contrat de services');
		expect(buildDocument(draft((d) => (d.type = 'soumission'))).typeLabel).toBe('Soumission');
	});

	it('ajoute une section de validité aux soumissions seulement', () => {
		const soumission = buildDocument(draft((d) => (d.type = 'soumission')));
		const contrat = buildDocument(draft((d) => (d.type = 'contrat')));

		expect(soumission.sections.map((s) => s.titre)).toContain('Validité de la soumission');
		expect(contrat.sections.map((s) => s.titre)).not.toContain('Validité de la soumission');
	});

	it('n’ajoute la section de dispositions particulières que si des notes existent', () => {
		const sans = buildDocument(draft()).sections.map((s) => s.titre);
		const avec = buildDocument(
			draft((d) => (d.conditions.notesAdditionnelles = 'Une note.'))
		).sections.map((s) => s.titre);

		expect(sans).not.toContain('Dispositions particulières');
		expect(avec).toContain('Dispositions particulières');
	});
});

describe('buildDocument : densité automatique', () => {
	it('aère une soumission courte', () => {
		const d = draft((x) => {
			x.type = 'soumission';
			x.objet = 'Refonte du logo.';
			x.lignes = [ligne({ nom: 'Logo', montantForfaitaire: 800 })];
			x.conditions.clauses = {
				confidentialite: false,
				limitationResponsabilite: false,
				propriete: false,
				litiges: false,
				signatureElectronique: false
			};
			x.conditions.dureeGarantieJours = 0;
			x.conditions.dureeSupportMois = 0;
			x.conditions.heuresFormationIncluses = 0;
			x.conditions.preavisResiliationJours = 0;
			x.conditions.tauxHoraireHorsPerimetre = 0;
		});

		expect(buildDocument(d).densite).toBe('aere');
	});

	it('resserre un contrat chargé', () => {
		const d = draft((x) => {
			x.lignes = Array.from({ length: 8 }, (_, i) =>
				ligne({
					nom: `Volet ${i + 1}`,
					montantForfaitaire: 2000,
					description: 'Description détaillée des travaux prévus pour ce volet du mandat.',
					inclus: ['Élément un', 'Élément deux', 'Élément trois']
				})
			);
		});

		expect(buildDocument(d).densite).toBe('compact');
	});

	it('garde une densité normale pour un mandat courant', () => {
		expect(buildDocument(draft()).densite).toBe('normal');
	});
});

describe('buildDocument : montants', () => {
	it('reprend exactement le total calculé par pricing.ts', () => {
		const d = draft((x) => {
			x.lignes = [
				ligne({ nom: 'A', montantForfaitaire: 3000 }),
				ligne({ nom: 'B', pricingMode: 'horaire', tauxHoraire: 100, heuresEstimees: 10 })
			];
			x.conditions.rabaisPct = 20;
		});

		const honoraires = section(d, 'Honoraires')?.contenu;
		if (honoraires?.kind !== 'honoraires') throw new Error('section honoraires absente');

		expect(honoraires.sousTotal).toBe(formatCad(4000));
		expect(honoraires.total).toBe(formatCad(totalNet(d.lignes, 20)));
	});

	it('n’affiche la ligne de rabais que lorsqu’un rabais est appliqué', () => {
		const sans = section(draft(), 'Honoraires')?.contenu;
		const avec = section(
			draft((d) => (d.conditions.rabaisPct = 15)),
			'Honoraires'
		)?.contenu;

		if (sans?.kind !== 'honoraires' || avec?.kind !== 'honoraires') {
			throw new Error('section honoraires absente');
		}
		expect(sans.rabais).toBeNull();
		expect(avec.rabais?.pct).toBe(15);
	});

	it('répartit l’échéancier selon les pourcentages saisis', () => {
		const d = draft((x) => {
			x.lignes = [ligne({ nom: 'A', montantForfaitaire: 10000 })];
			x.modalitesPaiement = { acomptePct: 40, soldePct: 60, delaiJoursSolde: 30 };
		});

		const echeancier = section(d, 'Modalités de paiement')?.contenu;
		if (echeancier?.kind !== 'echeancier') throw new Error('section échéancier absente');

		expect(echeancier.versements.map((v) => v.montant)).toEqual([formatCad(4000), formatCad(6000)]);
	});

	it('omet un versement à 0 %', () => {
		const d = draft(
			(x) => (x.modalitesPaiement = { acomptePct: 0, soldePct: 100, delaiJoursSolde: 30 })
		);
		const echeancier = section(d, 'Modalités de paiement')?.contenu;
		if (echeancier?.kind !== 'echeancier') throw new Error('section échéancier absente');

		expect(echeancier.versements).toHaveLength(1);
	});

	it('mentionne l’abonnement récurrent en note seulement s’il est actif', () => {
		const d = draft((x) => {
			x.abonnement = {
				actif: true,
				frequence: 'mensuel',
				montant: 250,
				couverture: 'l’hébergement',
				periodeOfferteMois: 3
			};
		});

		const echeancier = section(d, 'Modalités de paiement')?.contenu;
		if (echeancier?.kind !== 'echeancier') throw new Error('section échéancier absente');

		const notes = echeancier.notes.join(' ');
		expect(notes).toContain('par mois');
		expect(notes).toContain('trois (3) premiers mois');
	});
});

describe('buildDocument : portée', () => {
	it('nomme les entrées selon la structure du projet', () => {
		const d = draft((x) => (x.structureProjet = 'phases'));
		const portee = section(d, 'Portée des travaux')?.contenu;
		if (portee?.kind !== 'portee') throw new Error('section portée absente');

		expect(portee.entrees[0].label).toBe('Phase 1');
		expect(portee.entrees[0].nom).toBe('Conception');
	});

	it('retire les éléments vides des listes inclus / non inclus', () => {
		const d = draft((x) => {
			x.lignes = [ligne({ nom: 'A', montantForfaitaire: 100, inclus: ['Hébergement', '', '  '] })];
		});
		const portee = section(d, 'Portée des travaux')?.contenu;
		if (portee?.kind !== 'portee') throw new Error('section portée absente');

		expect(portee.entrees[0].inclus).toEqual(['Hébergement']);
	});

	it('détaille la tarification horaire', () => {
		const d = draft((x) => {
			x.lignes = [
				ligne({ nom: 'A', pricingMode: 'horaire', tauxHoraire: 125, heuresEstimees: 12 })
			];
		});
		const portee = section(d, 'Portée des travaux')?.contenu;
		if (portee?.kind !== 'portee') throw new Error('section portée absente');

		// Construit depuis formatCad : le format fr-CA insère une espace insécable étroite avant
		// le symbole monétaire, invisible mais différente d'une espace ordinaire.
		expect(portee.entrees[0].tarification).toEqual([
			`${formatCad(125)}/heure × 12 heures estimées`
		]);
	});

	it('éclate le mode quantité en une entrée par élément facturé', () => {
		const d = draft((x) => {
			x.lignes = [
				ligne({
					nom: 'A',
					pricingMode: 'quantite',
					items: [
						{ id: '1', description: 'Gabarit', quantite: 6, prixUnitaire: 450 },
						{ id: '2', description: 'Migration', quantite: 40, prixUnitaire: 35 }
					]
				})
			];
		});
		const portee = section(d, 'Portée des travaux')?.contenu;
		if (portee?.kind !== 'portee') throw new Error('section portée absente');

		expect(portee.entrees[0].tarification).toHaveLength(2);
	});
});

describe('buildDocument : rédaction IA', () => {
	const redaction = (partiel: Partial<RedactionIA>): RedactionIA => ({
		preambule: '',
		objet: '',
		lignes: {},
		genereLe: '2026-07-27T10:00:00.000Z',
		modele: 'llama3.1:8b',
		...partiel
	});

	it('substitue la prose de l’IA à la saisie', () => {
		const d = draft();
		const doc = buildDocument(d, redaction({ objet: 'Objet réécrit par l’IA.' }));
		const objet = doc.sections[0].contenu;
		if (objet.kind !== 'paragraphes') throw new Error('section objet absente');

		expect(objet.textes.join(' ')).toContain('Objet réécrit par l’IA.');
		expect(objet.textes.join(' ')).not.toContain('Refonte complète du site web.');
		expect(doc.redigeParIA).toBe(true);
	});

	it('retombe sur la saisie quand l’IA n’a rien produit pour un champ', () => {
		const doc = buildDocument(draft(), redaction({ objet: '   ' }));
		const objet = doc.sections[0].contenu;
		if (objet.kind !== 'paragraphes') throw new Error('section objet absente');

		expect(objet.textes.join(' ')).toContain('Refonte complète du site web.');
	});

	it('ne laisse pas l’IA modifier les montants', () => {
		const d = draft((x) => (x.lignes = [ligne({ nom: 'A', montantForfaitaire: 7500 })]));
		const sansIA = section(d, 'Honoraires')?.contenu;
		const avecIA = buildDocument(d, redaction({ objet: 'Autre chose.' })).sections.find(
			(s) => s.titre === 'Honoraires'
		)?.contenu;

		if (sansIA?.kind !== 'honoraires' || avecIA?.kind !== 'honoraires') {
			throw new Error('section honoraires absente');
		}
		expect(avecIA.total).toBe(sansIA.total);
	});
});
