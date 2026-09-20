export type DatePreset = 'dongji' | 'chunbun' | 'haji' | 'chubun' | 'today';

export const DATE_PRESET_LABELS: { id: DatePreset; label: string }[] = [
  { id: 'dongji', label: '동지' },
  { id: 'chunbun', label: '춘분' },
  { id: 'haji', label: '하지' },
  { id: 'chubun', label: '추분' },
  { id: 'today', label: '오늘' },
];

function at(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day);
}

/**
 * 계절 프리셋은 현재 date의 연도를 유지한 채 월/일만 바꾼다.
 * 오늘은 실제 오늘(연도 포함)로 설정한다.
 */
export function applyDatePreset(
  current: Date,
  preset: DatePreset,
  now: Date = new Date(),
): Date {
  const year = current.getFullYear();
  switch (preset) {
    case 'dongji':
      return at(year, 11, 21);
    case 'chunbun':
      return at(year, 2, 20);
    case 'haji':
      return at(year, 5, 21);
    case 'chubun':
      return at(year, 8, 22);
    case 'today':
      return koreaCalendar(now);
  }
}
import { koreaCalendar } from '@/lib/time';
