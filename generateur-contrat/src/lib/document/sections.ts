import type { BrouillonMandat, RedactionIA, LigneService } from '$lib/types';
import { totalLigne, sousTotal, montantRabais, totalNet, formatCad } from '$lib/montants';
import { PRESTATAIRE } from '$lib/config';
import type { BlocArticle } from './clauses';
import { clausesActives } from './clauses';
import {
	designationClient,
	formatDateLongue,
	libelleLigne,
	nettoyerListe,
	nombreContractuel
} from './format';

export interface Partie {
	/** « ENTRE » / « ET » : la charnière du préambule d'identification. */
	connecteur: string;
	role: string;
	nom: string;
	lignes: string[];
	representant: string;
	/** Désignation abrégée employée dans tout le reste du contrat. La mention « (ci-après … ) »
	 * n'est pas décorative : c'est elle qui définit le terme, sans quoi les articles renvoient
	 * à une désignation qui n'a jamais été établie. */
	designation: string;
}

export interface PorteeEntree {
	/** « Phase 1 », affiché en exergue et séparé du nom pour permettre une hiérarchie visuelle. */
	label: string;
	nom: string;
	description: string;
	inclus: string[];
	nonInclus: string[];
	delai: string;
	montant: string;
	tarification: string[];
}

export interface LigneHonoraires {
	label: string;
	nom: string;
	/** Une entrée par élément facturé : le tableau les empile au lieu de les concaténer. */
	details: string[];
	delai: string;
	montant: string;
}

export interface Versement {
	libelle: string;
	echeance: string;
	montant: string;
}

export interface BlocSignature {
	role: string;
	organisation: string;
	nom: string;
	titre: string;
}

/** Chaque section rend un type de contenu différent : l'union discriminée évite au composant de
 * rendu de deviner ce qu'il manipule, et garde toute la logique métier ici. */
export type ContenuSection =
	| { kind: 'paragraphes'; textes: string[] }
	| { kind: 'portee'; entrees: PorteeEntree[] }
	| {
			kind: 'honoraires';
			lignes: LigneHonoraires[];
			sousTotal: string;
			rabais: { pct: number; motif: string; montant: string } | null;
			total: string;
	  }
	| { kind: 'echeancier'; versements: Versement[]; notes: string[] }
	| { kind: 'blocs'; blocs: BlocArticle[] };

export interface SectionDocument {
	numero: number;
	titre: string;
	contenu: ContenuSection;
}

/** Réglage d'espacement appliqué au document entier.
 * `aere` étire une soumission courte pour qu'elle ne flotte pas en haut d'une page vide ;
 * `compact` resserre un contrat chargé pour éviter les pages qui débordent de trois lignes. */
export type Densite = 'aere' | 'normal' | 'compact';

export interface ModeleDocument {
	typeLabel: string;
	titre: string;
	dateLongue: string;
	lieu: string;
	parties: Partie[];
	sections: SectionDocument[];
	/** Formule liminaire fermant l'identification des parties, avant le premier article. */
	attendu: string;
	signatures: BlocSignature[];
	/** Formule de clôture consacrée, juste avant les blocs de signature. */
	enFoiDeQuoi: string;
	/** Ligne discrète fermant le document. */
	piedDePage: string;
	densite: Densite;
	/** Vrai lorsque la prose affichée provient de l'IA plutôt que de la saisie brute. */
	redigeParIA: boolean;
}

function detailTarification(ligne: LigneService): string[] {
	if (ligne.pricingMode === 'horaire') {
		const heures = ligne.heuresEstimees;
		return [
			`${formatCad(ligne.tauxHoraire)}/heure × ${heures} heure${heures > 1 ? 's' : ''} estimée${heures > 1 ? 's' : ''}`
		];
	}
	if (ligne.pricingMode === 'quantite') {
		return ligne.items
			.filter((item) => item.description.trim() || item.quantite || item.prixUnitaire)
			.map(
				(item) =>
					`${item.description.trim() || 'Élément'} : ${item.quantite} × ${formatCad(item.prixUnitaire)}`
			);
	}
	return ['Forfait'];
}

