import { eq, and, isNull, isNotNull, asc } from 'drizzle-orm';
import { db } from './index';
import { clauseBibliotheque } from './schema';
import type { ClauseBibliotheque } from '$domaine/types';
import { estUuid } from '$serveur/formulaire';

/** Même raison que pour les fiches clients : sans liste explicite, un `set({ ...data })` laisserait
 * écrire `id` ou `creeLe`. */
const CHAMPS_MODIFIABLES = ['titre', 'corps'] as const;

type ChampModifiable = (typeof CHAMPS_MODIFIABLES)[number];

function champsAutorises(data: unknown): Partial<Record<ChampModifiable, string>> {
	const source = (data ?? {}) as Record<string, unknown>;
	const retenus: Partial<Record<ChampModifiable, string>> = {};
	for (const champ of CHAMPS_MODIFIABLES) {
		const valeur = source[champ];
		if (typeof valeur === 'string') retenus[champ] = valeur;
	}
	return retenus;
}

function versEnregistrement(row: typeof clauseBibliotheque.$inferSelect): ClauseBibliotheque {
	return {
		id: row.id,
		titre: row.titre,
		corps: row.corps,
		origine: row.origine === 'manuelle' ? 'manuelle' : 'ia',
		archiveLe: row.archiveLe ? row.archiveLe.toISOString() : null,
		creeLe: row.creeLe.toISOString(),
		majLe: row.majLe.toISOString()
	};
}

/** `archives` bascule la liste sur les clauses archivées. Tri par titre : c'est ainsi qu'on cherche
 * dans une bibliothèque, jamais par date d'ajout. */
export async function listerClausesBibliotheque(options?: {
	archives?: boolean;
}): Promise<ClauseBibliotheque[]> {
	const rows = await db
		.select()
		.from(clauseBibliotheque)
		.where(
			options?.archives
				? isNotNull(clauseBibliotheque.archiveLe)
				: isNull(clauseBibliotheque.archiveLe)
		)
		.orderBy(asc(clauseBibliotheque.titre));
	return rows.map(versEnregistrement);
}

export async function obtenirClauseBibliotheque(id: string): Promise<ClauseBibliotheque | null> {
	if (!estUuid(id)) return null;
	const [row] = await db.select().from(clauseBibliotheque).where(eq(clauseBibliotheque.id, id));
	return row ? versEnregistrement(row) : null;
}

/** `origine` est la seule trace qu'un texte vient du modèle, et mérite donc une relecture juridique
 * avant d'être envoyé à un client. */
export async function creerClauseBibliotheque(data: {
	titre: string;
	corps: string;
	origine?: ClauseBibliotheque['origine'];
}): Promise<ClauseBibliotheque> {
	const [row] = await db
		.insert(clauseBibliotheque)
		.values({
			titre: data.titre,
			corps: data.corps,
			origine: data.origine ?? 'ia'
		})
		.returning();
	return versEnregistrement(row);
}

/** Renvoie `null` si la clause n'existe plus, ou si la requête ne portait aucun champ modifiable :
 * toucher `majLe` ferait alors passer pour modifiée une clause identique. */
export async function modifierClauseBibliotheque(
	id: string,
	data: unknown
): Promise<ClauseBibliotheque | null> {
	if (!estUuid(id)) return null;

	const champs = champsAutorises(data);
	if (Object.keys(champs).length === 0) return null;

	const [row] = await db
		.update(clauseBibliotheque)
		.set({ ...champs, majLe: new Date() })
		.where(eq(clauseBibliotheque.id, id))
		.returning();
	return row ? versEnregistrement(row) : null;
}

/** Sort une clause de la bibliothèque sans la détruire : les mandats qui la citent gardent leur
 * copie figée. */
export async function archiverClauseBibliotheque(id: string): Promise<boolean> {
	if (!estUuid(id)) return false;
	const lignes = await db
		.update(clauseBibliotheque)
		.set({ archiveLe: new Date() })
		.where(and(eq(clauseBibliotheque.id, id), isNull(clauseBibliotheque.archiveLe)))
		.returning({ id: clauseBibliotheque.id });
	return lignes.length > 0;
}

export async function desarchiverClauseBibliotheque(id: string): Promise<boolean> {
	if (!estUuid(id)) return false;
	const lignes = await db
		.update(clauseBibliotheque)
		.set({ archiveLe: null })
		.where(eq(clauseBibliotheque.id, id))
		.returning({ id: clauseBibliotheque.id });
	return lignes.length > 0;
}
