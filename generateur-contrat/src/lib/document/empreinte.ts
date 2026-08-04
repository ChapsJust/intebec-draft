/** Sert à savoir si la prose écrite par l'IA correspond encore à la saisie actuelle.
 *
 * Séparé de `sections.ts` : là-bas on construit le document, ici on vérifie seulement si la
 * rédaction enregistrée est encore à jour.
 */
import type { BrouillonMandat, RedactionIA } from '$domaine/types';
import { nettoyerListe } from './format';

/** FNV-1a sur 32 bits, un algorithme de hachage publié que j'ai repris tel quel (les deux constantes
 * viennent de la spec). Il n'est pas cryptographique, et c'est correct ici : je veux repérer un
 * changement de saisie, pas résister à quelqu'un qui chercherait une collision exprès.
 *
 * L'intérêt par rapport à garder le texte : 6 caractères en base au lieu d'une deuxième copie
 * complète de la prose. */
function hacher(texte: string): string {
	let empreinte = 2166136261;

	for (let i = 0; i < texte.length; i++) {
		empreinte ^= texte.charCodeAt(i);
		// Math.imul et pas `*` : en JS tous les nombres sont des flottants, et une multiplication
		// normale de deux entiers 32 bits dépasse la mantisse et perd les bits de poids faible.
		empreinte = Math.imul(empreinte, 16777619);
	}

	// Les opérateurs bit à bit de JS donnent un entier signé, `>>> 0` le repasse en positif.
	// La base 36 (chiffres + lettres) raccourcit le résultat.
	return (empreinte >>> 0).toString(36);
}

/** Séparateur entre les champs avant le hachage : le caractère de contrôle ASCII 31 (« unit
 * separator »), qu'on ne peut pas taper dans un formulaire. Avec une simple espace, un objet « A »
 * suivi d'une ligne « B » donnerait la même empreinte qu'un objet « A B » sans ligne.
 *
 * Passé par `fromCharCode` parce qu'écrire l'octet directement dans le fichier le ferait passer pour
 * un binaire auprès de git et de l'éditeur. */
const SEPARATEUR_EMPREINTE = String.fromCharCode(31);

/** Reprend exactement les champs que le prompt envoie au modèle.
 *
 * Le critère est « ce que l'IA a lu », pas « ce qu'elle a réécrit ». Un nom de ligne influence la
 * prose sans être réécrit : le changer doit donc périmer la rédaction.
 *
 * Les montants n'y sont pas, parce qu'ils ne sont pas dans le prompt non plus. Ajuster un prix ne
 * doit pas obliger à relancer l'IA ni faire perdre les passages déjà acceptés ou refusés. */
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

/** Vrai quand la saisie a changé depuis que l'IA a écrit. La prose affichée décrit alors une version
 * du mandat qui n'existe plus, et les passages refusés ne pointent plus au bon endroit.
 *
 * Les rédactions faites avant que j'ajoute l'empreinte n'en ont pas. Dans ce cas je ne dis rien,
 * plutôt que d'afficher un avertissement sur tout ce qui existait déjà. */
export function redactionCaduque(
	brouillon: BrouillonMandat,
	redaction: RedactionIA | null | undefined
): boolean {
	if (!redaction?.empreinte) return false;
	return redaction.empreinte !== empreinteProse(brouillon);
}
