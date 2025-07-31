// NUDLS Event Processors - Handle each type of NUDLS event and updates my database accordingly

import { db } from '../lib/database';
import { dinosaurs, zones, maintenanceRecords } from '../lib/schema';
import { eq } from 'drizzle-orm';
import type {
  DinoAddedEvent,
  DinoRemovedEvent,
  DinoLocationUpdatedEvent,
  DinoFedEvent,
  MaintenancePerformedEvent,
  NudlsEvent
} from '../types/nudls';

export class NudlsEventProcessors {
  /**
   * Process dino_added event - Add new dinosaur or update identity fields only
   */
  static async processDinoAdded(event: DinoAddedEvent): Promise<void> {
    try {
      await db.insert(dinosaurs).values({
        nudlsId: event.id,
        name: event.name,
        species: event.species,
        gender: event.gender,
        herbivore: event.herbivore,
        digestionPeriodHours: event.digestion_period_in_hours,
        parkId: event.park_id,
        currentLocation: null, // Will be set by location_updated events when they come in
        lastFedTime: null, // Will be set by fed events when they come in
        createdAt: new Date(event.time),
        updatedAt: new Date(event.time)
      }).onConflictDoUpdate({
        target: dinosaurs.nudlsId,
        set: {
          // Only update identity/metadata fields, to preserve operational data and not overwrite important last fed time and current location
          name: event.name,
          species: event.species,
          gender: event.gender,
          herbivore: event.herbivore,
          digestionPeriodHours: event.digestion_period_in_hours,
          parkId: event.park_id,
          updatedAt: new Date(event.time)
          // Don't overwrite: currentLocation, lastFedTime (preserve existing operational data)
        }
      });

      console.log(`✅ Added/Updated dinosaur: ${event.name} (NUDLS ID: ${event.id})`);
    } catch (error) {
      console.error(`❌ Error processing dino_added event:`, error);
      throw error;
    }
  }

  /**
   * Process dino_removed event - Remove dinosaur from database (skip if doesn't exist)
   */
  static async processDinoRemoved(event: DinoRemovedEvent): Promise<void> {
    try {
      // Validate event data
      if (!event.id || event.id === undefined || event.id === null) {
        console.log(`⏭️ Skipped removal: Invalid dinosaur ID in event (${event.id})`);
        return;
      }

      // First check if the dinosaur exists
      const existingDinosaur = await db
        .select({ name: dinosaurs.name, nudlsId: dinosaurs.nudlsId })
        .from(dinosaurs)
        .where(eq(dinosaurs.nudlsId, event.id))
        .limit(1);

      if (existingDinosaur.length === 0) {
        // Dinosaur doesn't exist - skip gracefully
        console.log(`⏭️ Skipped removal: Dinosaur ${event.id} not in our database (likely never added or already removed)`);
        return;
      }

      // Dinosaur exists - proceed with removal
      const result = await db
        .delete(dinosaurs)
        .where(eq(dinosaurs.nudlsId, event.id))
        .returning({ name: dinosaurs.name });

      const displayName = result[0]?.name || `Dinosaur ${event.id}`;
      console.log(`✅ Removed dinosaur: ${displayName} (NUDLS ID: ${event.id})`);
    } catch (error) {
      // If we still get an error, just skip gracefully rather than crashing
      console.log(`⏭️ Skipped problematic removal event: ${(error as Error).message} (NUDLS ID: ${event.id})`);
      // Don't re-throw the error - just continue processing other events
    }
  }

  /**
   * Process dino_location_updated event - Update or create dinosaur with location
   */
  static async processDinoLocationUpdated(event: DinoLocationUpdatedEvent): Promise<void> {
    try {
      // Validate required fields
      if (!event.dinosaur_id || event.dinosaur_id === undefined || event.dinosaur_id === null) {
        console.log(`⏭️ Skipped location update: Invalid dinosaur_id in event (${event.dinosaur_id})`);
        return;
      }
      
      if (!event.location) {
        console.log(`⏭️ Skipped location update: Invalid location in event for dinosaur ${event.dinosaur_id}`);
        return;
      }

      const result = await db.insert(dinosaurs).values({
        nudlsId: event.dinosaur_id,
        currentLocation: event.location,
        parkId: event.park_id,
        createdAt: new Date(event.time),
        updatedAt: new Date(event.time)
        // Other fields will use schema defaults
      }).onConflictDoUpdate({
        target: dinosaurs.nudlsId,
        set: {
          currentLocation: event.location,
          updatedAt: new Date(event.time)
          // Don't overwrite: name, species, herbivore, lastFedTime, etc.
        }
      }).returning({ name: dinosaurs.name, nudlsId: dinosaurs.nudlsId });

      const dinosaur = result[0];
      const displayName = dinosaur.name || `Dinosaur ${dinosaur.nudlsId}`;
      console.log(`✅ Updated location: ${displayName} → Zone ${event.location}`);
    } catch (error) {
      console.error(`❌ Error processing dino_location_updated event:`, error);
      // Don't throw - log and continue to avoid crashing the whole system
      console.log(`⏭️ Skipped problematic location update for dinosaur ${event.dinosaur_id}`);
    }
  }

