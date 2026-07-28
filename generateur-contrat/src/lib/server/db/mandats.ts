import { eq, desc, and, isNull, isNotNull, type SQL } from 'drizzle-orm';
import { db } from './index';
import { mandat } from './schema';
import type { MandatDraft, MandatRecord, DocumentStatus, RedactionIA } from '$lib/types';
import { totalNet } from '$lib/pricing';

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
}): Promise<MandatRecord[]> {
	const filtres: SQL[] = [
		options?.archives ? isNotNull(mandat.archiveLe) : isNull(mandat.archiveLe)
	];
	if (options?.clientId) filtres.push(eq(mandat.clientId, options.clientId));

	const rows = await db
		.select()
		.from(mandat)
		.where(and(...filtres))
		.orderBy(desc(mandat.majLe));
	return rows.map(toRecord);
}

export async function getMandat(id: string): Promise<MandatRecord | null> {
	const [row] = await db.select().from(mandat).where(eq(mandat.id, id));
	return row ? toRecord(row) : null;
}

export async function saveMandat(
	draft: MandatDraft,
	options?: { id?: string; clientId?: string | null; statut?: DocumentStatus }
): Promise<MandatRecord> {
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
