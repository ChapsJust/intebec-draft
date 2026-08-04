import { chromium, type Browser } from 'playwright';
import { env } from '$env/dynamic/private';

/** Chromium met une à deux secondes à démarrer, ce qui est beaucoup pour un clic sur « Télécharger ».
 * On garde donc une instance vivante entre les requêtes et on ouvre seulement un nouvel onglet à
 * chaque génération.
 *
 * Deux requêtes en même temps partagent le navigateur mais ont chacune leur onglet, qui est fermé
 * dans le `finally` de `genererPdf`. Si le processus est mort entre-temps, `isConnected()` est faux
 * et on en relance un. */
let navigateur: Browser | null = null;

async function obtenirNavigateur(): Promise<Browser> {
	if (navigateur?.isConnected()) return navigateur;

	// `CHROMIUM_PATH` n'est remplie qu'en conteneur, ce qui en fait aussi une façon de savoir où on
	// tourne sans ajouter une deuxième variable.
	const enConteneur = Boolean(env.CHROMIUM_PATH);

	navigateur = await chromium.launch({
		// En conteneur Alpine, Chromium vient du gestionnaire de paquets et pas de Playwright : les
		// binaires que Playwright télécharge sont liés à la glibc et refusent de démarrer sur musl.
		executablePath: env.CHROMIUM_PATH || undefined,
		// Compromis assumé. Le bac à sable réclame des capacités que le conteneur ne donne pas, et
		// `/dev/shm` y est trop petit pour les documents longs. Hors conteneur je le laisse actif :
		// c'est lui qui contiendrait Chromium si la page imprimée déclenchait une faille du moteur
		// de rendu. Le risque reste faible ici, le HTML imprimé est le nôtre, pas celui d'un tiers.
		args: enConteneur ? ['--no-sandbox', '--disable-dev-shm-usage'] : []
	});
	return navigateur;
}

const gabaritVide = '<span></span>';

/** Pied de page dessiné par Chromium dans la marge, en dehors du flux du document.
 *
 * C'est la seule façon d'obtenir « Page X sur Y ». Le nombre total de pages n'est exposé nulle part
 * au CSS : un pied de page écrit en HTML ne peut donc pas le connaître. Les classes `pageNumber` et
 * `totalPages` ci-dessous sont spéciales, Chromium les remplit lui-même à l'impression. */
function gabaritPied(mention: string): string {
	return `
		<div style="
			width: 100%;
			margin: 0 18mm;
			padding-top: 4mm;
			border-top: 0.5px solid #d8dfe8;
			font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
			font-size: 7pt;
			letter-spacing: 0.04em;
			color: #5a6a80;
			display: flex;
			justify-content: space-between;
		">
			<span>${mention}</span>
			<span>Page <span class="pageNumber"></span> sur <span class="totalPages"></span></span>
		</div>`;
}

export interface OptionsPdf {
	/** URL interne de la page d'aperçu à imprimer. */
	url: string;
	/** Mention portée à gauche du pied de page. */
	mention: string;
}

export async function genererPdf({ url, mention }: OptionsPdf): Promise<Uint8Array> {
	const page = await (await obtenirNavigateur()).newPage();
	try {
		await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });

		return await page.pdf({
			format: 'Letter',
			printBackground: true,
			displayHeaderFooter: true,
			headerTemplate: gabaritVide,
			footerTemplate: gabaritPied(mention),
			// La marge du bas doit être plus haute que le pied de page, sinon Chromium l'écrit
			// par-dessus le texte du document.
			margin: { top: '18mm', bottom: '24mm', left: '18mm', right: '18mm' }
		});
	} finally {
		await page.close();
	}
}

/** L'adresse que Chromium visite pour imprimer. Elle devient obligatoire dès qu'il y a un proxy
 * devant l'application, et c'est le piège le moins évident du fichier.
 *
 * Sans `PDF_ORIGIN`, on utilise l'origine de la requête entrante, donc le nom public `.ts.net`.
 * Sauf que Chromium tourne à l'intérieur du conteneur : il devrait résoudre ce nom, sortir du
 * conteneur, traverser le proxy, et revenir au même conteneur. Souvent ça ne résout même pas. */
export function origineInterne(fallback: string): string {
	return env.PDF_ORIGIN || fallback;
}

/** Nom de fichier sûr : sans accents, sans ponctuation, en minuscules. La date passe par le même
 * nettoyage que le titre, même si elle a l'air inoffensive : elle vient de la saisie, et un
 * guillemet dedans casserait l'en-tête `Content-Disposition` où ce nom est inséré. */
export function nomFichier(type: string, titre: string, date: string): string {
	const nettoyer = (valeur: string) =>
		valeur
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-zA-Z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.toLowerCase();

	const base = nettoyer(`${type}-${titre}`) || 'document';
	const suffixe = nettoyer(date);
	return suffixe ? `${base}-${suffixe}.pdf` : `${base}.pdf`;
}
