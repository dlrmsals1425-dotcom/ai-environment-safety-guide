import type { CctvSite, CctvLiveChosen } from '@/types/facility';

const EXPLICIT_JIBUN_RE =
  /([가-힣]+(?:동|리))\s*(산\s*)?(\d{1,4})(?:\s*-\s*(\d{1,4}))?/g;
const ROAD_RE =
  /([가-힣]+(?:대로|로)(?:\s*\d+\s*번길)?|[가-힣]+(?:번길|길))\s*(\d+(?:-\d+)?)(?!\d)(?!\s*(?:번길|대로|로|길))/g;

function stripParens(text: string): string {
  return text.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

export function defaultGeocodeQuery(
  placeText: string,
  matchNote?: string | null,
): string {
  const text = (placeText ?? '').trim();
  if (!text) return '경기도 고양시 덕양구';
  if (matchNote === 'ambiguous-jibun') return text;
  const core = stripParens(text) || text;
  const jibunMatches = [...core.matchAll(EXPLICIT_JIBUN_RE)];
  if (jibunMatches.length === 1) {
    const dong = jibunMatches[0][1];
    const san = jibunMatches[0][2] ? '산 ' : '';
    const bun = jibunMatches[0][3];
    const ho = jibunMatches[0][4];
    const jibun = `${dong} ${san}${bun}${ho ? `-${ho}` : ''}`.replace(/\s+/g, ' ').trim();
    return `경기도 고양시 덕양구 ${jibun}`;
  }
  const roadMatches = [...core.matchAll(ROAD_RE)];
  if (roadMatches.length === 1) {
    return `경기도 고양시 덕양구 ${roadMatches[0][1]} ${roadMatches[0][2]}`;
  }
  return text;
}

export function isGoyangDeogyangAddress(...parts: (string | null | undefined)[]): boolean {
  const hay = parts.filter((p): p is string => typeof p === 'string').join(' ');
  return hay.includes('고양시') && hay.includes('덕양구');
}

export function cctvDisplayPosition(
  site: CctvSite,
  live: CctvLiveChosen | null,
): [number, number] | null {
  if (live && live.siteId === site.stableId) return [live.lng, live.lat];
  return site.position;
}

export function cctvUsesLivePosition(
  site: CctvSite,
  live: CctvLiveChosen | null,
): boolean {
  return Boolean(live && live.siteId === site.stableId);
}
