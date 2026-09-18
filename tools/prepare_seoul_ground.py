"""Generate a reproducible *estimated* ground proxy, preserving the original DSM.

3x3 grey opening suppresses small surface peaks; it cannot identify bare earth
under large buildings or forests. This is not a DTM extraction/validation tool.
"""
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import grey_opening, map_coordinates

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'app/public/data/seoul/ground'
RAW = ROOT / 'source-data/seoul/terrain/copernicus-glo30'


def main():
    parts = []
    for lon in (126, 127):
        with Image.open(RAW / f'Copernicus_DSM_COG_10_N37_00_E{lon}_00_DEM.tif') as im:
            parts.append(np.asarray(im, dtype=np.float32).copy())
    dsm = np.concatenate(parts, axis=1)
    ground = grey_opening(dsm, size=(3, 3), mode='nearest')
    assert np.isfinite(ground).all()
    OUT.mkdir(parents=True, exist_ok=True)
    bounds = [126.5, 37.2, 127.4, 37.85]
    # Inclusive pixel centres, north-to-south rows. Little-endian Float32.
    r0, r1, c0, c1 = 540, 2880, 1800, 5040
    grid = ground[r0:r1+1, c0:c1+1].astype('<f4')
    grid.tofile(OUT / 'heights.f32')
    meta = {
        'source': 'Copernicus GLO-30, 3x3 grey opening estimated ground',
        'tiles': ['/data/seoul/ground/{z}/{x}/{y}.png'],
        'bounds': bounds, 'minzoom': 8, 'maxzoom': 12, 'tileSize': 256,
        'encoding': 'mapbox', 'exaggeration': 1, 'nominalResolutionM': 30,
        'attribution': 'Copernicus DEM · © DLR / Airbus · EU / ESA · estimated ground',
        'grid': {'url': '/data/seoul/ground/heights.f32', 'width': grid.shape[1],
                 'height': grid.shape[0], 'west': 126+c0/3600, 'north': 38-r0/3600,
                 'step': 1/3600, 'dtype': 'Float32 little-endian'},
        'method': '3x3 minimum then maximum filter at source 1 arcsecond spacing',
        'warning': 'DSM 유래 추정 지면, 정밀 DTM 아님. 대형 건물·수목 잔류와 능선 평활화 가능. 현장 오차/추정 실패율 미검증.',
        'terrainShadowRadiusM': 3000, 'terrainRayStepM': 15,
        'tileQuantizationM': 0.1, 'preparedAt': '2026-09-18',
    }
    def tile_y(lat, z):
        return (1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z
    count = 0
    for z in range(8, 13):
        scale = 2**z
        for tx in range(math.floor((bounds[0]+180)/360*scale), math.floor((bounds[2]+180)/360*scale)+1):
            dest = OUT / str(z) / str(tx)
            dest.mkdir(parents=True, exist_ok=True)
            lon = (tx+(np.arange(256)+.5)/256)/scale*360-180
            for ty in range(math.floor(tile_y(bounds[3], z)), math.floor(tile_y(bounds[1], z))+1):
                lat = np.degrees(np.arctan(np.sinh(math.pi*(1-2*(ty+(np.arange(256)+.5)/256)/scale))))
                rr, cc = np.meshgrid((38-lat)*3600, (lon-126)*3600, indexing='ij')
                heights = map_coordinates(ground, [rr, cc], order=1, mode='nearest', prefilter=False)
                encoded = np.rint((heights+10000)*10).astype(np.uint32)
                rgb = np.stack([(encoded>>16)&255, (encoded>>8)&255, encoded&255], axis=-1).astype(np.uint8)
                Image.fromarray(rgb).save(dest / f'{ty}.png')
                count += 1
    meta['pngCount'] = count
    (OUT / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    notice = (ROOT / 'app/public/data/seoul/terrain/ATTRIBUTION.txt').read_text(encoding='utf-8')
    (OUT / 'ATTRIBUTION.txt').write_text(notice+'Additional adaptation: 3x3 morphological opening. Estimated ground; not validated bare-earth DTM.\n', encoding='utf-8')
    print(json.dumps({'tiles':count, 'grid':list(grid.shape), 'bytes':grid.nbytes, 'warning':meta['warning']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
