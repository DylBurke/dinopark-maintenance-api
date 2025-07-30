import { Router } from 'express';
import type { Router as ExpressRouter, Response } from 'express';
import { db } from '../lib/database';
import { dinosaurs, zones, maintenanceRecords } from '../lib/schema';
import { sql } from 'drizzle-orm';
import { NudlsService } from '../services/nudls';
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
    
    // Get NUDLS service status
    const nudlsService = NudlsService.getInstance();
    const nudlsServiceStatus = nudlsService.getStatus();
    
    // Calculate system health
    const now = new Date();
    const lastUpdate = nudlsServiceStatus.lastSuccessfulPoll;
    const minutesSinceUpdate = lastUpdate 
      ? Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60))
      : null;
    
    // Determine NUDLS status based on service status and last update
    let nudlsStatus: NudlsStatus = 'unknown';
    if (!nudlsServiceStatus.isRunning) {
      nudlsStatus = 'down';
    } else if (minutesSinceUpdate === null) {
      nudlsStatus = 'no_data';
    } else if (minutesSinceUpdate < 2) {
      nudlsStatus = 'healthy';
    } else if (minutesSinceUpdate < 10) {
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
          healthy: 'Service running, data updated within 2 minutes',
          degraded: 'Service running, data updated 2-10 minutes ago',
          down: 'Service not running or no data for >10 minutes',
          no_data: 'Service running but no data received yet',
          unknown: 'Unable to determine status'
        }[nudlsStatus],
        serviceStats: {
          isRunning: nudlsServiceStatus.isRunning,
          totalEvents: nudlsServiceStatus.totalEvents,
          consecutiveFailures: nudlsServiceStatus.consecutiveFailures,
          eventsProcessed: nudlsServiceStatus.eventsProcessed
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