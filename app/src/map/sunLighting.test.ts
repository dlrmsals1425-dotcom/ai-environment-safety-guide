import { describe, expect, it } from 'vitest';
import { DirectionalLight } from '@deck.gl/core';
import { createSunLightingEffect } from '@/map/sunLighting';
import type { SunVector } from '@/solar/sunVector';

function vec(s: { x: number; y: number; z: number }): SunVector {
  return { alt: s.z > 0 ? 0.5 : -0.1, azimuthNorthDeg: 180, S: s };
}

describe('createSunLightingEffect', () => {
  it('points the directional light along -S and enables shadows by day', () => {
    const sun = vec({ x: 0.1, y: -0.8, z: 0.6 });
    const effect = createSunLightingEffect(sun);
    const lights = Object.values(effect.props);
    const dir = lights.find((l) => l instanceof DirectionalLight) as DirectionalLight;
    expect(dir).toBeTruthy();
    expect(dir.shadow).toBe(true);
    expect(dir.direction[0]).toBeCloseTo(-sun.S.x);
    expect(dir.direction[1]).toBeCloseTo(-sun.S.y);
    expect(dir.direction[2]).toBeCloseTo(-sun.S.z);
  });

  it('keeps shadow maps at night so overlay layers do not lose bindings', () => {
    const sun = vec({ x: 0, y: 0.2, z: -0.3 });
    sun.alt = -0.2;
    const effect = createSunLightingEffect(sun);
    const dir = Object.values(effect.props).find((l) => l instanceof DirectionalLight) as DirectionalLight;
    expect(dir.shadow).toBe(true);
    expect(dir.intensity).toBe(0);
    expect(dir.color).toEqual([40, 50, 80]);
  });
});
