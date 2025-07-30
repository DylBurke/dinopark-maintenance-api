import { Router } from 'express';
import type { Router as ExpressRouter, Response } from 'express';
import { db } from '../lib/database';
import { dinosaurs, zones, maintenanceRecords } from '../lib/schema';
import { sql } from 'drizzle-orm';
import type { 
  SystemStatusResponse, 
  SystemHealthResponse, 
  ApiError,
  NudlsStatus
} from '../types/api';

const router: ExpressRouter = Router();

// GET /api/system/status - System health and statistics
router.get('/status', async (_req, res: Response<SystemStatusResponse | ApiError>) => {
  try {
    // Get database statistics
    const [dinoCount] = await db.select({ count: sql<number>`count(*)` }).from(dinosaurs);
    const [zoneCount] = await db.select({ count: sql<number>`count(*)` }).from(zones);
    const [maintenanceCount] = await db.select({ count: sql<number>`count(*)` }).from(maintenanceRecords);
    
    // Get carnivore/herbivore breakdown
    const [carnivoreCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(dinosaurs)
      .where(sql`is_carnivore = true`);
    
    const [herbivoreCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(dinosaurs)
      .where(sql`is_carnivore = false`);
    
    // Get most recent dinosaur update (approximates last NUDLS sync)
    const [latestDino] = await db
      .select({ lastUpdated: dinosaurs.updatedAt })
      .from(dinosaurs)
      .orderBy(sql`updated_at DESC`)
      .limit(1);
    
    // Calculate system health
    const now = new Date();
    const lastUpdate = latestDino?.lastUpdated;
    const minutesSinceUpdate = lastUpdate 
      ? Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60))
      : null;
    
    // Determine NUDLS status based on last update
    let nudlsStatus: NudlsStatus = 'unknown';
    if (minutesSinceUpdate === null) {
      nudlsStatus = 'no_data';
    } else if (minutesSinceUpdate < 5) {
      nudlsStatus = 'healthy';
    } else if (minutesSinceUpdate < 15) {
      nudlsStatus = 'degraded';
    } else {
      nudlsStatus = 'down';
    }
    
    const response: SystemStatusResponse = {
      system: {
        status: 'operational',
        uptime: process.uptime(),
        timestamp: now.toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      },
      database: {
        connected: true,
        statistics: {
          totalDinosaurs: dinoCount.count,
          carnivores: carnivoreCount.count,
          herbivores: herbivoreCount.count,
          zonesWithData: zoneCount.count,
          maintenanceRecords: maintenanceCount.count
        }
      },
      nudls: {
        status: nudlsStatus,
        lastUpdate: lastUpdate?.toISOString() || null,
        minutesSinceUpdate,
        statusDescription: {
          healthy: 'Data updated within 5 minutes',
          degraded: 'Data updated 5-15 minutes ago',
          down: 'No data updates for >15 minutes',
          no_data: 'No dinosaur data in system',
          unknown: 'Unable to determine status'
        }[nudlsStatus]
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 3000
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting system status:', error);
    const errorResponse: ApiError = {
      error: 'Failed to retrieve system status',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(errorResponse);
  }
});

// GET /api/system/health - Lightweight health check
router.get('/health', async (_req, res: Response<SystemHealthResponse>) => {
  try {
    // Quick database connectivity check
    await db.select({ count: sql<number>`count(*)` }).from(zones).limit(1);
    
    const response: SystemHealthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };

    res.json(response);
  } catch (error) {
    console.error('Health check failed:', error);
    const errorResponse: SystemHealthResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      error: 'Database connectivity issue'
    };
    res.status(503).json(errorResponse);
  }
});

export default router;