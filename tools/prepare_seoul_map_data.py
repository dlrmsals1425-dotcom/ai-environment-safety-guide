"""Build local, spatially partitioned Seoul data and Copernicus DSM terrain tiles.

No network requests. Originals remain untouched. Only derived output directories
under this project are written. Run with --part buildings|trees|terrain|all.
"""
from __future__ import annotations

import argparse
from collections import Counter, OrderedDict
import hashlib
import json
import logging
import math
from pathlib import Path

import numpy as np
from PIL import Image
from pyproj import Transformer
import shapefile
from shapely.geometry import shape, mapping, MultiPolygon
from shapely.ops import transform
from shapely import make_valid

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'source-data/seoul'
OUT = ROOT / 'app/public/data/seoul'
STAGE = ROOT / 'data/processed-staging/seoul'
DISPLAY_BOUNDS = [126.7, 37.35, 127.3, 37.8]
GRID = 0.01
logging.getLogger('shapefile').setLevel(logging.ERROR)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')


def finite(v):
    try:
        v = float(v)
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None


def inside(x, y):
    w, s, e, n = DISPLAY_BOUNDS
    return w <= x <= e and s <= y <= n


def polygonal(g):
    if g.geom_type in ('Polygon', 'MultiPolygon'):
        return g
    parts = []
    for p in getattr(g, 'geoms', []):
        if p.geom_type == 'Polygon':
            parts.append(p)
        elif p.geom_type == 'MultiPolygon':
            parts.extend(p.geoms)
    return MultiPolygon(parts) if parts else None


def rounded(value):
    if isinstance(value, (list, tuple)):
        return [rounded(v) for v in value]
    return round(float(value), 8)


