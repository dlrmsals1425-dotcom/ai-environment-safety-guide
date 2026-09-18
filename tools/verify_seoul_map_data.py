"""Independent checks for generated Seoul assets; does not alter source data."""
from pathlib import Path
import json
import math
import numpy as np
from PIL import Image
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'app/public/data/seoul'


def intersects(a,b):
    return not (a[2]<b[0] or b[2]<a[0] or a[3]<b[1] or b[3]<a[1])


def check(kind, source_records):
    index=json.loads((DATA/kind/'index.json').read_text(encoding='utf-8'))
    meta=json.loads((DATA/kind/'meta.json').read_text(encoding='utf-8'))
    ids=set(); count=0; unknown=0
    for tile in index['tiles']:
        file=ROOT/'app/public'/tile['url'].lstrip('/')
        fc=json.loads(file.read_text(encoding='utf-8'))
        assert len(fc['features'])==tile['featureCount'],tile['id']
        for f in fc['features']:
            p=f['properties'];assert p['id'] not in ids,p['id'];ids.add(p['id'])
            assert f['geometry']['type'] in (['Point'] if kind=='trees' else ['Polygon','MultiPolygon'])
            if kind=='buildings':
                assert p['heightSource'] in ['measured','estimated','unknown']
                if p['heightSource']=='unknown': assert p['height']==0;unknown+=1
                else:assert 0<p['height']<=700
                assert p['pnu'].startswith('11')
            else:
                assert not {'PSS_MAN','MGE_MAN','owner','manager'} & set(p)
                x,y=f['geometry']['coordinates'];assert 126.7<=x<=127.3 and 37.35<=y<=37.8
                if p['heightM'] is not None:assert 1<=p['heightM']<=60
                if p['crownWidthM'] is not None:assert 0.2<=p['crownWidthM']<=40
            count+=1
    assert count==index['featureCount']==meta['featureCount']
    stats=meta['preparationCounts'];assert stats['sourceRecords']==source_records
    excluded=sum(stats.get(k,0) for k in ['nonSeoulLegalCode','emptyGeometry','outsideDisplayBounds','invalidGeometry','emptyPoint'])
    assert count+excluded==source_records,(count,excluded,source_records)
    if kind=='buildings':assert unknown==meta['heightCounts'].get('unknown',0)
    preset_tiles={}
    for name,x,y in [('서울숲',127.038,37.544),('남산',126.9891,37.5512),('여의도',126.9283,37.5265)]:
        bbox=[x-.007,y-.005,x+.007,y+.005]
        nearby=[t for t in index['tiles'] if intersects(t['bbox'],bbox)]
        assert nearby,name
        preset_tiles[name]={'tiles':len(nearby),'inputFeatures':sum(t['featureCount'] for t in nearby)}
    return {'records':count,'excluded':excluded,'tiles':len(index['tiles']),'presetTiles':preset_tiles}


def check_terrain():
    raw=ROOT/'source-data/seoul/terrain/copernicus-glo30'
    arrays=[]
    for lon in [126,127]:
        with Image.open(raw/f'Copernicus_DSM_COG_10_N37_00_E{lon}_00_DEM.tif') as im:
            arrays.append(np.asarray(im).copy())
    dem=np.concatenate(arrays,axis=1)
    mercator=Transformer.from_crs(3857,4326,always_xy=True)
    world=40075016.68557849
    errors=[]
    for name,lon,lat in [('서울숲',127.038,37.544),('남산',126.9891,37.5512),('여의도',126.9283,37.5265)]:
        z=12;n=2**z;tx=int((lon+180)/360*n);ty=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)
        pixel_x=min(255,max(0,int(((lon+180)/360*n-tx)*256)))
        pixel_y=min(255,max(0,int(((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n-ty)*256)))
        p=DATA/'terrain'/str(z)/str(tx)/f'{ty}.png'
        with Image.open(p) as image:rgb=image.getpixel((pixel_x,pixel_y));assert image.size==(256,256)
        decoded=-10000+(rgb[0]*65536+rgb[1]*256+rgb[2])*.1
        px=tx*256+pixel_x+.5;py=ty*256+pixel_y+.5
        x,y=mercator.transform(px/(n*256)*world-world/2,world/2-py/(n*256)*world)
        col=(x-126)*3600;row=(38-y)*3600
        c=int(col);r=int(row);dx=col-c;dy=row-r
        expected=float(dem[r,c])*(1-dx)*(1-dy)+float(dem[r,c+1])*dx*(1-dy)+float(dem[r+1,c])*(1-dx)*dy+float(dem[r+1,c+1])*dx*dy
        error=abs(decoded-expected);assert error<.06,(name,error)
        errors.append({'preset':name,'sampleLonLat':[round(x,6),round(y,6)],'encodedHeightM':round(decoded,2),'errorM':round(error,5)})
    meta=json.loads((DATA/'terrain/meta.json').read_text(encoding='utf-8'))
    assert len(list((DATA/'terrain').glob('*/*/*.png')))==meta['pngCount']
    return {'tiles':meta['pngCount'],'sampleChecks':errors,'note':'PNG encoding check, not field elevation accuracy'}


if __name__=='__main__':
    result={'buildings':check('buildings',695754),'trees':check('trees',435971),'terrain':check_terrain()}
    out=ROOT/'reference/seoul-map-acceptance';out.mkdir(parents=True,exist_ok=True)
    (out/'derived-data-check.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
