import { eq, and, isNull, isNotNull, asc, count } from 'drizzle-orm';
import { db } from './index';
import { client, mandat } from './schema';
import type { ClientInfo, ClientRecord, ClientListItem } from '$lib/types';

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

/** `archives` bascule la liste sur les clients archivés. Le décompte des mandats accompagne chaque
 * fiche : c'est ce qui permet d'annoncer les conséquences exactes avant d'archiver ou de supprimer. */
export async function listClients(options?: { archives?: boolean }): Promise<ClientListItem[]> {
	const rows = await db
		.select({ fiche: client, nbMandats: count(mandat.id) })
		.from(client)
		.leftJoin(mandat, eq(mandat.clientId, client.id))
		.where(options?.archives ? isNotNull(client.archiveLe) : isNull(client.archiveLe))
		.groupBy(client.id)
		.orderBy(asc(client.nom));
	return rows.map((row) => ({ ...toRecord(row.fiche), nbMandats: row.nbMandats }));
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

/** Archive le client **et** ses mandats encore actifs, avec le même horodatage de part et d'autre.
 * Cet horodatage partagé est la trace qui rend l'opération réversible : voir `unarchiveClient`. */
export async function archiveClient(id: string): Promise<void> {
	const archiveLe = new Date();
	await db.transaction(async (tx) => {
		await tx.update(client).set({ archiveLe }).where(eq(client.id, id));
		await tx
			.update(mandat)
			.set({ archiveLe })
			.where(and(eq(mandat.clientId, id), isNull(mandat.archiveLe)));
	});
}

/** Sort le client de l'archive et ne relève que les mandats tombés avec lui, reconnus à leur
 * horodatage identique au sien. Un mandat archivé séparément avant, ou après, reste archivé. */
export async function unarchiveClient(id: string): Promise<void> {
	await db.transaction(async (tx) => {
		const [fiche] = await tx.select().from(client).where(eq(client.id, id));
		if (!fiche) return;
		if (fiche.archiveLe) {
			await tx
				.update(mandat)
				.set({ archiveLe: null })
				.where(and(eq(mandat.clientId, id), eq(mandat.archiveLe, fiche.archiveLe)));
		}
		await tx.update(client).set({ archiveLe: null }).where(eq(client.id, id));
	});
}

/** Suppression définitive : la fiche et tous ses mandats, brouillons comme documents générés.
 * Irréversible, d'où la confirmation par saisie du nom côté interface. */
export async function deleteClient(id: string): Promise<void> {
	await db.transaction(async (tx) => {
		await tx.delete(mandat).where(eq(mandat.clientId, id));
		await tx.delete(client).where(eq(client.id, id));
	});
}
