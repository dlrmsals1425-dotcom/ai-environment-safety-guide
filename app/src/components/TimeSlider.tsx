import { useEffect, useState } from 'react';
import { formatMinutes, koreaClockMinutes, SLIDER_MAX_MINUTES, SLIDER_MIN_MINUTES } from '@/lib/time';
import { useAppStore } from '@/store/appStore';

export const PLAYBACK_INTERVAL_MS=1500;
export const PLAYBACK_STEP_MINUTES=10;

export function TimeSlider() {
  const minutes=useAppStore(s=>s.timeMinutes),setTime=useAppStore(s=>s.setTimeMinutes);
  const date=useAppStore(s=>s.date),setDate=useAppStore(s=>s.setCalendarDate),preset=useAppStore(s=>s.setDatePreset);
  const scene=useAppStore(s=>s.sceneRevision);
  const shadowBusy=useAppStore(s=>s.shadowBusy);
  const [playing,setPlaying]=useState(false);
  const day=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  useEffect(()=>{setPlaying(false);},[day,scene]);
  useEffect(()=>{
    if(!playing) return;
    const timer=window.setInterval(()=>{
      if(useAppStore.getState().shadowBusy) return;
      const next=Math.min(SLIDER_MAX_MINUTES,useAppStore.getState().timeMinutes+PLAYBACK_STEP_MINUTES);
      useAppStore.getState().setTimeMinutes(next);
      if(next>=SLIDER_MAX_MINUTES) setPlaying(false);
    },PLAYBACK_INTERVAL_MS);
    const onVisibility=()=>{if(document.hidden) setPlaying(false);};
    document.addEventListener('visibilitychange',onVisibility);
    return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisibility);};
  },[playing]);
  const togglePlayback=()=>{
    if(playing) {setPlaying(false);return;}
    if(minutes>=SLIDER_MAX_MINUTES) setTime(SLIDER_MIN_MINUTES);
    else setTime(minutes);
    setPlaying(true);
  };
  return <footer className="timebar">
    <div className="timebar-clock"><span className="timebar-hm">{formatMinutes(minutes)}</span><span className="timebar-date">{day} · 한국시간</span></div>
    <div className="timebar-slider"><span className="tick">00:00</span><input type="range" min={SLIDER_MIN_MINUTES} max={SLIDER_MAX_MINUTES} step={1} value={minutes} aria-label="시각" data-testid="time-slider" onChange={e=>{setPlaying(false);setTime(Number(e.target.value));}}/><span className="tick">23:59</span></div>
    <div className="timebar-presets">
      <div className="timebar-playback"><button type="button" className={playing ? 'btn btn-primary':'btn'} aria-label={playing ? '재생 일시정지' : minutes>=SLIDER_MAX_MINUTES ? '처음부터 10분 간격 재생':'10분 간격 재생'} aria-pressed={playing} onClick={togglePlayback}><span aria-hidden="true">{playing ? 'Ⅱ':'▶'}</span> {playing ? '일시정지':minutes>=SLIDER_MAX_MINUTES ? '다시 재생':'재생'}</button><span className="playback-caption">{playing && shadowBusy ? '10분씩 · 계산 기다리는 중':'10분씩 · 자동재생'}</span></div>
      <label className="date-picker"><span className="sr-only">분석 날짜</span><input type="date" aria-label="분석 날짜" value={day} onChange={e=>{setPlaying(false);setDate(e.target.value);}}/></label>
      <button className="btn" onClick={()=>{setPlaying(false);preset('today');}}>오늘</button>
      <button className="btn" onClick={()=>{setPlaying(false);preset('today');setTime(koreaClockMinutes(new Date()));}}>현재 시각</button>
    </div>
  </footer>;
}
