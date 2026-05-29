ALTER TABLE "players"
  ADD COLUMN "points_for" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "points_against" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "coefficient" numeric(10, 4);

CREATE TABLE "two_vs_two_games" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_a_player_1_id" integer NOT NULL,
  "team_a_player_2_id" integer NOT NULL,
  "team_b_player_1_id" integer NOT NULL,
  "team_b_player_2_id" integer NOT NULL,
  "score_team_a" integer NOT NULL,
  "score_team_b" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "two_vs_two_games" ADD CONSTRAINT "two_vs_two_games_team_a_player_1_id_players_id_fk" FOREIGN KEY ("team_a_player_1_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "two_vs_two_games" ADD CONSTRAINT "two_vs_two_games_team_a_player_2_id_players_id_fk" FOREIGN KEY ("team_a_player_2_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "two_vs_two_games" ADD CONSTRAINT "two_vs_two_games_team_b_player_1_id_players_id_fk" FOREIGN KEY ("team_b_player_1_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "two_vs_two_games" ADD CONSTRAINT "two_vs_two_games_team_b_player_2_id_players_id_fk" FOREIGN KEY ("team_b_player_2_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;
