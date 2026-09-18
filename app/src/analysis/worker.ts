import { expose, transfer } from 'comlink';
import analysisConfig from '../../config/analysis.json';
import { gridFromAoi, type GridSpec } from '@/analysis/grid';
import { sunHoursGrid } from '@/analysis/shadow';
import { terrainSunHours } from '@/analysis/terrainShadow';
import type { LocalGround } from '@/data/ground';
import { daylightSunSamples } from '@/analysis/times';
import type { BBox } from '@/geo/aoi';
import { SpatialIndex } from '@/geo/spatialIndex';
import type { EnuOrigin } from '@/geo/enu';
import type { Vec3 } from '@/solar/sunVector';
import type { Building } from '@/types/building';

export type ComputeSunHoursInput = {
  ground?: LocalGround;
  buildings: Building[];
  aoi: BBox;
  origin: EnuOrigin;
  dateParts: { year: number; month: number; day: number };
  cellSize?: number;
  stepMinutes?: number;
  z0?: number;
  minAltDeg?: number;
  times?: { S: Vec3; alt: number }[];
};

export type ComputeSunHoursResult = {
  hours: Float32Array;
  spec: GridSpec;
  timeSteps: number;
};

const api = {
  computeSunHours(
    input: ComputeSunHoursInput,
    onProgress?: (ratio: number) => void,
  ): ComputeSunHoursResult {
    const cellSize = input.cellSize ?? analysisConfig.cellSizeM;
    const stepMinutes = input.stepMinutes ?? analysisConfig.stepMinutes;
    const z0 = input.z0 ?? analysisConfig.z0;
    const minAltDeg = input.minAltDeg ?? analysisConfig.minAltDeg;
    const date = new Date(
      input.dateParts.year,
      input.dateParts.month,
      input.dateParts.day,
    );
    const spec = gridFromAoi(input.aoi, input.origin, cellSize);
    const buildings = input.buildings.map((b) => ({
      ...b,
      ring: b.ring instanceof Float64Array ? b.ring : new Float64Array(b.ring),
      holes: b.holes?.map((h) => (h instanceof Float64Array ? h : new Float64Array(h))),
    }));
    const index = new SpatialIndex(buildings, 50);
    const times =
      input.times ??
      daylightSunSamples(
        date,
        input.origin.lat0,
        input.origin.lon0,
        stepMinutes,
      ).map((t) => ({ S: t.S, alt: t.alt }));
    const params = {
      buildings,
      index,
      spec,
      times,
      z0,
      minAltDeg,
      stepMinutes,
      onProgress,
    };
    const hours = input.ground ? terrainSunHours(params, input.ground) : sunHoursGrid(params);
    return transfer({ hours, spec, timeSteps: times.length }, [hours.buffer]);
  },
};

export type SunHoursApi = typeof api;

expose(api);
