import { env } from '$env/dynamic/private';
import type {
	AuditClauses,
	ChampCondition,
	ClausesStandards,
	MandatDraft,
	PropositionClause,
	RedactionIA,
	SuggestionClause,
	SuggestionCondition
} from '$lib/types';
import { libelleLigne } from '$lib/document/format';
import {
	CLES_CLAUSES,
	CLES_CONDITIONS,
	LIBELLES_CLAUSES,
	LIBELLES_CONDITIONS
} from '$lib/document/catalogue';

const URL_PAR_DEFAUT = 'http://localhost:11434';
const MODELE_PAR_DEFAUT = 'llama3.1:8b';
const MODELE_PASSERELLE_PAR_DEFAUT = 'gemma4:latest';
const TIMEOUT_MS = 120_000;
/** En mode passerelle on streame : le heartbeat SSE tient la connexion pendant le chargement du
 * modèle, donc le plafond utile n'est plus le réseau mais la patience de l'utilisateur. */
const TIMEOUT_PASSERELLE_MS = 240_000;

export class OllamaIndisponibleError extends Error {}

/** Deux façons de joindre le modèle : la passerelle authentifiée de production (Mac Studio derrière
 * Tailscale) dès que `AI_API_URL` et `AI_API_KEY` sont fournies, sinon Ollama en direct, qui reste
 * le mode pratique en développement local. */
type ModeIa = { kind: 'passerelle'; base: string; cle: string } | { kind: 'ollama'; base: string };

function modeIa(): ModeIa {
	const base = (env.AI_API_URL || '').replace(/\/$/, '');
	const cle = env.AI_API_KEY || '';
	if (base && cle) return { kind: 'passerelle', base, cle };
	return { kind: 'ollama', base: (env.OLLAMA_URL || URL_PAR_DEFAUT).replace(/\/$/, '') };
}

/** Le modèle est toujours envoyé explicitement, y compris à la passerelle : elle a son propre
 * défaut, mais le nom retenu est horodaté dans le document et doit correspondre au vrai. */
export function modeleActif(): string {
	if (modeIa().kind === 'passerelle') return env.AI_MODEL || MODELE_PASSERELLE_PAR_DEFAUT;
	return env.OLLAMA_MODEL || MODELE_PAR_DEFAUT;
}

/** Contraintes communes aux deux modes de rédaction. L'IA ne produit que de la prose : tout ce
 * qui a une valeur juridique ou monétaire est rendu par le template, jamais par le modèle. */
const CONSIGNES = `Tu es un rédacteur professionnel qui prépare des documents d'affaires pour une firme de services numériques québécoise.

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

interface ReponseOllama {
	message?: { content?: string };
}

/** L'audit est le seul mode où le modèle a le droit d'esquisser une clause, parce que ce texte
 * n'atteint aucun document : il part en révision. Les consignes restent donc serrées sur ce qui
 * trompe le plus, la référence légale inventée, qui a l'air d'autant plus crédible qu'elle est précise. */
const CONSIGNES_AUDIT = `Tu es un conseiller qui relit des mandats de services numériques au Québec et signale ce qui manque.

