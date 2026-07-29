import { describe, expect, it } from 'vitest';
import { nomFichier } from './pdf';

/** Le nom produit ici est inséré dans l'en-tête `Content-Disposition`, entre guillemets. Tout ce
 * qui pourrait fermer ce guillemet ou couper la ligne doit donc disparaître avant. */
describe('nomFichier', () => {
	it('translittère les accents et la ponctuation', () => {
		expect(nomFichier('contrat', 'Refonte du site — étape 1', '2026-03-14')).toBe(
			'contrat-refonte-du-site-etape-1-2026-03-14.pdf'
		);
	});

	it('neutralise un guillemet ou un retour à la ligne dans la date', () => {
		// La date vient du brouillon, donc de la saisie : elle n'est pas plus sûre que le titre.
		const nom = nomFichier('contrat', 'Projet', '2026"; rm -rf /\n');
		expect(nom).not.toContain('"');
		expect(nom).not.toContain('\n');
		expect(nom.endsWith('.pdf')).toBe(true);
	});

	it('reste un nom valide quand tout est vide', () => {
		expect(nomFichier('', '', '')).toBe('document.pdf');
	});

	it('n’accole pas de tiret quand la date est inutilisable', () => {
		expect(nomFichier('contrat', 'Projet', '???')).toBe('contrat-projet.pdf');
	});
});
