/** Helpers de mise en forme propres au document généré : style contractuel québécois.
 * Fonctions pures, testables, sans dépendance au DOM. */

const SOUS_SEIZE = [
	'zéro',
	'un',
	'deux',
	'trois',
	'quatre',
	'cinq',
	'six',
	'sept',
	'huit',
	'neuf',
	'dix',
	'onze',
	'douze',
	'treize',
	'quatorze',
	'quinze',
	'seize'
];

const DIZAINES: Record<number, string> = {
	2: 'vingt',
	3: 'trente',
	4: 'quarante',
	5: 'cinquante',
	6: 'soixante'
};

function sousVingt(n: number): string {
	if (n <= 16) return SOUS_SEIZE[n];
	return `dix-${SOUS_SEIZE[n - 10]}`;
}

function sousCent(n: number): string {
	if (n < 20) return sousVingt(n);

	// 70-79 et 90-99 se construisent sur la dizaine inférieure : soixante-dix, quatre-vingt-dix.
	if (n < 70) {
		const d = Math.floor(n / 10);
		const r = n % 10;
		if (r === 0) return DIZAINES[d];
		if (r === 1) return `${DIZAINES[d]}-et-un`;
		return `${DIZAINES[d]}-${SOUS_SEIZE[r]}`;
	}
	if (n < 80) {
		const r = n - 60;
		if (r === 11) return 'soixante-et-onze';
		return `soixante-${sousVingt(r)}`;
	}
	const r = n - 80;
	if (r === 0) return 'quatre-vingts';
	return `quatre-vingt-${sousVingt(r)}`;
}

/** Écrit un entier en toutes lettres (0-999). Au-delà, retourne les chiffres tels quels. */
export function enLettres(n: number): string {
	if (!Number.isInteger(n) || n < 0 || n > 999) return String(n);
	if (n < 100) return sousCent(n);

	const c = Math.floor(n / 100);
	const r = n % 100;
	const prefixe = c === 1 ? 'cent' : `${SOUS_SEIZE[c]}-cent`;
	if (r === 0) return c === 1 ? 'cent' : `${SOUS_SEIZE[c]}-cents`;
	return `${prefixe}-${sousCent(r)}`;
}

/** Forme contractuelle usuelle : « trente (30) ». */
export function nombreContractuel(n: number): string {
	return `${enLettres(n)} (${n})`;
}

const MOIS = [
	'janvier',
	'février',
	'mars',
	'avril',
	'mai',
	'juin',
	'juillet',
	'août',
	'septembre',
	'octobre',
	'novembre',
	'décembre'
];

/** Formate une date ISO `YYYY-MM-DD` en « 27 juillet 2026 ».
 * Découpe la chaîne au lieu de passer par `new Date()`, qui interpréterait la date en UTC
 * et reculerait d'un jour dans les fuseaux négatifs (dont le Québec). */
export function formatDateLongue(iso: string): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
	if (!match) return iso;
	const [, annee, mois, jour] = match;
	const nomMois = MOIS[Number(mois) - 1];
	if (!nomMois) return iso;
	return `${Number(jour)} ${nomMois} ${annee}`;
}

/** Libellé de l'entité tarifaire selon la structure du projet : partagé entre le formulaire de
 * saisie (ServiceLinesForm) et le document généré pour éviter toute divergence de vocabulaire. */
export function libelleLigne(structure: 'phases' | 'blocs' | 'recurrent'): string {
	if (structure === 'phases') return 'Phase';
	if (structure === 'blocs') return 'Bloc';
	return 'Service';
}

/** Élide une préposition devant un nom commençant par une voyelle ou un h muet :
 * `elider('de', 'Intébec')` → « d'Intébec ». Évite les « de Intébec » dans le texte des clauses,
 * et reste correct si le nom du prestataire change. */
export function elider(preposition: 'de' | 'que' | 'le' | 'la', mot: string): string {
	const premiere = mot.trim().charAt(0).toLowerCase();
	// Le h muet n'est pas détectable automatiquement ; on ne traite que les voyelles, ce qui
	// couvre les cas réels sans produire de faux positifs (« d'hôtel » vs « de haut »).
	const voyelle = 'aàâeéèêëiîïoôuùûy'.includes(premiere);
	if (!voyelle) return `${preposition} ${mot}`;
	return `${preposition.slice(0, -1)}’${mot}`;
}

/** Désignation du client dans le corps du document, selon son type. */
export function designationClient(type: 'entreprise' | 'obnl' | 'particulier'): string {
	if (type === 'obnl') return "l'organisme";
	if (type === 'particulier') return 'le client';
	return "l'entreprise";
}

/** Retire les entrées vides d'une liste de champs texte libres (l'éditeur laisse des chaînes
 * vides quand l'utilisateur ajoute une ligne sans la remplir). */
export function nettoyerListe(valeurs: string[]): string[] {
	return valeurs.map((v) => v.trim()).filter((v) => v.length > 0);
}
