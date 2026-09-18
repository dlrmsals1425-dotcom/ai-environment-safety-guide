"""Preserve the supplied CSV and create explicitly qualified Seoul base points."""
from pathlib import Path
import csv
import hashlib
import json
import math
import shutil
from collections import Counter
from pyproj import Transformer

ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'data/processed-staging/seoul/서울시 제설전진기지 위치정보.csv'
raw=ROOT/'source-data/seoul/snow-bases'
raw.mkdir(parents=True,exist_ok=True)
shutil.copy2(source,raw/source.name)
rows=list(csv.DictReader(source.open(encoding='cp949',newline='')))
convert=Transformer.from_crs(5186,4326,always_xy=True)
reverse=Transformer.from_crs(4326,5186,always_xy=True)
features=[];rejected=[];max_roundtrip=0
for i,row in enumerate(rows):
    try:
        x,y=float(row['x좌표값'])/1000,float(row['y좌표값'])/1000
        lon,lat=convert.transform(x,y)
        if not all(math.isfinite(v) for v in [x,y,lon,lat]) or not (126.7<=lon<=127.3 and 37.35<=lat<=37.8):
            raise ValueError('좌표 범위 밖')
    except (ValueError,TypeError) as exc:
        rejected.append({'sourceRow':i+2,'row':row,'reason':str(exc)})
        continue
    lon,lat=round(lon,7),round(lat,7)
    rx,ry=reverse.transform(lon,lat)
    max_roundtrip=max(max_roundtrip,math.hypot(rx-x,ry-y))
    features.append({'type':'Feature','id':f'snow-base-{i}',
        'geometry':{'type':'Point','coordinates':[lon,lat]},
        'properties':{'id':f'snow-base-{i}','agency':row['관리기관명'].strip(),
            'baseId':row['전진기지관리번호'].strip(),'kind':row['구분'].strip(),
            'location':row['상세위치'].strip(),'coordinateStatus':'inferred-projection',
            'sourceRow':i+2,'rawX':row['x좌표값'],'rawY':row['y좌표값']}})
meta={'source':'사용자 제공 서울시 제설전진기지 위치정보 CSV',
      'sourceUrl':'https://data.seoul.go.kr/dataList/OA-22649/S/1/datasetView.do',
      'sourceFile':source.name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
      'encoding':'CP949','catalogUpdatedAt':'2026-09-17','preparedAt':'2026-09-18',
      'totalRows':len(rows),'mappedRows':len(features),'unmappedRows':len(rejected),
      'coordinateReviewRows':len(features),'coordinateStatus':'inferred-projection',
      'kindCounts':dict(Counter(f['properties']['kind'] for f in features)),
      'agencyCounts':dict(Counter(f['properties']['agency'] for f in features)),
      'conversion':{'catalogCrsLabel':'GRS80TM(WTM)','assumedEpsg':5186,'inputScaleDivisor':1000,
          'outputEpsg':4326,'maxNumericalRoundTripErrorM':max_roundtrip,
          'note':'Provider catalogue does not explicitly state EPSG or scale. Values interpreted as millimetre-scaled central-belt-2010 coordinates; all points fall in Seoul. Numerical roundtrip does not validate real-world position.'},
      'warning':'시설 위치 참고자료입니다. 원본 GRS80TM 좌표를 1,000으로 나누고 EPSG:5186으로 해석해 표시했습니다. 공급자 EPSG·단위 명시가 없어 변환 기준은 검토 필요이며 현장 위치를 검증한 것은 아닙니다. 제설 완료·운영 상태나 안전 등급을 뜻하지 않습니다.'}
out=ROOT/'app/public/data/seoul';out.mkdir(parents=True,exist_ok=True)
for path,obj in [(out/'snow-bases.geojson',{'type':'FeatureCollection','features':features}),
                 (out/'snow-bases.meta.json',meta),(raw/'coordinate-review.json',{'metadata':meta,'unmappedRows':rejected})]:
    path.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
assert len(features)+len(rejected)==len(rows)
assert len({f['id'] for f in features})==len(features)
assert max_roundtrip<.02
print(json.dumps({'totalRows':len(rows),'mappedRows':len(features),'unmappedRows':len(rejected),
                  'kindCounts':meta['kindCounts'],'coordinateStatus':'inferred-projection',
                  'maxNumericalRoundtripM':max_roundtrip},ensure_ascii=False))
