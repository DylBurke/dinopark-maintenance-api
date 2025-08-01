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
      .where(sql`herbivore = false`);
    
    const [herbivoreCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(dinosaurs)
      .where(sql`herbivore = true`);
    
    // Determine NUDLS status based on database content (once off seeding approach until we get webhook)
    const now = new Date();
    let nudlsStatus: NudlsStatus = 'unknown';
    
    // Check if we have dinosaur data (indicates successful seeding)
    if (dinoCount.count > 0) {
      nudlsStatus = 'healthy'; // Database has been seeded with NUDLS data
    } else {
      nudlsStatus = 'no_data'; // Database not seeded yet
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
        lastUpdate: null, // This will change from null when we get a webhook posting events
        minutesSinceUpdate: null,
        statusDescription: {
          healthy: 'Database seeded with NUDLS historical events',
          degraded: 'Partial data available',
          down: 'Failed to seed NUDLS data',
          no_data: 'Database not seeded - run: npm run seed',
          unknown: 'Unable to determine status'
        }[nudlsStatus],
        serviceStats: {
          consecutiveFailures: 0,
          databaseRecords: {
            dinosaurs: dinoCount.count,
            maintenanceRecords: maintenanceCount.count,
            zones: zoneCount.count
          }
        }
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