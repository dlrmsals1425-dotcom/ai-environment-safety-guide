import { useAppStore } from '@/store/appStore';

export const SYNTHETIC_BANNER_TEXT =
  '⚠ 합성 데모 데이터 — 실제 건물이 아닙니다. 분석·보고에 사용하지 마십시오.';

export function SyntheticBanner() {
  const dataIsSynthetic = useAppStore((s) => s.dataIsSynthetic);
  if (!dataIsSynthetic) return null;
  return (
    <div className="synthetic-banner" role="status" data-testid="synthetic-banner">
      {SYNTHETIC_BANNER_TEXT}
    </div>
  );
}
