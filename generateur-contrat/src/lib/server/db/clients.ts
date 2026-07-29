import { eq, and, isNull, isNotNull, asc, count } from 'drizzle-orm';
import { db } from './index';
import { client, mandat } from './schema';
import type { ClientInfo, ClientRecord, ClientListItem } from '$lib/types';
import { estUuid } from '../formulaire';

/** Champs qu'une requête entrante a le droit d'écrire sur une fiche client.
 *
 * La liste est explicite parce que le contraire l'était trop : le JSON reçu du navigateur partait
 * directement dans `set({ ...data })`, et une requête bricolée pouvait donc écrire n'importe quelle
 * colonne de la table, `id` comprise, ce qui aurait détaché la fiche de tous ses mandats. */
const CHAMPS_MODIFIABLES = [
	'nom',
	'typeClient',
	'adresse',
	'representantNom',
	'representantTitre',
	'courriel',
	'telephone',
	'siteWeb',
	'numeroEntreprise',
	'notes'
] as const;

type ChampModifiable = (typeof CHAMPS_MODIFIABLES)[number];

/** Ne retient d'un objet arbitraire que les champs modifiables, et seulement s'ils sont des
 * chaînes. Tout le reste est ignoré silencieusement : c'est du bruit, pas une erreur à signaler. */
function champsAutorises(data: unknown): Partial<Record<ChampModifiable, string>> {
	const source = (data ?? {}) as Record<string, unknown>;
	const retenus: Partial<Record<ChampModifiable, string>> = {};
	for (const champ of CHAMPS_MODIFIABLES) {
		const valeur = source[champ];
		if (typeof valeur === 'string') retenus[champ] = valeur;
	}
	return retenus;
}

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
	if (!estUuid(id)) return null;
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

/** Met à jour une fiche client. Renvoie `null` si la fiche n'existe plus, ou si la requête ne
 * portait aucun champ modifiable — dans ce dernier cas il n'y a rien à écrire, et toucher quand
 * même `majLe` ferait passer pour modifiée une fiche restée identique. */
export async function updateClient(
	id: string,
	data: Partial<ClientInfo> & { notes?: string }
): Promise<ClientRecord | null> {
	if (!estUuid(id)) return null;

	const champs = champsAutorises(data);
	if (Object.keys(champs).length === 0) return null;

	const [row] = await db
		.update(client)
		.set({ ...champs, majLe: new Date() })
		.where(eq(client.id, id))
		.returning();
	return row ? toRecord(row) : null;
}

/** Archive le client **et** ses mandats encore actifs, avec le même horodatage de part et d'autre.
 * Cet horodatage partagé est la trace qui rend l'opération réversible : voir `unarchiveClient`. */
export async function archiveClient(id: string): Promise<boolean> {
	if (!estUuid(id)) return false;
	const archiveLe = new Date();
	return db.transaction(async (tx) => {
		const lignes = await tx
			.update(client)
			.set({ archiveLe })
			.where(eq(client.id, id))
			.returning({ id: client.id });
		if (lignes.length === 0) return false;
		await tx
			.update(mandat)
			.set({ archiveLe })
			.where(and(eq(mandat.clientId, id), isNull(mandat.archiveLe)));
		return true;
	});
}

/** Sort le client de l'archive et ne relève que les mandats tombés avec lui, reconnus à leur
 * horodatage identique au sien. Un mandat archivé séparément avant, ou après, reste archivé. */
export async function unarchiveClient(id: string): Promise<boolean> {
	if (!estUuid(id)) return false;
	return db.transaction(async (tx) => {
		const [fiche] = await tx.select().from(client).where(eq(client.id, id));
		if (!fiche) return false;
		if (fiche.archiveLe) {
			await tx
				.update(mandat)
				.set({ archiveLe: null })
				.where(and(eq(mandat.clientId, id), eq(mandat.archiveLe, fiche.archiveLe)));
		}
		await tx.update(client).set({ archiveLe: null }).where(eq(client.id, id));
		return true;
	});
}

/** Suppression définitive : la fiche et tous ses mandats, brouillons comme documents générés.
 * Irréversible, d'où la confirmation par saisie du nom côté interface. */
export async function deleteClient(id: string): Promise<boolean> {
	if (!estUuid(id)) return false;
	return db.transaction(async (tx) => {
		await tx.delete(mandat).where(eq(mandat.clientId, id));
		const lignes = await tx.delete(client).where(eq(client.id, id)).returning({ id: client.id });
		return lignes.length > 0;
	});
}
