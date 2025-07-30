import { isMaintenanceNeeded, generateAllZoneIds } from '../src/lib/safety-and-maintenance';

describe('Zone Safety Calculations', () => {
  test('generateAllZoneIds should create 416 zones', () => {
    const zones = generateAllZoneIds();
    expect(zones).toHaveLength(416); // 26 columns × 16 rows
    expect(zones).toContain('A0');
    expect(zones).toContain('Z15');
  });

  test('isMaintenanceNeeded should return true for zones never maintained', () => {
    expect(isMaintenanceNeeded(null)).toBe(true);
  });

  test('isMaintenanceNeeded should return true for zones older than 30 days', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 31);
    expect(isMaintenanceNeeded(oldDate)).toBe(true);
  });

  test('isMaintenanceNeeded should return false for recently maintained zones', () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 10);
    expect(isMaintenanceNeeded(recentDate)).toBe(false);
  });
});