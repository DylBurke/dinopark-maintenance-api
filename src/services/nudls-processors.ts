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
   * Helper to check if location has actually changed
   */
  private static async hasLocationChanged(nudlsId: number, newLocation: string): Promise<boolean> {
    const existing = await db
      .select({ currentLocation: dinosaurs.currentLocation })
      .from(dinosaurs)
      .where(eq(dinosaurs.nudlsId, nudlsId))
      .limit(1);
    
    return existing.length === 0 || existing[0].currentLocation !== newLocation;
  }

  /**
   * Helper to check if feeding time has actually changed
   */
  private static async hasFeedingChanged(nudlsId: number, newFeedTime: Date): Promise<boolean> {
    const existing = await db
      .select({ lastFedTime: dinosaurs.lastFedTime })
      .from(dinosaurs)
      .where(eq(dinosaurs.nudlsId, nudlsId))
      .limit(1);
    
    if (existing.length === 0) return true; // New record
    
    const currentFeedTime = existing[0].lastFedTime;
    return !currentFeedTime || currentFeedTime.getTime() !== newFeedTime.getTime();
  }

  /**
   * Helper to check if maintenance time has actually changed
   */
  private static async hasMaintenanceChanged(zoneId: string, newPerformedAt: Date): Promise<boolean> {
    const existing = await db
      .select({ performedAt: maintenanceRecords.performedAt })
      .from(maintenanceRecords)
      .where(eq(maintenanceRecords.zoneId, zoneId))
      .limit(1);
    
    if (existing.length === 0) return true; // New record
    
    const currentPerformedAt = existing[0].performedAt;
    return !currentPerformedAt || currentPerformedAt.getTime() !== newPerformedAt.getTime();
  }

  /**
   * Helper to check if dinosaur identity data has actually changed
   */
  private static async hasDinosaurIdentityChanged(nudlsId: number, updates: {
    name: string | null;
    species: string | null;
    gender: string | null;
    herbivore: boolean;
    digestionPeriodHours: number;
    parkId: number;
  }): Promise<boolean> {
    const existing = await db
      .select({
        name: dinosaurs.name,
        species: dinosaurs.species,
        gender: dinosaurs.gender,
        herbivore: dinosaurs.herbivore,
        digestionPeriodHours: dinosaurs.digestionPeriodHours,
        parkId: dinosaurs.parkId
      })
      .from(dinosaurs)
      .where(eq(dinosaurs.nudlsId, nudlsId))
      .limit(1);
    
    if (existing.length === 0) return true; // New record
    
    const current = existing[0];
    return (
      current.name !== updates.name ||
      current.species !== updates.species ||
      current.gender !== updates.gender ||
      current.herbivore !== updates.herbivore ||
      current.digestionPeriodHours !== updates.digestionPeriodHours ||
      current.parkId !== updates.parkId
    );
  }

  /**
   * Process dino_added event - Add new dinosaur or update identity fields only
   */
  static async processDinoAdded(event: DinoAddedEvent): Promise<void> {
    try {
      // Check if dinosaur identity data actually changed
      const identityChanged = await this.hasDinosaurIdentityChanged(event.id, {
        name: event.name,
        species: event.species,
        gender: event.gender,
        herbivore: event.herbivore,
        digestionPeriodHours: event.digestion_period_in_hours,
        parkId: event.park_id
      });

      if (!identityChanged) {
        console.log(`⏭️ Skipped dino_added: No identity changes for ${event.name} (NUDLS ID: ${event.id})`);
        return;
      }

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
        createdAt: new Date(event.time), // Time the event was recorded by NUDLS system, correlating to our system
        updatedAt: new Date() // Current timestamp when record is created
      }).onConflictDoUpdate({
        target: dinosaurs.nudlsId,
        set: {
          // Update identity fields (may be null from out-of-order events such as dino_fed coming first)
          name: event.name,
          species: event.species,
          gender: event.gender,
          herbivore: event.herbivore,
          digestionPeriodHours: event.digestion_period_in_hours,
          parkId: event.park_id,
          updatedAt: new Date()
          // Don't overwrite: currentLocation, lastFedTime (preserve operational data)
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

      // Check if location actually changed
      const locationChanged = await this.hasLocationChanged(event.dinosaur_id, event.location);
      if (!locationChanged) {
        console.log(`⏭️ Skipped location update: Dinosaur ${event.dinosaur_id} already at Zone ${event.location}`);
        return;
      }

      const result = await db.insert(dinosaurs).values({
        nudlsId: event.dinosaur_id,
        currentLocation: event.location,
        parkId: event.park_id,
        createdAt: new Date(event.time),
        updatedAt: new Date() // Current timestamp when record is created
        // Other fields will use schema defaults
      }).onConflictDoUpdate({
        target: dinosaurs.nudlsId,
        set: {
          currentLocation: event.location,
          updatedAt: new Date() // Current timestamp when record is updated
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

      // Check if feeding time actually changed
      const newFeedTime = new Date(event.time);
      const feedingChanged = await this.hasFeedingChanged(event.dinosaur_id, newFeedTime);
      if (!feedingChanged) {
        console.log(`⏭️ Skipped feeding: Dinosaur ${event.dinosaur_id} already has same feeding time`);
        return;
      }

      const result = await db.insert(dinosaurs).values({
        nudlsId: event.dinosaur_id,
        lastFedTime: newFeedTime,
        parkId: event.park_id,
        createdAt: new Date(event.time), // Time the event was recorded by NUDLS system, correlating to our system
        updatedAt: new Date() // Current timestamp when record is created
        // Other fields will use schema defaults
      }).onConflictDoUpdate({
        target: dinosaurs.nudlsId,
        set: {
          lastFedTime: newFeedTime,
          updatedAt: new Date() // Current timestamp when record is updated
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
      // Use original timestamp without rounding
      const performedTime = new Date(event.time);
      
      // Check if maintenance time actually changed
      const maintenanceChanged = await this.hasMaintenanceChanged(event.location, performedTime);
      if (!maintenanceChanged) {
        console.log(`⏭️ Skipped maintenance: Zone ${event.location} already has same maintenance time`);
        return;
      }
      
      // Record the maintenance event with upsert to keep latest timestamp
      await db.insert(maintenanceRecords).values({
        zoneId: event.location,
        performedAt: performedTime,
        performedBy: 'NUDLS System',
        notes: `Maintenance performed via NUDLS event at ${event.time}`,
        createdAt: new Date(), // When I created this record
        updatedAt: new Date()  // When I last updated this record
      }).onConflictDoUpdate({
        target: maintenanceRecords.zoneId,
        set: {
          performedAt: performedTime, // When maintenance was actually performed
          notes: `Maintenance performed via NUDLS event at ${event.time}`,
          updatedAt: new Date() // When I last updated this record
        }
      });

      // Update or insert the zone with new maintenance date
      await db.insert(zones).values({
        id: event.location,
        lastMaintenanceDate: performedTime,
        createdAt: new Date(), // Current timestamp when zone record is created
        updatedAt: new Date() // Current timestamp when record is created
      }).onConflictDoUpdate({
        target: zones.id,
        set: {
          lastMaintenanceDate: performedTime,
          updatedAt: new Date() // Current timestamp when record is updated
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