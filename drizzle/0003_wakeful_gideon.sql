CREATE TYPE "public"."stage_type" AS ENUM('REGISTRATION', 'PLAY');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"street" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"url_slug" text,
	"type" "stage_type" DEFAULT 'PLAY' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"court_id" integer NOT NULL,
	"name" text,
	"description" text,
	"score_team_a" integer,
	"score_team_b" integer
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"division_id" integer NOT NULL,
	"team_a_id" integer NOT NULL,
	"team_b_id" integer NOT NULL,
	"reffing_team_id" integer,
	"name" text,
	"description" text,
	"score_team_a" integer,
	"score_team_b" integer
);
--> statement-breakpoint
CREATE TABLE "courts" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "venue_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"venue_id" integer NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" serial PRIMARY KEY NOT NULL,
	"address_id" integer,
	"name" text NOT NULL,
	"description" text,
	"invoice_num" text,
	"location" jsonb
);
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "start_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "end_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "url_slug" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "registration_stage_id" integer;--> statement-breakpoint
ALTER TABLE "divisions" ADD COLUMN "stage_id" integer;--> statement-breakpoint
ALTER TABLE "divisions" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "divisions" ADD COLUMN "url_slug" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "division_id" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sets" ADD CONSTRAINT "game_sets_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sets" ADD CONSTRAINT "game_sets_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_team_a_id_teams_id_fk" FOREIGN KEY ("team_a_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_team_b_id_teams_id_fk" FOREIGN KEY ("team_b_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_reffing_team_id_teams_id_fk" FOREIGN KEY ("reffing_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courts" ADD CONSTRAINT "courts_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_bookings" ADD CONSTRAINT "venue_bookings_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_bookings" ADD CONSTRAINT "venue_bookings_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE set null ON UPDATE no action;