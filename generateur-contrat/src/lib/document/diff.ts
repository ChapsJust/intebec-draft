/** Compare la saisie et la prose de l'IA : qu'est-ce qui a changé, et qu'est-ce qu'on en garde ?
 *
 * Deux échelles : la phrase est l'unité qu'on garde ou qu'on rejette, le mot ne sert qu'au
 * surlignage. Un LCS suffit, le projet n'embarque aucune librairie de diff.
 * (Fait grandement grâce à l'aide de l'IA pour cette feature)
 */

export type MotDiff = { kind: 'egal' | 'ajout' | 'suppression'; texte: string };

/** Phrases modifiées contiguës, regroupées : l'unité que l'utilisateur garde ou rejette. Un passage
 * vaut une phrase ou tout un paragraphe selon ce que l'IA a retouché, comme un hunk de
 * `git add -p`. */
export interface Passage {
	/** Clé stockée dans `RedactionIA.refuses`. */
	index: number;
	/** Côté saisie. Vide si l'IA a ajouté du texte là où il n'y en avait pas. */
	avant: string;
	/** Côté IA. Vide si l'IA a retiré du texte. */
	apres: string;
	mots: MotDiff[];
}

/** Alignement des deux textes. `comparerPassages` n'expose que les tranches modifiées, `texteEffectif`
 * a besoin des deux : les faire dériver du même alignement est ce qui garantit que les index
 * désignent la même chose des deux côtés. */
type Segment =
	{ kind: 'egal'; phrases: string[] } | { kind: 'change'; avant: string[]; apres: string[] };

/** Abréviations dont le point ne termine pas une phrase. */
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

/** Retiré avant comparaison. Le point, l'espace et le tiret restent : « p. ex », « c.-à-d ». */
const PONCTUATION_PARASITE = /[^\p{L}\p{N}. -]/gu;

/** Vrai si le texte finit sur une abréviation connue, point exclu. */
function finitParAbreviation(phrase: string): boolean {
	const sansPoint = phrase.slice(0, -1).toLowerCase().replace(PONCTUATION_PARASITE, '');

	return ABREVIATIONS.some(
		(abreviation) =>
			sansPoint === abreviation ||
			sansPoint.endsWith(` ${abreviation}`) ||
			sansPoint.endsWith(`-${abreviation}`)
	);
}

/** Un point qui ne ferme pas la phrase : abréviation, ou initiale isolée (« J. Chaput »). */
function pointTrompeur(phrase: string): boolean {
	if (!phrase.endsWith('.')) return false;
	const initialeIsolee = /(?:^|\s)\p{Lu}\.$/u;
	return finitParAbreviation(phrase) || initialeIsolee.test(phrase);
}

/** Découpe la prose en phrases.
 *
 * Le deux-points ne coupe pas : `nettoyerProse` en fabrique à partir des tirets cadratins du modèle,
 * et couper dessus donnerait des demi-phrases impossibles à refuser seules. Le saut de paragraphe,
 * lui, coupe toujours. */
export function decouperPhrases(texte: string): string[] {
	const phrases: string[] = [];

	for (const paragraphe of texte.split(/\n{2,}/)) {
		const contenu = paragraphe.trim();
		if (!contenu) continue;

		// Le séparateur ne consomme pas la ponctuation, pour pouvoir recoller ensuite.
		const candidats = contenu.split(/(?<=[.!?…])\s+/);

		let courante = '';
		for (const candidat of candidats) {
			courante = courante ? `${courante} ${candidat}` : candidat;
			if (pointTrompeur(courante)) continue;

			phrases.push(courante.trim());
			courante = '';
		}

		// Un paragraphe peut finir sans ponctuation.
		if (courante.trim()) phrases.push(courante.trim());
	}

	return phrases;
}

/** Découpe en mots, espaces compris, pour que la concaténation redonne le texte exact. La ponctuation
 * reste collée à son mot : l'isoler remplirait le surlignage de virgules « ajoutées ». */
