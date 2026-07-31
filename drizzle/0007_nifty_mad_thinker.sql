ALTER TABLE "standings" ADD COLUMN "sets_for" integer;--> statement-breakpoint
ALTER TABLE "standings" ADD COLUMN "sets_against" integer;--> statement-breakpoint
ALTER TABLE "standings" ADD COLUMN "sets_coefficient" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "standings" ADD COLUMN "admin_bonus_points" integer;