import { describe, expect, it } from 'vitest';
import {
  isViewWithinTerrain,
  parseTerrainMeta,
  terrainSourceSpec,
  terrainSpec,
} from '@/map/terrain';

const rawMeta = {
  tiles: ['/data/seoul/terrain/{z}/{x}/{y}.png'],
  bounds: [126.5, 37.2, 127.4, 37.85],
  minzoom: 8,
  maxzoom: 12,
  tileSize: 256,
  encoding: 'mapbox',
  exaggeration: 1,
  nominalResolutionM: 30,
  attribution: 'Copernicus DEM',
};

describe('parseTerrainMeta', () => {
  it('reads the local terrain meta contract', () => {
    const meta = parseTerrainMeta(rawMeta);
    expect(meta).not.toBeNull();
    expect(meta!.tiles).toEqual(['/data/seoul/terrain/{z}/{x}/{y}.png']);
    expect(meta!.minzoom).toBe(8);
    expect(meta!.maxzoom).toBe(12);
    expect(meta!.tileSize).toBe(256);
    expect(meta!.encoding).toBe('mapbox');
    expect(meta!.nominalResolutionM).toBe(30);
  });

  it('pins exaggeration to 1 even if the meta asks for more', () => {
    expect(parseTerrainMeta({ ...rawMeta, exaggeration: 2.5 })!.exaggeration).toBe(1);
  });

  it('returns null when no tile template is present', () => {
    expect(parseTerrainMeta({ tiles: [] })).toBeNull();
    expect(parseTerrainMeta({ tiles: ['/data/seoul/terrain/0/0/0.png'] })).toBeNull();
    expect(parseTerrainMeta(null)).toBeNull();
  });
});

describe('terrainSourceSpec', () => {
  it('builds a bounded raster-dem source', () => {
    const spec = terrainSourceSpec(parseTerrainMeta(rawMeta)!);
    expect(spec).toMatchObject({
      type: 'raster-dem',
      tiles: ['/data/seoul/terrain/{z}/{x}/{y}.png'],
      tileSize: 256,
      minzoom: 8,
      maxzoom: 12,
      bounds: [126.5, 37.2, 127.4, 37.85],
      encoding: 'mapbox',
      attribution: 'Copernicus DEM',
    });
  });

  it('uses exaggeration 1 in the terrain spec', () => {
    expect(terrainSpec(parseTerrainMeta(rawMeta)!)).toEqual({
      source: 'seoul-surface-dem',
      exaggeration: 1,
    });
  });
});

describe('isViewWithinTerrain', () => {
  it('detects views outside the terrain coverage', () => {
    const meta = parseTerrainMeta(rawMeta)!;
    expect(isViewWithinTerrain(meta, [127.0, 37.5, 127.01, 37.51])).toBe(true);
    expect(isViewWithinTerrain(meta, [129, 35, 129.1, 35.1])).toBe(false);
    expect(isViewWithinTerrain(null, [127.0, 37.5, 127.01, 37.51])).toBe(false);
  });
});