function decouperMots(texte: string): string[] {
	return texte.split(/(\s+)/).filter((jeton) => jeton !== '');
}

/** `longueurs[i][j]` = nombre d'éléments communs entre `gauche` à partir de `i` et `droite` à partir
 * de `j`. Rempli à rebours, chaque case se déduisant de ses voisines, qui portent sur des restes plus
 * courts. `[0][0]` donne la réponse pour les listes entières. */
function tableDesLongueurs<T>(
	gauche: T[],
	droite: T[],
	egaux: (a: T, b: T) => boolean
): number[][] {
	// La rangée et la colonne en trop restent à zéro et servent de bord au calcul.
	const longueurs: number[][] = [];
	for (let i = 0; i <= gauche.length; i++) {
		longueurs.push(new Array<number>(droite.length + 1).fill(0));
	}

	for (let i = gauche.length - 1; i >= 0; i--) {
		for (let j = droite.length - 1; j >= 0; j--) {
			longueurs[i][j] = egaux(gauche[i], droite[j])
				? longueurs[i + 1][j + 1] + 1 // les deux se correspondent
				: Math.max(longueurs[i + 1][j], longueurs[i][j + 1]); // il faut en sacrifier un
		}
	}

	return longueurs;
}

/** Plus longue sous-séquence commune, rendue comme les paires d'index conservées : entre « A B C D »
 * et « A X C », la suite commune est « A C », donc `[[0, 0], [2, 2]]`. Le reste a été ajouté ou
 * supprimé. Table pleine plutôt que Myers : quelques centaines de jetons, la version lisible suffit. */
function sousSequenceCommune<T>(
	gauche: T[],
	droite: T[],
	egaux: (a: T, b: T) => boolean
): Array<[number, number]> {
	const longueurs = tableDesLongueurs(gauche, droite, egaux);

	// On avance en suivant le meilleur score. La table décrit les fins de listes, donc le parcours va
	// du début vers la fin et les paires sortent déjà dans l'ordre.
	const paires: Array<[number, number]> = [];
	let indexGauche = 0;
	let indexDroite = 0;

	while (indexGauche < gauche.length && indexDroite < droite.length) {
		if (egaux(gauche[indexGauche], droite[indexDroite])) {
			paires.push([indexGauche, indexDroite]);
			indexGauche++;
			indexDroite++;
		} else if (longueurs[indexGauche + 1][indexDroite] >= longueurs[indexGauche][indexDroite + 1]) {
			// Sauter à gauche promet au moins autant : cet élément n'a pas de correspondant.
			indexGauche++;
		} else {
			indexDroite++;
		}
	}

	return paires;
}

/** Les accents, une fois détachés de leur lettre par `normalize('NFD')`. */
const ACCENTS_DETACHES = /[̀-ͯ]/g;

/** Clé de comparaison : casse, accents et espaces ignorés. Sans ça, une phrase réespacée par le
 * modèle passait pour réécrite et le diff signalait des changements invisibles à l'œil. */
