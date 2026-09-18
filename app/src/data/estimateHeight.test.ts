import { describe, expect, it } from 'vitest';
import { estimateHeight } from '@/data/estimateHeight';

describe('estimateHeight', () => {
  it('5-storey 공동주택 with missing HEIGHT is 15.75m estimated', () => {
    const r = estimateHeight({
      floors: 5,
      useName: '공동주택',
      heightRaw: null,
    });
    expect(r.height).toBe(15.75);
    expect(r.heightSource).toBe('estimated');
  });

  it('accepts HEIGHT as measured when within tolerance', () => {
    const r = estimateHeight({
      floors: 5,
      useName: '공동주택',
      heightRaw: 16,
    });
    expect(r.heightSource).toBe('measured');
    expect(r.height).toBe(16);
  });

  it('keeps precomputed estimated even when height equals the formula', () => {
    const r = estimateHeight({
      floors: 1,
      useName: '단독주택',
      heightRaw: 4.2,
      forceSource: 'estimated',
    });
    expect(r.heightSource).toBe('estimated');
    expect(r.height).toBe(4.2);
  });

  it('keeps precomputed measured height', () => {
    const r = estimateHeight({
      floors: 9,
      useName: '업무시설',
      heightRaw: 39.95,
      forceSource: 'measured',
    });
    expect(r.heightSource).toBe('measured');
    expect(r.height).toBe(39.95);
  });
});
