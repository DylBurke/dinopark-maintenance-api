import { Router } from 'express';
import type { Router as ExpressRouter, Response } from 'express';
import { db } from '../lib/database';
import { zones, dinosaurs } from '../lib/schema';
import { calculateZoneSafety, isMaintenanceNeeded } from '../lib/safety-and-maintenance';
import { eq } from 'drizzle-orm';
import type { 
  ZoneGridResponse, 
  ZoneDetailResponse, 
  ApiError 
} from '../types/api';

const router: ExpressRouter = Router();


// GET /api/zones/grid - Formatted grid data for frontend visualization
router.get('/grid', async (_req, res: Response<ZoneGridResponse | ApiError>) => {
  try {
    // Get all zones from database
    const allZones = await db.select().from(zones);
    const zoneMap = new Map(allZones.map(zone => [zone.id, zone]));
    
    // Generate grid structure (26 columns × 16 rows)
    const columns = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const rows = Array.from({ length: 16 }, (_, i) => i);
    
    const grid = await Promise.all(
      rows.map(async (row) => {
        const rowData = await Promise.all(
          columns.map(async (column) => {
            const zoneId = `${column}${row}`;
            const zoneData = zoneMap.get(zoneId);
            const safe = await calculateZoneSafety(zoneId);
            const needsMaintenance = isMaintenanceNeeded(zoneData?.lastMaintenanceDate || null);
            
            return {
              id: zoneId,
              column,
              row,
              safe,
              needsMaintenance,
              lastMaintenanceDate: zoneData?.lastMaintenanceDate || null,
              status: safe ? (needsMaintenance ? 'safe_needs_maintenance' as const : 'safe' as const) : 'unsafe' as const
            };
          })
        );
        return rowData;
      })
    );

    const response: ZoneGridResponse = {
      grid,
      metadata: {
        columns: columns.length,
        rows: rows.length,
        totalZones: columns.length * rows.length,
        lastUpdated: new Date().toISOString()
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error generating grid:', error);
    const errorResponse: ApiError = {
      error: 'Failed to generate grid data',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(errorResponse);
  }
});

// GET /api/zones/:id - Get specific zone details
router.get('/:id', async (req, res: Response<ZoneDetailResponse | ApiError>) => {
  try {
    const zoneId = req.params.id.toUpperCase();
    
    // Validate zone ID format (A0-Z15)
    if (!/^[A-Z]\d{1,2}$/.test(zoneId)) {
      const errorResponse: ApiError = {
        error: 'Invalid zone ID format. Expected format: A0-Z15',
        timestamp: new Date().toISOString(),
        provided: req.params.id
      };
      return res.status(400).json(errorResponse);
    }
    
    // Check if zone ID is within valid range
    const column = zoneId.charAt(0);
    const row = parseInt(zoneId.slice(1));
    if (column > 'Z' || row > 15) {
      const errorResponse: ApiError = {
        error: 'Zone not found. Valid range: A0-Z15',
        timestamp: new Date().toISOString(),
        provided: zoneId
      };
      return res.status(404).json(errorResponse);
    }
    
    // Get zone data
    const zoneData = await db.select().from(zones).where(eq(zones.id, zoneId)).limit(1);
    const safe = await calculateZoneSafety(zoneId);
    const needsMaintenance = isMaintenanceNeeded(zoneData[0]?.lastMaintenanceDate || null);
    
    // Get all dinosaurs in this zone
    const dinosaursInZone = await db
      .select()
      .from(dinosaurs)
      .where(eq(dinosaurs.currentLocation, zoneId));
    
    const carnivores = dinosaursInZone.filter(dino => dino.isCarnivore);
    const herbivores = dinosaursInZone.filter(dino => !dino.isCarnivore);
    
    const response: ZoneDetailResponse = {
      id: zoneId,
      safe,
      needsMaintenance,
      lastMaintenanceDate: zoneData[0]?.lastMaintenanceDate || null,
      dinosaurs: {
        total: dinosaursInZone.length,
        carnivores: carnivores.map(dino => ({
          id: dino.id,
          nudlsId: dino.nudlsId,
          name: dino.name,
          species: dino.species,
          lastFedTime: dino.lastFedTime,
          digestionPeriodHours: dino.digestionPeriodHours,
          isDigesting: dino.lastFedTime ? 
            (new Date().getTime() - dino.lastFedTime.getTime()) / (1000 * 60 * 60) < (dino.digestionPeriodHours ?? 48)
            : false
        })),
        herbivores: herbivores.map(dino => ({
          id: dino.id,
          nudlsId: dino.nudlsId,
          name: dino.name,
          species: dino.species
        }))
      },
      safetyReason: safe 
        ? (carnivores.length === 0 ? 'No carnivores present' : 'All carnivores are digesting')
        : 'Carnivores present and not digesting',
      lastUpdated: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching zone details:', error);
    const errorResponse: ApiError = {
      error: 'Failed to fetch zone details',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(errorResponse);
  }
});

export default router;