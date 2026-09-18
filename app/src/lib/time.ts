/** 하루 분(0~1439)을 HH:MM으로. */
export function formatMinutes(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function clampTimeMinutes(minutes: number): number {
  return Math.max(0, Math.min(1439, Math.round(minutes)));
}

/** 슬라이더에 표시하는 주간 구간 (06:00~20:00). 저장값은 0~1439. */
export const SLIDER_MIN_MINUTES = 6 * 60;
export const SLIDER_MAX_MINUTES = 20 * 60;
