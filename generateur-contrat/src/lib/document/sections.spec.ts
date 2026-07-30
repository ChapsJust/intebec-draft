import { describe, expect, it } from 'vitest';
import { construireDocument, preambuleParDefaut } from './sections';
import { nouveauMandat, nouvelleLigne } from '$domaine/fabriques';
import { formatCad, totalNet } from '$domaine/montants';
import type { BrouillonMandat, RedactionIA, LigneService } from '$domaine/types';

function ligne(overrides: Partial<LigneService>): LigneService {
	return { ...nouvelleLigne(), ...overrides };
}

function brouillon(modifier: (d: BrouillonMandat) => void = () => {}): BrouillonMandat {
	const d = nouveauMandat('contrat');
	d.titre = 'Refonte du site';
	d.objet = 'Refonte complète du site web.';
	d.client.nom = 'Boulangerie Tremblay';
	d.lignes = [ligne({ nom: 'Conception', montantForfaitaire: 4000 })];
	modifier(d);
	return d;
}

const section = (d: BrouillonMandat, titre: string) =>
	construireDocument(d).sections.find((s) => s.titre === titre);

describe('construireDocument : structure', () => {
	it('numérote les sections séquentiellement à partir de 1', () => {
		const numeros = construireDocument(brouillon()).sections.map((s) => s.numero);
		expect(numeros).toEqual(numeros.map((_, i) => i + 1));
	});

	it('distingue contrat et soumission', () => {
		expect(construireDocument(brouillon((d) => (d.type = 'contrat'))).typeLabel).toBe(
			'Contrat de services'
		);
		expect(construireDocument(brouillon((d) => (d.type = 'soumission'))).typeLabel).toBe(
			'Soumission'
		);
	});

	it('ajoute une section de validité aux soumissions seulement', () => {
		const soumission = construireDocument(brouillon((d) => (d.type = 'soumission')));
		const contrat = construireDocument(brouillon((d) => (d.type = 'contrat')));

		expect(soumission.sections.map((s) => s.titre)).toContain('Validité de la soumission');
		expect(contrat.sections.map((s) => s.titre)).not.toContain('Validité de la soumission');
	});

	it('n’ajoute la section de dispositions particulières que si des notes existent', () => {
		const sans = construireDocument(brouillon()).sections.map((s) => s.titre);
		const avec = construireDocument(
			brouillon((d) => (d.conditions.notesAdditionnelles = 'Une note.'))
		).sections.map((s) => s.titre);

		expect(sans).not.toContain('Dispositions particulières');
		expect(avec).toContain('Dispositions particulières');
	});
});

