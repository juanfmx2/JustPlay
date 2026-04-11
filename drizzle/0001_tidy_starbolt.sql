ALTER TABLE "organizations" ADD COLUMN "url_slug" text;--> statement-breakpoint
UPDATE "organizations"
SET "url_slug" = regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g');--> statement-breakpoint
UPDATE "organizations"
SET "url_slug" = regexp_replace("url_slug", '(^-+|-+$)', '', 'g');--> statement-breakpoint
UPDATE "organizations"
SET "url_slug" = CONCAT('org-', "id"::text)
WHERE "url_slug" IS NULL OR "url_slug" = '';--> statement-breakpoint
WITH ranked AS (
  SELECT
    "id",
    "url_slug",
    row_number() OVER (PARTITION BY "url_slug" ORDER BY "id") AS "row_num"
  FROM "organizations"
)
UPDATE "organizations" AS target
SET "url_slug" = CONCAT(target."url_slug", '-', target."id"::text)
FROM ranked
WHERE target."id" = ranked."id"
  AND ranked."row_num" > 1;--> statement-breakpoint
UPDATE "organizations"
SET "url_slug" = CONCAT("url_slug", '-org')
WHERE "url_slug" = 'admin';--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "url_slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_url_slug_unique" UNIQUE("url_slug");