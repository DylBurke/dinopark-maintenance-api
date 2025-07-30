// API Response Types for Dinopark Maintenance API

// Common types
export interface ApiError {
  error: string;
  timestamp: string;
  [key: string]: any;
}

export interface CarnivoreInfo {
  id: number;
  name: string | null;
  species: string | null;
  lastFedTime: Date | null;
  digestionPeriodHours: number | null;
  isDigesting?: boolean;
}

// Zone-related types

export interface ZoneGridCell {
  id: string;
  column: string;
  row: number;
  safe: boolean;
  needsMaintenance: boolean;
  lastMaintenanceDate: Date | null;
  status: 'safe' | 'safe_needs_maintenance' | 'unsafe';
}

export interface ZoneDetail {
  id: string;
  safe: boolean;
  needsMaintenance: boolean;
  lastMaintenanceDate: Date | null;
  dinosaurs: {
    total: number;
    carnivores: Array<CarnivoreInfo & { nudlsId: number | null; isDigesting: boolean }>;
    herbivores: Array<{
      id: number;
      nudlsId: number | null;
      name: string | null;
      species: string | null;
    }>;
  };
  safetyReason: string;
  lastUpdated: string;
}

// API Response types

export interface ZoneGridResponse {
  grid: ZoneGridCell[][];
  metadata: {
    columns: number;
    rows: number;
    totalZones: number;
    lastUpdated: string;
  };
}

export interface ZoneDetailResponse extends ZoneDetail {}

// System status types
export type NudlsStatus = 'healthy' | 'degraded' | 'down' | 'no_data' | 'unknown';

export interface SystemStatusResponse {
  system: {
    status: 'operational' | 'error';
    uptime: number;
    timestamp: string;
    version: string;
  };
  database: {
    connected: boolean;
    statistics: {
      totalDinosaurs: number;
      carnivores: number;
      herbivores: number;
      zonesWithData: number;
      maintenanceRecords: number;
    };
  };
  nudls: {
    status: NudlsStatus;
    lastUpdate: string | null;
    minutesSinceUpdate: number | null;
    statusDescription: string;
    serviceStats: {
      isRunning: boolean;
      totalEvents: number;
      consecutiveFailures: number;
      eventsProcessed: {
        dino_added: number;
        dino_removed: number;
        dino_location_updated: number;
        dino_fed: number;
        maintenance_performed: number;
      };
    };
  };
  environment: {
    nodeEnv: string;
    port: string | number;
  };
}

export interface SystemHealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  error?: string;
}

// API Root response
export interface ApiRootResponse {
  message: string;
  version: string;
  documentation: string;
  endpoints: {
    zones: {
      grid: string; // Main endpoint for FE devs to use
      single: string; // Bonus endpoint incase the FE devs want to allow for clicking into a specifc zone on the grid
    };
    system: {
      status: string; // Endpoint to view stats on the overall status of the system
      health: string; // Basic health check of the system
    };
  };
  grid: {
    description: string;
    format: string;
  };
}