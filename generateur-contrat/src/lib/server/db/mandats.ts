import { eq, desc, and, isNull, isNotNull, type SQL } from 'drizzle-orm';
import { db } from './index';
import { mandat } from './schema';
import type { MandatDraft, MandatRecord, DocumentStatus, RedactionIA } from '$lib/types';
import { totalNet } from '$lib/pricing';
import { estUuid } from '../formulaire';

function toRecord(row: typeof mandat.$inferSelect): MandatRecord {
	return {
		id: row.id,
		clientId: row.clientId,
		type: row.type as MandatRecord['type'],
		statut: row.statut as DocumentStatus,
		titre: row.titre,
		clientNom: row.clientNom,
		totalNet: Number(row.totalNet),
		draft: row.draft,
		redaction: row.redaction ?? null,
		archiveLe: row.archiveLe ? row.archiveLe.toISOString() : null,
		creeLe: row.creeLe.toISOString(),
		majLe: row.majLe.toISOString()
	};
}

/** `archives` bascule la liste sur les mandats archivés ; par défaut on ne rend que les courants,
 * pour qu'archiver suffise à sortir un mandat de l'accueil et des fiches client. */
export async function listMandats(options?: {
	clientId?: string;
	archives?: boolean;
	limite?: number;
}): Promise<MandatRecord[]> {
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

	// La limite est appliquée par la requête, pas après coup : l'accueil n'affiche que huit lignes
	// et n'a aucune raison de faire remonter toute la table pour en jeter le reste.
	const rows = options?.limite ? await requete.limit(options.limite) : await requete;
	return rows.map(toRecord);
}

export async function getMandat(id: string): Promise<MandatRecord | null> {
	if (!estUuid(id)) return null;
	const [row] = await db.select().from(mandat).where(eq(mandat.id, id));
	return row ? toRecord(row) : null;
}

/** Crée un mandat, ou met à jour celui désigné par `options.id`.
 *
 * Renvoie `null` quand la mise à jour ne touche aucune ligne, c'est-à-dire quand le mandat a été
 * supprimé entre-temps. Le cas se produit pour de vrai : deux onglets ouverts, suppression dans
 * l'un, « Enregistrer » dans l'autre. Sans ce retour, `toRecord(undefined)` levait une erreur et
 * l'utilisateur recevait une page 500 au lieu d'un « Mandat introuvable ». */
export async function saveMandat(
	draft: MandatDraft,
	options?: { id?: string; clientId?: string | null; statut?: DocumentStatus }
): Promise<MandatRecord | null> {
	const values = {
		clientId: options?.clientId ?? null,
		type: draft.type,
		statut: options?.statut ?? ('brouillon' as DocumentStatus),
		titre: draft.titre,
		clientNom: draft.client.nom,
		totalNet: totalNet(draft.lignes, draft.conditions.rabaisPct).toFixed(2),
		draft,
		majLe: new Date()
	};

	if (options?.id) {
		const [row] = await db.update(mandat).set(values).where(eq(mandat.id, options.id)).returning();
		return toRecord(row);
	}

	const [row] = await db.insert(mandat).values(values).returning();
	return toRecord(row);
}

/** Enregistre (ou efface, avec `null`) la prose générée par l'IA. Volontairement séparé de
 * `saveMandat` : sauvegarder le brouillon ne doit jamais toucher à la rédaction, et relancer la
 * rédaction ne doit jamais toucher à la saisie. */
export async function saveRedaction(
	id: string,
	redaction: RedactionIA | null
): Promise<MandatRecord | null> {
	const [row] = await db
		.update(mandat)
		.set({ redaction, majLe: new Date() })
		.where(eq(mandat.id, id))
		.returning();
	return row ? toRecord(row) : null;
}

export async function archiveMandat(id: string): Promise<void> {
	await db
		.update(mandat)
		.set({ archiveLe: new Date() })
		.where(and(eq(mandat.id, id), isNull(mandat.archiveLe)));
}

export async function unarchiveMandat(id: string): Promise<void> {
	await db.update(mandat).set({ archiveLe: null }).where(eq(mandat.id, id));
}

export async function deleteMandat(id: string): Promise<void> {
	await db.delete(mandat).where(eq(mandat.id, id));
}
