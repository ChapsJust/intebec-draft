import { eq, desc } from 'drizzle-orm';
import { db } from './index';
import { mandat } from './schema';
import type { MandatDraft, MandatRecord, DocumentStatus } from '$lib/types';
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
		creeLe: row.creeLe.toISOString(),
		majLe: row.majLe.toISOString()
	};
}

export async function listMandats(options?: { clientId?: string }): Promise<MandatRecord[]> {
	const rows = options?.clientId
		? await db
				.select()
				.from(mandat)
				.where(eq(mandat.clientId, options.clientId))
				.orderBy(desc(mandat.majLe))
		: await db.select().from(mandat).orderBy(desc(mandat.majLe));
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

export async function deleteMandat(id: string): Promise<void> {
	await db.delete(mandat).where(eq(mandat.id, id));
}
