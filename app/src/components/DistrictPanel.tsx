import { useMemo } from 'react';
import { DISTRICTS, filterSnowBoxes } from '@/data/municipal';
import { useAppStore } from '@/store/appStore';
import { useMunicipalStore } from '@/store/municipalStore';

export function DistrictPanel() {
  const code=useAppStore(s=>s.selectedDistrictCode),select=useAppStore(s=>s.selectDistrict);
  const visible=useAppStore(s=>s.districtBoundariesVisible),toggle=useAppStore(s=>s.setDistrictBoundariesVisible);
  const boxes=useMunicipalStore(s=>s.snowBoxes),ready=useMunicipalStore(s=>s.snowBoxReady),error=useMunicipalStore(s=>s.snowBoxError);
  const districtError=useMunicipalStore(s=>s.districtError),districtReady=useMunicipalStore(s=>s.districtReady);
  const query=useMunicipalStore(s=>s.snowBoxQuery),setQuery=useMunicipalStore(s=>s.setSnowBoxQuery),meta=useMunicipalStore(s=>s.snowBoxMeta);
  const shown=useMemo(()=>filterSnowBoxes(boxes,code,query),[boxes,code,query]);
  const allInDistrict=useMemo(()=>filterSnowBoxes(boxes,code,''),[boxes,code]);
  const district=DISTRICTS.find(d=>d.code===code);
  return <section className="district-panel" aria-label="담당 구역">
    <div className="district-title"><span className="eyebrow">담당 구역</span><label className="switch-control"><span>구 경계 표시</span><input type="checkbox" role="switch" aria-label="구 경계 표시" checked={visible} onChange={e=>toggle(e.target.checked)}/><i aria-hidden="true"/></label></div>
    <label className="district-select"><span className="sr-only">담당 자치구</span><select aria-label="담당 자치구" value={code ?? ''} onChange={e=>select(e.target.value || null)}><option value="">서울시 전체</option>{DISTRICTS.map(d=><option key={d.code} value={d.code}>{d.name}</option>)}</select></label>
    <button className="btn district-overview" onClick={()=>select(code)}>{district?.name ?? '서울시'} 전체 보기</button>
    <p className="district-summary" role="status"><strong>{district?.name ?? '서울시 전체'}</strong><span>{ready ? `제설함 ${allInDistrict.length.toLocaleString('ko-KR')}개` : error ? '제설함 자료 오류' : '제설함 자료 불러오는 중…'}</span></p>
    <p className="caption">주황색 점은 제설함, 파란색 계열 점은 제설기지입니다. 정밀 그늘은 구 안에서 지점을 고른 뒤 주변 범위로 계산하세요.</p>
    {districtError && <p className="notice-warning" role="alert">구 경계를 불러오지 못했습니다. {districtError}</p>}
    {!districtReady && !districtError && <p className="caption">구 경계 불러오는 중…</p>}
    {error && <p className="notice-warning" role="alert">{error}</p>}
    <details className="detail-section"><summary>제설함 찾기</summary>
      <input className="text-input" type="search" aria-label="제설함 번호·기관·주소 검색" placeholder="번호·기관·주소 검색" value={query} onChange={e=>setQuery(e.target.value)}/>
      <p className="caption">주황색 점: 제설함 · 검색 {shown.length.toLocaleString('ko-KR')}개{!code && meta ? ` · 구 미분류 ${meta.unassignedRows}개 포함` : ''}</p>
      <ul className="snow-list">{shown.slice(0,30).map(f=><li key={f.properties.id}><button className="snow-list-item" onClick={()=>{
        const [lng,lat]=f.geometry.coordinates;const st=useAppStore.getState();
        st.setLayerVisible('snowBoxes',true);st.flyTo(lng,lat);
        st.selectFeature({kind:'snowBox',props:f.properties,lngLat:{lng,lat}});
      }}><strong>{f.properties.boxId || '번호 미상'}</strong><span>{f.properties.districtName ?? '구 분류 검토 필요'} · {f.properties.address || '주소 없음'}</span><span className="muted">관리: {f.properties.agency}</span></button></li>)}</ul>
      {shown.length>30 && <p className="caption">목록은 30개씩 표시합니다. 검색으로 좁히세요. 지도에는 검색된 모든 지점이 표시됩니다.</p>}
      <p className="caption">좌표 변환 기준은 검토가 필요하며 재고·운영 상태는 포함하지 않습니다. 구 분류는 좌표 기준으로 관리기관과 다를 수 있습니다.</p>
      <a className="caption" href="https://data.seoul.go.kr/dataList/OA-22648/S/1/datasetView.do" target="_blank" rel="noreferrer">출처: 서울특별시 제설함 위치정보 ↗</a>
    </details>
    <details className="detail-section"><summary>구 경계 출처</summary><p className="caption">서울시 상권분석서비스의 25개 자치구 경계 · 파일 수정 2023-10-31 / 카탈로그 갱신 2026-09-11. 법적 경계 판정용은 아닙니다.</p><a className="caption" href="https://data.seoul.go.kr/dataList/OA-22161/S/1/datasetView.do" target="_blank" rel="noreferrer">서울특별시 공개 경계자료 ↗</a></details>
  </section>;
}
