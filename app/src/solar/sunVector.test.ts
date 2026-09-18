import SunCalc from 'suncalc';
import { describe, expect, it } from 'vitest';
import {
  combineLocalDateMinutes,
  findSolarNoon,
  shadowAzimuthNorthDeg,
  sunVector,
  sunVectorEquivalent,
  sunVectorFromSouthAzimuth,
} from '@/solar/sunVector';

const LAT = 37.658;
const LON = 126.832;

function deg(rad: number): number {
  return (rad * 180) / Math.PI;
}

describe('sunVector', () => {
  it('two equivalent formulas agree within 1e-9 on sampled times', () => {
    const days = [
      new Date(2026, 2, 20),
      new Date(2026, 5, 21),
      new Date(2026, 8, 22),
      new Date(2026, 11, 21),
    ];
    for (const day of days) {
      for (let m = 0; m < 1440; m += 17) {
        const when = combineLocalDateMinutes(day, m);
        const s = sunVector(when, LAT, LON);
        const p = SunCalc.getPosition(when, LAT, LON);
        const a = sunVectorFromSouthAzimuth(p.altitude, p.azimuth);
        const b = sunVectorEquivalent(p.altitude, p.azimuth);
        expect(Math.abs(a.x - b.x)).toBeLessThan(1e-9);
        expect(Math.abs(a.y - b.y)).toBeLessThan(1e-9);
        expect(Math.abs(a.z - b.z)).toBeLessThan(1e-9);
        expect(Math.abs(a.x - s.S.x)).toBeLessThan(1e-9);
        expect(Math.abs(a.y - s.S.y)).toBeLessThan(1e-9);
        expect(Math.abs(a.z - s.S.z)).toBeLessThan(1e-9);
      }
    }
  });

  it('GT-2 solar-noon altitudes match 52.3 / 75.8 / 28.9 ±0.5°', () => {
    const cases = [
      { d: new Date(2026, 2, 20), expect: 52.3 },
      { d: new Date(2026, 5, 21), expect: 75.8 },
      { d: new Date(2026, 11, 21), expect: 28.9 },
    ];
    for (const c of cases) {
      const { sun } = findSolarNoon(c.d, LAT, LON);
      expect(deg(sun.alt)).toBeCloseTo(c.expect, 0);
      expect(Math.abs(deg(sun.alt) - c.expect)).toBeLessThanOrEqual(0.5);
    }
  });

  it('GT-1 shadow azimuth at 하지 solar noon is due north ±2°', () => {
    const { sun } = findSolarNoon(new Date(2026, 5, 21), LAT, LON);
    const shadow = shadowAzimuthNorthDeg(sun.S);
    const err = Math.min(shadow, 360 - shadow);
    expect(err).toBeLessThanOrEqual(2);
  });

  it('GT-4 solar noon is between 12:20 and 12:45 KST', () => {
    for (const d of [
      new Date(2026, 2, 20),
      new Date(2026, 5, 21),
      new Date(2026, 8, 22),
      new Date(2026, 11, 21),
    ]) {
      const { minutes } = findSolarNoon(d, LAT, LON);
      expect(minutes).toBeGreaterThanOrEqual(12 * 60 + 20);
      expect(minutes).toBeLessThanOrEqual(12 * 60 + 45);
    }
  });

  it('night time has negative altitude', () => {
    const s = sunVector(combineLocalDateMinutes(new Date(2026, 11, 21), 3 * 60), LAT, LON);
    expect(s.alt).toBeLessThan(0);
  });
});
