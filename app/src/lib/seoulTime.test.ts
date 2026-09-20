import { describe, expect, it } from 'vitest';
import { combineLocalDateMinutes } from '@/solar/sunVector';
import { koreaCalendar, koreaClockMinutes, SLIDER_MIN_MINUTES, SLIDER_MAX_MINUTES } from '@/lib/time';
describe('Seoul calendar and overnight weather alignment',()=>{
  it('converts selected Seoul calendar/time to an explicit UTC instant',()=>{
    expect(combineLocalDateMinutes(new Date(2026,0,10),180).toISOString()).toBe('2026-01-09T18:00:00.000Z');
  });
  it('handles Korean midnight without inheriting browser clock components',()=>{
    const instant=new Date('2026-01-09T15:05:00Z');
    expect(koreaCalendar(instant).getDate()).toBe(10);expect(koreaClockMinutes(instant)).toBe(5);
    expect(SLIDER_MIN_MINUTES).toBe(0);expect(SLIDER_MAX_MINUTES).toBe(1439);
  });
});