function construirePortee(
	brouillon: BrouillonMandat,
	redaction?: RedactionIA | null
): PorteeEntree[] {
	const label = libelleLigne(brouillon.structureProjet);
	return brouillon.lignes.map((ligne, i) => ({
		label: `${label} ${i + 1}`,
		nom: ligne.nom.trim() || 'Sans titre',
		description: redaction?.lignes[ligne.id]?.trim() || ligne.description.trim(),
		inclus: nettoyerListe(ligne.inclus),
		nonInclus: nettoyerListe(ligne.nonInclus),
		delai: ligne.delaiEstime.trim(),
		montant: formatCad(totalLigne(ligne)),
		tarification: detailTarification(ligne)
	}));
}

function construireHonoraires(brouillon: BrouillonMandat): ContenuSection {
	const label = libelleLigne(brouillon.structureProjet);
	const st = sousTotal(brouillon.lignes);
	const { rabaisPct, rabaisMotif } = brouillon.conditions;

	return {
		kind: 'honoraires',
		lignes: brouillon.lignes.map((ligne, i) => ({
			label: `${label} ${i + 1}`,
			nom: ligne.nom.trim() || 'Sans titre',
			details: detailTarification(ligne),
			delai: ligne.delaiEstime.trim(),
			montant: formatCad(totalLigne(ligne))
		})),
		sousTotal: formatCad(st),
		rabais:
			rabaisPct > 0
				? {
						pct: rabaisPct,
						motif: rabaisMotif.trim(),
						montant: `− ${formatCad(montantRabais(st, rabaisPct))}`
					}
				: null,
		total: formatCad(totalNet(brouillon.lignes, rabaisPct))
	};
}

/** Échéance du solde, exprimée par rapport à la livraison. */
function echeanceSolde(delaiJoursSolde: number): string {
	return delaiJoursSolde > 0
		? `Net ${nombreContractuel(delaiJoursSolde)} jours suivant la livraison`
		: 'À la livraison';
}

function construireEcheancier(brouillon: BrouillonMandat): ContenuSection {
	const total = totalNet(brouillon.lignes, brouillon.conditions.rabaisPct);
	const { acomptePct, soldePct, delaiJoursSolde } = brouillon.modalitesPaiement;
	const versements: Versement[] = [];

	// Un seul versement quand l’acompte est nul ou couvre tout : parler de « solde » suppose
	// qu’un acompte l’a précédé, et « Solde (100 %) » se lirait comme une erreur de saisie sur
	// un mandat payable en entier à la livraison.
	// Espace insécable avant le %, conformément à la typographie française : le libellé ne doit
	// jamais se couper entre le nombre et son symbole.
	if (acomptePct <= 0) {
		versements.push({
			libelle: `Paiement intégral (100 %)`,
			echeance: echeanceSolde(delaiJoursSolde),
			montant: formatCad(total)
		});
	} else if (acomptePct >= 100) {
		versements.push({
			libelle: `Paiement intégral (100 %)`,
			echeance: 'À la signature du présent document',
			montant: formatCad(total)
		});
	} else {
		versements.push({
			libelle: `Acompte (${acomptePct} %)`,
			echeance: 'À la signature du présent document',
			montant: formatCad(total * (acomptePct / 100))
		});
		versements.push({
			libelle: `Solde (${soldePct} %)`,
			echeance: echeanceSolde(delaiJoursSolde),
			montant: formatCad(total * (soldePct / 100))
		});
	}
	const notes = [
		'Les montants indiqués sont en dollars canadiens et excluent les taxes applicables.'
	];

	if (brouillon.abonnement.actif && brouillon.abonnement.montant > 0) {
		const { frequence, montant, couverture, periodeOfferteMois } = brouillon.abonnement;
		const periodicite = frequence === 'mensuel' ? 'par mois' : 'par année';
		let note = `Un abonnement récurrent de ${formatCad(montant)} ${periodicite} s'applique en sus`;
		note += couverture.trim() ? ` et couvre ${couverture.trim()}.` : '.';
		if (periodeOfferteMois > 0) {
			note += ` Les ${nombreContractuel(periodeOfferteMois)} premiers mois sont offerts sans frais.`;
		}
		notes.push(note);
	}

	return { kind: 'echeancier', versements, notes };
}

