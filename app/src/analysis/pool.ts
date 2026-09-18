import { proxy, wrap, type Remote } from 'comlink';
import analysisConfig from '../../config/analysis.json';
import { mergeHours, partitionItems } from '@/analysis/partition';
import { daylightSunSamples } from '@/analysis/times';
import type {
  ComputeSunHoursInput,
  ComputeSunHoursResult,
  SunHoursApi,
} from '@/analysis/worker';
import { bboxSizeMeters } from '@/geo/aoi';

export type SunHoursRunMeta = {
  elapsedMs: number;
  workerCount: number;
  timeSteps: number;
  cellSize: number;
  stepMinutes: number;
  z0: number;
  minAltDeg: number;
  nx: number;
  ny: number;
  buildingCount: number;
  aoiWidthM: number;
  aoiHeightM: number;
};

export type DistributedSunHoursResult = ComputeSunHoursResult & {
  meta: SunHoursRunMeta;
};

export function analysisWorkerCount(): number {
  const cores =
    typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, cores - 1);
}

type WorkerFactory = () => Worker;

let workerFactory: WorkerFactory = () =>
  new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

let workers: Worker[] = [];
let remotes: Remote<SunHoursApi>[] = [];

export function setSunHoursWorkerFactory(factory: WorkerFactory | null): void {
  workerFactory =
    factory ??
    (() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }));
}

export function sunHoursPoolSize(): number {
  return workers.length;
}

export function terminateSunHoursPool(): void {
  for (const w of workers) w.terminate();
  workers = [];
  remotes = [];
}

/** @deprecated 이름 호환. 풀 전체를 종료한다. */
export function terminateSunHoursClient(): void {
  terminateSunHoursPool();
}

export function spawnSunHoursPool(): Remote<SunHoursApi>[] {
  if (remotes.length > 0) return remotes;
  const n = analysisWorkerCount();
  for (let i = 0; i < n; i++) {
    const w = workerFactory();
    workers.push(w);
    remotes.push(wrap<SunHoursApi>(w));
  }
  return remotes;
}

export function getSunHoursClient(): Remote<SunHoursApi> {
  return spawnSunHoursPool()[0];
}

export async function computeSunHoursDistributed(
  input: ComputeSunHoursInput,
  onProgress?: (ratio: number) => void,
): Promise<DistributedSunHoursResult> {
  const t0 =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  const pool = spawnSunHoursPool();
  const cellSize = input.cellSize ?? analysisConfig.cellSizeM;
  const stepMinutes = input.stepMinutes ?? analysisConfig.stepMinutes;
  const z0 = input.z0 ?? analysisConfig.z0;
  const minAltDeg = input.minAltDeg ?? analysisConfig.minAltDeg;
  const date = new Date(
    input.dateParts.year,
    input.dateParts.month,
    input.dateParts.day,
  );
  const allTimes =
    input.times ??
    daylightSunSamples(
      date,
      input.origin.lat0,
      input.origin.lon0,
      stepMinutes,
    ).map((t) => ({ S: t.S, alt: t.alt }));
  const chunks = partitionItems(allTimes, pool.length);
  const weights = chunks.map((c) => c.length);
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const prog = chunks.map(() => 0);

  const parts = await Promise.all(
    chunks.map((times, i) =>
      pool[i].computeSunHours(
        { ...input, times },
        onProgress
          ? proxy((ratio: number) => {
              prog[i] = ratio;
              let acc = 0;
              for (let k = 0; k < prog.length; k++) acc += prog[k] * weights[k];
              onProgress(acc / weightSum);
            })
          : undefined,
      ),
    ),
  );

  const hours = mergeHours(parts.map((p) => p.hours));
  const spec = parts[0].spec;
  const elapsedMs =
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  const size = bboxSizeMeters(input.aoi);
  return {
    hours,
    spec,
    timeSteps: allTimes.length,
    meta: {
      elapsedMs,
      workerCount: chunks.length,
      timeSteps: allTimes.length,
      cellSize,
      stepMinutes,
      z0,
      minAltDeg,
      nx: spec.nx,
      ny: spec.ny,
      buildingCount: input.buildings.length,
      aoiWidthM: size.width,
      aoiHeightM: size.height,
    },
  };
}
