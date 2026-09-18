import heightConfig from '../../config/building-height.json';
import type { HeightSource } from '@/types/building';

export function floorHeightM(useName?: string | null): number {
  const table = heightConfig.floorHeightM as Record<string, number>;
  if (useName && table[useName] != null) return table[useName];
  return table._default;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function estimateHeight(input: {
  floors?: number | null;
  useName?: string | null;
  heightRaw?: number | null;
  forceSource?: HeightSource;
}): { height: number; heightSource: HeightSource } {
  const floors = input.floors && input.floors > 0 ? input.floors : 1;
  const hEst = round2(floorHeightM(input.useName) * floors + heightConfig.parapetM);

  if (input.forceSource === 'synthetic') {
    return { height: hEst, heightSource: 'synthetic' };
  }

  const raw = input.heightRaw;
  const rawOk =
    raw != null &&
    Number.isFinite(raw) &&
    raw >= heightConfig.measuredMinM &&
    raw <= heightConfig.measuredMaxM;

  if (input.forceSource === 'measured' && rawOk) {
    return { height: raw as number, heightSource: 'measured' };
  }
  if (input.forceSource === 'estimated') {
    return { height: hEst, heightSource: 'estimated' };
  }

  if (rawOk) {
    const tol = Math.max(heightConfig.measuredAbsTolM, heightConfig.measuredRelTol * hEst);
    if (Math.abs((raw as number) - hEst) <= tol) {
      return { height: raw as number, heightSource: 'measured' };
    }
  }

  return { height: hEst, heightSource: 'estimated' };
}
