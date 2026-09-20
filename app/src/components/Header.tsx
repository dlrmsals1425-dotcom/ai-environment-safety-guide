import { bboxSizeMeters } from '@/geo/aoi';
import { useAppStore } from '@/store/appStore';

export function Header() {
  const aoi=useAppStore(s=>s.aoi),mode=useAppStore(s=>s.aoiDrawMode);
  const setMode=useAppStore(s=>s.setAoiDrawMode),place=useAppStore(s=>s.placeDefaultAoi),clear=useAppStore(s=>s.clearAoi);
  const selectionSizeM=useAppStore(s=>s.selectionSizeM),setSize=useAppStore(s=>s.setSelectionSizeM);
  const size=aoi ? bboxSizeMeters(aoi.bbox) : null;
  return <header className="header">
    <div className="brand"><div className="brand-mascot"><img src="/brand/seonje-seol-mascots.png" alt="선제설 캐릭터"/></div><div><div className="brand-title">선제설<span className="brand-badge">서울</span></div><div className="brand-sub">눈 오기 전, 먼저 살펴보는 우리 동네</div></div></div>
    <div className="header-actions area-actions">
      <label className="area-size">선택 범위<select aria-label="분석 지역 크기" value={selectionSizeM} onChange={e=>setSize(Number(e.target.value))}><option value={250}>250m</option><option value={500}>500m</option><option value={1000}>1km</option></select></label>
      <button type="button" className="btn btn-primary" onClick={()=>place()}>이 주변 분석하기</button>
      <button type="button" className={mode ? 'btn btn-active' : 'btn'} aria-pressed={mode} onClick={()=>setMode(!mode)}>{mode ? '선택 취소' : '지도에서 위치 선택'}</button>
      {aoi && <button type="button" className="btn btn-ghost" onClick={clear}>선택 해제</button>}
    </div>
    <div className="header-status" data-testid="aoi-status"><span className="status-dot"/>{size ? `${Math.round(size.width)}m × ${Math.round(size.height)}m 선택됨` : '지도를 옮겨 분석할 곳을 선택하세요'}</div>
  </header>;
}
