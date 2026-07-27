import { pgTable, uuid, text, timestamp, numeric, jsonb } from 'drizzle-orm/pg-core';
import type { MandatDraft, RedactionIA } from '$lib/types';

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

export const mandat = pgTable('mandat', {
	id: uuid('id').primaryKey().defaultRandom(),
	clientId: uuid('client_id').references(() => client.id, { onDelete: 'set null' }),
	type: text('type').notNull().default('soumission'),
	statut: text('statut').notNull().default('brouillon'),
	titre: text('titre').notNull().default(''),
	clientNom: text('client_nom').notNull().default(''),
	totalNet: numeric('total_net', { precision: 12, scale: 2 }).notNull().default('0'),
	draft: jsonb('draft').$type<MandatDraft>().notNull(),
	redaction: jsonb('redaction').$type<RedactionIA>(),
	creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
	majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow()
});