class PartitionWriter:
    def __init__(self, kind):
        self.kind = kind
        self.work = STAGE / kind
        self.work.mkdir(parents=True, exist_ok=True)
        self.handles = OrderedDict()
        self.tiles = {}

    def add(self, feature, bounds):
        w, s, e, n = bounds
        key = f'{math.floor((w + e) / 2 / GRID)}_{math.floor((s + n) / 2 / GRID)}'
        if key not in self.tiles:
            self.tiles[key] = {'id': key, 'url': f'/data/seoul/{self.kind}/tiles/{key}.geojson',
                               'bbox': [w, s, e, n], 'featureCount': 0}
            (self.work / f'{key}.jsonl').write_text('', encoding='utf-8')
        if key not in self.handles:
            if len(self.handles) >= 128:
                _, old = self.handles.popitem(last=False)
                old.close()
            self.handles[key] = (self.work / f'{key}.jsonl').open('a', encoding='utf-8')
        stream = self.handles.pop(key)
        self.handles[key] = stream
        stream.write(json.dumps(feature, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')
        tile = self.tiles[key]
        tile['bbox'] = [min(tile['bbox'][0], w), min(tile['bbox'][1], s),
                        max(tile['bbox'][2], e), max(tile['bbox'][3], n)]
        tile['featureCount'] += 1

    def finish(self, meta):
        for h in self.handles.values():
            h.close()
        dest = OUT / self.kind / 'tiles'
        dest.mkdir(parents=True, exist_ok=True)
        for key in self.tiles:
            with (dest / f'{key}.geojson').open('w', encoding='utf-8') as target:
                target.write('{"type":"FeatureCollection","features":[')
                with (self.work / f'{key}.jsonl').open(encoding='utf-8') as source:
                    first = True
                    for line in source:
                        if not first:
                            target.write(',')
                        target.write(line.rstrip('\n'))
                        first = False
                target.write(']}')
        meta['featureCount'] = sum(t['featureCount'] for t in self.tiles.values())
        meta['tileCount'] = len(self.tiles)
        meta['synthetic'] = False
        meta['displayBounds'] = DISPLAY_BOUNDS
        meta['preparedAt'] = '2026-09-18'
        write_json(OUT / self.kind / 'meta.json', meta)
        write_json(OUT / self.kind / 'index.json', {'version': 1, 'kind': self.kind,
                   'metaUrl': f'/data/seoul/{self.kind}/meta.json', 'featureCount': meta['featureCount'],
                   'bounds': DISPLAY_BOUNDS, 'tiles': sorted(self.tiles.values(), key=lambda t: t['id'])})
        print(self.kind, json.dumps(meta, ensure_ascii=False), flush=True)


def buildings():
    path = RAW / 'buildings/AL_D010_11_20260909.zip'
    reader = shapefile.Reader(str(path), encoding='cp949')
    project = Transformer.from_crs(5186, 4326, always_xy=True).transform
    writer = PartitionWriter('buildings')
    stats = Counter()
    height_counts = Counter()
    review = []
    for i, sr in enumerate(reader.iterShapeRecords()):
        stats['sourceRecords'] += 1
        d = sr.record.as_dict()
        if not str(d.get('A3', '')).startswith('11'):
            stats['nonSeoulLegalCode'] += 1
            continue
        try:
            g = shape(sr.shape.__geo_interface__)
            if not g.is_valid:
                g = polygonal(make_valid(g))
                stats['geometryRepaired'] += 1
            if g is None or g.is_empty:
                stats['emptyGeometry'] += 1
                continue
            g = transform(project, g)
            if not g.is_valid:
                g = polygonal(make_valid(g))
                stats['projectedGeometryRepaired'] += 1
            if g is None or g.is_empty:
                stats['emptyGeometry'] += 1
                continue
            w, s, e, n = g.bounds
            if not all(math.isfinite(v) for v in g.bounds) or not inside((w+e)/2, (s+n)/2):
                stats['outsideDisplayBounds'] += 1
                continue
        except (ValueError, TypeError, IndexError) as exc:
            stats['invalidGeometry'] += 1
            if len(review) < 100:
                review.append({'sourceRow': i, 'reason': str(exc)[:140]})
            continue
        raw, floors = finite(d.get('A16')), finite(d.get('A26'))
        use = str(d.get('A9') or '').strip()
        if raw is not None and 2 <= raw <= 650:
            h, basis = round(raw, 2), 'measured'
        elif floors is not None and 0 < floors <= 150:
            per_floor = 2.95 if '공동주택' in use else 3.6 if '업무시설' in use else 4.5 if '공장' in use else 3.2
            h, basis = round(floors * per_floor + 1, 2), 'estimated'
        else:
            h, basis = 0, 'unknown'
        if raw is not None and raw > 650:
            stats['heightOutlierOver650m'] += 1
            review.append({'sourceRow': i, 'id': str(d.get('A1')), 'heightRaw': raw,
                           'reason': 'height >650m; use floor estimate or unknown'})
        height_counts[basis] += 1
        geo = mapping(g)
        props = {'id': f'seoul-building-{i}', 'sourceId': str(d.get('A1') or ''),
                 'pnu': str(d.get('A2') or ''), 'name': str(d.get('A24') or d.get('A4') or '').strip(),
                 'address': str(d.get('A4') or '').strip(), 'useName': use,
                 'floors': floors, 'height': h, 'heightSource': basis, 'heightRaw': raw,
                 'sourceDate': '2026-09-09'}
        writer.add({'type': 'Feature', 'id': props['id'], 'properties': props,
                    'geometry': {'type': geo['type'], 'coordinates': rounded(geo['coordinates'])}}, g.bounds)
        if (i+1) % 100000 == 0:
            print('building input rows', i+1, flush=True)
    total = sum(height_counts.values())
    writer.finish({'source': '국토교통부 GIS건물통합정보 서울특별시 2026-09-09',
                   'sourceUrl': 'https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?svcCde=NA&dsId=18',
                   'downloadedAt': '2026-09-18', 'dataDate': '2026-09-09', 'bufferMeters': 300,
                   'heightMeasuredRatio': height_counts['measured']/total if total else 0,
                   'heightCounts': dict(height_counts), 'preparationCounts': dict(stats),
                   'warning': '높이는 대장값 또는 층수 기반 추정. measured는 현장 실측이 아님. 높이 미상은0으로 보존. 평면 일조 계산은 지형·수목을 포함하지 않음.',
                   'heightPolicy': {'acceptedRegisterRangeM': [2,650], 'acceptedFloorsRange': [1,150],
                                    'unknownHeight': 0, 'note': 'Plausibility filter only; field accuracy not validated.'}})
    write_json(STAGE / 'buildings-review.json', review)


def trees():
    datasets = [('street', 'TN_STTREE_W_SHP.zip'), ('park-private', 'TN_PARK_ND_PVTLND_WDPT_W_SHP.zip'),
                ('protected', 'TN_NRSTR_ND_OBT_W_SHP.zip')]
    writer = PartitionWriter('trees')
    counts = Counter()
    for dataset, name in datasets:
        reader = shapefile.Reader(str(RAW / 'trees' / name), encoding='cp949')
        for i, sr in enumerate(reader.iterShapeRecords()):
            counts['sourceRecords'] += 1
            if not sr.shape.points:
                counts['emptyPoint'] += 1
                continue
            x,y = sr.shape.points[0]
            if not inside(x,y):
                counts['outsideDisplayBounds'] += 1
                continue
            d = sr.record.as_dict()
            raw_h, raw_w = finite(d.get('THT_HG')), finite(d.get('WTRTB_BT'))
            h = raw_h if raw_h is not None and 1 <= raw_h <= 60 else None
            width = raw_w if raw_w is not None and 0.2 <= raw_w <= 40 else None
            quality = 'valid' if h is not None and width is not None else 'review'
            counts[dataset] += 1
            counts['plausibleAttributes' if quality == 'valid' else 'attributeReview'] += 1
            props = {'id': f'{dataset}-{i}', 'dataset': dataset, 'gu': str(d.get('GU_NM') or '').strip(),
                     'species': str(d.get('WDPT_NM') or d.get('TRE_SOM_KO') or d.get('TRE_SOM') or '미상').strip(),
                     'heightM': h, 'crownWidthM': width, 'rawHeight': raw_h, 'rawCrownWidth': raw_w,
                     'quality': quality, 'sourceYear': 2013}
            writer.add({'type':'Feature','id':props['id'],'properties':props,
                        'geometry':{'type':'Point','coordinates':[round(x,8),round(y,8)]}}, [x,y,x,y])
        print('trees input dataset finished',dataset, flush=True)
    writer.finish({'source':'서울 열린데이터광장 가로수·공원사유지 수목·보호수 역사자료',
                   'downloadedAt':'2026-09-18','dataDate':'2013-02-04', 'preparationCounts':dict(counts),
                   'warning':'2013년 공개 원본. 가로수 종로구 누락. 높이·수관은 원천값의 범위검사만 수행, 현장 검증 아님. 수목 차폐 계산 미반영.',
                   'heightPolicy': {'acceptedHeightRange':[1,60], 'acceptedCrownWidthRange':[0.2,40]},
                   'sourceUrls':['https://data.seoul.go.kr/dataList/OA-1325/A/1/datasetView.do',
                                 'https://data.seoul.go.kr/dataList/OA-1324/S/1/datasetView.do',
                                 'https://data.seoul.go.kr/dataList/OA-1323/S/1/datasetView.do'],
                   'privacy':'Only location and tree attributes exported; owner/manager/free-text personal fields omitted.'})


def terrain():
    raw = RAW / 'terrain/copernicus-glo30'
    parts = []
    for lon in [126,127]:
        with Image.open(raw / f'Copernicus_DSM_COG_10_N37_00_E{lon}_00_DEM.tif') as im:
            parts.append(np.asarray(im,dtype=np.float32).copy())
    dem = np.concatenate(parts,axis=1)
    del parts
    from scipy.ndimage import map_coordinates
    count = 0
    # Full tile coverage around Seoul; values outside the two raw tiles are clamped
    # to the nearest boundary, not invented ocean/zero cliffs. The source is bounded.
    bounds = [126.5,37.2,127.4,37.85]
    def tile_y(lat,z):
        return (1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2 * 2**z
    for z in range(8,13):
        scale = 2**z
        x0,x1 = math.floor((bounds[0]+180)/360*scale),math.floor((bounds[2]+180)/360*scale)
        y0,y1 = math.floor(tile_y(bounds[3],z)),math.floor(tile_y(bounds[1],z))
        for tx in range(x0,x1+1):
            dest = OUT/'terrain'/str(z)/str(tx)
            dest.mkdir(parents=True,exist_ok=True)
            lon = ((tx+(np.arange(256)+0.5)/256)/scale)*360-180
            for ty in range(y0,y1+1):
                lat = np.degrees(np.arctan(np.sinh(math.pi*(1-2*(ty+(np.arange(256)+0.5)/256)/scale))))
                rr,cc=np.meshgrid((38-lat)*3600,(lon-126)*3600,indexing='ij')
                heights=map_coordinates(dem,[rr,cc],order=1,mode='nearest',prefilter=False)
                encoded=np.rint((heights+10000)*10).astype(np.uint32)
                rgb=np.stack([(encoded>>16)&255,(encoded>>8)&255,encoded&255],axis=-1).astype(np.uint8)
                Image.fromarray(rgb).save(dest/f'{ty}.png')
                count+=1
        print('terrain zoom',z,'tiles so far',count,flush=True)
    meta={'source':'Copernicus GLO-30 Public 2021 release','type':'DSM surface reference, not bare-earth terrain',
          'sourceUrl':'https://registry.opendata.aws/copernicus-dem/','tiles':['/data/seoul/terrain/{z}/{x}/{y}.png'],
          'bounds':bounds,'minzoom':8,'maxzoom':12,'tileSize':256,'encoding':'mapbox','exaggeration':1,
          'nominalResolutionM':30,'pngCount':count,'quantizationM':0.1,'gridSpacingArcSeconds':1,
          'preparedAt':'2026-09-18','interpolation':'bilinear, boundary nearest outside supplied raster extent',
          'attribution':'Copernicus DEM · © DLR / Airbus · EU / ESA',
          'warning':'건물·수목을 포함하는30m급 표면고도. 건물/수목 상대높이를 더하지 않음. 정밀지면고도 및 지형차폐 분석으로 해석하지 않음.'}
    write_json(OUT/'terrain/meta.json',meta)
    notice=('produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH '
            '2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.\n'
            'Adaptation: bilinear sampling to Web Mercator Mapbox RGB PNG tiles. Not a ground-only DEM.\n')
    (OUT/'terrain/ATTRIBUTION.txt').write_text(notice,encoding='utf-8')
    print('terrain finished',count,flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--part',choices=['buildings','trees','terrain','all'],default='all')
    args=parser.parse_args()
    for name,fn in [('buildings',buildings),('trees',trees),('terrain',terrain)]:
        if args.part in ('all',name): fn()
