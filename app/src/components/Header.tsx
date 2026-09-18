import { bboxSizeMeters } from '@/geo/aoi';
import { useAppStore } from '@/store/appStore';

export function Header() {
  const aoi = useAppStore((s) => s.aoi);
  const origin = useAppStore((s) => s.origin);
  const aoiDrawMode = useAppStore((s) => s.aoiDrawMode);
  const setAoiDrawMode = useAppStore((s) => s.setAoiDrawMode);
  const placeDefaultAoi = useAppStore((s) => s.placeDefaultAoi);
  const clearAoi = useAppStore((s) => s.clearAoi);

  const size = aoi ? bboxSizeMeters(aoi.bbox) : null;

  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark">☀</span>
        <div>
          <div className="brand-title">서울 환경안내 프로토타입</div>
          <div className="brand-sub">
            서울 건물·수목·제설기지 · 추정 지형과 건물의 통합 일조 분석
          </div>
        </div>
      </div>

      <div className="header-actions">
        <button
          type="button"
          className={aoiDrawMode ? 'btn btn-active' : 'btn'}
          aria-pressed={aoiDrawMode}
          onClick={() => setAoiDrawMode(!aoiDrawMode)}
        >
          {aoiDrawMode ? 'AOI 드래그 중…' : 'AOI 지정'}
        </button>
        <button type="button" className="btn" onClick={() => placeDefaultAoi()}>
          500m 사각형
        </button>
        {aoi && (
          <button type="button" className="btn btn-ghost" onClick={clearAoi}>
            AOI 지우기
          </button>
        )}
      </div>

      <div className="header-status" data-testid="aoi-status">
        {aoi && origin && size ? (
          <>
            AOI {Math.round(size.width)}m × {Math.round(size.height)}m
            <span className="muted">
              {' '}
              원점 {origin.lat0.toFixed(5)}, {origin.lon0.toFixed(5)}
            </span>
          </>
        ) : (
          <span className="muted">관심구역 미지정</span>
        )}
      </div>
    </header>
  );
}