Règles strictes :
- Écris en français québécois professionnel, sobre et factuel.
- Ne cite JAMAIS un article de loi, un numéro d'article, une jurisprudence ni un délai légal. Tu n'as pas les moyens de les vérifier, et une référence fausse est pire qu'une clause absente. Décris l'intention de la clause, pas son fondement légal.
- N'invente aucun montant, pourcentage, durée ni échéance.
- Tes brouillons de clause sont des pistes de départ destinées à une révision humaine, jamais du texte contractuel définitif.
- Ne signale que ce qui est réellement pertinent pour CE mandat. Mieux vaut ne rien proposer que de remplir pour remplir.
- Réponds uniquement avec du JSON valide, sans texte autour.
- Pas de tiret cadratin, pas de gras, pas d'émojis, pas de tournures d'assistant.`;

async function appeler(prompt: string, consignes: string = CONSIGNES): Promise<unknown> {
	const mode = modeIa();
	const contenu =
		mode.kind === 'passerelle'
			? await appelerPasserelle(mode, prompt, consignes)
			: await appelerOllama(mode.base, prompt, consignes);

	if (!contenu.trim()) throw new OllamaIndisponibleError("L'IA a renvoyé une réponse vide.");

	try {
		return extraireJson(contenu);
	} catch (cause) {
		throw new OllamaIndisponibleError(
			"La réponse de l'IA n'est pas exploitable. Réessayez ou changez de modèle.",
			{ cause }
		);
	}
}

/** Appel direct au démon Ollama. `format: 'json'` contraint la sortie côté serveur : c'est le mode
 * le plus fiable, mais il suppose un accès sans authentification au port 11434. */
async function appelerOllama(base: string, prompt: string, consignes: string): Promise<string> {
	let reponse: Response;
	try {
		reponse = await fetch(`${base}/api/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: modeleActif(),
				stream: false,
				format: 'json',
				options: { temperature: 0.3 },
				messages: [
					{ role: 'system', content: consignes },
					{ role: 'user', content: prompt }
				]
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (cause) {
		throw new OllamaIndisponibleError(
			`L'IA locale est injoignable à ${base}. Vérifiez qu'Ollama est démarré et que la connexion Tailscale est active.`,
			{ cause }
		);
	}

	if (!reponse.ok) {
		throw new OllamaIndisponibleError(
			`L'IA locale a répondu ${reponse.status}. Vérifiez que le modèle « ${modeleActif()} » est bien installé.`
		);
	}

	const donnees = (await reponse.json()) as ReponseOllama;
	return donnees.message?.content ?? '';
}

/** Appel à la passerelle authentifiée. On streame systématiquement : elle plafonne le mode
 * non-streamé à 90 s, et une passe de rédaction complète sur un gros modèle dépasse ce seuil dès
 * que le modèle doit être rechargé en mémoire. Le flux n'est pas affiché au fil de l'eau, il est
 * seulement réassemblé ici, puisque la réponse attendue est un objet JSON complet. */
