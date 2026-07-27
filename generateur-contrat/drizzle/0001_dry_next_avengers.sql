CREATE TABLE "client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" text NOT NULL,
	"type_client" text DEFAULT 'entreprise' NOT NULL,
	"adresse" text DEFAULT '' NOT NULL,
	"representant_nom" text DEFAULT '' NOT NULL,
	"representant_titre" text DEFAULT '' NOT NULL,
	"courriel" text DEFAULT '' NOT NULL,
	"telephone" text DEFAULT '' NOT NULL,
	"site_web" text DEFAULT '' NOT NULL,
	"numero_entreprise" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"archive_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mandat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"type" text DEFAULT 'soumission' NOT NULL,
	"statut" text DEFAULT 'brouillon' NOT NULL,
	"titre" text DEFAULT '' NOT NULL,
	"client_nom" text DEFAULT '' NOT NULL,
	"total_net" numeric(12, 2) DEFAULT '0' NOT NULL,
	"draft" jsonb NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mandat" ADD CONSTRAINT "mandat_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;