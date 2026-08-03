/** Empreinte de la saisie dont une rédaction est dérivée. Séparé de `sections.ts`, qui demande « à
 * quoi ressemble le document » là où ce module demande « la prose décrit-elle encore ce mandat-là ».
 */
import type { BrouillonMandat, RedactionIA } from '$domaine/types';
import { nettoyerListe } from './format';

/** Hachage court et non cryptographique (FNV-1a 32 bits) : on détecte un changement de saisie, on ne
 * résiste pas à une collision provoquée. Évite de stocker une seconde copie de la prose. */
function hacher(texte: string): string {
	let empreinte = 2166136261;

	for (let i = 0; i < texte.length; i++) {
		empreinte ^= texte.charCodeAt(i);
		// `Math.imul` et non `*` : les nombres JavaScript sont des flottants, une multiplication
		// ordinaire perdrait les bits de poids faible.
		empreinte = Math.imul(empreinte, 16777619);
	}

	// `>>> 0` relit l'entier 32 bits comme un positif ; la base 36 le raccourcit.
	return (empreinte >>> 0).toString(36);
}

/** Le « unit separator » ASCII, que la saisie ne contient jamais. Avec une simple espace, un objet
 * « A » suivi d'une ligne « B » donnerait la même empreinte qu'un objet « A B » sans ligne. Construit
 * par `fromCharCode` : un octet de contrôle écrit tel quel rendrait le fichier binaire. */
const SEPARATEUR_EMPREINTE = String.fromCharCode(31);

/** Empreinte de la saisie dont une rédaction est dérivée.
 *
 * Reprend ce que le prompt transmet au modèle. Le critère est « ce que l'IA a lu », pas « ce qu'elle
 * réécrit » : un nom de ligne oriente la prose sans être réécrit, donc le changer la périme.
 *
 * Les montants en sont absents, comme du prompt : ajuster un prix ne redemande pas la prose à l'IA et
 * ne fait pas perdre les passages déjà arbitrés. */
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

/** Vrai quand la saisie a changé depuis que cette prose a été produite : la rédaction décrit alors un
 * mandat qui n'existe plus, et ses refus pointent des passages qui ont glissé. Les rédactions
 * antérieures à l'empreinte n'en ont pas — on se tait plutôt que d'alerter sur tout l'existant. */
export function redactionCaduque(
	brouillon: BrouillonMandat,
	redaction: RedactionIA | null | undefined
): boolean {
	if (!redaction?.empreinte) return false;
	return redaction.empreinte !== empreinteProse(brouillon);
}
