/** Comment on joint le modèle et comment on ramène sa réponse.
 *
 * Ce module ne sait rien du contenu : il connaît deux endpoints, un format de flux, et la liste des
 * façons dont un appel peut échouer. Ce qu'on demande au modèle est dans `invites.ts`.
 */
import { env } from '$env/dynamic/private';

const URL_PAR_DEFAUT = 'http://localhost:11434';
const MODELE_PAR_DEFAUT = 'llama3.1:8b';
const MODELE_PASSERELLE_PAR_DEFAUT = 'gemma4:latest';
const TIMEOUT_MS = 120_000;
/** En mode passerelle, le heartbeat SSE garde la connexion ouverte pendant que le modèle se charge.
 * Ce n'est donc plus le réseau qui limite, mais la patience de l'utilisateur. D'où un timeout plus
 * généreux qu'en direct. */
const TIMEOUT_PASSERELLE_MS = 240_000;

export class OllamaIndisponibleError extends Error {}

/** Deux modes. Si `AI_API_URL` et `AI_API_KEY` sont remplies, on passe par la passerelle
 * authentifiée. Sinon on tape Ollama directement, ce qui reste le plus pratique quand je développe
 * sur ma machine. */
type ModeIa = { kind: 'passerelle'; base: string; cle: string } | { kind: 'ollama'; base: string };

function modeIa(): ModeIa {
	const base = (env.AI_API_URL || '').replace(/\/$/, '');
	const cle = env.AI_API_KEY || '';
	if (base && cle) return { kind: 'passerelle', base, cle };
	return { kind: 'ollama', base: (env.OLLAMA_URL || URL_PAR_DEFAUT).replace(/\/$/, '') };
}

/** On envoie toujours le nom du modèle explicitement, même quand le serveur en a un par défaut : ce
 * nom est enregistré avec la rédaction et affiché à l'utilisateur, il doit donc correspondre à celui
 * qui a vraiment répondu. */
export function modeleActif(): string {
	if (modeIa().kind === 'passerelle') return env.AI_MODEL || MODELE_PASSERELLE_PAR_DEFAUT;
	return env.OLLAMA_MODEL || MODELE_PAR_DEFAUT;
}

interface ReponseOllama {
	message?: { content?: string };
}

/** Envoie une invite et renvoie l'objet JSON obtenu. Les consignes système sont passées par
 * l'appelant plutôt que fixées ici : elles font partie de ce qu'on demande, pas de la façon de le
 * demander. */
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

/** Appel direct au démon Ollama. Avec `format: 'json'` c'est Ollama lui-même qui force la sortie à
 * être du JSON valide, ce qui est bien plus fiable que de le demander gentiment dans le prompt.
 * En contrepartie ça suppose un accès sans authentification au port 11434, donc c'est le mode local
 * seulement. */
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

/** Appel à la passerelle authentifiée. On streame tout le temps, même si on n'affiche rien au fil de
 * l'eau : la passerelle coupe les requêtes non streamées au bout d'un délai assez court, et une
 * passe de rédaction complète le dépasse dès que le modèle doit être rechargé en mémoire. Le flux
 * est donc juste réassemblé en un bloc avant d'être rendu. */
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

/** Réassemble le texte d'un flux SSE.
 *
 * Le point important : les paquets réseau ne tombent pas sur les frontières des événements. On peut
 * très bien recevoir `data: {"cont` dans un paquet et le reste dans le suivant. D'où le tampon, qui
 * garde le morceau incomplet jusqu'à ce que la suite arrive. */
async function lireFluxSse(corps: ReadableStream<Uint8Array>): Promise<string> {
	const lecteur = corps.getReader();
	// Même problème un cran plus bas : un caractère accentué fait deux octets en UTF-8 et peut être
	// coupé en deux entre deux paquets. `stream: true` met l'octet orphelin en réserve.
	const decodeur = new TextDecoder();

	let tampon = '';
	let contenu = '';

	while (true) {
		const { done, value } = await lecteur.read();
		if (done) break;

		tampon += decodeur.decode(value, { stream: true });

		// Une ligne vide sépare deux événements SSE. Après le split, le dernier morceau est presque
		// toujours incomplet, donc on le remet dans le tampon au lieu de le traiter.
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

/** Traduit un code d'erreur de la passerelle en message que l'utilisateur peut agir dessus. On
 * recopie le `request_id` tel quel : c'est ce qui permet de retrouver la trace dans les logs du
 * Mac. */
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

/** Isole l'événement contenu dans un bloc SSE. Renvoie `null` pour tout ce qui ne porte pas de
 * donnée : les heartbeats, le marqueur de fin, et les blocs illisibles. Pour ces derniers, mieux
 * vaut ignorer et continuer que de faire échouer une génération déjà à moitié reçue. */
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

/** La passerelle n'expose pas le mode JSON natif d'Ollama, donc on n'a aucune garantie sur la forme
 * de la réponse. Le modèle entoure souvent son objet d'un bloc de code Markdown ou d'une phrase du
 * genre « Voici le JSON demandé ». On repère donc la première accolade ouvrante et la dernière
 * fermante, et on ne parse que ce qu'il y a entre les deux. */
export function extraireJson(brut: string): unknown {
	const sansBlocs = brut.replace(/```(?:json)?/gi, '').trim();
	const debut = sansBlocs.indexOf('{');
	const fin = sansBlocs.lastIndexOf('}');
	const candidat = debut >= 0 && fin > debut ? sansBlocs.slice(debut, fin + 1) : sansBlocs;
	return JSON.parse(candidat);
}
