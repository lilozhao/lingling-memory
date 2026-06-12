CREATE TABLE "community_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"community" text NOT NULL,
	"forum" text DEFAULT 'heritage' NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"author" text DEFAULT '聆灵' NOT NULL,
	"remote_id" text,
	"remote_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_msg" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
