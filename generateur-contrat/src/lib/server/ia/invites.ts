/** Ce qu'on demande au modèle : les consignes système, le résumé du mandat, et les trois invites.
 * Aucun appel réseau ici, uniquement des chaînes — c'est la seule façon de relire un prompt.
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

/** L'IA ne produit que de la prose : tout ce qui a une valeur juridique ou monétaire est rendu par le
 * gabarit, jamais par le modèle. */
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

/** Consignes pour ce qui n'est **pas** de la prose : un titre, un élément de liste. `CONSIGNES` ne
 * peut pas servir ici, elle ordonne « produis uniquement des paragraphes de texte courant » — et un
 * modèle à qui on demande un titre sous cette consigne renvoie un début de préambule.
 *
 * Les exemples comptent plus que les interdits : un petit modèle local suit mal une consigne
 * négative, mais imite bien un échantillon. */
export const CONSIGNES_LIBELLE = `Tu nommes des choses pour une firme de services numériques québécoise. Tu ne rédiges pas de texte : tu étiquettes.

Règles strictes :
- Réponds par un groupe nominal court, en français québécois. Jamais une phrase : pas de verbe conjugué, pas de sujet, pas de point final.
- N'invente JAMAIS de montant, de pourcentage, de date, de durée ni de nom d'entreprise.
- N'emploie pas les mots « contrat », « soumission », « mandat », « projet de », et ne reprends pas le nom du client.
- Pas de guillemets, pas de gras, pas d'émojis, pas de tiret cadratin.
- Réponds uniquement avec du JSON valide, sans texte autour.

Attendu : « Refonte du site vitrine », « Plateforme de réservation en ligne », « Migration infonuagique », « Sauvegarde automatisée ».
Refusé : « Ce contrat concerne la refonte du site », « Projet de refonte pour ABC inc. », « Une plateforme moderne et performante ».`;

/** Le seul mode où le modèle a le droit d'esquisser une clause, parce que ce texte part en révision
 * plutôt qu'au document. D'où la consigne serrée sur ce qui trompe le plus : la référence légale
 * inventée, d'autant plus crédible qu'elle est précise. */
export const CONSIGNES_AUDIT = `Tu es un conseiller qui relit des mandats de services numériques au Québec et signale ce qui manque.

Règles strictes :
- Écris en français québécois professionnel, sobre et factuel.
- Ne cite JAMAIS un article de loi, un numéro d'article, une jurisprudence ni un délai légal. Tu n'as pas les moyens de les vérifier, et une référence fausse est pire qu'une clause absente. Décris l'intention de la clause, pas son fondement légal.
- N'invente aucun montant, pourcentage, durée ni échéance.
- Tes brouillons de clause sont des pistes de départ destinées à une révision humaine, jamais du texte contractuel définitif.
- Ne signale que ce qui est réellement pertinent pour CE mandat. Mieux vaut ne rien proposer que de remplir pour remplir.
- Réponds uniquement avec du JSON valide, sans texte autour.
- Pas de tiret cadratin, pas de gras, pas d'émojis, pas de tournures d'assistant.`;

/** Résumé factuel du mandat. Les montants sont omis : le modèle n'a pas à les connaître puisqu'il n'a
 * pas le droit de les écrire. */
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

/** État du volet contractuel : ce qui est couvert, et ce qui ne l'est pas. Les chiffres saisis sont
 * montrés tels quels, ce sont des faits.
 *
 * La bibliothèque y figure avec ses identifiants : c'est ce que le modèle doit renvoyer pour désigner
 * une clause existante au lieu d'en rédiger une variante de plus. */
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

/** Passe complète : toute la prose du document d'un coup, pour qu'elle soit cohérente.
 *
 * Le volet contractuel est transmis lui aussi, comme aux invites de champ : une description de ligne
 * gagne à savoir qu'une garantie de 90 jours court derrière elle. */
