// Mock the database module to avoid connection requirements
jest.mock('../src/lib/database', () => ({
  db: {},
  closeConnection: jest.fn()
}));

import { isMaintenanceNeeded, generateAllZoneIds } from '../src/lib/safety-and-maintenance';

describe('Zone Safety Logic', () => {
  describe('Zone Generation', () => {
    it('should generate exactly 416 zones (A0-Z15)', () => {
      const zones = generateAllZoneIds();
      expect(zones).toHaveLength(416); // 26 columns × 16 rows
      expect(zones).toContain('A0');
      expect(zones).toContain('Z15');
    });
  });

  describe('Maintenance Scheduling', () => {
    it('should require maintenance for zones never maintained', () => {
      expect(isMaintenanceNeeded(null)).toBe(true);
    });

    it('should require maintenance after 30 days', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);
      expect(isMaintenanceNeeded(oldDate)).toBe(true);
    });

    it('should not require maintenance within 30 days', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 15);
      expect(isMaintenanceNeeded(recentDate)).toBe(false);
    });
  });
});