function construireParties(brouillon: BrouillonMandat): Partie[] {
	const client = brouillon.client;
	const lignesClient = [
		client.adresse.trim(),
		client.numeroEntreprise.trim() ? `NEQ : ${client.numeroEntreprise.trim()}` : '',
		client.courriel.trim(),
		client.telephone.trim()
	].filter(Boolean);

	const lignesPrestataire = [
		PRESTATAIRE.adresse,
		PRESTATAIRE.numeroEntreprise ? `NEQ : ${PRESTATAIRE.numeroEntreprise}` : '',
		PRESTATAIRE.courriel,
		PRESTATAIRE.telephone,
		PRESTATAIRE.siteWeb
	].filter(Boolean);

	const representantClient = [client.representantNom.trim(), client.representantTitre.trim()]
		.filter(Boolean)
		.join(', ');

	return [
		{
			connecteur: 'Entre',
			role: 'Le Prestataire',
			nom: PRESTATAIRE.nom,
			lignes: lignesPrestataire,
			representant: [
				brouillon.representantIntebecNom.trim(),
				brouillon.representantIntebecTitre.trim()
			]
				.filter(Boolean)
				.join(', '),
			designation: PRESTATAIRE.nom
		},
		{
			connecteur: 'Et',
			role: 'Le Client',
			nom: client.nom.trim() || 'Client à déterminer',
			lignes: lignesClient,
			representant: representantClient,
			designation: 'le Client'
		}
	];
}

function construirePreambule(brouillon: BrouillonMandat, redaction?: RedactionIA | null): string[] {
	const textes: string[] = [];
	const prealable = redaction?.preambule?.trim();
	if (prealable) {
		textes.push(prealable);
	} else {
		const designation = designationClient(brouillon.client.typeClient);
		const nomClient = brouillon.client.nom.trim() || 'le Client';
		textes.push(
			brouillon.type === 'contrat'
				? `Le présent contrat établit les modalités selon lesquelles ${PRESTATAIRE.nom} réalise, pour ${designation} ${nomClient}, le mandat décrit aux présentes.`
				: `La présente soumission présente à ${designation} ${nomClient} la portée, les honoraires et les conditions proposés par ${PRESTATAIRE.nom} pour la réalisation du mandat décrit aux présentes.`
		);
	}

	const objet = redaction?.objet?.trim() || brouillon.objet.trim();
	if (objet) textes.push(objet);

	return textes;
}

/** Compte les caractères de prose et les blocs d'une section, pour estimer la place qu'elle
 * occupera. Les tableaux pèsent plus que leur texte : chaque rangée est une ligne à part. */
function poidsSection(section: SectionDocument): number {
	const c = section.contenu;
	switch (c.kind) {
		case 'paragraphes':
			return c.textes.join(' ').length;
		case 'portee':
			return c.entrees.reduce(
				(n, e) =>
					n +
					e.nom.length +
					e.description.length +
					e.delai.length +
					(e.inclus.length + e.nonInclus.length) * 60,
				0
			);
		case 'honoraires':
			return c.lignes.reduce((n, l) => n + l.nom.length + l.details.join(' ').length + 90, 0);
		case 'echeancier':
			return c.versements.length * 90 + c.notes.join(' ').length;
		case 'blocs':
			return c.blocs.reduce(
				(n, b) => n + (b.kind === 'p' ? b.texte.length : b.intro.length + b.items.length * 70),
				40
			);
	}
}

