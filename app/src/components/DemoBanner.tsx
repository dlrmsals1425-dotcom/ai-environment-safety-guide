import { useEffect, useRef } from 'react';
import { useDemoStore } from '@/store/demoStore';
import type { LayerId } from '@/types/layers';
import type { BBox } from '@/geo/aoi';
import { useAppStore } from '@/store/appStore';
export function DemoBanner() {
  const enabled=useDemoStore(s=>s.enabled),toggle=useDemoStore(s=>s.setEnabled);
  const code=useAppStore(s=>s.selectedDistrictCode);
  const districtView=useAppStore(s=>s.districtView);
  const contextLayers:LayerId[]=['snowBoxes','snowBases','footprints','trees','buildings'];
  const entered=useRef(false);
  const saved=useRef<{date:string;minutes:number;code:string|null;bbox:BBox|null;layers:Partial<Record<LayerId,boolean>>}|null>(null);
  useEffect(()=>{
    const s=useAppStore.getState();
    if(enabled && !entered.current) {
      saved.current={date:`${s.date.getFullYear()}-${String(s.date.getMonth()+1).padStart(2,'0')}-${String(s.date.getDate()).padStart(2,'0')}`,minutes:s.timeMinutes,code:s.selectedDistrictCode,bbox:s.aoi?.bbox ?? null,layers:Object.fromEntries(contextLayers.map(id=>[id,s.layers[id]]))};
      entered.current=true;
      for(const id of contextLayers)s.setLayerVisible(id,false);
      if(!s.selectedDistrictCode)s.selectDistrict('11440');
      s.setCalendarDate('2026-12-21');s.setTimeMinutes(480);s.selectFeature(null);
    } else if(!enabled && entered.current) {
      entered.current=false;const before=saved.current;
      if(before){s.selectDistrict(before.code);s.setCalendarDate(before.date);s.setTimeMinutes(before.minutes);if(before.bbox)s.confirmAoi(before.bbox);for(const id of contextLayers)s.setLayerVisible(id,before.layers[id] ?? true);}
      saved.current=null;
    }
  },[enabled]);
  useEffect(()=>{useDemoStore.setState({selectedId:null,plan:[]});},[code]);
  useEffect(()=>{useDemoStore.getState().select(null);},[districtView]);
  return <div className={enabled?'demo-banner active':'demo-banner'} role="status"><div><strong>{enabled?'가상 시연 모드 · 실제 위험정보 아님':'실자료 보기 · 기상 API 미연동'}</strong><span>{enabled?'기상·도로 조건·제설 상태·색칠 구역은 모두 의사결정 연습용입니다.':'제공받은 위험자료 파일과 실제 공개 시설 위치를 확인합니다.'}</span></div><button className="btn" onClick={()=>toggle(!enabled)}>{enabled?'시연 종료 · 실자료 보기':'가상 의사결정 시연'}</button></div>;
}
