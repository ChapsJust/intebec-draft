/** Assemble le modèle de vue d'un document. C'est le seul endroit qui décide de ce qui figure au
 * contrat et dans quel ordre : si une section manque ou tombe au mauvais endroit, c'est ici.
 *
 * Les types du résultat sont dans `modele.ts`, et `empreinte.ts` s'occupe de savoir si la prose de
 * l'IA est encore à jour.
 */
import type { BrouillonMandat, RedactionIA, LigneService } from '$domaine/types';
import { totalLigne, sousTotal, montantRabais, totalNet, formatCad } from '$domaine/montants';
import { PRESTATAIRE } from '$domaine/config';
import { clausesActives } from './clauses';
import { texteEffectif } from './diff';
import {
	designationClient,
	formatDateLongue,
	libelleLigne,
	nettoyerListe,
	nombreContractuel
} from './format';
import type {
	BlocSignature,
	ContenuSection,
	Densite,
	LigneHonoraires,
	ModeleDocument,
	Partie,
	PorteeEntree,
	SectionDocument,
	Versement
} from './modele';

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
		description: texteEffectif(
			ligne.description,
			redaction?.lignes[ligne.id],
			refusesDuChamp(redaction, ligne.id)
		),
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

	// Un seul versement quand l'acompte est à zéro ou couvre déjà tout. Écrire « Solde (100 %) »
	// laisserait entendre qu'un acompte est venu avant, ce qui serait faux.
	// (Note : l'espace avant le % est une espace insécable, c'est la règle en typographie française.)
	if (acomptePct <= 0) {
		versements.push({
			libelle: `Paiement intégral (100 %)`,
			echeance: echeanceSolde(delaiJoursSolde),
			montant: formatCad(total)
		});
	} else if (acomptePct >= 100) {
		versements.push({
			libelle: `Paiement intégral (100 %)`,
			echeance: 'À la signature du présent document',
			montant: formatCad(total)
		});
	} else {
		versements.push({
			libelle: `Acompte (${acomptePct} %)`,
			echeance: 'À la signature du présent document',
			montant: formatCad(total * (acomptePct / 100))
		});
		versements.push({
			libelle: `Solde (${soldePct} %)`,
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

/** La phrase d'introduction, écrite par le gabarit et non par l'IA. Elle est exportée parce que le
 * panneau de revue en a besoin : c'est le côté « avant » du diff, celui auquel on compare ce que le
 * modèle a écrit. */
export function preambuleParDefaut(brouillon: BrouillonMandat): string {
	const designation = designationClient(brouillon.client.typeClient);
	const nomClient = brouillon.client.nom.trim() || 'le Client';
	return brouillon.type === 'contrat'
		? `Le présent contrat établit les modalités selon lesquelles ${PRESTATAIRE.nom} réalise, pour ${designation} ${nomClient}, le mandat décrit aux présentes.`
		: `La présente soumission présente à ${designation} ${nomClient} la portée, les honoraires et les conditions proposés par ${PRESTATAIRE.nom} pour la réalisation du mandat décrit aux présentes.`;
}

/** Les passages refusés pour un champ donné. On tolère l'absence de `refuses` : les rédactions
 * faites avant que j'ajoute la revue passage par passage n'ont pas ce champ. */
function refusesDuChamp(redaction: RedactionIA | null | undefined, champ: string): number[] {
	return redaction?.refuses?.[champ] ?? [];
}

function construirePreambule(brouillon: BrouillonMandat, redaction?: RedactionIA | null): string[] {
	const textes: string[] = [];

	const preambule = texteEffectif(
		preambuleParDefaut(brouillon),
		redaction?.preambule,
		refusesDuChamp(redaction, 'preambule')
	);
	if (preambule) textes.push(preambule);

	const objet = texteEffectif(
		brouillon.objet,
		redaction?.objet,
		refusesDuChamp(redaction, 'objet')
	);
	if (objet) textes.push(objet);

	return textes;
}

/** Estime grossièrement la place qu'une section va prendre. Ce n'est pas une mesure, juste un
 * comptage de caractères pondéré. Les tableaux comptent plus que leur texte seul, parce que chaque
 * rangée occupe une ligne complète peu importe ce qu'elle contient. */
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

/** Choisit l'espacement selon le volume du document. Avec une valeur fixe, on ne peut pas gagner :
 * un espacement qui rend bien sur un contrat de dix pages laisse une soumission d'une page à moitié
 * vide, et l'inverse est aussi vrai.
 *
 * Les deux seuils ci-dessous ont été trouvés à l'essai, en regardant l'aperçu. Ils correspondent
 * grossièrement à une page et à trois pages. Il n'y a rien de scientifique là-dedans : si un
 * document rend mal, c'est ici qu'on ajuste. */
export function calculerDensite(sections: SectionDocument[]): Densite {
	const poids = sections.reduce((n, s) => n + poidsSection(s), 0);
	if (poids < 2200) return 'aere';
	if (poids < 6500) return 'normal';
	return 'compact';
}

/** Transforme un mandat en modèle prêt à afficher. Fonction pure, donc facile à tester.
 *
 * Règle que je me suis fixée : aucun montant n'est recalculé ici. Tout passe par `montants.ts`,
 * exactement comme l'éditeur, sinon on finirait par afficher un total à l'écran et un autre au
 * contrat. */
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

	// Chaque clause devient un article de premier niveau, numéroté comme les autres sections, au
	// lieu d'être une sous-section d'un gros bloc « Conditions générales ». Quand je les regroupais,
	// les dix clauses formaient trois pages d'affilée sans aucun repère de lecture. À plat, chacune
	// a son numéro et son filet. C'est aussi la structure des contrats Intébec existants.
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
