"""Verify storage/render-input agreement, not real-world elevation accuracy."""
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / 'app/public/data/seoul/ground'
meta = json.loads((DIR / 'meta.json').read_text(encoding='utf-8'))
g = meta['grid']
values = np.fromfile(DIR / 'heights.f32', dtype='<f4').reshape(g['height'], g['width'])
assert np.isfinite(values).all()
errors = []
for file in (DIR / '12').glob('*/*.png'):
    x, y = int(file.parent.name), int(file.stem)
    rgb = np.asarray(Image.open(file), dtype=np.uint32)
    for py in (0, 128, 255):
        for px in (0, 128, 255):
            lon = (x+(px+.5)/256)/4096*360-180
            lat = math.degrees(math.atan(math.sinh(math.pi*(1-2*(y+(py+.5)/256)/4096))))
            col, row = (lon-g['west'])/g['step'], (g['north']-lat)/g['step']
            c, r = math.floor(col), math.floor(row)
            if c < 0 or r < 0 or c+1 >= g['width'] or r+1 >= g['height']: continue
            u, v = col-c, row-r
            height = ((1-u)*values[r,c]+u*values[r,c+1])*(1-v)+((1-u)*values[r+1,c]+u*values[r+1,c+1])*v
            p = rgb[py,px]
            encoded = int(p[0])*65536+int(p[1])*256+int(p[2])
            decoded = -10000+encoded*.1
            errors.append(abs(float(height)-decoded))
assert errors and max(errors) < .051, max(errors)
report = {'passed':True,'gridShape':list(values.shape),'finiteCells':int(values.size),
          'tilePixelSamplesIncludingEdges':len(errors),'maxEncodingDifferenceM':max(errors),
          'meaning':'Bilinear Float32 analysis input and rendered tile pixel centres agree within 0.1m encoding quantization. Not field accuracy; tile interpolation/mesh can differ.',
          'fieldAccuracy':'Unvalidated DSM-derived ground proxy; not surveyed DTM.'}
dest = ROOT / 'reference/seoul-map-acceptance/ground-data-check.json'
dest.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
