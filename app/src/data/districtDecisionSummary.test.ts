import { describe,it,expect } from 'vitest';
import { summarizeDistrict } from './districtDecisionSummary';
import type { DemoResult } from './demoDecision';
const make=(action:string)=>({action}) as DemoResult;
describe('district decision summary',()=>{
  it('uses exclusive action counts instead of overlapping risk metrics',()=>{
    const s=summarizeDistrict([make('제설 우선 검토'),make('제설 우선 검토'),make('결빙 우려 확인'),make('모니터링')]);
    expect(s).toMatchObject({urgent:2,inspect:1,monitor:1,total:4,title:'제설 우선 검토'});
    expect(s.reason).toContain('가상 장소 4곳');
    expect(s.urgent+s.inspect+s.monitor).toBe(s.total);
  });
  it('does not turn missing or low-scoring samples into an all-district safety claim',()=>{
    expect(summarizeDistrict([]).title).toBe('판단 자료 없음');
    expect(summarizeDistrict([make('모니터링')]).reason).toContain('안전 판정을 뜻하지 않습니다');
  });
});
