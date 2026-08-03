/** Comment on joint le modèle, et comment on ramène sa réponse. Ce module ne sait rien du contenu :
 * deux endpoints, un format de flux, et la liste des façons dont un appel peut échouer.
 */
import { env } from '$env/dynamic/private';

const URL_PAR_DEFAUT = 'http://localhost:11434';
const MODELE_PAR_DEFAUT = 'llama3.1:8b';
const MODELE_PASSERELLE_PAR_DEFAUT = 'gemma4:latest';
const TIMEOUT_MS = 120_000;
/** En mode passerelle, le heartbeat SSE tient la connexion pendant le chargement du modèle : le
 * plafond utile n'est plus le réseau mais la patience de l'utilisateur. */
const TIMEOUT_PASSERELLE_MS = 240_000;

export class OllamaIndisponibleError extends Error {}

/** La passerelle authentifiée dès que `AI_API_URL` et `AI_API_KEY` sont fournies, sinon Ollama en
 * direct, qui reste le mode pratique en développement local. */
type ModeIa = { kind: 'passerelle'; base: string; cle: string } | { kind: 'ollama'; base: string };

function modeIa(): ModeIa {
	const base = (env.AI_API_URL || '').replace(/\/$/, '');
	const cle = env.AI_API_KEY || '';
	if (base && cle) return { kind: 'passerelle', base, cle };
	return { kind: 'ollama', base: (env.OLLAMA_URL || URL_PAR_DEFAUT).replace(/\/$/, '') };
}

/** Le modèle est toujours envoyé explicitement : son nom est horodaté dans le document, il doit donc
 * correspondre à celui qui a réellement répondu. */
export function modeleActif(): string {
	if (modeIa().kind === 'passerelle') return env.AI_MODEL || MODELE_PASSERELLE_PAR_DEFAUT;
	return env.OLLAMA_MODEL || MODELE_PAR_DEFAUT;
}

interface ReponseOllama {
	message?: { content?: string };
}

/** Envoie une invite et rend l'objet JSON obtenu. Les consignes viennent de l'appelant : elles
 * relèvent de ce qu'on demande, pas de la façon de le demander. */
export async function appeler(prompt: string, consignes: string): Promise<unknown> {
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

/** Appel direct au démon Ollama. `format: 'json'` contraint la sortie côté serveur, le mode le plus
 * fiable, mais suppose un accès sans authentification au port 11434. */
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
 * non-streamé à 90 s, qu'une passe de rédaction dépasse dès que le modèle doit être rechargé. Le
 * flux n'est pas affiché au fil de l'eau, seulement réassemblé. */
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

	return lireFluxSse(reponse.body);
}

/** Réassemble le texte d'un flux SSE. Les morceaux réseau ne tombent pas sur les frontières des
 * événements, d'où le tampon qui garde ce qui est incomplet jusqu'à la suite. */
async function lireFluxSse(corps: ReadableStream<Uint8Array>): Promise<string> {
	const lecteur = corps.getReader();
	// `stream: true` met en réserve un caractère UTF-8 coupé entre deux morceaux.
	const decodeur = new TextDecoder();

	let tampon = '';
	let contenu = '';

	while (true) {
		const { done, value } = await lecteur.read();
		if (done) break;

		tampon += decodeur.decode(value, { stream: true });

		// Une ligne vide sépare les événements. Le dernier morceau est presque toujours incomplet :
		// il repart dans le tampon.
		const blocs = tampon.split('\n\n');
		tampon = blocs.pop() ?? '';

		for (const bloc of blocs) {
			const evenement = analyserBlocSse(bloc);
			if (!evenement) continue;
			if (evenement.type === 'error') {
				throw new OllamaIndisponibleError(
					evenement.error || 'La passerelle IA a signalé une erreur pendant la génération.'
				);
			}
			if (evenement.type === 'delta' && evenement.content) contenu += evenement.content;
		}
	}

	return contenu;
}

/** Traduit un refus de la passerelle en message actionnable. Le `request_id` est repris tel quel :
 * c'est la clé pour retrouver la trace côté Mac. */
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

/** Isole l'événement d'un bloc SSE. `null` pour ce qui ne porte pas de donnée : heartbeat, marqueur
 * de fin, et tout bloc illisible — mieux vaut l'ignorer que casser une génération à moitié reçue. */
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

/** La passerelle n'expose pas le mode JSON natif d'Ollama, et le modèle encadre volontiers son objet
 * d'un bloc de code ou d'une phrase d'introduction. On l'isole avant de parser. */
export function extraireJson(brut: string): unknown {
	const sansBlocs = brut.replace(/```(?:json)?/gi, '').trim();
	const debut = sansBlocs.indexOf('{');
	const fin = sansBlocs.lastIndexOf('}');
	const candidat = debut >= 0 && fin > debut ? sansBlocs.slice(debut, fin + 1) : sansBlocs;
	return JSON.parse(candidat);
}
