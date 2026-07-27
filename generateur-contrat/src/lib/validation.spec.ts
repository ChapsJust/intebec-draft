import { describe, expect, it } from 'vitest';
import { validateDraft, fieldError } from './validation';
import { createEmptyDraft } from './mandat';

describe('validateDraft', () => {
	it('signale les champs requis manquants sur un brouillon vide', () => {
		const errors = validateDraft(createEmptyDraft());
		const fields = errors.map((e) => e.field);
		expect(fields).toContain('client.nom');
		expect(fields).toContain('titre');
		expect(fields).toContain('objet');
		expect(fields).toContain('lignes.0.montant');
	});

	it('accepte un brouillon complet', () => {
		const draft = createEmptyDraft();
		draft.client.nom = 'Constructions Rivard';
		draft.titre = 'Refonte du site web';
		draft.objet = 'Modernisation de la présence numérique.';
		draft.lignes[0].nom = 'Développement';
		draft.lignes[0].montantForfaitaire = 5000;

		expect(validateDraft(draft)).toEqual([]);
	});

	it('rejette un courriel client mal formé', () => {
		const draft = createEmptyDraft();
		draft.client.courriel = 'pas-un-courriel';
		const errors = validateDraft(draft);
		expect(errors.some((e) => e.field === 'client.courriel')).toBe(true);
	});

	it("n'exige pas de courriel quand il est vide", () => {
		const draft = createEmptyDraft();
		draft.client.courriel = '';
		const errors = validateDraft(draft);
		expect(errors.some((e) => e.field === 'client.courriel')).toBe(false);
	});

	it("rejette un acompte hors de l'intervalle 0-100", () => {
		const draft = createEmptyDraft();
		draft.modalitesPaiement.acomptePct = 150;
		const errors = validateDraft(draft);
		expect(errors.some((e) => e.field === 'modalitesPaiement.acomptePct')).toBe(true);
	});
});

describe('fieldError', () => {
	it('retourne le message associé à un champ', () => {
		const errors = [{ field: 'titre', message: 'Le titre du projet est requis.' }];
		expect(fieldError(errors, 'titre')).toBe('Le titre du projet est requis.');
	});

	it('retourne undefined pour un champ sans erreur', () => {
		expect(fieldError([], 'titre')).toBeUndefined();
	});
});
