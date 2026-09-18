import { AmbientLight, DirectionalLight, LightingEffect } from '@deck.gl/core';
import type { SunVector } from '@/solar/sunVector';

export function createSunLightingEffect(sun: SunVector, castShadows = true): LightingEffect {
  const night = sun.alt <= 0;
  const ambient = new AmbientLight({
    id: 'bitgil-ambient',
    intensity: night ? 0.35 : 0.7,
    color: night ? [70, 90, 130] : [255, 255, 255],
  });
  const sunLight = new DirectionalLight({
    id: 'bitgil-sun',
    intensity: night ? 0 : 1,
    color: night ? [40, 50, 80] : [255, 244, 214],
    direction: [-sun.S.x, -sun.S.y, -sun.S.z],
    // 끄면 dummyShadowMap이 해제되어 같은 overlay의 캐시 셰이더가 죽는다.
    _shadow: castShadows,
  });
  return new LightingEffect({ ambient, sunLight });
}
