CREATE TABLE IF NOT EXISTS "two_vs_two_settings" (
  "id" integer PRIMARY KEY NOT NULL,
  "register_games_enabled" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "two_vs_two_settings" ("id", "register_games_enabled")
VALUES (1, true)
ON CONFLICT ("id") DO NOTHING;
