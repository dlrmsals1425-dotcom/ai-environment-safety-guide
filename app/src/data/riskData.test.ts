import { describe, expect, it } from 'vitest';
import { parseRiskBundle, riskDisplayFeature } from '@/data/riskData';
const bundle=()=>({type:'FeatureCollection',schemaVersion:1,purpose:'test',source:'가상 형식 검사',generatedAt:'2026-01-01T12:00:00+09:00',features:[{
  type:'Feature',geometry:{type:'Point',coordinates:[126.98,37.56]},properties:{id:'test-only',name:'형식 검사용',level:'caution',basis:'screening_model',source:'가상 자료',inputKind:'observation',quality:'good',observedAt:'2026-01-01T12:00:00+09:00',spatialContext:'검사 좌표만 대표, 실제 공간자료 아님',modelVersion:'test-v1',validFrom:'2026-01-01T12:00:00+09:00',validUntil:'2026-01-01T13:00:00+09:00',reasons:['실제 위험이 아닌 형식 검사']}}]});
describe('provider risk data',()=>{
  it('requires provenance/model and does not let a model masquerade as field confirmation',()=>{
    expect(parseRiskBundle(bundle()).features).toHaveLength(1);
    const bad=bundle();bad.features[0].properties.level='observed_ice';
    expect(()=>parseRiskBundle(bad)).toThrow('현장 관측');
    const missing=bundle();missing.features[0].properties.modelVersion='';
    expect(()=>parseRiskBundle(missing)).toThrow('버전');
  });
  it('fails closed for missing timezone, invalid enum, duplicate IDs and swapped/outside coordinates',()=>{
    const time=bundle();time.generatedAt='2026-01-01T12:00:00';expect(()=>parseRiskBundle(time)).toThrow('시간대');
    const level=bundle();level.features[0].properties.level='__proto__';expect(()=>parseRiskBundle(level)).toThrow('위험 구분');
    const duplicate=bundle();duplicate.features.push(duplicate.features[0]);expect(()=>parseRiskBundle(duplicate)).toThrow('중복');
    const coords=bundle();coords.features[0].geometry.coordinates=[37.56,126.98];expect(()=>parseRiskBundle(coords)).toThrow('경도');
  });
  it('turns out-of-time results grey instead of reusing a previous risk classification',()=>{
    const point=parseRiskBundle(bundle()).features[0];
    expect(riskDisplayFeature(point,Date.parse('2026-01-01T12:30:00+09:00'),true).properties.statusLabel).toContain('[테스트]');
    expect(riskDisplayFeature(point,Date.parse('2026-01-01T13:00:00+09:00')).properties.level).toBe('insufficient');
    expect(riskDisplayFeature(point,Date.parse('2026-01-01T11:00:00+09:00')).properties.reason).toContain('유효기간');
  });
  it('allows an empty test document without generating imaginary risk locations',()=>{
    const empty=bundle();empty.features=[];expect(parseRiskBundle(empty).features).toEqual([]);
  });
  it('retains forecast issue/target times and rejects inputs arriving after the decision time',()=>{
    const data=bundle(),p=data.features[0];
    const forecast={...data,features:[{...p,properties:{...p.properties,inputKind:'forecast',forecastIssuedAt:'2026-01-01T11:00:00+09:00',forecastValidAt:'2026-01-01T12:00:00+09:00'}}]};
    const point=parseRiskBundle(forecast).features[0];
    expect(riskDisplayFeature(point,Date.parse('2026-01-01T12:30:00+09:00')).properties.inputKindLabel).toBe('예보 기반');
    forecast.features[0].properties.forecastIssuedAt='2026-01-01T13:00:00+09:00';
    expect(()=>parseRiskBundle(forecast)).toThrow('이후');
  });
  it('downgrades bad quality and enforces explicit display-validity limits',()=>{
    const bad=bundle();bad.features[0].properties.quality='bad';
    const point=parseRiskBundle(bad).features[0];
    expect(riskDisplayFeature(point,Date.parse('2026-01-01T12:30:00+09:00')).properties.level).toBe('insufficient');
    const long=bundle();long.features[0].properties.validUntil='2026-01-01T23:00:00+09:00';
    expect(()=>parseRiskBundle(long)).toThrow('6시간');
    const old=bundle();old.features[0].properties.level='observed_ice';old.features[0].properties.basis='field_observation';
    old.features[0].properties.validUntil='2026-01-01T13:01:00+09:00';
    expect(()=>parseRiskBundle(old)).toThrow('60분');
  });
  it('allows genuinely absent inputs without inventing an observation time',()=>{
    const data=bundle(),p=data.features[0];
    const missing={...data,features:[{...p,properties:{...p.properties,inputKind:'none',level:'insufficient',basis:'insufficient_data',quality:'missing',observedAt:undefined}}]};
    const point=parseRiskBundle(missing).features[0];
    expect(point.properties.observedAt).toBeUndefined();
    expect(riskDisplayFeature(point,Date.parse('2026-01-01T12:30:00+09:00')).properties.reason).toContain('자료가 없어');
  });
  it('accepts an observation inside the window but never applies it to earlier instants',()=>{
    const data=bundle();data.generatedAt='2026-01-01T12:10:00+09:00';data.features[0].properties.observedAt='2026-01-01T12:05:00+09:00';
    const point=parseRiskBundle(data).features[0];
    expect(riskDisplayFeature(point,Date.parse('2026-01-01T12:01:00+09:00')).properties.level).toBe('insufficient');
    expect(riskDisplayFeature(point,Date.parse('2026-01-01T12:06:00+09:00')).properties.level).toBe('caution');
  });
  it('rejects far-future windows and never treats a future field state as confirmed',()=>{
    const future=bundle();future.features[0].properties.validFrom='2026-01-05T12:00:00+09:00';future.features[0].properties.validUntil='2026-01-05T13:00:00+09:00';
    expect(()=>parseRiskBundle(future)).toThrow('72시간');
    const field=bundle();field.features[0].properties.level='observed_ice';field.features[0].properties.basis='field_observation';
    const point=parseRiskBundle(field).features[0];
    expect(riskDisplayFeature(point,Date.parse('2026-01-01T12:30:00+09:00'),false,Date.parse('2026-01-01T12:00:00+09:00')).properties.level).toBe('insufficient');
  });
});
