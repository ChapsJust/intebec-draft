import { eq, and, isNull, isNotNull, asc, count } from 'drizzle-orm';
import { db } from './index';
import { client, mandat } from './schema';
import type { CoordonneesClient, FicheClient, FicheClientListee } from '$domaine/types';
import { estUuid } from '$serveur/formulaire';

/** Champs qu'une requête entrante a le droit d'écrire. Sans liste explicite, le JSON reçu partirait
 * dans `set({ ...data })` et pourrait écrire n'importe quelle colonne, `id` comprise, ce qui
 * détacherait la fiche de tous ses mandats. */
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

/** Ne retient que les champs modifiables, et seulement s'ils sont des chaînes. Le reste est du bruit,
 * pas une erreur à signaler. */
function champsAutorises(data: unknown): Partial<Record<ChampModifiable, string>> {
	const source = (data ?? {}) as Record<string, unknown>;
	const retenus: Partial<Record<ChampModifiable, string>> = {};
	for (const champ of CHAMPS_MODIFIABLES) {
		const valeur = source[champ];
		if (typeof valeur === 'string') retenus[champ] = valeur;
	}
	return retenus;
}

function versEnregistrement(row: typeof client.$inferSelect): FicheClient {
	return {
		id: row.id,
		nom: row.nom,
		typeClient: row.typeClient as FicheClient['typeClient'],
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

/** `archives` bascule la liste sur les clients archivés. Le décompte des mandats permet d'annoncer
 * les conséquences exactes avant d'archiver ou de supprimer. */
export async function listerClients(options?: {
	archives?: boolean;
}): Promise<FicheClientListee[]> {
	const rows = await db
		.select({ fiche: client, nbMandats: count(mandat.id) })
		.from(client)
		.leftJoin(mandat, eq(mandat.clientId, client.id))
		.where(options?.archives ? isNotNull(client.archiveLe) : isNull(client.archiveLe))
		.groupBy(client.id)
		.orderBy(asc(client.nom));
	return rows.map((row) => ({ ...versEnregistrement(row.fiche), nbMandats: row.nbMandats }));
}

export async function obtenirClient(id: string): Promise<FicheClient | null> {
	if (!estUuid(id)) return null;
	const [row] = await db.select().from(client).where(eq(client.id, id));
	return row ? versEnregistrement(row) : null;
}

export async function creerClient(
	data: CoordonneesClient & { notes?: string }
): Promise<FicheClient> {
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
	return versEnregistrement(row);
}

/** Renvoie `null` si la fiche n'existe plus, ou si la requête ne portait aucun champ modifiable :
 * toucher `majLe` ferait alors passer pour modifiée une fiche identique. */
export async function modifierClient(
	id: string,
	data: Partial<CoordonneesClient> & { notes?: string }
): Promise<FicheClient | null> {
	if (!estUuid(id)) return null;

	const champs = champsAutorises(data);
	if (Object.keys(champs).length === 0) return null;

	const [row] = await db
		.update(client)
		.set({ ...champs, majLe: new Date() })
		.where(eq(client.id, id))
		.returning();
	return row ? versEnregistrement(row) : null;
}

/** Archive le client et ses mandats actifs avec le même horodatage : c'est cette trace partagée qui
 * rend l'opération réversible (voir `desarchiverClient`). */
export async function archiverClient(id: string): Promise<boolean> {
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

/** Ne relève que les mandats tombés avec le client, reconnus à leur horodatage identique au sien. Un
 * mandat archivé séparément reste archivé. */
export async function desarchiverClient(id: string): Promise<boolean> {
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

/** Suppression définitive : la fiche et tous ses mandats. Irréversible, d'où la confirmation par
 * saisie du nom côté interface. */
export async function supprimerClient(id: string): Promise<boolean> {
	if (!estUuid(id)) return false;
	return db.transaction(async (tx) => {
		await tx.delete(mandat).where(eq(mandat.clientId, id));
		const lignes = await tx.delete(client).where(eq(client.id, id)).returning({ id: client.id });
		return lignes.length > 0;
	});
}
