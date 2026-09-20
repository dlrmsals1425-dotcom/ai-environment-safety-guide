import { AnalysisPanel } from '@/components/AnalysisPanel';
import { Header } from '@/components/Header';
import { LayerPanel } from '@/components/LayerPanel';
import { MapView } from '@/components/MapView';
import { StatusBar } from '@/components/StatusBar';
import { SunStatus } from '@/components/SunStatus';
import { SyntheticBanner } from '@/components/SyntheticBanner';
import { TimeSlider } from '@/components/TimeSlider';
import { useSeoulData } from '@/data/useSeoulData';
import { useAppStore } from '@/store/appStore';

export function App() {
  useSeoulData();
  const sample=useAppStore(s=>s.seoulBuildings.meta?.source?.includes('[팀 공유 샘플]'));
  return (
    <div className="app">
      <SyntheticBanner />
      <Header />
      {sample && <div className="data-scope-banner" role="status">팀 공유 시연 자료 · 일부 지역만 제공 · 전체 자료는 저장소 Releases에서 별도 설치</div>}
      <div className="app-main">
        <LayerPanel />
        <MapView />
        <AnalysisPanel />
      </div>
      <StatusBar />
      <SunStatus />
      <TimeSlider />
    </div>
  );
}
