import { db } from "./database";
import { dinosaurs, zones } from "./schema";
import { eq, and } from "drizzle-orm";

/**
 * Calculate if a zone is safe for maintenance workers to enter
 * Safe = No carnivores present OR all carnivores are still digesting
 */
export async function calculateZoneSafety(zoneId: string): Promise<boolean> {
  try {
    // Get all carnivores currently in this zone
    const carnivoresInZone = await db
      .select()
      .from(dinosaurs)
      .where(
        and(
          eq(dinosaurs.currentLocation, zoneId),
          eq(dinosaurs.herbivore, false)
        )
      );

    // If no carnivores in zone, it's safe
    if (carnivoresInZone.length === 0) {
      return true;
    }

    // Check if all carnivores are still digesting their last meal
    const now = new Date();
    return carnivoresInZone.every((carnivore) => {
      // If no feeding time recorded, assume unsafe
      if (!carnivore.lastFedTime) {
        return false;
      }

      const hoursSinceFeeding =
        (now.getTime() - carnivore.lastFedTime.getTime()) / (1000 * 60 * 60);

      // Safe if still within digestion period
      // Use default of 12 hours as a safety if digestionPeriodHours is null
      const digestionPeriod = carnivore.digestionPeriodHours ?? 12;
      return hoursSinceFeeding < digestionPeriod;
    });
  } catch (error) {
    console.error(`Error calculating safety for zone ${zoneId}:`, error);
    // Fail safe: return false if we can't determine safety
    return false;
  }
}

/**
 * Check if a zone needs maintenance (every 30 days)
 */
export function isMaintenanceNeeded(lastMaintenanceDate: Date | null): boolean {
  if (!lastMaintenanceDate) {
    return true; // Never been maintained
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return lastMaintenanceDate < thirtyDaysAgo;
}

/**
 * Generate all possible zone IDs (A0-Z15)
 */
export function generateAllZoneIds(): string[] {
  const zones: string[] = [];
  const columns = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  for (const column of columns) {
    for (let row = 0; row <= 15; row++) {
      zones.push(`${column}${row}`);
    }
  }

  return zones;
}