describe('construireDocument : densité automatique', () => {
	it('aère une soumission courte', () => {
		const d = brouillon((x) => {
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

		expect(construireDocument(d).densite).toBe('aere');
	});

	it('resserre un contrat chargé', () => {
		const d = brouillon((x) => {
			x.lignes = Array.from({ length: 8 }, (_, i) =>
				ligne({
					nom: `Volet ${i + 1}`,
					montantForfaitaire: 2000,
					description: 'Description détaillée des travaux prévus pour ce volet du mandat.',
					inclus: ['Élément un', 'Élément deux', 'Élément trois']
				})
			);
		});

		expect(construireDocument(d).densite).toBe('compact');
	});

	it('garde une densité normale pour un mandat courant', () => {
		expect(construireDocument(brouillon()).densite).toBe('normal');
	});
});

describe('construireDocument : montants', () => {
	it('reprend exactement le total calculé par montants.ts', () => {
		const d = brouillon((x) => {
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
		const sans = section(brouillon(), 'Honoraires')?.contenu;
		const avec = section(
			brouillon((d) => (d.conditions.rabaisPct = 15)),
			'Honoraires'
		)?.contenu;

		if (sans?.kind !== 'honoraires' || avec?.kind !== 'honoraires') {
			throw new Error('section honoraires absente');
		}
		expect(sans.rabais).toBeNull();
		expect(avec.rabais?.pct).toBe(15);
	});

	it('répartit l’échéancier selon les pourcentages saisis', () => {
		const d = brouillon((x) => {
			x.lignes = [ligne({ nom: 'A', montantForfaitaire: 10000 })];
			x.modalitesPaiement = { acomptePct: 40, soldePct: 60, delaiJoursSolde: 30 };
		});

		const echeancier = section(d, 'Modalités de paiement')?.contenu;
		if (echeancier?.kind !== 'echeancier') throw new Error('section échéancier absente');

		expect(echeancier.versements.map((v) => v.montant)).toEqual([formatCad(4000), formatCad(6000)]);
	});

	it('omet un versement à 0 %', () => {
		const d = brouillon(
			(x) => (x.modalitesPaiement = { acomptePct: 0, soldePct: 100, delaiJoursSolde: 30 })
		);
		const echeancier = section(d, 'Modalités de paiement')?.contenu;
		if (echeancier?.kind !== 'echeancier') throw new Error('section échéancier absente');

		expect(echeancier.versements).toHaveLength(1);
	});

	it('parle de paiement intégral, pas de « solde », quand tout est payé à la livraison', () => {
		// « Solde (100 %) » sans acompte qui précède se lit comme une erreur de saisie.
		const d = brouillon((x) => {
			x.lignes = [ligne({ nom: 'A', montantForfaitaire: 8000 })];
			x.modalitesPaiement = { acomptePct: 0, soldePct: 100, delaiJoursSolde: 0 };
		});
		const echeancier = section(d, 'Modalités de paiement')?.contenu;
		if (echeancier?.kind !== 'echeancier') throw new Error('section échéancier absente');

		expect(echeancier.versements).toHaveLength(1);
		expect(echeancier.versements[0].libelle).toContain('Paiement intégral');
		expect(echeancier.versements[0].libelle).not.toContain('Solde');
		expect(echeancier.versements[0].echeance).toBe('À la livraison');
		expect(echeancier.versements[0].montant).toBe(formatCad(8000));
	});

	it('reporte l’échéance du paiement unique selon le délai saisi', () => {
		const d = brouillon(
			(x) => (x.modalitesPaiement = { acomptePct: 0, soldePct: 100, delaiJoursSolde: 30 })
		);
		const echeancier = section(d, 'Modalités de paiement')?.contenu;
		if (echeancier?.kind !== 'echeancier') throw new Error('section échéancier absente');

		expect(echeancier.versements[0].echeance).toBe('Net trente (30) jours suivant la livraison');
	});

	it('annonce un paiement à la signature quand l’acompte couvre tout', () => {
		const d = brouillon((x) => {
			x.lignes = [ligne({ nom: 'A', montantForfaitaire: 8000 })];
			x.modalitesPaiement = { acomptePct: 100, soldePct: 0, delaiJoursSolde: 30 };
		});
		const echeancier = section(d, 'Modalités de paiement')?.contenu;
		if (echeancier?.kind !== 'echeancier') throw new Error('section échéancier absente');

		expect(echeancier.versements).toHaveLength(1);
		expect(echeancier.versements[0].libelle).toContain('Paiement intégral');
		expect(echeancier.versements[0].echeance).toContain('signature');
		expect(echeancier.versements[0].montant).toBe(formatCad(8000));
	});

	it('mentionne l’abonnement récurrent en note seulement s’il est actif', () => {
		const d = brouillon((x) => {
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

describe('construireDocument : portée', () => {
	it('nomme les entrées selon la structure du projet', () => {
		const d = brouillon((x) => (x.structureProjet = 'phases'));
		const portee = section(d, 'Portée des travaux')?.contenu;
		if (portee?.kind !== 'portee') throw new Error('section portée absente');

		expect(portee.entrees[0].label).toBe('Phase 1');
		expect(portee.entrees[0].nom).toBe('Conception');
	});

	it('retire les éléments vides des listes inclus / non inclus', () => {
		const d = brouillon((x) => {
			x.lignes = [ligne({ nom: 'A', montantForfaitaire: 100, inclus: ['Hébergement', '', '  '] })];
		});
		const portee = section(d, 'Portée des travaux')?.contenu;
		if (portee?.kind !== 'portee') throw new Error('section portée absente');

		expect(portee.entrees[0].inclus).toEqual(['Hébergement']);
	});

	it('détaille la tarification horaire', () => {
		const d = brouillon((x) => {
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
		const d = brouillon((x) => {
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

describe('construireDocument : rédaction IA', () => {
	const redaction = (partiel: Partial<RedactionIA>): RedactionIA => ({
		preambule: '',
		objet: '',
		lignes: {},
		genereLe: '2026-07-27T10:00:00.000Z',
		modele: 'llama3.1:8b',
		...partiel
	});

	it('substitue la prose de l’IA à la saisie', () => {
		const d = brouillon();
		const doc = construireDocument(d, redaction({ objet: 'Objet réécrit par l’IA.' }));
		const objet = doc.sections[0].contenu;
		if (objet.kind !== 'paragraphes') throw new Error('section objet absente');

		expect(objet.textes.join(' ')).toContain('Objet réécrit par l’IA.');
		expect(objet.textes.join(' ')).not.toContain('Refonte complète du site web.');
		expect(doc.redigeParIA).toBe(true);
	});

	it('retombe sur la saisie quand l’IA n’a rien produit pour un champ', () => {
		const doc = construireDocument(brouillon(), redaction({ objet: '   ' }));
		const objet = doc.sections[0].contenu;
		if (objet.kind !== 'paragraphes') throw new Error('section objet absente');

		expect(objet.textes.join(' ')).toContain('Refonte complète du site web.');
	});

	it('ne laisse pas l’IA modifier les montants', () => {
		const d = brouillon((x) => (x.lignes = [ligne({ nom: 'A', montantForfaitaire: 7500 })]));
		const sansIA = section(d, 'Honoraires')?.contenu;
		const avecIA = construireDocument(d, redaction({ objet: 'Autre chose.' })).sections.find(
			(s) => s.titre === 'Honoraires'
		)?.contenu;

		if (sansIA?.kind !== 'honoraires' || avecIA?.kind !== 'honoraires') {
			throw new Error('section honoraires absente');
		}
		expect(avecIA.total).toBe(sansIA.total);
	});
});

describe('construireDocument : passages refusés', () => {
	const redaction = (partiel: Partial<RedactionIA>): RedactionIA => ({
		preambule: '',
		objet: '',
		lignes: {},
		genereLe: '2026-07-27T10:00:00.000Z',
		modele: 'llama3.1:8b',
		...partiel
	});

	/** Prose de l'objet en deux phrases, dont une seule est réécrite : c'est le cas qui distingue un
	 * refus par passage d'un refus par champ. */
	const objetSaisi = 'Le mandat porte sur le site. La mise en ligne est incluse.';
	const objetIA = 'Le mandat porte sur la refonte du site. La mise en ligne est incluse.';

	const textesObjet = (d: ReturnType<typeof brouillon>, r: RedactionIA) => {
		const contenu = construireDocument(d, r).sections[0].contenu;
		if (contenu.kind !== 'paragraphes') throw new Error('section objet absente');
		return contenu.textes.join(' ');
	};

	it('rend la saisie pour le passage refusé', () => {
		const d = brouillon((x) => (x.objet = objetSaisi));
		const texte = textesObjet(d, redaction({ objet: objetIA, refuses: { objet: [0] } }));

		expect(texte).toContain('Le mandat porte sur le site.');
		expect(texte).not.toContain('la refonte du site');
	});

	it('conserve la prose de l’IA pour les passages non refusés du même champ', () => {
		const d = brouillon((x) => (x.objet = objetSaisi));
		const texte = textesObjet(d, redaction({ objet: objetIA, refuses: { objet: [] } }));

		expect(texte).toContain('la refonte du site');
	});

	it('ne touche pas aux autres champs quand un champ est refusé', () => {
		const d = brouillon((x) => (x.objet = objetSaisi));
		const texte = textesObjet(
			d,
			redaction({
				preambule: 'Préambule réécrit par l’IA.',
				objet: objetIA,
				refuses: { objet: [0] }
			})
		);

		expect(texte).toContain('Préambule réécrit par l’IA.');
		expect(texte).toContain('Le mandat porte sur le site.');
	});

	it('rend la description saisie d’une ligne dont le passage est refusé', () => {
		const l = ligne({ nom: 'Site', montantForfaitaire: 5000 });
		l.description = 'Conception de la vitrine.';
		const d = brouillon((x) => (x.lignes = [l]));

		const contenu = construireDocument(
			d,
			redaction({
				lignes: { [l.id]: 'Conception complète de la vitrine.' },
				refuses: { [l.id]: [0] }
			})
		).sections.find((s) => s.titre === 'Portée des travaux')?.contenu;

		if (contenu?.kind !== 'portee') throw new Error('section portée absente');
		expect(contenu.entrees[0].description).toBe('Conception de la vitrine.');
	});

	it('tolère une rédaction enregistrée avant l’arrivée des refus', () => {
		// Les lignes déjà en base n'ont pas la clé `refuses` : la colonne jsonb ne les a pas migrées.
		const d = brouillon((x) => (x.objet = objetSaisi));
		expect(textesObjet(d, redaction({ objet: objetIA }))).toContain('la refonte du site');
	});

	it('ne laisse pas un refus modifier les montants', () => {
		const d = brouillon((x) => (x.lignes = [ligne({ nom: 'A', montantForfaitaire: 7500 })]));
		const sansIA = section(d, 'Honoraires')?.contenu;
		const avecRefus = construireDocument(
			d,
			redaction({ objet: objetIA, refuses: { objet: [0] } })
		).sections.find((s) => s.titre === 'Honoraires')?.contenu;

		if (sansIA?.kind !== 'honoraires' || avecRefus?.kind !== 'honoraires') {
			throw new Error('section honoraires absente');
		}
		expect(avecRefus.total).toBe(sansIA.total);
	});
});

describe('preambuleParDefaut', () => {
	it('ne dépend pas de la rédaction : c’est le côté « avant » du diff', () => {
		const d = brouillon((x) => (x.client.nom = 'Boulangerie Dupont'));
		expect(preambuleParDefaut(d)).toContain('Boulangerie Dupont');
	});

	it('distingue le contrat de la soumission', () => {
		const contrat = preambuleParDefaut(brouillon((x) => (x.type = 'contrat')));
		const soumission = preambuleParDefaut(brouillon((x) => (x.type = 'soumission')));

		expect(contrat).toContain('présent contrat');
		expect(soumission).toContain('présente soumission');
	});

	it('nomme le client « le Client » à défaut de raison sociale saisie', () => {
		expect(preambuleParDefaut(brouillon((x) => (x.client.nom = '  ')))).toContain('le Client');
	});
});

/** Une rédaction survivait à la saisie qui l'avait produite : on modifiait le mandat, on relançait
 * « Générer », et l'aperçu réaffichait la prose d'avant sans que rien ne le signale. L'empreinte est
 * ce qui permet de le savoir. */
