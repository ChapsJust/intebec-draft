/** Actions qui écrivent un mandat : enregistrement, génération, cycle de vie.
 *
 * `actionsMandat` est le socle commun de /nouveau et /mandats/[id] — le seul point de bascule entre
 * créer et éditer est `params.id`, absent sur la première et présent sur la seconde. Les actions
 * unitaires en dessous sont étalées à la carte par les pages qui en ont besoin.
 */
import { fail, redirect, type Action, type Actions } from '@sveltejs/kit';
import { creerClient } from '$serveur/db/clients';
import {
	archiverMandat,
	supprimerMandat,
	obtenirMandat,
	enregistrerMandat,
	enregistrerRedaction,
	changerStatutMandat,
	desarchiverMandat
} from '$serveur/db/mandats';
import { verifierMandat } from '$domaine/validation';
import { empreinteProse } from '$document/empreinte';
import { dupliquerMandat } from '$domaine/fabriques';
import { SoumissionInvalideError, lireSoumissionMandat } from '$serveur/mandat/formulaire';
import { idPoste } from '$serveur/formulaire';
import type { StatutDocument, BrouillonMandat, MandatEnregistre } from '$domaine/types';
import { ID_MANQUANT, INTROUVABLE, MANDAT_INTROUVABLE } from './messages';

/** Statuts qu'une requête a le droit de poser. `brouillon` n'y figure pas : on ne revient pas en
 * arrière sur un document déjà sorti. */
const STATUTS_POSABLES: StatutDocument[] = ['genere', 'envoye'];

async function persist(
	brouillon: BrouillonMandat,
	clientId: string | null,
	enregistrerNouveauClient: boolean,
	statut: StatutDocument,
	mandatId: string | undefined
): Promise<MandatEnregistre | null> {
	let finalClientId = clientId;
	if (enregistrerNouveauClient && !clientId) {
		const created = await creerClient(brouillon.client);
		finalClientId = created.id;
	}
	return enregistrerMandat(brouillon, { id: mandatId, clientId: finalClientId, statut });
}

/** Actions de sauvegarde partagées entre /nouveau (création) et /mandats/[id] (édition). */
export const actionsMandat: Actions = {
	enregistrer: async ({ request, params }) => {
		let soumission;
		try {
			soumission = await lireSoumissionMandat(request);
		} catch (err) {
			if (err instanceof SoumissionInvalideError) return fail(400, { message: err.message });
			throw err;
		}

		const { brouillon, clientId, enregistrerNouveauClient } = soumission;
		const record = await persist(
			brouillon,
			clientId,
			enregistrerNouveauClient,
			'brouillon',
			params.id
		);
		if (!record) return fail(404, { message: INTROUVABLE });
		throw redirect(303, `/mandats/${record.id}?saved=1`);
	},

	generer: async ({ request, params }) => {
		let soumission;
		try {
			soumission = await lireSoumissionMandat(request);
		} catch (err) {
			if (err instanceof SoumissionInvalideError) return fail(400, { message: err.message });
			throw err;
		}

		const { brouillon, clientId, enregistrerNouveauClient } = soumission;
		const erreurs = verifierMandat(brouillon);
		if (erreurs.length > 0) {
			return fail(400, {
				message: 'Le document contient des erreurs à corriger avant de pouvoir être généré.'
			});
		}

		const record = await persist(
			brouillon,
			clientId,
			enregistrerNouveauClient,
			'genere',
			params.id
		);
		if (!record) return fail(404, { message: INTROUVABLE });

		// « Générer » veut dire « produis le document à partir de ma saisie actuelle ». Une rédaction
		// dérivée d'une version antérieure est donc à jeter : sans cela, on modifiait le mandat, on
		// relançait « Générer », et l'aperçu affichait imperturbablement la prose d'avant, puisque
		// `redactionAFaire` se tait dès qu'une rédaction existe. La modification semblait perdue.
		//
		// On ne conserve la rédaction que si l'on peut **prouver** qu'elle correspond encore à la
		// saisie. Une rédaction sans empreinte est antérieure à ce mécanisme : sa fraîcheur est
		// indémontrable, et sur une demande explicite de génération, mieux vaut la refaire que
		// réafficher une prose peut-être périmée. La bannière de l'aperçu, elle, se tait dans ce cas :
		// alarmer sur tous les documents déjà générés n'aiderait personne.
		//
		// Régénérer un mandat inchangé conserve donc la rédaction et les passages déjà arbitrés, au
		// lieu de les redemander à l'IA. Pour seulement relire le document, il y a « Voir le document ».
		const redactionAJour = record.redaction?.empreinte === empreinteProse(record.brouillon);
		if (record.redaction && !redactionAJour) {
			await enregistrerRedaction(record.id, null);
		}

		// La passe de rédaction n'est plus faite ici. Elle prend jusqu'à quatre minutes quand le
		// modèle doit être rechargé, et l'enregistrement se retrouvait suspendu à sa durée : un
		// proxy ou le navigateur abandonnait avant la fin, l'utilisateur voyait une erreur réseau
		// alors que le mandat, lui, était bien enregistré. L'aperçu la déclenche maintenant dans sa
		// propre requête, avec un état visible et une annulation possible.
		throw redirect(303, `/mandats/${record.id}/apercu?rediger=1`);
	}
};

