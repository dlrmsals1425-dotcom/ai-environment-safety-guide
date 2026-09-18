import { describe, expect, it } from 'vitest';
import { cameraOffsets, cameraParts, HUD_DEPTH } from '@/map/facilityLayers';

describe('cameraOffsets', () => {
  it('spreads cameras evenly when direction is unknown', () => {
    const three = cameraOffsets(3);
    expect(three).toHaveLength(3);
    expect(three[0].east).not.toBeCloseTo(three[1].east);
  });
});

describe('cameraParts', () => {
  it('builds arm, 6-face box housing, and a front lens', () => {
    const parts = cameraParts(126.83, 37.66, 0.45, 0);
    expect(parts.arm).toHaveLength(2);
    expect(parts.housing).toHaveLength(6);
    expect(parts.lens).toHaveLength(5);
    expect(parts.arm[1][0]).toBeGreaterThan(parts.arm[0][0]);
    const lensLng = parts.lens.reduce((s, p) => s + p[0], 0) / parts.lens.length;
    expect(lensLng).toBeGreaterThan(parts.arm[1][0]);
  });
});

describe('HUD_DEPTH', () => {
  it('ignores building depth so pins stay pickable', () => {
    expect(HUD_DEPTH).toEqual({ depthCompare: 'always', depthWriteEnabled: false });
  });
});
