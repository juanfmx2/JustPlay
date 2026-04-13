CREATE TABLE "rule_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_group_id" integer NOT NULL,
	"title" text NOT NULL,
	"html" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rule_groups" ADD CONSTRAINT "rule_groups_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_rule_group_id_rule_groups_id_fk" FOREIGN KEY ("rule_group_id") REFERENCES "public"."rule_groups"("id") ON DELETE cascade ON UPDATE no action;