  /**
   * Process dino_fed event - Update or create dinosaur with feeding time
   */
  static async processDinoFed(event: DinoFedEvent): Promise<void> {
    try {
      // Validate required fields
      if (!event.dinosaur_id || event.dinosaur_id === undefined || event.dinosaur_id === null) {
        console.log(`⏭️ Skipped feeding: Invalid dinosaur_id in event (${event.dinosaur_id})`);
        return;
      }

      const result = await db.insert(dinosaurs).values({
        nudlsId: event.dinosaur_id,
        lastFedTime: new Date(event.time),
        parkId: event.park_id,
        createdAt: new Date(event.time),
        updatedAt: new Date(event.time)
        // Other fields will use schema defaults
      }).onConflictDoUpdate({
        target: dinosaurs.nudlsId,
        set: {
          lastFedTime: new Date(event.time),
          updatedAt: new Date(event.time)
          // Don't overwrite: name, species, herbivore, currentLocation, etc.
        }
      }).returning({ name: dinosaurs.name, herbivore: dinosaurs.herbivore, nudlsId: dinosaurs.nudlsId });

      const dinosaur = result[0];
      const displayName = dinosaur.name || `Dinosaur ${dinosaur.nudlsId}`;
      const dinoType = dinosaur.herbivore ? '🦕 Herbivore' : '🦖 Carnivore';
      console.log(`✅ Fed dinosaur: ${displayName} ${dinoType} at ${event.time}`);
    } catch (error) {
      console.error(`❌ Error processing dino_fed event:`, error);
      // Don't throw - log and continue to avoid crashing the whole system
      console.log(`⏭️ Skipped problematic feeding event for dinosaur ${event.dinosaur_id}`);
    }
  }

  /**
   * Process maintenance_performed event - Record maintenance and update zone
   */
  static async processMaintenancePerformed(event: MaintenancePerformedEvent): Promise<void> {
    try {
      // Record the maintenance event with upsert to prevent duplicates
      await db.insert(maintenanceRecords).values({
        zoneId: event.location,
        performedAt: new Date(event.time),
        performedBy: 'NUDLS System',
        notes: `Maintenance performed via NUDLS event at ${event.time}`,
        createdAt: new Date(event.time)
      }).onConflictDoNothing(); // Skip if already exists (idempotent)

      // Update or insert the zone with new maintenance date
      await db.insert(zones).values({
        id: event.location,
        lastMaintenanceDate: new Date(event.time),
        createdAt: new Date(event.time),
        updatedAt: new Date(event.time)
      }).onConflictDoUpdate({
        target: zones.id,
        set: {
          lastMaintenanceDate: new Date(event.time),
          updatedAt: new Date(event.time)
        }
      });

      console.log(`✅ Recorded maintenance: Zone ${event.location} at ${event.time}`);
    } catch (error) {
      console.error(`❌ Error processing maintenance_performed event:`, error);
      throw error;
    }
  }

  /**
   * Main event processor - Route events to appropriate handlers
   */
  static async processEvent(event: NudlsEvent): Promise<void> {
    console.log(`🔄 Processing ${event.kind} event (Park ${event.park_id})`);

    try {
      switch (event.kind) {
        case 'dino_added':
          await this.processDinoAdded(event);
          break;
        case 'dino_removed':
          await this.processDinoRemoved(event);
          break;
        case 'dino_location_updated':
          await this.processDinoLocationUpdated(event);
          break;
        case 'dino_fed':
          await this.processDinoFed(event);
          break;
        case 'maintenance_performed':
          await this.processMaintenancePerformed(event);
          break;
        default:
          console.warn(`⚠️ Unknown event type: ${(event as any).kind}`);
      }
    } catch (error) {
      console.error(`❌ Failed to process ${event.kind} event:`, error);
      throw error;
    }
  }

  /**
   * Process array of events (typical NUDLS feed response)
   */
  static async processEvents(events: NudlsEvent[]): Promise<{
    processed: number;
    failed: number;
    errors: Error[];
  }> {
    let processed = 0;
    let failed = 0;
    const errors: Error[] = [];

    console.log(`📦 Processing ${events.length} NUDLS events...`);

    for (const event of events) {
      try {
        await this.processEvent(event);
        processed++;
      } catch (error) {
        failed++;
        errors.push(error as Error);
      }
    }

    console.log(`✅ Processed: ${processed}, ❌ Failed: ${failed}`);
    return { processed, failed, errors };
  }
}