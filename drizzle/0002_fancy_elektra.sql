CREATE TYPE "public"."competition_type" AS ENUM('SINGLE_DAY', 'MULTIPLE_DAYS', 'WEEKLY', 'MONTHLY', 'SEASON');--> statement-breakpoint
CREATE TYPE "public"."division_type" AS ENUM('MEN', 'WOMEN', 'MIXED');--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"type" "competition_type" NOT NULL,
	"format" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "divisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"level" text NOT NULL,
	"type" "division_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url_slug" text NOT NULL,
	CONSTRAINT "teams_url_slug_unique" UNIQUE("url_slug")
);
