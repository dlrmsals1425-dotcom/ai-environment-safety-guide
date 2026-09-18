"""Package existing public derived data for a portable team checkout/release.
Original downloaded files and the full running local dataset are not modified.
"""
import argparse
import hashlib
import json
import math
import shutil
import struct
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'app/public/data/seoul'
DEMO = ROOT / 'app/team-data/seoul'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')


def around(preset, radius):
    lat, lon = preset['lat'], preset['lon']
    dy = radius/110900
    dx = radius/(111000*math.cos(math.radians(lat)))
    return [lon-dx, lat-dy, lon+dx, lat+dy]


def intersects(a, b):
    return a[0] <= b[2] and a[2] >= b[0] and a[1] <= b[3] and a[3] >= b[1]


def sample():
    if (DEMO/'buildings/index.json').exists():
        raise SystemExit('Sample already exists; review it before replacing it.')
    presets = read(ROOT/'app/config/seoul.json')['presets']
    areas = [around(p, 1000) for p in presets]
    for kind in ['buildings', 'trees']:
        index = read(SOURCE/kind/'index.json')
        tiles = [t for t in index['tiles'] if any(intersects(t['bbox'], b) for b in areas)]
        height_counts = {'measured':0,'estimated':0,'unknown':0}
        for tile in tiles:
            relative = tile['url'].removeprefix('/data/seoul/')
            dest = DEMO/relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(SOURCE/relative, dest)
            if kind == 'buildings':
                for f in read(dest)['features']:
                    height_counts[f['properties']['heightSource']] += 1
        meta = read(SOURCE/kind/'meta.json')
        meta['sourceFeatureCount'] = meta['featureCount']
        meta['source'] += ' [팀 공유 샘플]'
        meta['warning'] = '서울숲·남산·여의도 중심 반경 약 1km만 보장하는 공유용 부분 자료. '+meta.get('warning', '')
        meta['featureCount'] = sum(t['featureCount'] for t in tiles)
        meta['tileCount'] = len(tiles)
        if kind == 'buildings':
            meta['heightCounts'] = height_counts
            meta['heightMeasuredRatio'] = height_counts['measured']/meta['featureCount']
        index.update(tiles=tiles,featureCount=meta['featureCount'],coverageAreas=areas)
        write(DEMO/kind/'index.json', index)
        write(DEMO/kind/'meta.json', meta)
    for name in ['snow-bases.geojson','snow-bases.meta.json']:
        shutil.copyfile(SOURCE/name, DEMO/name)
    meta = read(SOURCE/'ground/meta.json')
    grid = meta['grid']
    terrain_areas = [around(p, 5000) for p in presets]
    bounds = [min(b[0] for b in terrain_areas), min(b[1] for b in terrain_areas),
              max(b[2] for b in terrain_areas), max(b[3] for b in terrain_areas)]
    c0 = math.floor((bounds[0]-grid['west'])/grid['step'])
    c1 = math.ceil((bounds[2]-grid['west'])/grid['step'])
    r0 = math.floor((grid['north']-bounds[3])/grid['step'])
    r1 = math.ceil((grid['north']-bounds[1])/grid['step'])
    assert 0 <= c0 < c1 < grid['width'] and 0 <= r0 < r1 < grid['height']
    (DEMO/'ground').mkdir(parents=True, exist_ok=True)
    with (SOURCE/'ground/heights.f32').open('rb') as src, (DEMO/'ground/heights.f32').open('wb') as out:
        for r in range(r0,r1+1):
            src.seek((r*grid['width']+c0)*4)
            out.write(src.read((c1-c0+1)*4))
    west = grid['west']+c0*grid['step']
    north = grid['north']-r0*grid['step']
    meta['grid'].update(width=c1-c0+1,height=r1-r0+1,west=west,north=north)
    meta['bounds'] = [west,north-(r1-r0)*grid['step'],west+(c1-c0)*grid['step'],north]
    count=0
    for z in range(meta['minzoom'],meta['maxzoom']+1):
        scale=2**z
        def y(lat): return math.floor((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*scale)
        x0=math.floor((bounds[0]+180)/360*scale); x1=math.floor((bounds[2]+180)/360*scale)
        for x in range(x0,x1+1):
            for yy in range(y(bounds[3]),y(bounds[1])+1):
                relative=Path('ground')/str(z)/str(x)/f'{yy}.png'
                dest=DEMO/relative; dest.parent.mkdir(parents=True,exist_ok=True)
                shutil.copyfile(SOURCE/relative,dest); count+=1
    meta['pngCount']=count
    meta['warning'] += ' 팀 공유 3개 구역 주변만 제공.'
    write(DEMO/'ground/meta.json',meta)
    shutil.copyfile(SOURCE/'ground/ATTRIBUTION.txt',DEMO/'ground/ATTRIBUTION.txt')
    write(DEMO/'profile.json',{'mode':'team-demo','presets':[p['label'] for p in presets],
         'coverageAreas':areas,'dataDate':'2026-09-18','note':'Real public-data subset, not synthetic.'})
    sizes=[p.stat().st_size for p in DEMO.rglob('*') if p.is_file()]
    print(json.dumps({'sampleFiles':len(sizes),'sampleBytes':sum(sizes)},ensure_ascii=False))


def archive():
    dest=ROOT/'.artifacts/seoul-runtime-data-v2026.09.18.zip'
    dest.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(dest,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as out:
        for file in sorted(SOURCE.rglob('*')):
            if file.is_file(): out.write(file,file.relative_to(SOURCE).as_posix())
    digest=hashlib.file_digest(dest.open('rb'),'sha256').hexdigest()
    manifest={
        'repository':'dlrmsals1425-dotcom/ai-environment-safety-guide','tag':'v0.1.0',
        'asset':dest.name,'sha256':digest,'bytes':dest.stat().st_size,
        'target':'app/public/data/seoul','description':'Full prepared Seoul runtime data, not raw source archives.'}
    write(ROOT/'data-catalog/runtime-release.json',manifest)
    write(ROOT/'app/config/data-release.json',manifest)
    print(json.dumps({'archive':str(dest),'bytes':dest.stat().st_size,'sha256':digest}))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('part',choices=['sample','archive'])
    args=parser.parse_args();sample() if args.part=='sample' else archive()
