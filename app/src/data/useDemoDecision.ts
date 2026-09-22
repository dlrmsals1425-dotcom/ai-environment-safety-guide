import { useMemo } from 'react';
import { useAppStore } from '@/store/appStore';
import { useMunicipalStore } from '@/store/municipalStore';
import { useDemoStore } from '@/store/demoStore';
import { createDemoAreas, evaluateDemoArea } from './demoDecision';
import { combineLocalDateMinutes, sunVector } from '@/solar/sunVector';
export function useDemoDecision() {
  const districts=useMunicipalStore(s=>s.districts),ready=useMunicipalStore(s=>s.districtReady),error=useMunicipalStore(s=>s.districtError);
  const code=useAppStore(s=>s.selectedDistrictCode),date=useAppStore(s=>s.date),minutes=useAppStore(s=>s.timeMinutes);
  const weather=useDemoStore(s=>s.weather),treatments=useDemoStore(s=>s.treatments),enabled=useDemoStore(s=>s.enabled);
  const areas=useMemo(()=>enabled?createDemoAreas(districts,code):[],[districts,code,enabled]);
  const results=useMemo(()=>areas.map(area=>evaluateDemoArea(area,weather,
    sunVector(combineLocalDateMinutes(date,minutes),area.position[1],area.position[0]).alt*180/Math.PI,
    treatments[area.id] ?? 'pending')).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)),[areas,weather,treatments,date,minutes]);
  return {results,ready,error};
}
