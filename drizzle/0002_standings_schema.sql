CREATE TABLE "standings" (
	"id" serial PRIMARY KEY NOT NULL,
	"stage_id" integer NOT NULL,
	"division_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"games_won" integer,
	"games_lost" integer,
	"points_for" integer,
	"points_against" integer,
	"coefficient" numeric(10, 4),
	"penalties" integer,
	"league_points" integer,
	"league_points_minus_penalties" integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX "standings_stage_division_team_uidx" ON "standings" USING btree ("stage_id","division_id","team_id");
--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
