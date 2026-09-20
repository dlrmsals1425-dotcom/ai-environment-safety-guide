import type { DatasetState } from '@/types/seoul';

export interface AnalysisGateInput {
  aoiPresent: boolean;
  buildings: DatasetState<unknown>;
  groundReady: boolean;
}

/**
 * 일조 계산을 막아야 하는 이유. null이면 계산 가능.
 * 화면에 일부 건물만 올라온 상태로 계산하면 거짓 일조 결과가 되므로,
 * 타일 상한·표시 상한·로드 오류에서는 계산을 시작하지 않는다.
 */
export function analysisBlockReason(input: AnalysisGateInput): string | null {
  if (!input.aoiPresent) return '분석할 지역을 먼저 선택하세요.';
  if (!input.groundReady) return '추정 지면을 불러오는 중이거나 주변 3km 고도 자료가 부족합니다.';

  const b = input.buildings;
  if (b.status === 'idle' || b.status === 'loading') {
    return '건물 데이터를 불러오는 중입니다. 로딩이 끝난 뒤 계산하세요.';
  }
  if (b.status === 'error') {
    return `건물 데이터 로드 오류로 계산할 수 없습니다: ${b.error ?? '알 수 없는 오류'}`;
  }
  if (b.status === 'missing' || b.status === 'empty') {
    return '이 범위에는 사용할 수 있는 건물 데이터가 없습니다.';
  }
  if (b.tilesTruncated) {
    return '화면에 걸친 건물 타일이 상한을 넘어 일부만 읽었습니다. 범위를 좁힌 뒤 계산하세요.';
  }
  if (b.capped) {
    return '건물이 표시 상한으로 잘렸습니다. 범위를 좁힌 뒤 계산하세요.';
  }
  if (b.skipped > 0) {
    return '읽지 못한 건물 기하가 있어 완전한 분석을 보장할 수 없습니다. 데이터 상태를 확인하세요.';
  }
  return null;
}
