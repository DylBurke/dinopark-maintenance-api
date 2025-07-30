CREATE TABLE IF NOT EXISTS "dinosaurs" (
	"id" serial PRIMARY KEY NOT NULL,
	"nudls_id" integer,
	"name" varchar(100),
	"species" varchar(100),
	"gender" varchar(10),
	"is_carnivore" boolean DEFAULT false,
	"current_location" varchar(3),
	"last_fed_time" timestamp,
	"digestion_period_hours" integer DEFAULT 12,
	"park_id" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dinosaurs_nudls_id_unique" UNIQUE("nudls_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "maintenance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone_id" varchar(3) NOT NULL,
	"performed_at" timestamp DEFAULT now(),
	"performed_by" varchar(100),
	"notes" varchar(500),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zones" (
	"id" varchar(3) PRIMARY KEY NOT NULL,
	"last_maintenance_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