/** Choisit l'espacement en fonction du volume réel du document, plutôt que d'imposer une valeur
 * fixe qui convient à un contrat de dix pages mais laisse une soumission d'une page à moitié
 * vide. Les seuils correspondent grossièrement à une et à trois pages de texte. */
export function calculerDensite(sections: SectionDocument[]): Densite {
	const poids = sections.reduce((n, s) => n + poidsSection(s), 0);
	if (poids < 2200) return 'aere';
	if (poids < 6500) return 'normal';
	return 'compact';
}

/** Transforme un mandat en modèle de document prêt à rendre.
 * Fonction pure : aucune valeur monétaire n'est recalculée ici, tout passe par `montants.ts`,
 * seule source de vérité des montants (la même que celle affichée dans l'éditeur). */
export function construireDocument(
	brouillon: BrouillonMandat,
	redaction?: RedactionIA | null
): ModeleDocument {
	const contrat = brouillon.type === 'contrat';
	const sections: SectionDocument[] = [];
	const pousser = (titre: string, contenu: ContenuSection) =>
		sections.push({ numero: sections.length + 1, titre, contenu });

	pousser('Objet du mandat', {
		kind: 'paragraphes',
		textes: construirePreambule(brouillon, redaction)
	});

	pousser('Portée des travaux', {
		kind: 'portee',
		entrees: construirePortee(brouillon, redaction)
	});
	pousser('Honoraires', construireHonoraires(brouillon));
	pousser('Modalités de paiement', construireEcheancier(brouillon));

	// Chaque clause est un article de premier niveau, numéroté comme les autres sections, plutôt
	// qu'une sous-section d'un bloc « Conditions générales ». Regroupées, les dix clauses
	// formaient trois pages d'un seul tenant sans repère de lecture ; à plat, chacune reçoit son
	// numéro et son filet, ce qui est aussi la structure des contrats Intébec existants.
	for (const article of clausesActives(brouillon)) {
		pousser(article.titre, { kind: 'blocs', blocs: article.corps });
	}

	const notes = brouillon.conditions.notesAdditionnelles.trim();
	if (notes) {
		pousser('Dispositions particulières', { kind: 'paragraphes', textes: notes.split(/\n{2,}/) });
	}

	if (!contrat) {
		pousser('Validité de la soumission', {
			kind: 'paragraphes',
			textes: [
				`La présente soumission est valide pour une période de ${nombreContractuel(30)} jours à compter du ${formatDateLongue(brouillon.dateSignature)}. Son acceptation par le Client vaut autorisation d'entreprendre les travaux décrits aux présentes.`
			]
		});
	}

	return {
		typeLabel: contrat ? 'Contrat de services' : 'Soumission',
		titre: brouillon.titre.trim() || 'Sans titre',
		dateLongue: formatDateLongue(brouillon.dateSignature),
		lieu: brouillon.lieuSignature.trim(),
		parties: construireParties(brouillon),
		attendu: contrat
			? 'Lesquelles parties conviennent de ce qui suit :'
			: 'À laquelle partie la présente soumission est adressée aux conditions suivantes :',
		sections,
		enFoiDeQuoi: `En foi de quoi, les parties ont signé à ${brouillon.lieuSignature.trim() || 'Victoriaville'}, le ${formatDateLongue(brouillon.dateSignature)}.`,
		signatures: [
			{
				role: 'Le Prestataire',
				organisation: PRESTATAIRE.nom,
				nom: brouillon.representantIntebecNom.trim(),
				titre: brouillon.representantIntebecTitre.trim()
			},
			{
				role: 'Le Client',
				organisation: brouillon.client.nom.trim(),
				nom: brouillon.client.representantNom.trim(),
				titre: brouillon.client.representantTitre.trim()
			}
		],
		piedDePage: [
			PRESTATAIRE.nom,
			contrat ? 'Contrat de services' : 'Soumission',
			brouillon.titre.trim()
		]
			.filter(Boolean)
			.join(' · '),
		densite: calculerDensite(sections),
		redigeParIA: Boolean(redaction)
	};
}
