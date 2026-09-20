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

/** 새벽·야간 결빙 검토를 포함한 하루 전체(한국시간). */
export const SLIDER_MIN_MINUTES = 0;
export const SLIDER_MAX_MINUTES = 1439;

export function koreaClockMinutes(instant:Date):number {
  return (instant.getUTCHours()*60+instant.getUTCMinutes()+9*60)%1440;
}
/** Calendar carrier: getters reflect the chosen Seoul date in any browser zone. */
export function koreaCalendar(instant:Date=new Date()):Date {
  const shifted=new Date(instant.getTime()+9*60*60*1000);
  return new Date(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate());
}
