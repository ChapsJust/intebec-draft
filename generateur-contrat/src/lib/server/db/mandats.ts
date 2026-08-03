import { eq, desc, and, isNull, isNotNull, type SQL } from 'drizzle-orm';
import { db } from './index';
import { mandat } from './schema';
import type {
	BrouillonMandat,
	MandatEnregistre,
	StatutDocument,
	RedactionIA
} from '$domaine/types';
import { totalNet } from '$domaine/montants';
import { estUuid } from '$serveur/formulaire';
import { normaliserMandat } from '$serveur/mandat/formulaire';

function versEnregistrement(row: typeof mandat.$inferSelect): MandatEnregistre {
	return {
		id: row.id,
		clientId: row.clientId,
		type: row.type as MandatEnregistre['type'],
		statut: row.statut as StatutDocument,
		titre: row.titre,
		clientNom: row.clientNom,
		totalNet: Number(row.totalNet),
		// Normalisé à la lecture aussi : la colonne est un `jsonb` sans contrainte, donc une ligne
		// écrite avant l'ajout d'un champ ne l'a pas, et la page d'édition tombait en 500. Idempotent,
		// puisque l'écriture applique déjà la même normalisation.
		brouillon: normaliserMandat(row.brouillon),
		redaction: row.redaction ?? null,
		archiveLe: row.archiveLe ? row.archiveLe.toISOString() : null,
		creeLe: row.creeLe.toISOString(),
		majLe: row.majLe.toISOString()
	};
}

/** `archives` bascule la liste sur les mandats archivés ; par défaut on ne rend que les courants,
 * pour qu'archiver suffise à sortir un mandat de l'accueil et des fiches client. */
export async function listerMandats(options?: {
	clientId?: string;
	archives?: boolean;
	limite?: number;
}): Promise<MandatEnregistre[]> {
	const filtres: SQL[] = [
		options?.archives ? isNotNull(mandat.archiveLe) : isNull(mandat.archiveLe)
	];
	// Un `clientId` mal formé ne peut correspondre à aucune fiche : on renvoie une liste vide au
	// lieu de laisser Postgres refuser la conversion en `uuid`.
	if (options?.clientId) {
		if (!estUuid(options.clientId)) return [];
		filtres.push(eq(mandat.clientId, options.clientId));
	}

	const requete = db
		.select()
		.from(mandat)
		.where(and(...filtres))
		.orderBy(desc(mandat.majLe));

	// Limite appliquée par la requête : inutile de remonter toute la table pour en jeter le reste.
	const rows = options?.limite ? await requete.limit(options.limite) : await requete;
	return rows.map(versEnregistrement);
}

export async function obtenirMandat(id: string): Promise<MandatEnregistre | null> {
	if (!estUuid(id)) return null;
	const [row] = await db.select().from(mandat).where(eq(mandat.id, id));
	return row ? versEnregistrement(row) : null;
}

/** Crée un mandat, ou met à jour celui désigné par `options.id`. Renvoie `null` quand aucune ligne
 * n'est touchée : le mandat a été supprimé entre-temps, depuis un autre onglet. */
export async function enregistrerMandat(
	brouillon: BrouillonMandat,
	options?: { id?: string; clientId?: string | null; statut?: StatutDocument }
): Promise<MandatEnregistre | null> {
	const values = {
		clientId: options?.clientId ?? null,
		type: brouillon.type,
		statut: options?.statut ?? ('brouillon' as StatutDocument),
		titre: brouillon.titre,
		clientNom: brouillon.client.nom,
		totalNet: totalNet(brouillon.lignes, brouillon.conditions.rabaisPct).toFixed(2),
		brouillon,
		majLe: new Date()
	};

	if (options?.id) {
		if (!estUuid(options.id)) return null;
		const [row] = await db.update(mandat).set(values).where(eq(mandat.id, options.id)).returning();
		return row ? versEnregistrement(row) : null;
	}

	const [row] = await db.insert(mandat).values(values).returning();
	return versEnregistrement(row);
}

/** Enregistre (ou efface, avec `null`) la rédaction de l'IA. Séparé de `enregistrerMandat` : les deux
 * colonnes ne doivent jamais se toucher l'une l'autre. */
export async function enregistrerRedaction(
	id: string,
	redaction: RedactionIA | null
): Promise<MandatEnregistre | null> {
	if (!estUuid(id)) return null;
	const [row] = await db
		.update(mandat)
		.set({ redaction, majLe: new Date() })
		.where(eq(mandat.id, id))
		.returning();
	return row ? versEnregistrement(row) : null;
}

/** Fait avancer un mandat dans son cycle de vie (brouillon, généré, envoyé) sans toucher à sa
 * saisie. */
export async function changerStatutMandat(id: string, statut: StatutDocument): Promise<boolean> {
	if (!estUuid(id)) return false;
	const lignes = await db
		.update(mandat)
		.set({ statut, majLe: new Date() })
		.where(eq(mandat.id, id))
		.returning({ id: mandat.id });
	return lignes.length > 0;
}

/** Les trois opérations ci-dessous renvoient `true` seulement si elles ont touché une ligne : sinon
 * l'interface annonce « Mandat supprimé » pour un identifiant qui n'existe pas, et une confirmation
 * fausse dispense de vérifier. (IA) */
export async function archiverMandat(id: string): Promise<boolean> {
	if (!estUuid(id)) return false;
	const lignes = await db
		.update(mandat)
		.set({ archiveLe: new Date() })
		.where(and(eq(mandat.id, id), isNull(mandat.archiveLe)))
		.returning({ id: mandat.id });
	return lignes.length > 0;
}

/** Annule l'archivage d'un mandat. */
export async function desarchiverMandat(id: string): Promise<boolean> {
	if (!estUuid(id)) return false;
	const lignes = await db
		.update(mandat)
		.set({ archiveLe: null })
		.where(eq(mandat.id, id))
		.returning({ id: mandat.id });
	return lignes.length > 0;
}

/** Efface un mandat. */
export async function supprimerMandat(id: string): Promise<boolean> {
	if (!estUuid(id)) return false;
	const lignes = await db.delete(mandat).where(eq(mandat.id, id)).returning({ id: mandat.id });
	return lignes.length > 0;
}
