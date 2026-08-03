import { chromium, type Browser } from 'playwright';
import { env } from '$env/dynamic/private';

/** Chromium met une à deux secondes à démarrer. On garde une instance vivante entre les requêtes
 * et on n'ouvre qu'un onglet par génération, ce qui ramène le coût à quelques centaines de ms. */
let navigateur: Browser | null = null;

async function obtenirNavigateur(): Promise<Browser> {
	if (navigateur?.isConnected()) return navigateur;

	// `CHROMIUM_PATH` n'est renseignée qu'en conteneur : elle sert donc aussi d'indice de contexte.
	const enConteneur = Boolean(env.CHROMIUM_PATH);

	navigateur = await chromium.launch({
		// En conteneur Alpine, Chromium vient du gestionnaire de paquets : les binaires de Playwright
		// sont liés à la glibc et ne démarrent pas sur musl.
		executablePath: env.CHROMIUM_PATH || undefined,
		// Le bac à sable a besoin de capacités que le conteneur n'accorde pas, et `/dev/shm` y est
		// trop petit pour les documents longs. Ailleurs on le garde actif : c'est lui qui contient
		// Chromium si la page imprimée déclenche une faille du moteur de rendu.
		args: enConteneur ? ['--no-sandbox', '--disable-dev-shm-usage'] : []
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
			// La marge basse doit dépasser la hauteur du pied, sinon Chromium le superpose au texte.
			margin: { top: '18mm', bottom: '24mm', left: '18mm', right: '18mm' }
		});
	} finally {
		await page.close();
	}
}

/** Origine que Chromium visite pour imprimer. `PDF_ORIGIN` cesse d'être facultative dès qu'un proxy
 * est devant l'application : l'origine entrante serait le nom public `.ts.net`, que Chromium devrait
 * résoudre depuis Docker pour ressortir par le proxy et revenir au même conteneur. */
export function origineInterne(fallback: string): string {
	return env.PDF_ORIGIN || fallback;
}

/** Nom de fichier sûr : sans accents, sans ponctuation, en minuscules. La date passe par le même
 * nettoyage que le titre — elle vient de la saisie, et un guillemet y casserait l'en-tête
 * `Content-Disposition` dans lequel ce nom est inséré. */
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
