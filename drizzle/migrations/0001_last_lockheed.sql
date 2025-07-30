ALTER TABLE "dinosaurs" RENAME COLUMN "is_carnivore" TO "herbivore";--> statement-breakpoint
UPDATE "dinosaurs" SET "herbivore" = NOT "herbivore";--> statement-breakpoint
ALTER TABLE "dinosaurs" ALTER COLUMN "herbivore" SET DEFAULT true;