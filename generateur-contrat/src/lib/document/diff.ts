/** Comparaison entre la saisie et la prose de l'IA, au service d'une seule question : qu'est-ce que
 * l'IA a changé, et qu'est-ce que j'en garde ?
 *
 * Deux échelles, parce qu'elles ne servent pas à la même chose. Les **phrases** définissent l'unité
 * qu'on garde ou qu'on rejette : une phrase est la plus petite tranche de prose qui se tienne encore
 * debout seule, alors qu'accepter la moitié d'une phrase réécrite produit du charabia. Les **mots**
 * ne servent qu'à la lecture, pour montrer d'un coup d'œil ce qui bouge à l'intérieur d'un passage.
 *
 * Module pur, sans dépendance : un LCS sur quelques centaines de mots tient en trente lignes, et le
 * projet n'embarque aucune librairie utilitaire. */

export type MotDiff = { kind: 'egal' | 'ajout' | 'suppression'; texte: string };

/** Phrases contiguës modifiées, regroupées : l'unité que l'utilisateur garde ou rejette.
 *
 * Le regroupement est ce qui évite de choisir entre « par phrase » et « par paragraphe ». Un passage
 * vaut une phrase quand l'IA n'a retouché qu'une phrase, et le paragraphe entier quand elle l'a
 * réécrit de bout en bout, sans qu'aucune granularité fixe ait à trancher d'avance. C'est le hunk de
 * `git add -p`. */
export interface Passage {
	/** Position dans la liste des passages du champ. C'est la clé stockée dans `RedactionIA.refuses`. */
	index: number;
	/** Côté saisie. Vide lorsque l'IA a ajouté du texte là où il n'y en avait pas. */
	avant: string;
	/** Côté IA. Vide lorsque l'IA a retiré du texte présent dans la saisie. */
	apres: string;
	/** Surlignage mot par mot, pour la lecture à l'intérieur du passage. */
	mots: MotDiff[];
}

/** Alignement complet des deux textes : ce qui est commun, et ce qui diffère. `comparerPassages` n'en
 * expose que les tranches modifiées, mais `texteEffectif` a besoin des deux pour recomposer le texte
 * dans l'ordre. Les faire dériver du même alignement est ce qui garantit que les index des passages
 * désignent la même chose de part et d'autre. */
type Segment =
	{ kind: 'egal'; phrases: string[] } | { kind: 'change'; avant: string[]; apres: string[] };

/** Abréviations dont le point ne termine pas une phrase. La liste est courte à dessein : elle ne
 * couvre que ce qui paraît réellement dans un mandat de services. */
const ABREVIATIONS = [
	'inc',
	'ltée',
	'ltee',
	'etc',
	'p. ex',
	'c.-à-d',
	'c.-a-d',
	'no',
	'nos',
	'art',
	'm',
	'mme',
	'me',
	'dr',
	'tél',
	'tel',
	'env',
	'max',
	'min',
	'réf',
	'ref'
];

/** Vrai si le texte se termine sur une abréviation connue, point exclu. */
function finitParAbreviation(morceau: string): boolean {
	const mot = morceau
		.slice(0, -1)
		.toLowerCase()
		.replace(/[^\p{L}\p{N}. -]/gu, '');
	return ABREVIATIONS.some(
		(abr) => mot === abr || mot.endsWith(` ${abr}`) || mot.endsWith(`-${abr}`)
	);
}

/** Découpe de la prose en phrases.
 *
 * Le deux-points ne coupe **pas**, et ce n'est pas un détail : `nettoyerProse` remplace les tirets
 * cadratins du modèle par des deux-points, donc la prose de l'IA en est truffée. Couper dessus
 * aurait produit des demi-phrases qu'on ne peut ni lire ni refuser séparément.
 *
 * Les sauts de paragraphe, eux, sont des frontières franches : deux paragraphes ne se fondent jamais
 * en une phrase, même quand le premier ne se termine par aucune ponctuation. */
