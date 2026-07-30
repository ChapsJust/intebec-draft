/** Ce qu'on demande au modèle.
 *
 * Les consignes système, le résumé du mandat qu'on lui donne à lire, et les trois invites. Rien
 * ici ne fait d'appel réseau : ce module ne produit que des chaînes, ce qui le rend lisible d'un
 * bout à l'autre — c'est la seule façon de relire un prompt.
 */
import type { BrouillonMandat, ClauseBibliotheque } from '$domaine/types';
import { libelleLigne } from '$document/format';
import {
	CLES_CLAUSES,
	CLES_CONDITIONS,
	LIBELLES_CLAUSES,
	LIBELLES_CONDITIONS
} from '$document/catalogue';
import { titreNormalise } from './normalisation';

/** Contraintes communes aux deux modes de rédaction. L'IA ne produit que de la prose : tout ce
 * qui a une valeur juridique ou monétaire est rendu par le template, jamais par le modèle. */
export const CONSIGNES = `Tu es un rédacteur professionnel qui prépare des documents d'affaires pour une firme de services numériques québécoise.

Règles strictes :
- Écris en français québécois professionnel, au ton sobre et factuel. Vouvoiement, pas de superlatifs commerciaux.
- N'invente JAMAIS de montant, de pourcentage, de date, d'échéance, de durée ou de clause juridique. Ces éléments sont ajoutés automatiquement ailleurs dans le document.
- Ne mentionne aucun prix ni aucun chiffre qui ne figure pas explicitement dans les données fournies.
- Ne reprends pas de titres ni de numérotation : produis uniquement des paragraphes de texte courant.
- Reste fidèle à l'information fournie. Si une information manque, reste général plutôt que de la deviner.
- Réponds uniquement avec du JSON valide, sans texte autour.

Style, à respecter absolument :
- N'utilise jamais le tiret cadratin ni le tiret demi-cadratin pour ponctuer une phrase. Utilise la virgule, le deux-points, la parenthèse ou le point.
- Pas de tournures d'assistant : « il est important de noter », « permettant ainsi de », « dans un monde où », « que ce soit ». Va droit au fait.
- Pas de triades décoratives du type « rapide, fiable et évolutif ». Une qualification suffit si elle est vraie.
- Pas d'emphase en gras, pas de listes à puces, pas d'émojis.
- Des phrases courtes, à la voix active. Écris comme un professionnel qui rédige, pas comme un texte de présentation.`;

/** L'audit est le seul mode où le modèle a le droit d'esquisser une clause, parce que ce texte
 * n'atteint aucun document : il part en révision. Les consignes restent donc serrées sur ce qui
 * trompe le plus, la référence légale inventée, qui a l'air d'autant plus crédible qu'elle est précise. */
export const CONSIGNES_AUDIT = `Tu es un conseiller qui relit des mandats de services numériques au Québec et signale ce qui manque.

Règles strictes :
- Écris en français québécois professionnel, sobre et factuel.
- Ne cite JAMAIS un article de loi, un numéro d'article, une jurisprudence ni un délai légal. Tu n'as pas les moyens de les vérifier, et une référence fausse est pire qu'une clause absente. Décris l'intention de la clause, pas son fondement légal.
- N'invente aucun montant, pourcentage, durée ni échéance.
- Tes brouillons de clause sont des pistes de départ destinées à une révision humaine, jamais du texte contractuel définitif.
- Ne signale que ce qui est réellement pertinent pour CE mandat. Mieux vaut ne rien proposer que de remplir pour remplir.
- Réponds uniquement avec du JSON valide, sans texte autour.
- Pas de tiret cadratin, pas de gras, pas d'émojis, pas de tournures d'assistant.`;

/** Résumé factuel du mandat envoyé au modèle. Les montants sont volontairement omis : le modèle
 * n'a pas à les connaître puisqu'il n'a pas le droit de les écrire. */
function contexte(brouillon: BrouillonMandat): string {
	const label = libelleLigne(brouillon.structureProjet);
	const lignes = brouillon.lignes
		.map((ligne, i) => {
			const parties = [
				`  - id: ${ligne.id}`,
				`    ${label} ${i + 1}: ${ligne.nom || '(sans nom)'}`,
				ligne.description ? `    Description actuelle: ${ligne.description}` : '',
				ligne.inclus.filter(Boolean).length
					? `    Inclus: ${ligne.inclus.filter(Boolean).join(', ')}`
					: '',
				ligne.nonInclus.filter(Boolean).length
					? `    Non inclus: ${ligne.nonInclus.filter(Boolean).join(', ')}`
					: '',
				ligne.delaiEstime ? `    Délai: ${ligne.delaiEstime}` : ''
			];
			return parties.filter(Boolean).join('\n');
		})
		.join('\n');

	return `Type de document: ${brouillon.type === 'contrat' ? 'contrat de services' : 'soumission'}
Titre du projet: ${brouillon.titre || '(sans titre)'}
Client: ${brouillon.client.nom || '(non renseigné)'} (${brouillon.client.typeClient})
Objet saisi par l'utilisateur: ${brouillon.objet || '(vide)'}
Structure: ${brouillon.structureProjet}
Lignes de service:
${lignes}`;
}

/** État du volet contractuel : ce qui est déjà couvert, et ce qui ne l'est pas. Les valeurs
 * chiffrées sont montrées telles quelles, ce sont des faits saisis, pas des chiffres à inventer.
 *
 * La bibliothèque y figure avec ses identifiants parce que c'est ce que le modèle doit renvoyer pour
 * désigner une clause existante : sans elle, il rédigeait une variante de plus à chaque relecture
 * d'une protection déjà retenue sur un autre mandat. */
