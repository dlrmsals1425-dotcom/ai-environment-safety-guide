import type { SnowBaseFeature } from '@/types/seoul';

/** 제설전진기지 표시 필터. 구분(전진/발진 등)과 기관·위치 검색어로 좁힌다. */
export function filterSnowBases(
  features: SnowBaseFeature[],
  opts: { kind?: string | null; query?: string },
): SnowBaseFeature[] {
  const kind = opts.kind ?? null;
  const q = (opts.query ?? '').trim();
  return features.filter((f) => {
    const p = f.properties;
    if (kind && p.kind !== kind) return false;
    if (q === '') return true;
    const haystack = [p.agency, p.location, p.baseId].filter(Boolean).join(' ');
    return haystack.includes(q);
  });
}

export function snowBaseKinds(features: SnowBaseFeature[]): string[] {
  const kinds = new Set<string>();
  features.forEach((f) => {
    if (f.properties.kind) kinds.add(f.properties.kind);
  });
  return [...kinds].sort();
}
