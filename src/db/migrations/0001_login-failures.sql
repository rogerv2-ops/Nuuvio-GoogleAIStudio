CREATE TABLE "login_failures" (
	"email" text PRIMARY KEY NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"locked_until" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
