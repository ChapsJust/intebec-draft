import type { BrouillonMandat } from '$lib/types';
import { totalNet, formatCad } from '$lib/montants';
import { PRESTATAIRE } from '$lib/config';
import { elider, nombreContractuel } from './format';

/** Un article alterne prose et énumérations. Les listes ne sont pas décoratives : sur les clauses
 * qui énumèrent des engagements ou des exclusions, elles rendent chaque item opposable
 * individuellement, et cassent le mur de prose qui rendait les conditions illisibles. */
export type BlocArticle =
	{ kind: 'p'; texte: string } | { kind: 'liste'; intro: string; items: string[] };

export interface Article {
	titre: string;
	corps: BlocArticle[];
}

const p = (texte: string): BlocArticle => ({ kind: 'p', texte });
const liste = (intro: string, items: string[]): BlocArticle => ({ kind: 'liste', intro, items });

/** Les clauses ne sont que des booléens dans `ClausesStandards`, c'est ici qu'elles reçoivent
 * leur corps juridique. Chaque clause consomme les valeurs saisies dans le mandat plutôt que du
 * texte figé, pour que le document reflète réellement les conditions convenues. */

function confidentialite(brouillon: BrouillonMandat): Article {
	const corps: BlocArticle[] = [
		p(
			`Chaque partie s'engage à traiter comme confidentiel tout renseignement, document ou donnée obtenu de l'autre partie dans le cadre du présent mandat, et à ne l'utiliser qu'aux fins de son exécution.`
		),
		p(
			`${PRESTATAIRE.nom} met en œuvre des mesures de sécurité raisonnables pour protéger les renseignements personnels qui lui sont confiés, conformément à la Loi sur la protection des renseignements personnels dans le secteur privé, telle que modifiée par la Loi 25. Les données sont hébergées au Canada.`
		),
		p(
			`Cet engagement demeure en vigueur pendant toute la durée du mandat et pour une période de ${nombreContractuel(3)} ans suivant sa terminaison.`
		)
	];

	if (brouillon.client.typeClient !== 'particulier') {
		corps.push(
			p(
				`Les parties conviennent de se notifier sans délai tout incident de confidentialité susceptible de porter atteinte aux renseignements visés par la présente clause.`
			)
		);
	}

	return { titre: 'Confidentialité et protection des renseignements personnels', corps };
}

function limitationResponsabilite(brouillon: BrouillonMandat): Article {
	const plafond = totalNet(brouillon.lignes, brouillon.conditions.rabaisPct);
	const corps: BlocArticle[] = [
		p(
			`La responsabilité totale ${elider('de', PRESTATAIRE.nom)} découlant du présent mandat, toutes causes confondues, est limitée au montant effectivement versé par le Client en vertu de celui-ci, soit un maximum de ${formatCad(plafond)}.`
		),
		liste(`${PRESTATAIRE.nom} ne peut être tenu responsable :`, [
			`des dommages indirects, notamment la perte de profits ou la perte de revenus`,
			`de la perte de données causée par un tiers ou par un service externe`,
			`des interruptions de service hors de son contrôle`
		]),
		p(
			`Cette exclusion ne s'applique pas en cas de faute lourde ou intentionnelle ${elider('de', PRESTATAIRE.nom)}.`
		),
		p(
			`Le Client demeure responsable de l'exactitude des contenus, accès et informations qu'il fournit, ainsi que du maintien de ses propres copies de sauvegarde.`
		)
	];

	if (brouillon.client.typeClient === 'particulier') {
		corps.push(
			p(
				`La présente clause ne saurait déroger aux droits que la Loi sur la protection du consommateur confère au Client.`
			)
		);
	}

	return { titre: 'Limitation de responsabilité', corps };
}

function propriete(brouillon: BrouillonMandat): Article {
	const corps: BlocArticle[] = [
		p(
			`Les droits de propriété sur les livrables réalisés spécifiquement pour le Client lui sont cédés au moment du paiement intégral des sommes dues en vertu du présent mandat. Le Client demeure en tout temps propriétaire de ses données.`
		),
		p(
			`${PRESTATAIRE.nom} conserve la propriété de ses outils, méthodes, gabarits et composants réutilisables préexistants ou développés de façon générique, et accorde au Client une licence non exclusive, perpétuelle et incessible pour leur utilisation au sein des livrables.`
		),
		p(
			`Les logiciels et services tiers intégrés aux livrables demeurent régis par leurs licences respectives.`
		)
	];

	if (brouillon.client.typeClient !== 'particulier') {
		corps.push(
			p(
				`${PRESTATAIRE.nom} se réserve le droit de mentionner le mandat et d'en présenter des extraits visuels à titre de référence, sauf avis écrit contraire du Client.`
			)
		);
	}

	return { titre: 'Propriété intellectuelle', corps };
}

/** Engagements réciproques. Systématiquement présent : c'est l'article qui rend le mandat
 * exécutoire de part et d'autre, et sa forme énumérée est celle des contrats Intébec existants. */
function engagements(brouillon: BrouillonMandat): Article {
	const engagementsClient = [
		`fournir les informations, contenus et accès nécessaires dans des délais raisonnables`,
		`désigner une personne responsable du projet`,
		`effectuer les paiements selon les modalités prévues aux présentes`
	];

	if (brouillon.conditions.heuresFormationIncluses > 0) {
		engagementsClient.push(`rendre disponibles les personnes visées par la formation incluse`);
	}

	return {
		titre: 'Engagements des parties',
		corps: [
			liste(`${PRESTATAIRE.nom} s'engage à :`, [
				`réaliser les services décrits aux présentes avec professionnalisme`,
				`respecter les délais convenus, sous réserve de la collaboration du Client`,
				`informer le Client sans délai de tout élément susceptible d'affecter la portée ou l'échéancier`
			]),
			liste(`Le Client s'engage à :`, engagementsClient)
		]
	};
}

