import { chromium, type Browser } from 'playwright';
import { env } from '$env/dynamic/private';

/** Chromium met une à deux secondes à démarrer. On garde une instance vivante entre les requêtes
 * et on n'ouvre qu'un onglet par génération, ce qui ramène le coût à quelques centaines de ms. */
let navigateur: Browser | null = null;

async function obtenirNavigateur(): Promise<Browser> {
	if (navigateur?.isConnected()) return navigateur;
	navigateur = await chromium.launch({
		// En conteneur Alpine, Chromium vient du gestionnaire de paquets : les binaires téléchargés
		// par Playwright sont liés à la glibc et ne démarrent pas sur musl. Hors conteneur, la
		// variable est absente et Playwright utilise son propre navigateur.
		executablePath: env.CHROMIUM_PATH || undefined,
		args: ['--no-sandbox', '--disable-dev-shm-usage']
	});
	return navigateur;
}

const gabaritVide = '<span></span>';

/** Pied de page rendu par Chromium dans la marge de la page, hors du flux du document.
 * C'est la seule façon fiable d'obtenir « Page X sur Y » : le nombre total de pages n'est pas
 * exposé au CSS des navigateurs, un pied en HTML ne pourrait donc jamais l'afficher. */
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
	/** Cookies de la requête entrante, à retransmettre si la page devient protégée. */
	cookie?: string;
}

export async function genererPdf({ url, mention, cookie }: OptionsPdf): Promise<Uint8Array> {
	const page = await (await obtenirNavigateur()).newPage();
	try {
		if (cookie) await page.setExtraHTTPHeaders({ cookie });
		await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });

		return await page.pdf({
			format: 'Letter',
			printBackground: true,
			displayHeaderFooter: true,
			headerTemplate: gabaritVide,
			footerTemplate: gabaritPied(mention),
			// La marge basse doit dépasser la hauteur du pied, sinon Chromium le superpose au texte.
			margin: { top: '18mm', bottom: '24mm', left: '18mm', right: '18mm' }
		});
	} finally {
		await page.close();
	}
}

/** Origine à utiliser pour la navigation interne de Chromium. En conteneur, `localhost` désigne
 * le conteneur lui-même, ce qui est correct ici puisque l'app et Chromium y cohabitent. */
export function origineInterne(fallback: string): string {
	return env.PDF_ORIGIN || fallback;
}
