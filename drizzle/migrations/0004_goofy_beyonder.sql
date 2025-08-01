ALTER TABLE "maintenance_records" DROP CONSTRAINT "maintenance_records_zone_id_performed_at_unique";--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_zone_id_unique" UNIQUE("zone_id");