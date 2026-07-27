import { eq, isNull, asc } from 'drizzle-orm';
import { db } from './index';
import { client } from './schema';
import type { ClientInfo, ClientRecord } from '$lib/types';

function toRecord(row: typeof client.$inferSelect): ClientRecord {
	return {
		id: row.id,
		nom: row.nom,
		typeClient: row.typeClient as ClientRecord['typeClient'],
		adresse: row.adresse,
		representantNom: row.representantNom,
		representantTitre: row.representantTitre,
		courriel: row.courriel,
		telephone: row.telephone,
		siteWeb: row.siteWeb,
		numeroEntreprise: row.numeroEntreprise,
		notes: row.notes,
		archiveLe: row.archiveLe ? row.archiveLe.toISOString() : null,
		creeLe: row.creeLe.toISOString(),
		majLe: row.majLe.toISOString()
	};
}

export async function listClients(): Promise<ClientRecord[]> {
	const rows = await db
		.select()
		.from(client)
		.where(isNull(client.archiveLe))
		.orderBy(asc(client.nom));
	return rows.map(toRecord);
}

export async function getClient(id: string): Promise<ClientRecord | null> {
	const [row] = await db.select().from(client).where(eq(client.id, id));
	return row ? toRecord(row) : null;
}

export async function createClient(data: ClientInfo & { notes?: string }): Promise<ClientRecord> {
	const [row] = await db
		.insert(client)
		.values({
			nom: data.nom,
			typeClient: data.typeClient,
			adresse: data.adresse,
			representantNom: data.representantNom,
			representantTitre: data.representantTitre,
			courriel: data.courriel,
			telephone: data.telephone,
			siteWeb: data.siteWeb,
			numeroEntreprise: data.numeroEntreprise,
			notes: data.notes ?? ''
		})
		.returning();
	return toRecord(row);
}

export async function updateClient(
	id: string,
	data: Partial<ClientInfo> & { notes?: string }
): Promise<ClientRecord> {
	const [row] = await db
		.update(client)
		.set({ ...data, majLe: new Date() })
		.where(eq(client.id, id))
		.returning();
	return toRecord(row);
}

export async function archiveClient(id: string): Promise<void> {
	await db.update(client).set({ archiveLe: new Date() }).where(eq(client.id, id));
}
