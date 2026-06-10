CREATE TABLE "group_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"polla_id" uuid,
	"group_name" text NOT NULL,
	"first_place" text NOT NULL,
	"second_place" text NOT NULL,
	"third_place" text,
	"points_first" integer,
	"points_second" integer,
	"points_third" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "group_predictions_user_id_group_name_polla_id_unique" UNIQUE("user_id","group_name","polla_id")
);
--> statement-breakpoint
CREATE TABLE "group_standings" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_name" text NOT NULL,
	"team_name" text NOT NULL,
	"played" integer DEFAULT 0,
	"won" integer DEFAULT 0,
	"drawn" integer DEFAULT 0,
	"lost" integer DEFAULT 0,
	"goals_for" integer DEFAULT 0,
	"goals_against" integer DEFAULT 0,
	"points" integer DEFAULT 0,
	"position" integer,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "group_standings_group_name_team_name_unique" UNIQUE("group_name","team_name")
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"polla_id" uuid,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"used_at" timestamp,
	"expires_at" timestamp,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text,
	"competition_id" integer DEFAULT 2000,
	"stage" text NOT NULL,
	"group_name" text,
	"matchday" integer,
	"match_datetime" timestamp with time zone NOT NULL,
	"team1" text NOT NULL,
	"team2" text NOT NULL,
	"team1_resolved" boolean DEFAULT false,
	"team2_resolved" boolean DEFAULT false,
	"venue" text,
	"status" text DEFAULT 'SCHEDULED',
	"score1" integer,
	"score2" integer,
	"score1_ht" integer,
	"score2_ht" integer,
	"lock_time" timestamp with time zone,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "matches_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "password_reset_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	"resolved_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "polla_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"polla_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'participant' NOT NULL,
	"inscription_status" text DEFAULT 'pending' NOT NULL,
	"inscription_notes" text,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "polla_members_polla_id_user_id_unique" UNIQUE("polla_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "polla_result_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"polla_id" uuid NOT NULL,
	"match_id" integer NOT NULL,
	"score1" integer NOT NULL,
	"score2" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "polla_result_overrides_polla_id_match_id_unique" UNIQUE("polla_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "pollas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"competition_id" integer DEFAULT 2000,
	"competition_code" text DEFAULT 'WC',
	"competition_name" text DEFAULT 'FIFA World Cup',
	"competition_emblem" text,
	"competition_area" text DEFAULT 'World',
	CONSTRAINT "pollas_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"polla_id" uuid,
	"match_id" integer NOT NULL,
	"predicted_score1" integer NOT NULL,
	"predicted_score2" integer NOT NULL,
	"points" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "predictions_user_id_match_id_polla_id_unique" UNIQUE("user_id","match_id","polla_id")
);
--> statement-breakpoint
CREATE TABLE "special_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"polla_id" uuid,
	"type" text NOT NULL,
	"team_name" text,
	"player_name" text,
	"points" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "special_predictions_user_id_type_polla_id_unique" UNIQUE("user_id","type","polla_id")
);
--> statement-breakpoint
CREATE TABLE "tournament_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"polla_id" uuid,
	"key" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "tournament_config_polla_id_key_unique" UNIQUE("polla_id","key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"avatar_color" text,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "group_predictions" ADD CONSTRAINT "group_predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_predictions" ADD CONSTRAINT "group_predictions_polla_id_pollas_id_fk" FOREIGN KEY ("polla_id") REFERENCES "public"."pollas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_polla_id_pollas_id_fk" FOREIGN KEY ("polla_id") REFERENCES "public"."pollas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polla_members" ADD CONSTRAINT "polla_members_polla_id_pollas_id_fk" FOREIGN KEY ("polla_id") REFERENCES "public"."pollas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polla_members" ADD CONSTRAINT "polla_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polla_result_overrides" ADD CONSTRAINT "polla_result_overrides_polla_id_pollas_id_fk" FOREIGN KEY ("polla_id") REFERENCES "public"."pollas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polla_result_overrides" ADD CONSTRAINT "polla_result_overrides_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pollas" ADD CONSTRAINT "pollas_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_polla_id_pollas_id_fk" FOREIGN KEY ("polla_id") REFERENCES "public"."pollas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "special_predictions" ADD CONSTRAINT "special_predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "special_predictions" ADD CONSTRAINT "special_predictions_polla_id_pollas_id_fk" FOREIGN KEY ("polla_id") REFERENCES "public"."pollas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_config" ADD CONSTRAINT "tournament_config_polla_id_pollas_id_fk" FOREIGN KEY ("polla_id") REFERENCES "public"."pollas"("id") ON DELETE cascade ON UPDATE no action;