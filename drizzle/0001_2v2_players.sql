CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"ranking" integer DEFAULT 500 NOT NULL
);
