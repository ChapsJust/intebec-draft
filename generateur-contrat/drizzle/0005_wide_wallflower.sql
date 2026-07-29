CREATE TABLE "clause_bibliotheque" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titre" text NOT NULL,
	"corps" text NOT NULL,
	"origine" text DEFAULT 'ia' NOT NULL,
	"archive_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
