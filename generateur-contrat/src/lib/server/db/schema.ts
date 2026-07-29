import { pgTable, uuid, text, timestamp, numeric, jsonb } from 'drizzle-orm/pg-core';
import type { BrouillonMandat, RedactionIA } from '$lib/types';

export const client = pgTable('client', {
	id: uuid('id').primaryKey().defaultRandom(),
	nom: text('nom').notNull(),
	typeClient: text('type_client').notNull().default('entreprise'),
	adresse: text('adresse').notNull().default(''),
	representantNom: text('representant_nom').notNull().default(''),
	representantTitre: text('representant_titre').notNull().default(''),
	courriel: text('courriel').notNull().default(''),
	telephone: text('telephone').notNull().default(''),
	siteWeb: text('site_web').notNull().default(''),
	numeroEntreprise: text('numero_entreprise').notNull().default(''),
	notes: text('notes').notNull().default(''),
	archiveLe: timestamp('archive_le', { withTimezone: true }),
	creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
	majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow()
});

/** Clauses rédigées hors catalogue, réutilisables d'un mandat à l'autre.
 *
 * Séparée de `mandat` parce qu'une clause survit au document qui l'a fait naître : elle est proposée
 * par une relecture, retenue une première fois, puis reproposée sur les mandats suivants au lieu
 * d'être réécrite en autant de variantes approximatives. Le texte retenu dans un mandat en est une
 * copie figée (`ClauseRetenue`), donc modifier une clause ici ne réécrit aucun contrat déjà rédigé. */
export const clauseBibliotheque = pgTable('clause_bibliotheque', {
	id: uuid('id').primaryKey().defaultRandom(),
	titre: text('titre').notNull(),
	corps: text('corps').notNull(),
	origine: text('origine').notNull().default('ia'),
	archiveLe: timestamp('archive_le', { withTimezone: true }),
	creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
	majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow()
});

export const mandat = pgTable('mandat', {
	id: uuid('id').primaryKey().defaultRandom(),
	clientId: uuid('client_id').references(() => client.id, { onDelete: 'set null' }),
	type: text('type').notNull().default('soumission'),
	statut: text('statut').notNull().default('brouillon'),
	titre: text('titre').notNull().default(''),
	clientNom: text('client_nom').notNull().default(''),
	totalNet: numeric('total_net', { precision: 12, scale: 2 }).notNull().default('0'),
	// La colonne s'appelle toujours `draft` en base : seule la clé JavaScript est passée au français.
	// Drizzle dissocie les deux, ce qui évite une migration pour un simple renommage de vocabulaire.
	brouillon: jsonb('draft').$type<BrouillonMandat>().notNull(),
	redaction: jsonb('redaction').$type<RedactionIA>(),
	archiveLe: timestamp('archive_le', { withTimezone: true }),
	creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
	majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow()
});
