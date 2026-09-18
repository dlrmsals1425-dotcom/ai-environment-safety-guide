import { cctvDisplayPosition } from '@/data/geocodeQuery';
import type { CctvLiveChosen, CctvMeta, CctvSite } from '@/types/facility';

export async function loadCctvSites(
  url: string,
  metaUrl: string,
  signal?: AbortSignal,
): Promise<{ sites: CctvSite[]; meta: CctvMeta }> {
  const [sitesRes, metaRes] = await Promise.all([
    fetch(url, { signal }),
    fetch(metaUrl, { signal }),
  ]);
  if (!sitesRes.ok) throw new Error(`${url} HTTP ${sitesRes.status}`);
  if (!metaRes.ok) throw new Error(`${metaUrl} HTTP ${metaRes.status}`);
  const sites = (await sitesRes.json()) as CctvSite[];
  const meta = (await metaRes.json()) as CctvMeta;
  return { sites, meta };
}

export function deogyangSites(sites: CctvSite[]): CctvSite[] {
  return sites.filter((s) => s.gu === '덕양구');
}

export function visibleCctvSites(
  sites: CctvSite[],
  opts: { showRemoved: boolean; query: string },
): CctvSite[] {
  const q = (opts.query ?? '').trim().toLowerCase();
  return deogyangSites(sites).filter((s) => {
    if (!opts.showRemoved && s.status === 'removed') return false;
    if (!q) return true;
    const hay = `${s.sourceId} ${s.dong ?? ''} ${s.placeText}`.toLowerCase();
    return hay.includes(q);
  });
}

export function mappedCctvSites(sites: CctvSite[]): CctvSite[] {
  return sites.filter((s) => s.locationGrade === 'matched' && s.position);
}

export const CCTV_PIN_HIT_PX = 12;

export function mapVisibleCctvPins(
  sites: CctvSite[],
  opts: { showRemoved: boolean; live?: CctvLiveChosen | null },
): CctvSite[] {
  const live = opts.live ?? null;
  return deogyangSites(sites).filter((s) => {
    if (!opts.showRemoved && s.status === 'removed') return false;
    return cctvDisplayPosition(s, live) !== null;
  });
}

export function nearestCctvPin(
  point: { x: number; y: number },
  sites: CctvSite[],
  project: (lngLat: [number, number]) => { x: number; y: number },
  maxPx = CCTV_PIN_HIT_PX,
  live: CctvLiveChosen | null = null,
): string | null {
  let bestId: string | null = null;
  let bestD = maxPx;
  for (const s of sites) {
    const pos = cctvDisplayPosition(s, live);
    if (!pos) continue;
    const p = project(pos);
    const d = Math.hypot(p.x - point.x, p.y - point.y);
    if (d <= bestD) {
      bestD = d;
      bestId = s.stableId;
    }
  }
  return bestId;
}

const MATCH_NOTE_KO: Record<string, string> = {
  'empty-address': '주소 없음',
  'road-address': '도로명·정류소번호(지번 아님)',
  'no-explicit-jibun': '명시 지번 없음',
  'ambiguous-jibun': '지번이 여러 개라 위치를 특정할 수 없음',
  'unknown-dong': '법정동을 건물 자료에서 찾지 못함',
  'no-building': '해당 지번에 건물 자료 없음',
};

export function matchNoteLabel(note: string | null): string | null {
  if (!note) return null;
  return MATCH_NOTE_KO[note] ?? note;
}
