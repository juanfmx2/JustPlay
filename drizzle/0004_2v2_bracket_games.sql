CREATE TABLE IF NOT EXISTS "two_vs_two_bracket_games" (
  "id" serial PRIMARY KEY NOT NULL,
  "pool" text NOT NULL,
  "match_key" text NOT NULL,
  "team_a_player_1_id" integer NOT NULL,
  "team_a_player_2_id" integer NOT NULL,
  "team_b_player_1_id" integer NOT NULL,
  "team_b_player_2_id" integer NOT NULL,
  "score_team_a" integer NOT NULL,
  "score_team_b" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "two_vs_two_bracket_games_pool_match_key_unique" UNIQUE("pool", "match_key")
);

ALTER TABLE "two_vs_two_bracket_games"
  ADD CONSTRAINT "two_vs_two_bracket_games_team_a_player_1_id_players_id_fk"
  FOREIGN KEY ("team_a_player_1_id") REFERENCES "public"."players"("id")
  ON DELETE no action ON UPDATE no action;

ALTER TABLE "two_vs_two_bracket_games"
  ADD CONSTRAINT "two_vs_two_bracket_games_team_a_player_2_id_players_id_fk"
  FOREIGN KEY ("team_a_player_2_id") REFERENCES "public"."players"("id")
  ON DELETE no action ON UPDATE no action;

ALTER TABLE "two_vs_two_bracket_games"
  ADD CONSTRAINT "two_vs_two_bracket_games_team_b_player_1_id_players_id_fk"
  FOREIGN KEY ("team_b_player_1_id") REFERENCES "public"."players"("id")
  ON DELETE no action ON UPDATE no action;

ALTER TABLE "two_vs_two_bracket_games"
  ADD CONSTRAINT "two_vs_two_bracket_games_team_b_player_2_id_players_id_fk"
  FOREIGN KEY ("team_b_player_2_id") REFERENCES "public"."players"("id")
  ON DELETE no action ON UPDATE no action;
