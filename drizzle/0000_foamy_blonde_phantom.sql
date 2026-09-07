CREATE TABLE "char_defs" (
	"char_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"element" text NOT NULL,
	"rarity" text NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"instance_id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"char_id" text NOT NULL,
	"level" smallint DEFAULT 1 NOT NULL,
	"exp" integer DEFAULT 0 NOT NULL,
	"sp" integer DEFAULT 0 NOT NULL,
	"skill_levels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"loadout" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weapon" integer,
	"armor" integer,
	"accessory" integer,
	"locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gacha_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"char_id" text NOT NULL,
	"rarity" text NOT NULL,
	"is_new" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gear_defs" (
	"gear_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slot" text NOT NULL,
	"rarity" text NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gears" (
	"instance_id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"gear_id" text NOT NULL,
	"plus" smallint DEFAULT 0 NOT NULL,
	"equipped_by" integer,
	"locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"save_key" text NOT NULL,
	"name" text DEFAULT 'Chủ Nhân' NOT NULL,
	"gold" integer DEFAULT 1500 NOT NULL,
	"gem" integer DEFAULT 1000 NOT NULL,
	"pity" integer DEFAULT 0 NOT NULL,
	"pull_count" integer DEFAULT 0 NOT NULL,
	"since_sr" integer DEFAULT 0 NOT NULL,
	"stage_progress" integer DEFAULT 1 NOT NULL,
	"best_round" integer DEFAULT 0 NOT NULL,
	"team" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"purchases" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_save_key_unique" UNIQUE("save_key")
);
--> statement-breakpoint
CREATE TABLE "pulls" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"kind" text NOT NULL,
	"result" jsonb NOT NULL,
	"cost" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"stage_id" smallint NOT NULL,
	"win" boolean NOT NULL,
	"rounds" smallint DEFAULT 0 NOT NULL,
	"total_damage" integer DEFAULT 0 NOT NULL,
	"kills" smallint DEFAULT 0 NOT NULL,
	"first_clear" boolean DEFAULT false NOT NULL,
	"gold" integer DEFAULT 0 NOT NULL,
	"gem" integer DEFAULT 0 NOT NULL,
	"exp" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sp" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"drops" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seed" bigint DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gacha_history" ADD CONSTRAINT "gacha_history_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gears" ADD CONSTRAINT "gears_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulls" ADD CONSTRAINT "pulls_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_runs" ADD CONSTRAINT "stage_runs_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;