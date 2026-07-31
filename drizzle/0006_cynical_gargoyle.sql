ALTER TABLE "games" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "team_a_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "team_b_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "admin_validated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "admin_validated_by_name" text;