// Nom d'affichage de l'application.
// Placeholder pour le projet école.
export const APP_NAME = 'DocGen';

// Baseline affichée sous le nom / dans le hero.
export const APP_TAGLINE = 'Soumissions et contrats générés par IA locale';

/** Coordonnées du prestataire, reprises telles quelles en en-tête et dans le bloc « Parties »
 * du document généré. Le représentant signataire, lui, reste saisi par mandat (SignatureForm). */
export const PRESTATAIRE = {
	nom: 'Intébec',
	adresse: 'Victoriaville (Québec), Canada',
	courriel: 'info@intebec.com',
	siteWeb: 'intebec.com',
	numeroEntreprise: ''
} as const;
