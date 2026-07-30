/** Empreinte de la saisie dont une redaction est derivee.
 *
 * Isole des constructeurs de sections parce que ce n'est pas la meme question : `sections.ts`
 * demande « a quoi ressemble le document », ce module demande « la prose affichee decrit-elle
 * encore ce mandat-la ».
 */
import type { BrouillonMandat, RedactionIA } from '$domaine/types';
import { nettoyerListe } from './format';

/** Hachage court et non cryptographique (FNV-1a 32 bits). On ne cherche qu'à détecter un changement
 * de saisie, pas à résister à une collision provoquée, et cela évite de stocker une seconde copie de
 * la prose à côté de la rédaction. */
function hacher(texte: string): string {
	let h = 2166136261;
	for (let i = 0; i < texte.length; i++) {
		h ^= texte.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0).toString(36);
}

/** Séparateur de champs de l'empreinte : le « unit separator » ASCII, que la saisie ne contient
 * jamais. Construit par `fromCharCode` plutôt qu'écrit tel quel, parce qu'un octet de contrôle déposé
 * dans le source rend le fichier binaire pour l'outillage. Avec une simple espace, un objet « A »
 * suivi d'une ligne « B » aurait donné la même empreinte qu'un objet « A B » sans ligne. */
const SEPARATEUR_EMPREINTE = String.fromCharCode(31);

/** Empreinte de la saisie dont une rédaction est dérivée.
 *
 * Reprend ce que `contexte()` transmet au modèle dans `server/ia/invites.ts`, plus ce qui compose le préambule
 * par défaut. Le critère n'est pas « ce que l'IA réécrit » mais « ce que l'IA a lu » : un nom de ligne
 * ou une puce « non inclus » ne sont pas réécrits, pourtant ils orientent la prose, donc les changer
 * la périme.
 *
 * Les montants en sont absents, et c'est cohérent de bout en bout : le prompt ne les transmet pas, le
 * gabarit les rend directement. Ajuster un prix ne redemande donc pas la prose à l'IA et ne fait pas
 * perdre les passages déjà arbitrés. */
export function empreinteProse(brouillon: BrouillonMandat): string {
	const parties = [
		brouillon.type,
		brouillon.titre.trim(),
		brouillon.structureProjet,
		brouillon.client.typeClient,
		brouillon.client.nom.trim(),
		brouillon.objet.trim()
	];

	for (const ligne of brouillon.lignes) {
		parties.push(
			ligne.id,
			ligne.nom.trim(),
			ligne.description.trim(),
			nettoyerListe(ligne.inclus).join('|'),
			nettoyerListe(ligne.nonInclus).join('|'),
			ligne.delaiEstime.trim()
		);
	}

	return hacher(parties.join(SEPARATEUR_EMPREINTE));
}

/** Vrai quand la saisie a changé depuis que cette prose a été produite.
 *
 * Une rédaction caduque décrit un mandat qui n'existe plus : elle masque les modifications qu'on vient
 * de faire, et ses refus pointent des passages qui ont glissé. Les rédactions enregistrées avant
 * l'empreinte n'en ont pas : on se tait plutôt que d'alerter sur tous les documents existants. */
export function redactionCaduque(
	brouillon: BrouillonMandat,
	redaction: RedactionIA | null | undefined
): boolean {
	if (!redaction?.empreinte) return false;
	return redaction.empreinte !== empreinteProse(brouillon);
}
