// Nom d'affichage de l'application.
// Placeholder pour le projet école.
export const APP_NAME = 'DocGen';

// Baseline affichée sous le nom / dans le hero.
export const APP_TAGLINE = 'Soumissions et contrats générés par IA locale';

/** Coordonnées du prestataire, reprises telles quelles en en-tête et dans le bloc « Parties »
 * du document généré. Le représentant signataire, lui, reste saisi par mandat (Signature).
 *
 */
export const PRESTATAIRE = {
	nom: 'Intébec Inc.',
	adresse: 'Victoriaville (Québec), Canada',
	courriel: 'info@intebec.ca',
	telephone: '(819) 960-9831',
	siteWeb: 'intebec.ca',
	numeroEntreprise: '1181530875'
} as const;

/** Ce qui manque encore à l'identité du prestataire avant un envoi réel. Liste vide = tout est
 * renseigné, et le rappel disparaît de lui-même. */
export function identiteIncomplete(): string[] {
	const manques: string[] = [];
	if (!PRESTATAIRE.numeroEntreprise) manques.push("le numéro d'entreprise (NEQ)");
	if (!PRESTATAIRE.telephone) manques.push('le téléphone');
	return manques;
}
