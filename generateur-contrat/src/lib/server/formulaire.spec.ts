import { describe, expect, it } from 'vitest';
import { estUuid, idPoste } from './formulaire';

/** La garde d'identifiant est ce qui rend le 404 atteignable : sans elle, un identifiant qui n'est
 * pas un UUID arrive dans une comparaison sur colonne `uuid`, Postgres refuse la conversion, et
 * l'utilisateur reçoit une page 500 là où le code prévoyait « introuvable ». */
describe('estUuid', () => {
	it('accepte un UUID, quelle que soit la casse', () => {
		expect(estUuid('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true);
		expect(estUuid('3F2504E0-4F89-41D3-9A0C-0305E82C3301')).toBe(true);
	});

	it('refuse ce qui n’en est pas un', () => {
		for (const valeur of [
			'test',
			'',
			'3f2504e0-4f89-41d3-9a0c',
			'3f2504e0-4f89-41d3-9a0c-0305e82c3301x',
			'3f2504e0_4f89_41d3_9a0c_0305e82c3301',
			// Une tentative d'injection ne peut pas passer la garde non plus.
			"' OR 1=1 --",
			null,
			undefined,
			42,
			{}
		]) {
			expect(estUuid(valeur)).toBe(false);
		}
	});
});

/** Construit une requête POST équivalente à une soumission de formulaire. */
function requeteAvec(champs: Record<string, string>): Request {
	const body = new FormData();
	for (const [cle, valeur] of Object.entries(champs)) body.set(cle, valeur);
	return new Request('http://localhost/', { method: 'POST', body });
}

describe('idPoste', () => {
	it('renvoie l’identifiant posté quand il est valide', async () => {
		const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
		expect(await idPoste(requeteAvec({ id }))).toBe(id);
	});

	it('renvoie null quand l’identifiant est absent, vide ou mal formé', async () => {
		expect(await idPoste(requeteAvec({}))).toBeNull();
		expect(await idPoste(requeteAvec({ id: '' }))).toBeNull();
		expect(await idPoste(requeteAvec({ id: 'pas-un-uuid' }))).toBeNull();
	});
});
