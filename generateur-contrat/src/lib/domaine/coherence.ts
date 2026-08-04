/** Les incohérences qu'on peut détecter sans l'IA, juste en comparant des chaînes de caractères.
 *
 * Complément de `validation.ts` : là-bas ce sont les erreurs qui empêchent de générer le document,
 * ici ce sont des avertissements. Rien ne bloque.
 *
 * Pourquoi je ne laisse pas l'IA faire ce travail : je lui ai fait relire un mandat où « Migration
 * des données » était promis dans une phase et exclu dans une autre, et elle ne le voyait pas à tous
 * les coups. La comparaison de chaînes le trouve à chaque fois, tout de suite, et sans réseau. Je
 * garde l'IA pour ce qui demande du jugement.
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

/** Les avertissements, dans l'ordre d'importance : les contradictions d'abord, les oublis ensuite.
 *
 * `libelle` est passé par l'appelant (« Phase », « Bloc », « Service ») au lieu d'être calculé ici.
 * `libelleLigne` vit dans la couche document, et je ne veux pas que le domaine en dépende. */
export function verifierCoherence(
	brouillon: BrouillonMandat,
	libelle = 'Ligne'
): AvertissementCoherence[] {
	const avertissements: AvertissementCoherence[] = [];
	const rang = (i: number) => `${libelle.toLowerCase()} ${i + 1}`;

	// Deux index : pour chaque élément, les numéros de lignes où il est inclus, et ceux où il est
	// exclu. La clé est la forme normalisée, sinon « Migration des données » et « migration des
	// donnees » compteraient pour deux choses différentes.
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

	// Le cas qui coûte le plus cher en cas de chicane : la même chose promise à un endroit du
	// mandat et exclue à un autre.
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

	// Deux lignes qui portent le même nom donnent deux articles qu'on ne peut plus distinguer.
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