export function invitePourDocument(brouillon: BrouillonMandat): string {
	return `Voici les données d'un mandat.

${contexte(brouillon)}

${contexteClauses(brouillon, [])}

Rédige la prose du document sous forme d'un objet JSON avec exactement ces clés :
- "preambule" : un paragraphe d'introduction situant le mandat et les parties.
- "objet" : un ou deux paragraphes décrivant l'objet du mandat, en développant l'objet saisi par l'utilisateur.
- "lignes" : un objet dont les clés sont EXACTEMENT les identifiants "id" listés ci-dessus, et les valeurs un paragraphe décrivant les travaux de cette ligne. N'invente aucun identifiant.

Développe, ne reformule pas. Une description de trois mots doit devenir un paragraphe qui explicite ce que les travaux impliquent concrètement pour le client : ce qui sera fait, sur quoi, et ce que ça produit. Appuie-toi sur les éléments inclus et exclus déjà listés pour étoffer.

Mais n'ajoute AUCUN fait absent des données : pas de livrable, pas d'outil, pas de technologie, pas d'étape, pas de contrainte dont rien ne parle ci-dessus. Si une ligne est trop vague pour être développée honnêtement, écris un paragraphe court plutôt que de la remplir d'inventions.`;
}

/** La revue du fond, par opposition à l'audit du volet contractuel. Le modèle n'écrit rien au
 * document ici : il lit et signale. D'où des consignes tournées vers le doute plutôt que vers le
 * style. */
export const CONSIGNES_REVUE = `Tu relis le fond d'un mandat de services numériques avant qu'il ne parte chez un client. Ton rôle est de repérer ce qui coince, pas de réécrire.

Règles strictes :
- Écris en français québécois professionnel, sobre et direct.
- Ne signale QUE ce que tu peux constater dans les données fournies. Ne suppose pas ce que l'auteur a voulu dire.
- N'invente aucun montant, durée, délai, technologie ni livrable, y compris dans tes suggestions.
- Une bonne alerte pointe deux endroits du mandat qui ne s'accordent pas, ou une promesse que rien ne réalise. Une mauvaise alerte est un conseil générique qui vaudrait pour n'importe quel mandat.
- Si le mandat se tient, réponds par une liste vide. Ne remplis pas pour remplir : cinq alertes molles valent moins qu'une seule juste.
- Ne commente ni le style, ni l'orthographe, ni la longueur des textes. Le fond seulement.
- Réponds uniquement avec du JSON valide, sans texte autour.

Exemples d'alertes utiles :
- L'objet annonce une migration des données existantes, mais aucune phase ne la mentionne.
- La phase 2 exclut la rédaction des contenus, la phase 3 la présente comme incluse.
- Le mandat porte sur une application mobile, la portée ne parle que du site web.`;

