import { describe, expect, it } from 'vitest';
import { applyDatePreset } from '@/lib/datePresets';

describe('applyDatePreset', () => {
  it('keeps the current year and only changes month/day for season presets', () => {
    const current = new Date(2025, 7, 3); // 2025-08-03
    const cases = [
      { id: 'dongji' as const, month: 11, day: 21 },
      { id: 'chunbun' as const, month: 2, day: 20 },
      { id: 'haji' as const, month: 5, day: 21 },
      { id: 'chubun' as const, month: 8, day: 22 },
    ];
    for (const c of cases) {
      const d = applyDatePreset(current, c.id);
      expect(d.getFullYear()).toBe(2025);
      expect(d.getMonth()).toBe(c.month);
      expect(d.getDate()).toBe(c.day);
    }
  });

  it('오늘 uses the provided now, including year', () => {
    const current = new Date(2024, 0, 1);
    const now = new Date(2026, 8, 16);
    const d = applyDatePreset(current, 'today', now);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(16);
  });
});