async function appelerPasserelle(
	mode: { base: string; cle: string },
	prompt: string,
	consignes: string
): Promise<string> {
	let reponse: Response;
	try {
		reponse = await fetch(`${mode.base}/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-API-Key': mode.cle },
			body: JSON.stringify({
				model: modeleActif(),
				system: consignes,
				message: prompt,
				temperature: 0.3,
				stream: true
			}),
			signal: AbortSignal.timeout(TIMEOUT_PASSERELLE_MS)
		});
	} catch (cause) {
		throw new OllamaIndisponibleError(
			`La passerelle IA est injoignable à ${mode.base}. Vérifiez que la connexion Tailscale est active et que le service tourne sur le Mac.`,
			{ cause }
		);
	}

	if (!reponse.ok || !reponse.body) {
		throw new OllamaIndisponibleError(await messagePasserelle(reponse));
	}

	const lecteur = reponse.body.getReader();
	const decodeur = new TextDecoder();
	let tampon = '';
	let contenu = '';

	while (true) {
		const { done, value } = await lecteur.read();
		if (done) break;

		tampon += decodeur.decode(value, { stream: true });
		const blocs = tampon.split('\n\n');
		tampon = blocs.pop() ?? '';

		for (const bloc of blocs) {
			const evt = analyserBlocSse(bloc);
			if (!evt) continue;
			if (evt.type === 'error') {
				throw new OllamaIndisponibleError(
					evt.error || 'La passerelle IA a signalé une erreur pendant la génération.'
				);
			}
			if (evt.type === 'delta' && evt.content) contenu += evt.content;
		}
	}

	return contenu;
}

/** Traduit un refus de la passerelle en message actionnable. Le `request_id` est repris tel quel :
 * c'est la clé pour retrouver la trace côté Mac (`docker compose logs | grep <id>`). */
async function messagePasserelle(reponse: Response): Promise<string> {
	let detail = '';
	let requete = '';
	try {
		const corps = (await reponse.json()) as { error?: string; request_id?: string };
		detail = corps.error ?? '';
		requete = corps.request_id ?? '';
	} catch {
		// Une erreur d'infrastructure (524 de Cloudflare, 502 d'un proxy) ne renvoie pas de JSON.
	}

	const cause =
		{
			401: 'La clé API est absente ou refusée. Vérifiez AI_API_KEY.',
			403: "Cette machine n'est pas reconnue par la passerelle. Vérifiez que Tailscale est actif.",
			422: `La requête a été refusée. Vérifiez que le modèle « ${modeleActif()} » figure dans la liste autorisée de la passerelle.`,
			429: 'Quota de requêtes dépassé. Patientez un instant avant de relancer.',
			503: "La passerelle est saturée ou l'IA est arrêtée sur le Mac.",
			504: "L'IA a mis trop de temps à répondre.",
			524: 'La connexion a été coupée avant la fin de la génération.'
		}[reponse.status] ?? `La passerelle IA a répondu ${reponse.status}.`;

	return [cause, detail && `(${detail})`, requete && `[${requete}]`].filter(Boolean).join(' ');
}

interface EvenementSse {
	type?: string;
	content?: string;
	error?: string;
}

/** Isole l'événement d'un bloc SSE. Renvoie `null` pour ce qui ne porte pas de donnée : les
 * commentaires de heartbeat qui tiennent la connexion ouverte, le marqueur de fin, et tout bloc
 * illisible, qu'il vaut mieux ignorer que laisser casser une génération déjà à moitié reçue. */
export function analyserBlocSse(bloc: string): EvenementSse | null {
	const ligne = bloc.split('\n').find((l) => l.startsWith('data:'));
	if (!ligne) return null;

	const charge = ligne.slice(5).trim();
	if (!charge || charge === '[DONE]') return null;

	try {
		const evt = JSON.parse(charge);
		return evt && typeof evt === 'object' ? (evt as EvenementSse) : null;
	} catch {
		return null;
	}
}

/** La passerelle n'expose pas le mode JSON natif d'Ollama : la consigne « réponds uniquement avec
 * du JSON » suffit la plupart du temps, mais le modèle encadre volontiers son objet d'un bloc de
 * code ou d'une phrase d'introduction. On isole donc l'objet avant de parser. */
export function extraireJson(brut: string): unknown {
	const sansBlocs = brut.replace(/```(?:json)?/gi, '').trim();
	const debut = sansBlocs.indexOf('{');
	const fin = sansBlocs.lastIndexOf('}');
	const candidat = debut >= 0 && fin > debut ? sansBlocs.slice(debut, fin + 1) : sansBlocs;
	return JSON.parse(candidat);
}

/** Résumé factuel du mandat envoyé au modèle. Les montants sont volontairement omis : le modèle
 * n'a pas à les connaître puisqu'il n'a pas le droit de les écrire. */
function contexte(draft: MandatDraft): string {
	const label = libelleLigne(draft.structureProjet);
	const lignes = draft.lignes
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

	return `Type de document: ${draft.type === 'contrat' ? 'contrat de services' : 'soumission'}
Titre du projet: ${draft.titre || '(sans titre)'}
Client: ${draft.client.nom || '(non renseigné)'} (${draft.client.typeClient})
Objet saisi par l'utilisateur: ${draft.objet || '(vide)'}
Structure: ${draft.structureProjet}
Lignes de service:
${lignes}`;
}

/** Passe complète : réécrit toute la prose du document d'un coup, de façon cohérente. */
export async function redigerDocument(draft: MandatDraft): Promise<RedactionIA> {
	const idsConnus = new Set(draft.lignes.map((l) => l.id));

	const prompt = `Voici les données d'un mandat.

${contexte(draft)}

Rédige la prose du document sous forme d'un objet JSON avec exactement ces clés :
- "preambule" : un paragraphe d'introduction situant le mandat et les parties.
- "objet" : un ou deux paragraphes décrivant l'objet du mandat, en développant l'objet saisi par l'utilisateur.
- "lignes" : un objet dont les clés sont EXACTEMENT les identifiants "id" listés ci-dessus, et les valeurs un paragraphe décrivant les travaux de cette ligne. N'invente aucun identifiant.`;

	const brut = await appeler(prompt);
	return normaliser(brut, idsConnus);
}

/** Le tiret cadratin est la ponctuation qui trahit le plus vite un texte généré, et les modèles
 * continuent d'en produire malgré la consigne. On le remplace donc systématiquement :
 * en incise (« mot — mot — mot ») par des virgules, en apposition finale par un deux-points.
 * Nettoie au passage les puces et le gras Markdown, qui n'ont rien à faire dans un contrat. */
export function nettoyerProse(brut: string): string {
	return (
		brut
			// Incise encadrée : « les livrables — conçus sur mesure — sont livrés »
			.replace(/\s+[—–]\s+([^—–]+?)\s+[—–]\s+/g, ', $1, ')
			// Tiret d'apposition en fin de phrase : « ... du client — sans frais. »
			.replace(/\s+[—–]\s+/g, ' : ')
			// Tiret collé, souvent une plage ou une liaison : « site—web »
			.replace(/(\S)[—–](\S)/g, '$1, $2')
			.replace(/^\s*[-*•]\s+/gm, '')
			.replace(/\*\*(.+?)\*\*/g, '$1')
			.replace(/[ \t]{2,}/g, ' ')
			// Un deux-points de remplacement peut en suivre un autre déjà présent.
			.replace(/\s*:\s*:/g, ' :')
			.trim()
	);
}

function texte(valeur: unknown): string {
	return typeof valeur === 'string' ? nettoyerProse(valeur) : '';
}

/** Le modèle peut halluciner des clés ou des identifiants de lignes : on ne conserve que ce
 * qui correspond à la structure attendue et aux lignes réellement présentes dans le mandat. */
export function normaliser(brut: unknown, idsConnus: Set<string>): RedactionIA {
	const source = (brut ?? {}) as Record<string, unknown>;
	const lignesBrutes = (source.lignes ?? {}) as Record<string, unknown>;

	const lignes: Record<string, string> = {};
	for (const [id, valeur] of Object.entries(lignesBrutes)) {
		if (!idsConnus.has(id)) continue;
		const contenu = texte(valeur);
		if (contenu) lignes[id] = contenu;
	}

	return {
		preambule: texte(source.preambule),
		objet: texte(source.objet),
		lignes,
		genereLe: new Date().toISOString(),
		modele: modeleActif()
	};
}

/** État du volet contractuel : ce qui est déjà couvert, et ce qui ne l'est pas. Les valeurs
 * chiffrées sont montrées telles quelles, ce sont des faits saisis, pas des chiffres à inventer. */
function contexteClauses(draft: MandatDraft): string {
	const actives = CLES_CLAUSES.filter((c) => draft.conditions.clauses[c]);
	const inactives = CLES_CLAUSES.filter((c) => !draft.conditions.clauses[c]);
	const zero = CLES_CONDITIONS.filter((c) => draft.conditions[c] <= 0);
	const renseignees = CLES_CONDITIONS.filter((c) => draft.conditions[c] > 0);

	const liste = <K extends string>(cles: K[], source: Record<K, string>) =>
		cles.length ? cles.map((c) => `  - ${c} : ${source[c]}`).join('\n') : '  (aucune)';

	return `Clauses déjà activées :
${liste(actives, LIBELLES_CLAUSES)}

Clauses du catalogue NON activées :
${liste(inactives, LIBELLES_CLAUSES)}

Conditions chiffrées renseignées :
${renseignees.length ? renseignees.map((c) => `  - ${c} = ${draft.conditions[c]}`).join('\n') : '  (aucune)'}

Conditions chiffrées laissées à zéro (l'article correspondant est absent du contrat) :
${liste(zero, LIBELLES_CONDITIONS)}

Notes additionnelles saisies : ${draft.conditions.notesAdditionnelles.trim() || '(vide)'}
Abonnement récurrent : ${draft.abonnement.actif ? `oui, ${draft.abonnement.frequence}, couvre : ${draft.abonnement.couverture.trim() || '(non précisé)'}` : 'non'}`;
}

/** Relit le mandat et signale ce qui manque au volet contractuel. Ne modifie rien : l'utilisateur
 * reste seul à décider d'activer une clause, et les brouillons partent en révision, pas au document. */
export async function auditerClauses(draft: MandatDraft): Promise<AuditClauses> {
	const prompt = `Voici un mandat à relire.

${contexte(draft)}

${contexteClauses(draft)}

Relis ce mandat et signale ce qui manque au volet contractuel. Réponds par un objet JSON avec exactement ces clés :
- "suggestions" : tableau des clauses NON activées qui devraient l'être compte tenu de la nature de ce mandat. Chaque entrée : {"cle": "<une clé exacte de la liste des clauses non activées>", "raison": "<une phrase expliquant pourquoi ce mandat l'appelle>"}. N'y mets aucune clause déjà activée.
- "conditions" : tableau des conditions chiffrées à zéro qui devraient être renseignées. Chaque entrée : {"champ": "<une clé exacte de la liste des conditions à zéro>", "raison": "<une phrase>"}. Ne propose AUCUNE valeur chiffrée.
- "propositions" : tableau des protections manquantes que le catalogue ci-dessus ne couvre pas du tout. Chaque entrée : {"titre": "<titre court de la clause>", "raison": "<pourquoi ce mandat en a besoin>", "brouillon": "<un ou deux paragraphes de départ, sans référence légale>"}. Laisse ce tableau vide si le catalogue suffit.

Ne signale que ce qui est réellement justifié par ce mandat.`;

	const brut = await appeler(prompt, CONSIGNES_AUDIT);
	return normaliserAudit(brut, draft);
}

/** Le modèle recommande volontiers d'activer ce qui l'est déjà, invente des clés, ou renvoie un
 * objet là où un tableau est attendu. On ne garde que ce qui désigne une case réellement
 * décochée : une suggestion sans effet est du bruit qui décrédibilise l'audit entier. */
export function normaliserAudit(brut: unknown, draft: MandatDraft): AuditClauses {
	const source = (brut ?? {}) as Record<string, unknown>;
	const tableau = (v: unknown): Record<string, unknown>[] =>
		Array.isArray(v)
			? v.filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
			: [];

	const suggestions: SuggestionClause[] = [];
	for (const entree of tableau(source.suggestions)) {
		const cle = entree.cle as keyof ClausesStandards;
		if (!CLES_CLAUSES.includes(cle)) continue;
		if (draft.conditions.clauses[cle]) continue;
		if (suggestions.some((s) => s.cle === cle)) continue;
		suggestions.push({ cle, raison: texte(entree.raison) });
	}

	const conditions: SuggestionCondition[] = [];
	for (const entree of tableau(source.conditions)) {
		const champ = entree.champ as ChampCondition;
		if (!CLES_CONDITIONS.includes(champ)) continue;
		if (draft.conditions[champ] > 0) continue;
		if (conditions.some((c) => c.champ === champ)) continue;
		conditions.push({ champ, raison: texte(entree.raison) });
	}

	const propositions: PropositionClause[] = [];
	for (const entree of tableau(source.propositions)) {
		const titre = texte(entree.titre);
		const brouillon = texte(entree.brouillon);
		if (!titre || !brouillon) continue;
		propositions.push({ titre, raison: texte(entree.raison), brouillon });
	}

	return {
		suggestions,
		conditions,
		propositions,
		genereLe: new Date().toISOString(),
		modele: modeleActif()
	};
}

export type CibleChamp = { kind: 'objet' } | { kind: 'ligne'; id: string };

/** Aide ponctuelle : étoffe un seul champ pendant la saisie, sans rien persister. */
export async function redigerChamp(draft: MandatDraft, cible: CibleChamp): Promise<string> {
	const consigne =
		cible.kind === 'objet'
			? `Rédige uniquement l'objet du mandat, en développant ce que l'utilisateur a saisi. Un ou deux paragraphes.`
			: `Rédige uniquement la description des travaux de la ligne dont l'identifiant est "${cible.id}". Un paragraphe.`;

	const prompt = `Voici les données d'un mandat.

${contexte(draft)}

${consigne}

Réponds avec un objet JSON de la forme {"texte": "..."} et rien d'autre.`;

	const brut = (await appeler(prompt)) as Record<string, unknown>;
	const resultat = texte(brut?.texte);
	if (!resultat) throw new OllamaIndisponibleError("L'IA locale n'a pas produit de texte.");
	return resultat;
}