function clePhrase(phrase: string): string {
	return phrase
		.normalize('NFD')
		.replace(ACCENTS_DETACHES, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

/** Aligne les phrases des deux textes en segments communs et modifiés. */
function aligner(avant: string, apres: string): Segment[] {
	const phrasesAvant = decouperPhrases(avant);
	const phrasesApres = decouperPhrases(apres);
	const communes = sousSequenceCommune(
		phrasesAvant,
		phrasesApres,
		(a, b) => clePhrase(a) === clePhrase(b)
	);

	const segments: Segment[] = [];
	let curseurAvant = 0;
	let curseurApres = 0;

	/** Range en segment « change » ce qui sépare les curseurs de la prochaine phrase commune. */
	const ajouterCeQuiPrecede = (finAvant: number, finApres: number) => {
		const trancheAvant = phrasesAvant.slice(curseurAvant, finAvant);
		const trancheApres = phrasesApres.slice(curseurApres, finApres);
		if (trancheAvant.length === 0 && trancheApres.length === 0) return;
		segments.push({ kind: 'change', avant: trancheAvant, apres: trancheApres });
	};

	for (const [indexAvant, indexApres] of communes) {
		ajouterCeQuiPrecede(indexAvant, indexApres);

		// Les phrases communes consécutives se regroupent, pour que `texteEffectif` n'ait pas à
		// recoller des segments d'une phrase chacun.
		const dernier = segments[segments.length - 1];
		if (dernier && dernier.kind === 'egal') dernier.phrases.push(phrasesApres[indexApres]);
		else segments.push({ kind: 'egal', phrases: [phrasesApres[indexApres]] });

		curseurAvant = indexAvant + 1;
		curseurApres = indexApres + 1;
	}

	// Ce qui traîne après la dernière phrase commune.
	ajouterCeQuiPrecede(phrasesAvant.length, phrasesApres.length);

	return segments;
}

/** Les passages réécrits, les parties identiques étant tues. Un `apres` vide veut dire que l'IA n'a
 * rien produit : liste vide, plutôt qu'un passage « tout supprimé » qu'elle n'a pas fait. */
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

/** Surlignage mot par mot. Les mots communs sortent en `egal`, pour que le rendu reconstitue le texte
 * entier avec les ajouts et les suppressions en place. */
export function comparerMots(avant: string, apres: string): MotDiff[] {
	const motsAvant = decouperMots(avant);
	const motsApres = decouperMots(apres);
	const communs = sousSequenceCommune(motsAvant, motsApres, (a, b) => a === b);

	const segments: MotDiff[] = [];

	/** Fusionne avec le segment précédent s'il est de même nature : un élément HTML par mot noierait
	 * le texte dans les balises. */
	const ajouter = (kind: MotDiff['kind'], texte: string) => {
		if (!texte) return;
		const dernier = segments[segments.length - 1];
		if (dernier && dernier.kind === kind) dernier.texte += texte;
		else segments.push({ kind, texte });
	};

	let curseurAvant = 0;
	let curseurApres = 0;

	for (const [indexAvant, indexApres] of communs) {
		// Avant chaque mot commun : ce que la saisie avait là, puis ce que l'IA a mis à la place.
		ajouter('suppression', motsAvant.slice(curseurAvant, indexAvant).join(''));
		ajouter('ajout', motsApres.slice(curseurApres, indexApres).join(''));
		ajouter('egal', motsApres[indexApres]);
		curseurAvant = indexAvant + 1;
		curseurApres = indexApres + 1;
	}

	ajouter('suppression', motsAvant.slice(curseurAvant).join(''));
	ajouter('ajout', motsApres.slice(curseurApres).join(''));

	return segments;
}

/** Texte réellement affiché, compte tenu des passages refusés.
 *
 * On recompose au lieu de choisir entre les deux versions : refuser un passage rend la saisie à cet
 * endroit-là sans faire perdre les autres réécritures du champ. Un index hors bornes est ignoré — le
 * brouillon a changé depuis le refus, et mieux vaut la prose de l'IA qu'une page en erreur. */
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
	const phrasesRetenues: string[] = [];
	// Même parcours que `comparerPassages`, donc même numérotation.
	let numeroPassage = 0;

	for (const segment of aligner(saisie, propose)) {
		if (segment.kind === 'egal') {
			phrasesRetenues.push(...segment.phrases);
			continue;
		}

		const retenu = rejetes.has(numeroPassage) ? segment.avant : segment.apres;
		phrasesRetenues.push(...retenu);
		numeroPassage++;
	}

	return phrasesRetenues
		.filter(Boolean)
		.join(' ')
		.replace(/[ \t]+/g, ' ')
		.trim();
}