/** Marque un document comme envoyé, ou le ramène à « généré ». Le statut est purement déclaratif :
 * l'application n'envoie rien elle-même, elle enregistre que vous l'avez fait. */
export const changerStatutAction: Action = async ({ request, params }) => {
	const data = await request.formData();
	const statut = data.get('statut');
	const id = params.id;

	if (!id) return fail(400, { ok: false, message: ID_MANQUANT });
	if (typeof statut !== 'string' || !STATUTS_POSABLES.includes(statut as StatutDocument)) {
		return fail(400, { ok: false, message: 'Statut inconnu.' });
	}

	if (!(await changerStatutMandat(id, statut as StatutDocument))) {
		return fail(404, { ok: false, message: INTROUVABLE });
	}
	return {
		ok: true,
		message: statut === 'envoye' ? 'Document marqué comme envoyé.' : 'Document remis en « généré ».'
	};
};

/** Duplique un mandat existant vers un nouveau brouillon : le raccourci le plus rapide pour un
 * client récurrent. */
export const dupliquerMandatAction: Action = async ({ request }) => {
	const id = await idPoste(request);
	if (!id) return fail(400, { message: ID_MANQUANT });

	const existing = await obtenirMandat(id);
	if (!existing) return fail(404, { message: MANDAT_INTROUVABLE });

	const brouillon = dupliquerMandat(existing.brouillon);
	const record = await enregistrerMandat(brouillon, {
		clientId: existing.clientId,
		statut: 'brouillon'
	});
	if (!record) return fail(500, { message: 'La copie du mandat a échoué.' });
	throw redirect(303, `/mandats/${record.id}`);
};

export const archiverMandatAction: Action = async ({ request }) => {
	const id = await idPoste(request);
	if (!id) return fail(400, { notice: ID_MANQUANT });
	if (!(await archiverMandat(id))) {
		return fail(404, { notice: 'Ce mandat est introuvable, ou déjà archivé.' });
	}
	return { notice: 'Mandat archivé.' };
};

export const desarchiverMandatAction: Action = async ({ request }) => {
	const id = await idPoste(request);
	if (!id) return fail(400, { notice: ID_MANQUANT });
	if (!(await desarchiverMandat(id))) return fail(404, { notice: MANDAT_INTROUVABLE });
	return { notice: 'Mandat désarchivé.' };
};

/** Suppression définitive d'un mandat. Si c'est celui qu'on est en train d'éditer, la page n'existe
 * plus après coup : on renvoie à l'accueil plutôt que de laisser un 404. */
export const supprimerMandatAction: Action = async ({ request, params }) => {
	const id = await idPoste(request);
	if (!id) return fail(400, { notice: ID_MANQUANT });
	if (!(await supprimerMandat(id))) return fail(404, { notice: MANDAT_INTROUVABLE });
	if (params.id === id) throw redirect(303, '/');
	return { notice: 'Mandat supprimé.' };
};
