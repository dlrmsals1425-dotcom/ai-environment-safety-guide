import { useAppStore } from '@/store/appStore';

export function StatusBar() {
  const seoulBuildings = useAppStore((s) => s.seoulBuildings);
  const trees = useAppStore((s) => s.seoulTrees);
  const unknownHeight = useAppStore((s) => s.buildingsUnknownHeight);
  const analysisBuildings = useAppStore((s) => s.buildings);

  const meta = seoulBuildings.meta;
  const ratio =
    meta?.heightMeasuredRatio != null
      ? `${(meta.heightMeasuredRatio * 100).toFixed(1)}%`
      : '—';

  return (
    <div className="status-bar" data-testid="building-status">
      <span>
        건물 {seoulBuildings.features.length.toLocaleString('ko-KR')}동 (분석 대상{' '}
        {analysisBuildings.length.toLocaleString('ko-KR')}동 · 높이 미상{' '}
        {unknownHeight.toLocaleString('ko-KR')}동 제외) · 수목{' '}
        {trees.features.length.toLocaleString('ko-KR')}본 · 전체 대장높이 채택 {ratio} ·
        기준일 {meta?.dataDate ?? '—'}
      </span>
      <span className="muted">
        추정 지면 + 건물 차폐 · 정밀 DTM 아님 · 수목 차폐·기상 미연동
      </span>
    </div>
  );
}
