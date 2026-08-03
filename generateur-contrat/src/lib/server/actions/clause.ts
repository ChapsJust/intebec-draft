/** Actions sur la bibliothèque de clauses.
 *
 * La bibliothèque est le stock réutilisable ; ce qu'un mandat retient en est une copie figée. Modifier
 * une clause ici ne touche donc aucun contrat déjà rédigé, et c'est voulu.
 */
import { fail, type Actions } from '@sveltejs/kit';
import {
	creerClauseBibliotheque,
	modifierClauseBibliotheque,
	archiverClauseBibliotheque,
	desarchiverClauseBibliotheque
} from '$serveur/db/clauses';
import { idPoste } from '$serveur/formulaire';
import { ID_MANQUANT, REQUETE_INVALIDE } from './messages';

/** Même plafond que sur le brouillon : le titre d'une clause devient un titre d'article. */
const MAX_TITRE = 200;

const CLAUSE_INTROUVABLE = "Cette clause n'existe plus.";

/** Titre et corps postés, ou `null` si l'un des deux manque. Une clause sans corps ne produirait
 * aucun article. */
function champsPostes(data: FormData): { titre: string; corps: string } | null {
	const titre = data.get('titre');
	const corps = data.get('corps');
	if (typeof titre !== 'string' || typeof corps !== 'string') return null;
	if (!titre.trim() || !corps.trim()) return null;
	return { titre: titre.trim().slice(0, MAX_TITRE), corps: corps.trim() };
}

export const actionsClause: Actions = {
	/** Ajout à la main, par opposition aux clauses que la relecture fait entrer avec `origine: 'ia'`. */
	creer: async ({ request }) => {
		const champs = champsPostes(await request.formData());
		if (!champs) {
			return fail(400, { notice: 'Une clause a besoin d’un titre et d’un texte.' });
		}
		await creerClauseBibliotheque({ ...champs, origine: 'manuelle' });
		return { notice: 'Clause ajoutée à la bibliothèque.' };
	},

	/** Corrige le texte d'une clause. Les mandats qui l'ont déjà retenue gardent leur copie. */
	modifier: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id');
		if (typeof id !== 'string' || !id) return fail(400, { notice: ID_MANQUANT });

		const champs = champsPostes(data);
		if (!champs) return fail(400, { notice: REQUETE_INVALIDE });

		if (!(await modifierClauseBibliotheque(id, champs))) {
			return fail(404, { notice: CLAUSE_INTROUVABLE });
		}
		return { notice: 'Clause enregistrée.' };
	},

	/** Sort la clause des listes sans la détruire : la relecture cesse de la proposer. */
	archiver: async ({ request }) => {
		const id = await idPoste(request);
		if (!id) return fail(400, { notice: ID_MANQUANT });
		if (!(await archiverClauseBibliotheque(id))) {
			return fail(404, { notice: 'Cette clause est introuvable, ou déjà archivée.' });
		}
		return { notice: 'Clause archivée.' };
	},

	desarchiver: async ({ request }) => {
		const id = await idPoste(request);
		if (!id) return fail(400, { notice: ID_MANQUANT });
		if (!(await desarchiverClauseBibliotheque(id))) {
			return fail(404, { notice: CLAUSE_INTROUVABLE });
		}
		return { notice: 'Clause désarchivée.' };
	}
};
