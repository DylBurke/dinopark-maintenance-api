import request from 'supertest';

// Mock the database module
jest.mock('../src/lib/database', () => ({
  db: {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockResolvedValue([])
    })
  },
  closeConnection: jest.fn()
}));

// Mock the safety calculation functions
jest.mock('../src/lib/safety-and-maintenance', () => ({
  calculateZoneSafety: jest.fn(),
  isMaintenanceNeeded: jest.fn(),
  generateAllZoneIds: jest.fn()
}));

// Mock the NUDLS service to prevent it from starting
jest.mock('../src/services/nudls', () => ({
  NudlsService: {
    getInstance: () => ({
      start: jest.fn(),
      stop: jest.fn()
    })
  }
}));

import app from '../src/index';
import { calculateZoneSafety, isMaintenanceNeeded } from '../src/lib/safety-and-maintenance';
import { db } from '../src/lib/database';

const mockCalculateZoneSafety = calculateZoneSafety as jest.MockedFunction<typeof calculateZoneSafety>;
const mockIsMaintenanceNeeded = isMaintenanceNeeded as jest.MockedFunction<typeof isMaintenanceNeeded>;
const mockDb = db as jest.Mocked<typeof db>;

describe('Zones API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Force jest to exit
    jest.restoreAllMocks();
  });

  describe('GET /api/zones/grid', () => {
    it('should return correct grid structure with 26x16 zones', async () => {
      // Mock database response - no existing zones
      mockDb.select.mockReturnValue({
        from: jest.fn().mockResolvedValue([])
      } as any);
      
      // Mock safety calculations - all zones safe, no maintenance needed
      mockCalculateZoneSafety.mockResolvedValue(true);
      mockIsMaintenanceNeeded.mockReturnValue(false);

      const response = await request(app)
        .get('/api/zones/grid')
        .expect(200);

      expect(response.body).toHaveProperty('grid');
      expect(response.body).toHaveProperty('metadata');
      
      // Check grid structure
      expect(response.body.grid).toHaveLength(16); // 16 rows
      expect(response.body.grid[0]).toHaveLength(26); // 26 columns
      
      // Check metadata
      expect(response.body.metadata).toEqual({
        columns: 26,
        rows: 16,
        totalZones: 416,
        lastUpdated: expect.any(String)
      });
    });

    it('should return correct zone data structure for each cell', async () => {
      // Mock database response
      mockDb.select.mockReturnValue({
        from: jest.fn().mockResolvedValue([
          { 
            id: 'A0', 
            lastMaintenanceDate: new Date('2025-01-01T00:00:00.000Z') 
          }
        ])
      } as any);
      
      mockCalculateZoneSafety.mockResolvedValue(true);
      mockIsMaintenanceNeeded.mockReturnValue(false);

      const response = await request(app)
        .get('/api/zones/grid')
        .expect(200);

      // Check first zone (A0) structure
      const firstZone = response.body.grid[0][0];
      expect(firstZone).toEqual({
        id: 'A0',
        column: 'A',
        row: 0,
        safe: true,
        needsMaintenance: false,
        lastMaintenanceDate: '2025-01-01T00:00:00.000Z',
        status: 'safe'
      });
    });

    it('should handle zones with maintenance data correctly', async () => {
      const maintenanceDate = new Date('2025-01-15T10:00:00.000Z');
      
      // Mock database with zone that has maintenance data
      mockDb.select.mockReturnValue({
        from: jest.fn().mockResolvedValue([
          { 
            id: 'B5', 
            lastMaintenanceDate: maintenanceDate 
          }
        ])
      } as any);
      
      mockCalculateZoneSafety.mockResolvedValue(true);
      mockIsMaintenanceNeeded.mockReturnValue(true); // needs maintenance

      const response = await request(app)
        .get('/api/zones/grid')
        .expect(200);

      // Find zone B5 in the grid (row 5, column B = index 1)
      const zoneB5 = response.body.grid[5][1];
      
      expect(zoneB5).toEqual({
        id: 'B5',
        column: 'B',
        row: 5,
        safe: true,
        needsMaintenance: true,
        lastMaintenanceDate: maintenanceDate.toISOString(),
        status: 'safe_needs_maintenance'
      });
    });

    it('should handle unsafe zones correctly', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockResolvedValue([])
      } as any);
      
      mockCalculateZoneSafety.mockResolvedValue(false); // unsafe
      mockIsMaintenanceNeeded.mockReturnValue(false);

      const response = await request(app)
        .get('/api/zones/grid')
        .expect(200);

      const firstZone = response.body.grid[0][0];
      expect(firstZone.safe).toBe(false);
      expect(firstZone.status).toBe('unsafe');
    });

    it('should handle database errors gracefully', async () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock database error
      mockDb.select.mockReturnValue({
        from: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      } as any);

      const response = await request(app)
        .get('/api/zones/grid')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to generate grid data',
        timestamp: expect.any(String)
      });
      
      // Restore console.error
      consoleSpy.mockRestore();
    });

    it('should call safety calculation for each zone', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockResolvedValue([])
      } as any);
      
      mockCalculateZoneSafety.mockResolvedValue(true);
      mockIsMaintenanceNeeded.mockReturnValue(false);

      await request(app)
        .get('/api/zones/grid')
        .expect(200);

      // Should call calculateZoneSafety 416 times (26×16)
      expect(mockCalculateZoneSafety).toHaveBeenCalledTimes(416);
      
      // Check some specific zone IDs are called
      expect(mockCalculateZoneSafety).toHaveBeenCalledWith('A0');
      expect(mockCalculateZoneSafety).toHaveBeenCalledWith('Z15');
      expect(mockCalculateZoneSafety).toHaveBeenCalledWith('M7');
    });
  });

  describe('GET /api/zones/:id', () => {
    it('should reject invalid zone ID format', async () => {
      const response = await request(app)
        .get('/api/zones/INVALID')
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid zone ID format. Expected format: A0-Z15',
        timestamp: expect.any(String),
        provided: 'INVALID'
      });
    });

    it('should reject zone ID outside valid range', async () => {
      const response = await request(app)
        .get('/api/zones/A99')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Zone not found. Valid range: A0-Z15',
        timestamp: expect.any(String),
        provided: 'A99'
      });
    });
  });
});