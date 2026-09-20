export type RiskLevel='observed_ice'|'caution'|'insufficient';
export type RiskBasis='field_observation'|'screening_model'|'insufficient_data';
export interface RiskPoint {
  type:'Feature';
  geometry:{type:'Point';coordinates:[number,number]};
  properties:{id:string;name:string;level:RiskLevel;basis:RiskBasis;source:string;
    validFrom:string;validUntil:string;reasons:string[];modelVersion?:string;
    inputKind:'observation'|'forecast'|'mixed'|'none';quality:'good'|'suspect'|'bad'|'missing';
    observedAt?:string;forecastIssuedAt?:string;forecastValidAt?:string;spatialContext:string};
}
export interface RiskBundle {
  type:'FeatureCollection';schemaVersion:1;purpose:'operational'|'test';
  generatedAt:string;source:string;features:RiskPoint[];
}
export const RISK_LABELS:Record<RiskLevel,string>={observed_ice:'결빙 확인 자료',caution:'결빙 우려 · 추정',insufficient:'판단 보류'};
export const RISK_COLORS:Record<RiskLevel,string>={observed_ice:'#d94343',caution:'#db8b14',insufficient:'#7c8da3'};
const record=(v:unknown):Record<string,unknown>=>v && typeof v==='object' && !Array.isArray(v) ? v as Record<string,unknown> : {};
function text(v:unknown,label:string,max=300):string {
  if (typeof v!=='string' || !v.trim() || v.length>max) throw new Error(`${label} 항목을 확인하세요.`);
  return v.trim();
}
function time(v:unknown,label:string):string {
  const s=text(v,label,40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(s) || !Number.isFinite(Date.parse(s))) {
    throw new Error(`${label}에 시간대가 포함된 ISO 시각이 필요합니다.`);
  }
  if (new Date(s.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)!==s.slice(0,10)
    || Number(s.slice(11,13))>23 || Number(s.slice(14,16))>59) throw new Error(`${label}의 날짜·시각 값이 올바르지 않습니다.`);
  return s;
}
/** These are provider-supplied results, not a browser-generated risk prediction. */
export function parseRiskBundle(raw:unknown):RiskBundle {
  const r=record(raw);
  if (r.type!=='FeatureCollection' || r.schemaVersion!==1 || !['operational','test'].includes(String(r.purpose))
    || !Array.isArray(r.features) || r.features.length>5000) throw new Error('선제설 위험지점 형식(v1), 용도, 지점 수를 확인하세요. 최대 5,000개입니다.');
  const ids=new Set<string>();
  const generatedAt=time(r.generatedAt,'파일 생성시각');
  if (r.purpose==='operational' && Date.parse(generatedAt)>Date.now()+300_000) throw new Error('실제 자료의 생성시각이 현재보다 미래입니다. 자료와 PC의 시각을 확인하세요.');
  const features=r.features.map((item,index):RiskPoint=>{
    const f=record(item),g=record(f.geometry),p=record(f.properties);
    const c=g.coordinates;
    if (f.type!=='Feature' || g.type!=='Point' || !Array.isArray(c) || c.length!==2
      || !c.every(v=>typeof v==='number' && Number.isFinite(v))
      || c[0]<126.5 || c[0]>127.4 || c[1]<37.2 || c[1]>37.85) throw new Error(`${index+1}번 지점의 서울 범위 경도·위도를 확인하세요.`);
    const id=text(p.id,'지점 ID',100);
    if (ids.has(id)) throw new Error('중복된 지점 ID가 있습니다.');ids.add(id);
    const level=p.level as RiskLevel,basis=p.basis as RiskBasis;
    if (!['observed_ice','caution','insufficient'].includes(level) || !['field_observation','screening_model','insufficient_data'].includes(basis)) throw new Error('위험 구분과 판단 근거가 필요합니다.');
    if (level==='observed_ice' && basis!=='field_observation') throw new Error('결빙 확인 표시는 현장 관측 근거가 있어야 합니다.');
    if (level==='caution' && (basis!=='screening_model' || typeof p.modelVersion!=='string' || !p.modelVersion.trim())) throw new Error('추정 지점에는 모델/규칙 버전이 필요합니다.');
    const validFrom=time(p.validFrom,'유효 시작'),validUntil=time(p.validUntil,'유효 종료');
    if (Date.parse(validFrom)>=Date.parse(validUntil)) throw new Error('유효 종료는 시작보다 뒤여야 합니다.');
    // Conservative display contract limits, not physical icing thresholds.
    if (Date.parse(validUntil)-Date.parse(validFrom)>6*3600_000) throw new Error('초기 표시 규약의 최대 유효기간은 6시간입니다. 시간대별 결과로 나눠 주세요.');
    const inputKind=p.inputKind as RiskPoint['properties']['inputKind'];
    const quality=p.quality as RiskPoint['properties']['quality'];
    if (!['observation','forecast','mixed','none'].includes(inputKind) || !['good','suspect','bad','missing'].includes(quality)) throw new Error('관측/예보 구분과 정규화된 품질 상태가 필요합니다.');
    if (inputKind==='none' && (level!=='insufficient' || basis!=='insufficient_data' || quality!=='missing')) throw new Error('입력이 없는 지점은 자료 부족·판단 보류로만 제공할 수 있습니다.');
    const observedAt=['observation','mixed'].includes(inputKind) ? time(p.observedAt,'관측시각') : undefined;
    const forecastIssuedAt=['forecast','mixed'].includes(inputKind) ? time(p.forecastIssuedAt,'예보 발표시각') : undefined;
    const forecastValidAt=['forecast','mixed'].includes(inputKind) ? time(p.forecastValidAt,'예보 대상시각') : undefined;
    for (const inputTime of [observedAt,forecastIssuedAt]) {
      if (inputTime && (Date.parse(inputTime)>=Date.parse(validUntil) || Date.parse(inputTime)>Date.parse(generatedAt))) throw new Error('유효기간 종료/파일 생성 이후의 관측 또는 예보 발표 자료를 사용할 수 없습니다.');
    }
    if (Date.parse(validFrom)-Date.parse(generatedAt)>72*3600_000
      || (forecastIssuedAt && forecastValidAt && Date.parse(forecastValidAt)-Date.parse(forecastIssuedAt)>72*3600_000)) throw new Error('초기 표시 규약은 생성/예보 발표 후 72시간 이내 결과만 지원합니다.');
    if (forecastValidAt && forecastIssuedAt && (Date.parse(forecastValidAt)<Date.parse(forecastIssuedAt)
      || Date.parse(forecastValidAt)<Date.parse(validFrom) || Date.parse(forecastValidAt)>=Date.parse(validUntil))) throw new Error('예보 대상시각과 위험자료 유효기간을 맞춰 주세요.');
    if (level==='observed_ice' && (inputKind!=='observation' || !observedAt
      || Date.parse(validUntil)-Date.parse(observedAt)>3600_000)) throw new Error('결빙 확인 자료는 관측 기반이며 관측 후 최대 60분까지만 표시합니다. 이후는 재관측 또는 판단 보류가 필요합니다.');
    if (!Array.isArray(p.reasons) || p.reasons.length<1 || p.reasons.length>10) throw new Error('지점마다 1~10개의 판단 근거가 필요합니다.');
    return {type:'Feature',geometry:{type:'Point',coordinates:[c[0],c[1]]},properties:{id,
      name:text(p.name,'지점명',120),level,basis,source:text(p.source,'출처'),validFrom,validUntil,
      reasons:p.reasons.map(v=>text(v,'판단 근거')),modelVersion:p.modelVersion ? text(p.modelVersion,'모델 버전',100) : undefined,
      inputKind,quality,observedAt,forecastIssuedAt,forecastValidAt,spatialContext:text(p.spatialContext,'공간 대표성 설명')}};
  });
  return {type:'FeatureCollection',schemaVersion:1,purpose:r.purpose as RiskBundle['purpose'],
    generatedAt,source:text(r.source,'자료 출처'),features};
}