export function invitePourRevue(brouillon: BrouillonMandat): string {
	return `Voici un mandat à relire sur le fond.

${contexte(brouillon)}

${contexteClauses(brouillon, [])}

Procède dans cet ordre. C'est là que se trouvent les erreurs, et un survol général les manque :

1. Relis l'objet du mandat, puis la liste des lignes. L'objet annonce-t-il un travail qu'aucune ligne ne réalise ?
2. Pour chaque ligne, compare ses éléments « Inclus » et « Non inclus » à l'objet et aux autres lignes. Une même chose est-elle promise à un endroit et exclue à un autre ? C'est la contradiction la plus fréquente et la plus coûteuse.
3. Compare les lignes entre elles : se recoupent-elles, s'attribuent-elles le même travail, une exclusion de l'une contredit-elle l'inclusion d'une autre ?
4. Relis chaque description : dit-elle assez clairement qui fait quoi pour trancher un désaccord, ou pourrait-elle vouloir dire deux choses ?

Signale ensuite ce qui ne se tient pas. Réponds par un objet JSON avec une seule clé :
- "alertes" : un tableau. Chaque entrée : {"gravite": "incoherence" | "manque" | "imprecision", "cible": "<où regarder>", "constat": "<ce qui cloche, une phrase>", "suggestion": "<ce qu'on pourrait faire, une phrase>"}.

Pour "gravite" :
- "incoherence" : deux endroits du mandat se contredisent.
- "manque" : le mandat annonce quelque chose dont aucune ligne ne parle.
- "imprecision" : un texte si vague qu'il ne serait pas opposable en cas de désaccord.

Pour "cible", utilise EXACTEMENT l'une de ces valeurs : "objet", "portee", "general", ou l'identifiant "id" d'une des lignes listées ci-dessus. N'invente aucun identifiant.

Au plus six alertes, les plus graves d'abord. Tableau vide si le mandat se tient.`;
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

/** Les champs de prose qu'on peut faire étoffer un par un pendant la saisie. */
export type CibleChamp =
	| { kind: 'titre' }
	| { kind: 'objet' }
	| { kind: 'ligne'; id: string }
	| { kind: 'couverture' }
	| { kind: 'notes' };

/** Les listes de puces qu'on peut faire compléter. Réponse en tableau, pas en paragraphe : ce sont
 * des éléments qu'on coche un par un. */
export type CiblePuces = { kind: 'inclus' | 'nonInclus'; id: string };

function consignePourChamp(cible: CibleChamp): string {
	switch (cible.kind) {
		case 'titre':
			return `Propose uniquement un titre de projet, déduit de la portée décrite ci-dessus. Un groupe nominal de deux à six mots, sans guillemets, sans point final, sans le nom du client et sans le mot « soumission » ni « contrat ». Il doit nommer le projet, pas le décrire : « Refonte du site vitrine », pas « Projet de refonte du site vitrine du client ».`;
		case 'objet':
			return `Rédige uniquement l'objet du mandat, en développant ce que l'utilisateur a saisi. Un ou deux paragraphes.`;
		case 'ligne':
			return `Rédige uniquement la description des travaux de la ligne dont l'identifiant est "${cible.id}". Un paragraphe.`;
		case 'couverture':
			return `Rédige uniquement ce que couvre l'abonnement récurrent, en une phrase ou deux, à la suite de « couvre ». N'écris ni le montant ni la fréquence : ils sont ajoutés automatiquement autour de ta phrase.`;
		case 'notes':
			return `Rédige uniquement les conditions particulières additionnelles que ce mandat appelle et que les clauses ci-dessus ne couvrent pas encore. Ne redis pas une clause déjà active. N'invente ni durée, ni délai, ni montant. Si rien de sérieux ne manque, réponds par une chaîne vide.`;
	}
}

/** Aide ponctuelle : un seul champ étoffé pendant la saisie. Le mandat entier est transmis à chaque
 * fois, y compris le volet contractuel : c'est ce qui permet à une description de ligne de tenir
 * compte du reste du projet au lieu d'être rédigée dans le vide. */
export function invitePourChamp(brouillon: BrouillonMandat, cible: CibleChamp): string {
	return `Voici les données d'un mandat.

${contexte(brouillon)}

${contexteClauses(brouillon, [])}

${consignePourChamp(cible)}

Réponds avec un objet JSON de la forme {"texte": "..."} et rien d'autre.`;
}

/** Complète une liste d'éléments inclus ou exclus, en tenant compte de tout le mandat. */
export function invitePourPuces(brouillon: BrouillonMandat, cible: CiblePuces): string {
	const ligne = brouillon.lignes.find((l) => l.id === cible.id);
	const dejaLa = (cible.kind === 'inclus' ? ligne?.inclus : ligne?.nonInclus) ?? [];
	const propres = dejaLa.map((v) => v.trim()).filter(Boolean);

	const quoi =
		cible.kind === 'inclus'
			? `ce que cette ligne comprend`
			: `ce que cette ligne ne comprend PAS, et qu'un client pourrait croire inclus`;

	return `Voici les données d'un mandat.

${contexte(brouillon)}

Concentre-toi sur la ligne dont l'identifiant est "${cible.id}".

Éléments déjà listés, à ne pas répéter :
${propres.length ? propres.map((v) => `  - ${v}`).join('\n') : '  (aucun)'}

Propose au plus cinq éléments courts décrivant ${quoi}. Un groupe nominal par élément, sans phrase complète, sans ponctuation finale, sans montant ni durée. Reste dans la portée décrite : n'invente pas de travaux dont rien ne parle.

Réponds avec un objet JSON de la forme {"items": ["...", "..."]} et rien d'autre. Tableau vide si tu n'as rien de pertinent à ajouter.`;
}
