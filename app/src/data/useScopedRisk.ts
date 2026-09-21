import { useMemo } from 'react';
import { useAppStore } from '@/store/appStore';
import { useMunicipalStore } from '@/store/municipalStore';
import { useRiskStore } from '@/store/riskStore';
import { DISTRICTS, pointInDistrict } from '@/data/municipal';
import { riskDisplayFeature } from '@/data/riskData';
import { combineLocalDateMinutes } from '@/solar/sunVector';

export function useScopedRisk() {
  const bundle=useRiskStore(s=>s.bundle),code=useAppStore(s=>s.selectedDistrictCode);
  const districts=useMunicipalStore(s=>s.districts),date=useAppStore(s=>s.date),minutes=useAppStore(s=>s.timeMinutes);
  const district=districts.find(d=>d.properties.code===code);
  const scoped=useMemo(()=>bundle?.features.filter(f=>!code || (district && pointInDistrict(f.geometry.coordinates,district))) ?? [],[bundle,code,district]);
  const features=useMemo(()=>scoped.map(f=>riskDisplayFeature(f,combineLocalDateMinutes(date,minutes).getTime(),bundle?.purpose==='test')),[scoped,date,minutes,bundle]);
  return {features,scopeLabel:DISTRICTS.find(d=>d.code===code)?.name ?? '서울시 전체',scopeUnavailable:!!code&&!district};
}