function litiges(brouillon: BrouillonMandat): Article {
	const lieu = brouillon.lieuSignature.trim() || 'Victoriaville';
	return {
		titre: 'Droit applicable et règlement des différends',
		corps: [
			p(`Le présent document est régi par les lois applicables dans la province de Québec.`),
			p(
				`Les parties conviennent de tenter de régler à l'amiable tout différend relatif à son interprétation ou à son exécution avant d'entreprendre quelque recours que ce soit.`
			),
			p(
				`À défaut d'entente, tout litige sera soumis à la compétence exclusive des tribunaux du district judiciaire d'Arthabaska, à ${lieu}.`
			)
		]
	};
}

function signatureElectronique(): Article {
	return {
		titre: 'Signature électronique',
		corps: [
			p(
				`Les parties conviennent que le présent document peut être signé électroniquement et que les signatures ainsi apposées ont la même valeur juridique que des signatures manuscrites, conformément à la Loi concernant le cadre juridique des technologies de l'information.`
			),
			p(
				`Le document peut être signé en plusieurs exemplaires, chacun étant réputé constituer un original.`
			)
		]
	};
}

/** Les conditions particulières chiffrées deviennent des articles à part entière, mais
 * uniquement lorsqu'une valeur a réellement été saisie : un « 0 » ne produit pas d'article vide. */
function conditionsParticulieres(brouillon: BrouillonMandat): Article[] {
	const { conditions } = brouillon;
	const articles: Article[] = [];

	if (conditions.dureeGarantieJours > 0) {
		articles.push({
			titre: 'Garantie',
			corps: [
				p(
					`${PRESTATAIRE.nom} garantit la conformité des livrables à la portée décrite aux présentes pendant ${nombreContractuel(conditions.dureeGarantieJours)} jours suivant leur livraison.`
				),
				p(
					`Toute anomalie signalée par écrit durant cette période et attribuable aux travaux réalisés est corrigée sans frais additionnels. Les modifications demandées après la livraison qui ne relèvent pas d'une anomalie sont traitées comme des travaux hors périmètre.`
				)
			]
		});
	}

	if (conditions.dureeSupportMois > 0) {
		articles.push({
			titre: 'Support et accompagnement',
			corps: [
				p(
					`Le Client bénéficie d'un support technique pour une durée de ${nombreContractuel(conditions.dureeSupportMois)} mois à compter de la livraison, portant sur l'utilisation courante des livrables.`
				),
				liste(`Le support n'inclut pas :`, [
					`les nouvelles fonctionnalités et les ajouts à la portée initiale`,
					`les modifications esthétiques majeures`,
					`la formation additionnelle au-delà des heures incluses`
				]),
				p(
					`Les demandes de support sont acheminées à ${PRESTATAIRE.courriel} et traitées durant les heures ouvrables.`
				)
			]
		});
	}

	if (conditions.heuresFormationIncluses > 0) {
		articles.push({
			titre: 'Formation',
			corps: [
				p(
					`Le mandat comprend ${nombreContractuel(conditions.heuresFormationIncluses)} heures de formation ou d'accompagnement, offertes à distance ou en personne selon ce que les parties conviendront.`
				)
			]
		});
	}

	if (conditions.tauxHoraireHorsPerimetre > 0) {
		articles.push({
			titre: 'Portée, modifications et travaux hors périmètre',
			corps: [
				p(
					`Les services décrits aux présentes constituent l'intégralité du mandat. Toute demande additionnelle ou modification majeure fait l'objet d'une estimation écrite et peut entraîner des frais et des délais supplémentaires.`
				),
				p(
					`Les travaux hors périmètre requièrent une approbation écrite préalable du Client et sont facturés au taux de ${formatCad(conditions.tauxHoraireHorsPerimetre)} l'heure. Aucun travail hors périmètre n'est entrepris sans cette approbation.`
				)
			]
		});
	}

	if (conditions.preavisResiliationJours > 0) {
		articles.push({
			titre: 'Résiliation',
			corps: [
				p(
					`Chaque partie peut mettre fin au présent mandat en transmettant à l'autre un préavis écrit de ${nombreContractuel(conditions.preavisResiliationJours)} jours.`
				),
				p(
					`En cas de résiliation, le Client acquitte les travaux réalisés et les engagements pris jusqu'à la date de prise d'effet, et ${PRESTATAIRE.nom} lui remet les livrables complétés ainsi que les accès pertinents.`
				)
			]
		});
	}

	return articles;
}

/** Articles du contrat : clauses standards cochées, engagements réciproques, puis conditions
 * particulières chiffrées. L'ordre est stable, il détermine la numérotation dans le document. */
export function clausesActives(brouillon: BrouillonMandat): Article[] {
	const { clauses } = brouillon.conditions;
	const articles: Article[] = [];

	articles.push(engagements(brouillon));
	if (clauses.propriete) articles.push(propriete(brouillon));
	if (clauses.confidentialite) articles.push(confidentialite(brouillon));
	if (clauses.limitationResponsabilite) articles.push(limitationResponsabilite(brouillon));

	articles.push(...conditionsParticulieres(brouillon));

	if (clauses.litiges) articles.push(litiges(brouillon));
	if (clauses.signatureElectronique) articles.push(signatureElectronique());

	return articles;
}