export function decouperPhrases(texte: string): string[] {
	const phrases: string[] = [];

	for (const paragraphe of texte.split(/\n{2,}/)) {
		const contenu = paragraphe.trim();
		if (!contenu) continue;

		// Chaque candidat garde sa ponctuation finale : on recolle ensuite ceux qui n'auraient pas dû
		// être séparés, ce qui serait impossible si le point avait été consommé par le séparateur.
		const morceaux = contenu.split(/(?<=[.!?…])\s+/);
		let courante = '';

		for (const morceau of morceaux) {
			courante = courante ? `${courante} ${morceau}` : morceau;

			// Un point d'abréviation, ou une initiale isolée, ne ferme pas la phrase : on continue
			// d'accumuler jusqu'à une fin crédible.
			if (courante.endsWith('.') && finitParAbreviation(courante)) continue;
			if (/(?:^|\s)\p{Lu}\.$/u.test(courante)) continue;

			phrases.push(courante.trim());
			courante = '';
		}

		if (courante.trim()) phrases.push(courante.trim());
	}

	return phrases;
}

/** Découpe en mots en conservant les espaces qui les séparent, pour que le texte se recompose à
 * l'identique par simple concaténation. La ponctuation reste collée à son mot : la déplacer dans un
 * jeton à part remplirait le surlignage de virgules « ajoutées » qui n'apprennent rien. */
function decouperMots(texte: string): string[] {
	return texte.split(/(\s+)/).filter((jeton) => jeton !== '');
}

/** Plus longue sous-séquence commune, sous la forme des paires d'index conservées.
 *
 * Table pleine plutôt qu'algorithme de Myers : on compare des paragraphes, donc quelques centaines
 * de jetons de part et d'autre, et la version lisible suffit largement. */
function sousSequenceCommune<T>(
	gauche: T[],
	droite: T[],
	egaux: (a: T, b: T) => boolean
): Array<[number, number]> {
	const table: number[][] = Array.from({ length: gauche.length + 1 }, () =>
		new Array<number>(droite.length + 1).fill(0)
	);

	for (let i = gauche.length - 1; i >= 0; i--) {
		for (let j = droite.length - 1; j >= 0; j--) {
			table[i][j] = egaux(gauche[i], droite[j])
				? table[i + 1][j + 1] + 1
				: Math.max(table[i + 1][j], table[i][j + 1]);
		}
	}

	const paires: Array<[number, number]> = [];
	let i = 0;
	let j = 0;
	while (i < gauche.length && j < droite.length) {
		if (egaux(gauche[i], droite[j])) {
			paires.push([i, j]);
			i++;
			j++;
		} else if (table[i + 1][j] >= table[i][j + 1]) {
			i++;
		} else {
			j++;
		}
	}

	return paires;
}

/** Normalise une phrase pour l'alignement : espaces uniformisés, casse et accents ignorés. Sans
 * cela, une phrase reprise à la lettre près par le modèle mais réespacée passait pour réécrite, et
 * le diff signalait des changements invisibles à l'œil. */
