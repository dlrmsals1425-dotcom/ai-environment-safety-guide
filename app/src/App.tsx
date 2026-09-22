import { AnalysisPanel } from '@/components/AnalysisPanel';
import { DemoBanner } from '@/components/DemoBanner';
import { Header } from '@/components/Header';
import { LayerPanel } from '@/components/LayerPanel';
import { MapView } from '@/components/MapView';
import { StatusBar } from '@/components/StatusBar';
import { SunStatus } from '@/components/SunStatus';
import { SyntheticBanner } from '@/components/SyntheticBanner';
import { TimeSlider } from '@/components/TimeSlider';
import { useSeoulData } from '@/data/useSeoulData';
import { useMunicipalData } from '@/store/municipalStore';
import { useDemoStore } from '@/store/demoStore';
import { useAppStore } from '@/store/appStore';

export function App() {
  const demo=useDemoStore(s=>s.enabled);
  useSeoulData();
  useMunicipalData();
  const mapProblem=useAppStore(s=>s.seoulBuildings.status==='error'||s.seoulTrees.status==='error'||s.terrainStatus==='error'||!!s.groundError);
  const sample=useAppStore(s=>s.seoulBuildings.meta?.source?.includes('[팀 공유 샘플]'));
  return (
    <div className="app">
      <SyntheticBanner />
      <Header />
      <DemoBanner />
      {sample && <div className="data-scope-banner" role="status">팀 공유 시연 자료 · 일부 지역만 제공 · 전체 자료는 저장소 Releases에서 별도 설치</div>}
      <div className={demo ? "app-main district-overview-layout":"app-main"}>
        {demo ? <div className="map-settings-drawer"><details><summary>지도·시설 설정{mapProblem ? ' · 자료 확인 필요':''}</summary><LayerPanel/></details></div> : <LayerPanel />}
        <MapView />
        <AnalysisPanel />
      </div>
      <StatusBar />
      <SunStatus />
      <TimeSlider />
    </div>
  );
}