export function riskDisplayFeature(point:RiskPoint,instant:number,test=false,now=Date.now()) {
  const p=point.properties;
  const valid=instant>=Date.parse(p.validFrom) && instant<Date.parse(p.validUntil);
  const qualityOK=p.quality==='good';
  const availableAt=Math.max(p.observedAt ? Date.parse(p.observedAt) : -Infinity,p.forecastIssuedAt ? Date.parse(p.forecastIssuedAt) : -Infinity);
  const available=instant>=availableAt;
  const futureConfirmation=p.level==='observed_ice' && instant>now+300_000;
  const level:RiskLevel=valid && qualityOK && available && !futureConfirmation ? p.level : 'insufficient';
  return {type:'Feature' as const,geometry:point.geometry,properties:{...p,level,
    isTest:test,
    inputKindLabel:{observation:'관측 기반',forecast:'예보 기반',mixed:'관측 + 예보',none:'사용할 자료 없음'}[p.inputKind],
    qualityLabel:{good:'제공 자료 QC 정상',suspect:'검토 필요',bad:'품질 불량',missing:'결측'}[p.quality],
    statusLabel:(test ? '[테스트] ' : '')+RISK_LABELS[level],
    reason:!valid ? '선택한 시각이 자료의 유효기간 밖입니다. 현재 위험으로 해석하지 마세요.'
      : !available ? '선택한 시각에는 아직 확보되지 않은 입력 자료이므로 판단을 보류합니다.'
      : futureConfirmation ? '미래 시각의 결빙을 관측 사실로 확정할 수 없어 판단을 보류합니다.'
      : p.inputKind==='none' ? '사용할 관측·예보 자료가 없어 판단을 보류합니다.'
      : !qualityOK ? '자료 품질 확인이 필요해 판단을 보류합니다.' : p.reasons.join(' · '),
    purpose:test ? '형식 확인용 가상 자료' : '제공받은 위험지점 자료'}};
}
