import type { DemoResult } from './demoDecision';
/** Counts describe the synthetic sample only, never district-wide measured risk. */
export function summarizeDistrict(results:DemoResult[]) {
  const urgent=results.filter(r=>r.action==='제설 우선 검토').length;
  const inspect=results.filter(r=>r.action==='결빙 우려 확인').length;
  const monitor=results.length-urgent-inspect;
  const title=!results.length?'판단 자료 없음':urgent?'제설 우선 검토':inspect?'결빙 우려 장소 확인':'상황 변화 관찰';
  const reason=!results.length?'자료가 준비되면 요약을 표시합니다.':urgent?
    `가상 장소 ${results.length}곳 중 ${urgent}곳은 잔설과 저온 조건을 우선 검토해야 합니다.`:
    inspect?`가상 장소 ${inspect}곳에 결빙 우려 조건이 남아 있습니다.`:
    '현재 가정에서 우선 제설 후보는 없습니다. 안전 판정을 뜻하지 않습니다.';
  return {urgent,inspect,monitor,title,reason,total:results.length};
}
