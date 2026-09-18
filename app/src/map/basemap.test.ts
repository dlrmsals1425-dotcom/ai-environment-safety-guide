import { describe, expect, it } from 'vitest';
import { BASEMAP_LAYER_ID, createBasemapStyle, OSM_TILE_URL } from '@/map/basemap';

function basemapLayer(basemap: 'osm' | 'none') {
  return createBasemapStyle(basemap).style.layers.find((l) => l.id === BASEMAP_LAYER_ID) as {
    layout?: { visibility?: string };
  };
}

describe('createBasemapStyle', () => {
  it('uses public OSM tiles in {z}/{x}/{y} order with attribution', () => {
    const { style } = createBasemapStyle('osm');
    const source = style.sources.basemap as { tiles: string[]; attribution: string };
    expect(source.tiles[0]).toBe(OSM_TILE_URL);
    expect(source.attribution).toContain('OpenStreetMap');
    expect(basemapLayer('osm').layout?.visibility).toBe('visible');
  });

  it('keeps one style and only hides the raster layer for "배경 없음"', () => {
    const { style } = createBasemapStyle('none');
    // 소스는 그대로 두고 visibility만 none — 스타일 교체로 소스가 사라지지 않게 한다.
    expect(style.sources.basemap).toBeDefined();
    expect(basemapLayer('none').layout?.visibility).toBe('none');
    expect(style.layers[0].type).toBe('background');
  });

  it('never points at a paid/keyed tile service', () => {
    for (const id of ['osm', 'none'] as const) {
      const json = JSON.stringify(createBasemapStyle(id).style);
      expect(json).not.toContain('vworld');
      expect(json).not.toContain('naver');
      expect(json).not.toContain('google');
    }
  });
});
