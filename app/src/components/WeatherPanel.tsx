export function WeatherPanel() {
  return <section className="weather-panel">
    <span className="eyebrow">WEATHER & EVIDENCE</span><h2>어떤 자료가 필요할까요?</h2>
    <p className="intro-copy">정확한 위치 안내는 ‘추운 날씨’보다 <strong>그 도로의 온도와 물기</strong>를 아는 것에서 시작합니다.</p>
    <div className="data-priority"><span>우선 확인</span><h3>노면온도 · 습윤 · 결빙 상태</h3><p>서울 도로에서 실제 관측한 자료가 있는지, 위치와 관측 간격부터 확인합니다. 관측소 지면온도는 도로 노면온도와 구분해야 합니다.</p></div>
    <div className="data-priority"><span>기본 자료</span><h3>AWS·ASOS 관측 + 예보</h3><p>기온, 습도·이슬점, 강수형태·강수량, 적설, 바람, 일사. 관측시각과 예보 발표·유효시각을 별도로 받습니다.</p></div>
    <div className="data-priority"><span>정확도 검증</span><h3>과거 결빙 · 제설 이력</h3><p>실제로 얼었던 때와 얼지 않았던 때를 함께 비교합니다. 제설·제빙제 살포, 교량·경사·포장 상태도 별도 자료로 결합합니다.</p></div>
    <a className="btn btn-primary guide-download" href="/guides/weather-request.txt" download="선제설_기상자료_요청서.txt">팀원에게 전달할 요청서 다운로드 ↓</a>
    <a className="guide-link" href="/guides/risk-contract.md" target="_blank" rel="noreferrer">지도 위험지점 연결 형식 보기 ↗</a>
    <details className="detail-section"><summary>권장 연결 방식</summary><p className="panel-hint">기상청 자료 수집 → 서버에서 단위·시각·결측·품질 정리 → 도로 단위 분석 → 유효기간과 근거를 포함한 지점 자료 → 지도 표시. 인증키는 브라우저에 넣지 않습니다.</p><p className="panel-hint">원본 CSV/JSON과 항목 설명서·지점 목록을 함께 받는 방식으로 시작합니다. 자동 수집과 위험 산출 서버는 다음 연결 단계입니다.</p></details>
    <p className="caption">자료를 받을 수 있는 권한과 공개 지도에 게시할 수 있는 범위는 별도로 확인합니다.</p>
  </section>;
}
