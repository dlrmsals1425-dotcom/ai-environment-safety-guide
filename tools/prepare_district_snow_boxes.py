"""Prepare public municipal overlays. Raw inputs remain outside Git.

Usage: python tools/prepare_district_snow_boxes.py --csv <downloaded CSV>
District SHP: source-data/seoul/districts/districts.shp (OA-22161 ZIP).
"""
from pathlib import Path
import argparse
import csv
import hashlib
import json
import math
import shutil
from collections import Counter
import shapefile
from pyproj import Transformer
from shapely.geometry import shape, mapping, Point
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]

def write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

def main():
    args = argparse.ArgumentParser()
    args.add_argument('--csv', type=Path, required=True)
    source = args.parse_args().csv
    out = ROOT / 'app/public/overlays'
    raw = ROOT / 'source-data/seoul/districts'
    projection = Transformer.from_crs(5181, 4326, always_xy=True)
    reader = shapefile.Reader(str(raw/'districts.shp'), encoding='utf-8')
    districts = []
    shapes = []
    catalog = []
    for sr in reader.iterShapeRecords():
        props = sr.record.as_dict()
        geom = transform(projection.transform, shape(sr.shape.__geo_interface__))
        assert geom.is_valid and not geom.is_empty
        code, name = props['SIGNGU_CD'], props['SIGNGU_NM']
        label = geom.representative_point()
        districts.append({'type':'Feature','id':code,'properties':{'code':code,'name':name},'geometry':mapping(geom)})
        shapes.append((code, name, geom))
        catalog.append({'code':code,'name':name,'bbox':list(geom.bounds),'label':[label.x,label.y]})
    assert len(districts) == 25 and len({d['id'] for d in districts}) == 25
    write(out/'districts.geojson', {'type':'FeatureCollection','features':districts})
    write(ROOT/'app/src/data/districtCatalog.json', sorted(catalog,key=lambda d:d['name']))
    snow_raw = ROOT/'source-data/seoul/snow-boxes'
    snow_raw.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source,snow_raw/source.name)
    rows = list(csv.DictReader(source.open(encoding='cp949',newline='')))
    convert = Transformer.from_crs(5186,4326,always_xy=True)
    features, rejected, reviews = [], [], []
    for i, row in enumerate(rows):
        try:
            x,y = float(row['x좌표값'])/1000,float(row['y좌표값'])/1000
            lon,lat = convert.transform(x,y)
            if not all(math.isfinite(v) for v in (lon,lat)) or not (126.5<lon<127.4 and 37.2<lat<37.85):
                raise ValueError('Seoul vicinity bounds check failed')
        except (ValueError,TypeError) as error:
            rejected.append({'sourceRow':i+2,'reason':str(error),'row':row})
            continue
        hits = [(c,n) for c,n,g in shapes if g.covers(Point(lon,lat))]
        code,name = hits[0] if len(hits)==1 else (None,None)
        if code is None: reviews.append(i+2)
        features.append({'type':'Feature','id':f'snow-box-{i+2}',
            'geometry':{'type':'Point','coordinates':[round(lon,7),round(lat,7)]},
            'properties':{'id':f'snow-box-{i+2}','boxId':row['제설함번호'].strip(),
                'agency':row['관리기관명'].strip(),'address':row['위치상세정보'].strip(),
                'districtCode':code,'districtName':name,'coordinateStatus':'inferred-projection',
                'sourceRow':i+2}})
    assert len(features)+len(rejected)==len(rows)
    counts = dict(Counter(f['properties']['districtCode'] or 'unassigned' for f in features))
    meta = {'source':'서울특별시 · 서울시 제설함 위치정보 (사용자 제공 CSV)',
        'sourceUrl':'https://data.seoul.go.kr/dataList/OA-22648/S/1/datasetView.do',
        'sourceFile':source.name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'preparedAt':'2026-09-21','dataDate':None,'totalRows':len(rows),'mappedRows':len(features),
        'unmappedRows':len(rejected),'unassignedRows':len(reviews),'districtCounts':counts,
        'license':'공공누리 제1유형 · 출처표시',
        'conversion':{'assumedEpsg':5186,'inputScaleDivisor':1000,'outputEpsg':4326},
        'warning':'좌표 단위·EPSG는 원본 값에서 해석한 참고 위치입니다. 현장 위치·제설제 재고·운영 상태는 미검증입니다. 구 분류는 경계와의 공간 포함관계이며 관리기관과 다를 수 있습니다.'}
    write(out/'snow-boxes.geojson',{'type':'FeatureCollection','features':features})
    write(out/'snow-boxes.meta.json',meta)
    write(snow_raw/'coordinate-review.json',{'metadata':meta,'rejected':rejected,'unassignedSourceRows':reviews})
    write(out/'districts.meta.json',{'source':'서울특별시 · 서울시 상권분석서비스(영역-자치구)',
        'sourceUrl':'https://data.seoul.go.kr/dataList/OA-22161/S/1/datasetView.do',
        'fileModifiedAt':'2023-10-31','catalogUpdatedAt':'2026-09-11','preparedAt':'2026-09-21',
        'sourceSha256':hashlib.sha256((raw/'districts.zip').read_bytes()).hexdigest(),
        'sourceCrs':'EPSG:5181 (PRJ 확인)','outputCrs':'EPSG:4326','featureCount':25,
        'license':'공공누리 제1유형 · 출처표시',
        'warning':'공개 상권분석용 자치구 경계입니다. 파일 수정일과 카탈로그 갱신일은 다릅니다. 법적 경계 판정용 자료가 아닙니다.'})
    print(json.dumps(meta,ensure_ascii=False))

if __name__ == '__main__':
    main()
