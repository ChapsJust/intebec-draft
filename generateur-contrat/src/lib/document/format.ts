/** Petites fonctions de mise en forme propres au document généré, dans le style des contrats
 * québécois. Toutes pures et sans dépendance au DOM, donc faciles à tester. */

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

/** 0 à 19. Au-delà de seize, le français recompose : dix-sept, dix-huit, dix-neuf. */
function sousVingt(n: number): string {
	if (n <= 16) return SOUS_SEIZE[n];
	return `dix-${SOUS_SEIZE[n - 10]}`;
}

/** 0 à 99. Trois cas séparés, parce que le français compte de trois façons différentes selon la
 * tranche. C'est fastidieux mais il n'y a pas de règle unique à appliquer. */
function sousCent(n: number): string {
	if (n < 20) return sousVingt(n);

	// 20 à 69 : dizaine + unité, avec le « et » de vingt-et-un pour seule exception.
	if (n < 70) {
		const dizaine = DIZAINES[Math.floor(n / 10)];
		const unite = n % 10;
		if (unite === 0) return dizaine;
		if (unite === 1) return `${dizaine}-et-un`;
		return `${dizaine}-${SOUS_SEIZE[unite]}`;
	}

	// 70 à 79 : pas de « septante », mais soixante + un nombre de 10 à 19.
	if (n < 80) {
		const reste = n - 60;
		if (reste === 11) return 'soixante-et-onze';
		return `soixante-${sousVingt(reste)}`;
	}

	// 80 à 99 : le « s » ne tient que sur le compte rond, quatre-vingts mais quatre-vingt-un.
	const reste = n - 80;
	if (reste === 0) return 'quatre-vingts';
	return `quatre-vingt-${sousVingt(reste)}`;
}

/** Écrit un entier en toutes lettres (0-999). Au-delà, retourne les chiffres tels quels. */
export function enLettres(n: number): string {
	if (!Number.isInteger(n) || n < 0 || n > 999) return String(n);
	if (n < 100) return sousCent(n);

	const centaines = Math.floor(n / 100);
	const reste = n % 100;

	// Jamais « un cent », et même règle de pluriel : deux-cents, mais deux-cent-cinq.
	const prefixe = centaines === 1 ? 'cent' : `${SOUS_SEIZE[centaines]}-cent`;
	if (reste === 0) return centaines === 1 ? 'cent' : `${prefixe}s`;
	return `${prefixe}-${sousCent(reste)}`;
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
 *
 * Je découpe la chaîne à la main au lieu d'utiliser `new Date()`, et c'est important : `new
 * Date('2026-07-27')` est interprété en UTC, donc affiché dans un fuseau négatif comme le Québec il
 * recule d'un jour. Une date de signature qui change toute seule dans un contrat, c'est non. */
export function formatDateLongue(iso: string): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
	if (!match) return iso;
	const [, annee, mois, jour] = match;
	const nomMois = MOIS[Number(mois) - 1];
	if (!nomMois) return iso;
	return `${Number(jour)} ${nomMois} ${annee}`;
}

/** Libellé de l'entité tarifaire selon la structure du projet : partagé entre le formulaire de
 * saisie (LignesService) et le document généré pour éviter toute divergence de vocabulaire. */
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