function clePhrase(phrase: string): string {
	return phrase.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Aligne les phrases des deux textes en une suite de segments communs et modifiés. */
function aligner(avant: string, apres: string): Segment[] {
	const phrasesAvant = decouperPhrases(avant);
	const phrasesApres = decouperPhrases(apres);
	const communes = sousSequenceCommune(
		phrasesAvant,
		phrasesApres,
		(a, b) => clePhrase(a) === clePhrase(b)
	);

	const segments: Segment[] = [];
	let i = 0;
	let j = 0;

	const clore = (finAvant: number, finApres: number) => {
		const trancheAvant = phrasesAvant.slice(i, finAvant);
		const trancheApres = phrasesApres.slice(j, finApres);
		if (trancheAvant.length === 0 && trancheApres.length === 0) return;
		segments.push({ kind: 'change', avant: trancheAvant, apres: trancheApres });
	};

	for (const [ia, ja] of communes) {
		clore(ia, ja);
		const dernier = segments[segments.length - 1];
		// Les phrases communes consécutives se regroupent, pour que `texteEffectif` n'ait pas à
		// recoller des segments d'une phrase chacun.
		if (dernier && dernier.kind === 'egal') dernier.phrases.push(phrasesApres[ja]);
		else segments.push({ kind: 'egal', phrases: [phrasesApres[ja]] });
		i = ia + 1;
		j = ja + 1;
	}
	clore(phrasesAvant.length, phrasesApres.length);

	return segments;
}

/** Compare deux textes et renvoie les passages réécrits, les parties identiques étant tues.
 *
 * Un `apres` vide signifie que l'IA n'a rien produit pour ce champ : il n'y a alors rien à trancher,
 * la saisie tient toute seule, et on renvoie une liste vide plutôt qu'un passage « tout supprimé »
 * qui laisserait croire à une intervention du modèle. */
export function comparerPassages(avant: string, apres: string): Passage[] {
	const propose = apres.trim();
	if (!propose) return [];

	const passages: Passage[] = [];
	for (const segment of aligner(avant.trim(), propose)) {
		if (segment.kind !== 'change') continue;
		const morceauAvant = segment.avant.join(' ').trim();
		const morceauApres = segment.apres.join(' ').trim();
		passages.push({
			index: passages.length,
			avant: morceauAvant,
			apres: morceauApres,
			mots: comparerMots(morceauAvant, morceauApres)
		});
	}

	return passages;
}

/** Surlignage mot par mot entre deux fragments. Les mots communs sortent en `egal`, ce qui permet au
 * rendu de reconstituer le texte entier avec les ajouts et les suppressions en place. */
export function comparerMots(avant: string, apres: string): MotDiff[] {
	const motsAvant = decouperMots(avant);
	const motsApres = decouperMots(apres);
	const communs = sousSequenceCommune(motsAvant, motsApres, (a, b) => a === b);

	const segments: MotDiff[] = [];
	/** Fusionne les jetons de même nature : le rendu produit un élément par segment, et un mot par
	 * élément noierait le texte dans les balises. */
	const pousser = (kind: MotDiff['kind'], texte: string) => {
		if (!texte) return;
		const dernier = segments[segments.length - 1];
		if (dernier && dernier.kind === kind) dernier.texte += texte;
		else segments.push({ kind, texte });
	};

	let i = 0;
	let j = 0;
	for (const [ia, ja] of communs) {
		pousser('suppression', motsAvant.slice(i, ia).join(''));
		pousser('ajout', motsApres.slice(j, ja).join(''));
		pousser('egal', motsApres[ja]);
		i = ia + 1;
		j = ja + 1;
	}
	pousser('suppression', motsAvant.slice(i).join(''));
	pousser('ajout', motsApres.slice(j).join(''));

	return segments;
}

/** Texte réellement affiché dans le document, compte tenu des passages refusés.
 *
 * Recomposition plutôt que choix binaire entre les deux versions : refuser un passage doit rendre la
 * phrase saisie **à cet endroit-là**, sans faire perdre les autres réécritures du même champ. Le
 * parcours suit le même alignement que `comparerPassages`, donc les index désignent bien le même
 * passage des deux côtés.
 *
 * Un index hors bornes est ignoré. Le cas se produit si le brouillon est modifié après un refus,
 * puisque le découpage change alors sous les index déjà stockés ; mieux vaut retomber sur la prose de
 * l'IA que refuser d'afficher le document. */
export function texteEffectif(
	avant: string,
	apres: string | undefined,
	refuses: number[] = []
): string {
	const saisie = avant.trim();
	const propose = (apres ?? '').trim();
	if (!propose) return saisie;
	if (refuses.length === 0) return propose;

	const rejetes = new Set(refuses);
	const morceaux: string[] = [];
	let index = 0;

	for (const segment of aligner(saisie, propose)) {
		if (segment.kind === 'egal') {
			morceaux.push(...segment.phrases);
			continue;
		}
		const retenu = rejetes.has(index) ? segment.avant : segment.apres;
		morceaux.push(...retenu);
		index++;
	}

	return morceaux
		.filter(Boolean)
		.join(' ')
		.replace(/[ \t]+/g, ' ')
		.trim();
}
