import { describe, expect, it } from 'vitest';
import { clausesActives, type Article } from './clauses';
import { nouveauMandat, nouvelleLigne } from '$lib/mandat';
import type { BrouillonMandat } from '$domaine/types';

function brouillon(modifier: (d: BrouillonMandat) => void = () => {}): BrouillonMandat {
	const d = nouveauMandat('contrat');
	d.lignes = [{ ...nouvelleLigne(), nom: 'Site web', montantForfaitaire: 5000 }];
	modifier(d);
	return d;
}

const titres = (d: BrouillonMandat) => clausesActives(d).map((a) => a.titre);

/** Aplatit prose et énumérations d'un article en une seule chaîne, pour tester le contenu sans
 * dépendre de la façon dont il est découpé en blocs. */
function texte(article: Article | undefined): string {
	if (!article) return '';
	return article.corps
		.map((b) => (b.kind === 'p' ? b.texte : `${b.intro} ${b.items.join(' ')}`))
		.join(' ');
}

const article = (d: BrouillonMandat, predicat: (a: Article) => boolean) =>
	clausesActives(d).find(predicat);

describe('clausesActives', () => {
	it('ne produit que les clauses cochées', () => {
		const d = brouillon((x) => {
			x.conditions.clauses = {
				confidentialite: true,
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

		// Les engagements réciproques sont systématiques : ils ne dépendent d'aucune case à cocher.
		expect(titres(d)).toEqual([
			'Engagements des parties',
			'Confidentialité et protection des renseignements personnels'
		]);
	});

	it('n’émet pas d’article pour une condition laissée à zéro', () => {
		const avec = brouillon((x) => (x.conditions.dureeGarantieJours = 30));
		const sans = brouillon((x) => (x.conditions.dureeGarantieJours = 0));

		expect(titres(avec)).toContain('Garantie');
		expect(titres(sans)).not.toContain('Garantie');
	});

	it('reprend le lieu de signature dans la clause de litiges', () => {
		const d = brouillon((x) => (x.lieuSignature = 'Drummondville'));
		const corps = texte(article(d, (a) => a.titre.startsWith('Droit applicable')));

		expect(corps).toContain('Drummondville');
		expect(corps).toContain("district judiciaire d'Arthabaska");
	});

	it('plafonne la responsabilité au total net du mandat', () => {
		const d = brouillon((x) => {
			x.lignes = [{ ...nouvelleLigne(), nom: 'Site', montantForfaitaire: 10000 }];
			x.conditions.rabaisPct = 10;
		});
		const corps = texte(article(d, (a) => a.titre === 'Limitation de responsabilité'));

		// 10 000 $ moins 10 % = 9 000 $ : le plafond suit le calcul de montants.ts, pas le sous-total.
		expect(corps).toContain('9');
		expect(corps).not.toContain('10 000');
	});

	it('ajoute la réserve de la Loi sur la protection du consommateur pour un particulier', () => {
		const trouve = (type: BrouillonMandat['client']['typeClient']) =>
			texte(
				article(
					brouillon((x) => (x.client.typeClient = type)),
					(a) => a.titre === 'Limitation de responsabilité'
				)
			);

		expect(trouve('particulier')).toContain('protection du consommateur');
		expect(trouve('entreprise')).not.toContain('protection du consommateur');
	});

	it('écrit les durées en toutes lettres suivies du chiffre', () => {
		const d = brouillon((x) => (x.conditions.preavisResiliationJours = 30));

		expect(texte(article(d, (a) => a.titre === 'Résiliation'))).toContain('trente (30) jours');
	});

	it('énumère les engagements des deux parties sous forme de listes', () => {
		const engagements = article(brouillon(), (a) => a.titre === 'Engagements des parties');
		const listes = engagements?.corps.filter((b) => b.kind === 'liste') ?? [];

		expect(listes).toHaveLength(2);
		expect(listes.every((b) => b.kind === 'liste' && b.items.length > 0)).toBe(true);
	});

	it('ajoute l’engagement de formation seulement si des heures sont incluses', () => {
		const avec = texte(
			article(
				brouillon((x) => (x.conditions.heuresFormationIncluses = 4)),
				(a) => a.titre === 'Engagements des parties'
			)
		);
		const sans = texte(
			article(
				brouillon((x) => (x.conditions.heuresFormationIncluses = 0)),
				(a) => a.titre === 'Engagements des parties'
			)
		);

		expect(avec).toContain('formation incluse');
		expect(sans).not.toContain('formation incluse');
	});

	it('garde un ordre stable des articles', () => {
		expect(titres(brouillon())).toEqual(titres(brouillon()));
	});
});

describe('clausesActives et les clauses retenues hors catalogue', () => {
	const avecClause = (titre: string, corps: string) =>
		brouillon((x) => {
			x.conditions.clausesRetenues = [{ idBibliotheque: '', titre, corps }];
		});

	it('rend une clause retenue comme un article à part entière', () => {
		const d = avecClause('Cession de contrat', 'Le contrat ne peut être cédé sans accord écrit.');

		expect(titres(d)).toContain('Cession de contrat');
		expect(texte(article(d, (a) => a.titre === 'Cession de contrat'))).toContain(
			'ne peut être cédé sans accord écrit'
		);
	});

	it('découpe le texte en un paragraphe par bloc séparé d’une ligne vide', () => {
		const d = avecClause('Cession de contrat', 'Premier paragraphe.\n\nSecond paragraphe.');
		const corps = article(d, (a) => a.titre === 'Cession de contrat')?.corps ?? [];

		expect(corps).toHaveLength(2);
		expect(corps.every((b) => b.kind === 'p')).toBe(true);
	});

	it('ne produit aucun article pour une clause au corps vide', () => {
		// Un titre seul donnerait un article numéroté sans contenu, ce qui se lit comme un bug du
		// document plutôt que comme une clause à compléter.
		expect(titres(avecClause('Titre orphelin', '   '))).not.toContain('Titre orphelin');
	});

	it('ne produit aucun article pour une clause sans titre', () => {
		const d = avecClause('  ', 'Du texte sans intitulé.');
		expect(titres(d).some((t) => t.trim() === '')).toBe(false);
	});

	it('place les clauses retenues avant les articles de clôture', () => {
		// Voir « Litiges » ou « Signature électronique » précéder une clause de fond se lirait comme un
		// oubli de rédaction : ces deux articles ferment le contrat.
		const d = avecClause('Cession de contrat', 'Texte.');
		const ordre = titres(d);

		expect(ordre.indexOf('Cession de contrat')).toBeLessThan(
			ordre.indexOf('Droit applicable et règlement des différends')
		);
		expect(ordre.indexOf('Cession de contrat')).toBeLessThan(
			ordre.indexOf('Signature électronique')
		);
	});

	it('n’ajoute rien quand aucune clause n’est retenue', () => {
		expect(titres(brouillon())).toEqual(titres(avecClause('Vide', '')));
	});

	it('conserve l’ordre de saisie de plusieurs clauses retenues', () => {
		const d = brouillon((x) => {
			x.conditions.clausesRetenues = [
				{ idBibliotheque: '', titre: 'Première clause', corps: 'Texte un.' },
				{ idBibliotheque: '', titre: 'Seconde clause', corps: 'Texte deux.' }
			];
		});
		const ordre = titres(d);

		expect(ordre.indexOf('Première clause')).toBeLessThan(ordre.indexOf('Seconde clause'));
	});
});
