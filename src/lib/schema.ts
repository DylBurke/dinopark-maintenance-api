import { pgTable, varchar, boolean, timestamp, integer, serial } from 'drizzle-orm/pg-core';

// Park zones (A0-Z15, 26x16 grid = 416 zones total)
export const zones = pgTable('zones', {
  id: varchar('id', { length: 3 }).primaryKey(), // e.g., "A13", "Z15"
  lastMaintenanceDate: timestamp('last_maintenance_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Dinosaurs in the park
export const dinosaurs = pgTable('dinosaurs', {
  id: serial('id').primaryKey(),
  nudlsId: integer('nudls_id').unique(), // I am using this as the ID we get from the NUDLS system
  name: varchar('name', { length: 100 }),
  species: varchar('species', { length: 100 }),
  gender: varchar('gender', { length: 10 }),
  isCarnivore: boolean('is_carnivore').default(false),
  currentLocation: varchar('current_location', { length: 3 }), // Zone ID
  lastFedTime: timestamp('last_fed_time'),
  digestionPeriodHours: integer('digestion_period_hours').default(48), // Making the default digestion period 48 hours
  parkId: integer('park_id').default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Maintenance records for tracking 30-day cycles of doing the maintenance
export const maintenanceRecords = pgTable('maintenance_records', {
  id: serial('id').primaryKey(),
  zoneId: varchar('zone_id', { length: 3 }).notNull(),
  performedAt: timestamp('performed_at').defaultNow(),
  performedBy: varchar('performed_by', { length: 100 }),
  notes: varchar('notes', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Type exports for TypeScript to make it easier for inferring types during usage
export type Zone = typeof zones.$inferSelect;
export type NewZone = typeof zones.$inferInsert;
export type Dinosaur = typeof dinosaurs.$inferSelect;
export type NewDinosaur = typeof dinosaurs.$inferInsert;
export type MaintenanceRecord = typeof maintenanceRecords.$inferSelect;
export type NewMaintenanceRecord = typeof maintenanceRecords.$inferInsert;