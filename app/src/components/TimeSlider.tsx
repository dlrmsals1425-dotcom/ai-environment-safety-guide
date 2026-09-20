import { formatMinutes, koreaClockMinutes, SLIDER_MAX_MINUTES, SLIDER_MIN_MINUTES } from '@/lib/time';
import { useAppStore } from '@/store/appStore';

export function TimeSlider() {
  const minutes=useAppStore(s=>s.timeMinutes),setTime=useAppStore(s=>s.setTimeMinutes);
  const date=useAppStore(s=>s.date),setDate=useAppStore(s=>s.setCalendarDate),preset=useAppStore(s=>s.setDatePreset);
  const day=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  return <footer className="timebar"><div className="timebar-clock"><span className="timebar-hm">{formatMinutes(minutes)}</span><span className="timebar-date">{day} · 한국시간</span></div><div className="timebar-slider"><span className="tick">00:00</span><input type="range" min={SLIDER_MIN_MINUTES} max={SLIDER_MAX_MINUTES} step={1} value={minutes} aria-label="시각" data-testid="time-slider" onChange={e=>setTime(Number(e.target.value))}/><span className="tick">23:59</span></div><div className="timebar-presets"><label className="date-picker"><span className="sr-only">분석 날짜</span><input type="date" aria-label="분석 날짜" value={day} onChange={e=>setDate(e.target.value)}/></label><button className="btn" onClick={()=>preset('today')}>오늘</button><button className="btn" onClick={()=>{preset('today');setTime(koreaClockMinutes(new Date()));}}>현재 시각</button></div></footer>;
}
