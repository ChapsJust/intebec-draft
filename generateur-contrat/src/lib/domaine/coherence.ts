/** Les incohérences qu'on peut **prouver**, sans modèle.
 *
 * Complément de `validation.ts`, qui dit ce qui empêche de générer. Ici rien ne bloque : on signale
 * ce qui produira un document bancal sans être faux au sens strict.
 *
 * La raison d'être de ce module tient en une mesure : sur un mandat où « Migration des données »
 * était promis à un endroit et exclu à un autre, la relecture par l'IA repérait la contradiction une
 * fois sur deux. La même comparaison, faite ici sur des chaînes normalisées, la trouve à tous les
 * coups, instantanément et hors ligne. Ce qui se compte se compte ; l'IA garde ce qui demande du
 * jugement.
 */
import type { BrouillonMandat } from './types';
import { titreNormalise } from './titres';
import { totalLigne } from './montants';

export interface AvertissementCoherence {
	/** Où regarder. Même vocabulaire que les alertes de l'IA, pour que les deux s'affichent
	 * ensemble : `general`, `portee`, `paiement`, `conditions`, ou un `LigneService.id`. */
	cible: string;
	message: string;
}

/** Entrées non vides d'une liste de puces. L'éditeur laisse des chaînes vides derrière lui. */
function entrees(valeurs: string[]): string[] {
	return valeurs.map((v) => v.trim()).filter(Boolean);
}

/** Incohérences décelables par comparaison, dans l'ordre où elles comptent : ce qui se contredit
 * d'abord, ce qui manque ensuite.
 *
 * `libelle` vient de l'appelant (« Phase », « Bloc », « Service ») : le domaine ne dépend pas de la
 * couche document, où vit `libelleLigne`. */
export function verifierCoherence(
	brouillon: BrouillonMandat,
	libelle = 'Ligne'
): AvertissementCoherence[] {
	const avertissements: AvertissementCoherence[] = [];
	const rang = (i: number) => `${libelle.toLowerCase()} ${i + 1}`;

	// Où chaque élément apparaît, indexé par sa forme normalisée : « Migration des données » et
	// « migration des donnees » doivent se reconnaître.
	const inclusPar = new Map<string, number[]>();
	const exclusPar = new Map<string, number[]>();
	const libelleDe = new Map<string, string>();

	brouillon.lignes.forEach((ligne, i) => {
		const noter = (registre: Map<string, number[]>, item: string) => {
			const cle = titreNormalise(item);
			if (!cle) return;
			libelleDe.set(cle, item);
			registre.set(cle, [...(registre.get(cle) ?? []), i]);
		};
		for (const item of entrees(ligne.inclus)) noter(inclusPar, item);
		for (const item of entrees(ligne.nonInclus)) noter(exclusPar, item);
	});

	// La contradiction la plus coûteuse : la même chose promise ici, exclue là.
	for (const [cle, lignesInclus] of inclusPar) {
		const lignesExclus = exclusPar.get(cle);
		if (!lignesExclus) continue;

		const item = libelleDe.get(cle);
		const memeLigne = lignesInclus.find((i) => lignesExclus.includes(i));

		if (memeLigne !== undefined) {
			avertissements.push({
				cible: brouillon.lignes[memeLigne].id,
				message: `« ${item} » est à la fois inclus et exclu dans la ${rang(memeLigne)}. Le document affichera les deux.`
			});
		} else {
			avertissements.push({
				cible: brouillon.lignes[lignesInclus[0]].id,
				message: `« ${item} » est inclus dans la ${rang(lignesInclus[0])} et exclu dans la ${rang(lignesExclus[0])}.`
			});
		}
	}

	brouillon.lignes.forEach((ligne, i) => {
		const listes = [
			{ nom: 'inclus', valeurs: ligne.inclus },
			{ nom: 'non inclus', valeurs: ligne.nonInclus }
		];

		for (const { nom, valeurs } of listes) {
			const vus = new Set<string>();
			for (const item of entrees(valeurs)) {
				const cle = titreNormalise(item);
				if (vus.has(cle)) {
					avertissements.push({
						cible: ligne.id,
						message: `« ${item} » est listé deux fois dans les éléments ${nom} de la ${rang(i)}.`
					});
				}
				vus.add(cle);
			}
		}
	});

	// Deux lignes homonymes deviennent deux articles que rien ne distingue à la lecture.
	const nomsVus = new Map<string, number>();
	brouillon.lignes.forEach((ligne, i) => {
		const cle = titreNormalise(ligne.nom);
		if (!cle) return;
		const premier = nomsVus.get(cle);
		if (premier === undefined) {
			nomsVus.set(cle, i);
			return;
		}
		avertissements.push({
			cible: ligne.id,
			message: `La ${rang(i)} porte le même nom que la ${rang(premier)}. Seul le numéro les distinguera au contrat.`
		});
	});

	brouillon.lignes.forEach((ligne, i) => {
		const decrite = ligne.description.trim() || entrees(ligne.inclus).length > 0;
		if (totalLigne(ligne) > 0 && !decrite) {
			avertissements.push({
				cible: ligne.id,
				message: `La ${rang(i)} porte un montant mais ne décrit aucun travail. Le contrat afficherait un prix sans contrepartie.`
			});
		}
	});

	const { abonnement } = brouillon;
	if (abonnement.actif && abonnement.montant > 0 && !abonnement.couverture.trim()) {
		avertissements.push({
			cible: 'paiement',
			message:
				'L’abonnement récurrent n’indique pas ce qu’il couvre. Le document annoncera un montant « en sus » sans dire de quoi.'
		});
	}

	const { rabaisPct, rabaisMotif } = brouillon.conditions;
	if (rabaisPct > 0 && !rabaisMotif.trim()) {
		avertissements.push({
			cible: 'conditions',
			message: `Le rabais de ${rabaisPct} % n’a pas de motif. Il apparaîtra au tableau des honoraires sans justification.`
		});
	}

	return avertissements;
}