function contexteClauses(brouillon: BrouillonMandat, bibliotheque: ClauseBibliotheque[]): string {
	const actives = CLES_CLAUSES.filter((c) => brouillon.conditions.clauses[c]);
	const inactives = CLES_CLAUSES.filter((c) => !brouillon.conditions.clauses[c]);
	const zero = CLES_CONDITIONS.filter((c) => brouillon.conditions[c] <= 0);
	const renseignees = CLES_CONDITIONS.filter((c) => brouillon.conditions[c] > 0);

	const liste = <K extends string>(cles: K[], source: Record<K, string>) =>
		cles.length ? cles.map((c) => `  - ${c} : ${source[c]}`).join('\n') : '  (aucune)';

	const retenues = brouillon.conditions.clausesRetenues;
	const titresRetenus = new Set(retenues.map((c) => titreNormalise(c.titre)));
	const disponibles = bibliotheque.filter((c) => !titresRetenus.has(titreNormalise(c.titre)));

	return `Clauses déjà activées :
${liste(actives, LIBELLES_CLAUSES)}

Clauses du catalogue NON activées :
${liste(inactives, LIBELLES_CLAUSES)}

Conditions chiffrées renseignées :
${renseignees.length ? renseignees.map((c) => `  - ${c} = ${brouillon.conditions[c]}`).join('\n') : '  (aucune)'}

Conditions chiffrées laissées à zéro (l'article correspondant est absent du contrat) :
${liste(zero, LIBELLES_CONDITIONS)}

Clauses hors catalogue déjà retenues pour CE mandat :
${retenues.length ? retenues.map((c) => `  - ${c.titre}`).join('\n') : '  (aucune)'}

Clauses de la bibliothèque non retenues pour ce mandat (utilise l'id pour en désigner une) :
${disponibles.length ? disponibles.map((c) => `  - id: ${c.id} : ${c.titre}`).join('\n') : '  (aucune)'}

Notes additionnelles saisies : ${brouillon.conditions.notesAdditionnelles.trim() || '(vide)'}
Abonnement récurrent : ${brouillon.abonnement.actif ? `oui, ${brouillon.abonnement.frequence}, couvre : ${brouillon.abonnement.couverture.trim() || '(non précisé)'}` : 'non'}`;
}

/** Passe complète : toute la prose du document d'un coup, pour qu'elle soit cohérente. */
export function invitePourDocument(brouillon: BrouillonMandat): string {
	return `Voici les données d'un mandat.

${contexte(brouillon)}

Rédige la prose du document sous forme d'un objet JSON avec exactement ces clés :
- "preambule" : un paragraphe d'introduction situant le mandat et les parties.
- "objet" : un ou deux paragraphes décrivant l'objet du mandat, en développant l'objet saisi par l'utilisateur.
- "lignes" : un objet dont les clés sont EXACTEMENT les identifiants "id" listés ci-dessus, et les valeurs un paragraphe décrivant les travaux de cette ligne. N'invente aucun identifiant.`;
}

export function invitePourAudit(
	brouillon: BrouillonMandat,
	bibliotheque: ClauseBibliotheque[]
): string {
	return `Voici un mandat à relire.

${contexte(brouillon)}

${contexteClauses(brouillon, bibliotheque)}

Relis ce mandat et signale ce qui manque au volet contractuel. Réponds par un objet JSON avec exactement ces clés :
- "suggestions" : tableau des clauses NON activées qui devraient l'être compte tenu de la nature de ce mandat. Chaque entrée : {"cle": "<une clé exacte de la liste des clauses non activées>", "raison": "<une phrase expliquant pourquoi ce mandat l'appelle>"}. N'y mets aucune clause déjà activée.
- "conditions" : tableau des conditions chiffrées à zéro qui devraient être renseignées. Chaque entrée : {"champ": "<une clé exacte de la liste des conditions à zéro>", "raison": "<une phrase>"}. Ne propose AUCUNE valeur chiffrée.
- "bibliotheque" : tableau des clauses de la bibliothèque ci-dessus qui devraient être retenues pour ce mandat. Chaque entrée : {"id": "<un id exact de la liste des clauses de la bibliothèque>", "raison": "<une phrase>"}. N'invente aucun id.
- "propositions" : tableau des protections manquantes que RIEN ne couvre : ni le catalogue, ni les clauses déjà retenues, ni la bibliothèque. Chaque entrée : {"titre": "<titre court de la clause>", "raison": "<pourquoi ce mandat en a besoin>", "brouillon": "<un ou deux paragraphes de départ, sans référence légale>"}. Si la protection existe déjà dans la bibliothèque, ne la réécris PAS ici : désigne-la par son id dans "bibliotheque". Laisse ce tableau vide si tout est déjà couvert.

Ne signale que ce qui est réellement justifié par ce mandat.`;
}

export type CibleChamp = { kind: 'objet' } | { kind: 'ligne'; id: string };

/** Aide ponctuelle : un seul champ étoffé pendant la saisie, sans rien persister. */
export function invitePourChamp(brouillon: BrouillonMandat, cible: CibleChamp): string {
	const consigne =
		cible.kind === 'objet'
			? `Rédige uniquement l'objet du mandat, en développant ce que l'utilisateur a saisi. Un ou deux paragraphes.`
			: `Rédige uniquement la description des travaux de la ligne dont l'identifiant est "${cible.id}". Un paragraphe.`;

	return `Voici les données d'un mandat.

${contexte(brouillon)}

${consigne}

Réponds avec un objet JSON de la forme {"texte": "..."} et rien d'autre.`;
}
