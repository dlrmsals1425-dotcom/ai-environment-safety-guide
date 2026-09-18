/** 합성 데모 GeoJSON 생성. geopandas 없이 Node만 사용. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const heightCfg = JSON.parse(
  fs.readFileSync(path.join(root, 'config/building-height.json'), 'utf8'),
);

const LAT0 = 37.658;
const LON0 = 126.832;

function metersPerDegree(lat0Deg) {
  const φ = (lat0Deg * Math.PI) / 180;
  const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * φ) + 1.175 * Math.cos(4 * φ);
  const mPerDegLon = 111412.84 * Math.cos(φ) - 93.5 * Math.cos(3 * φ);
  return { mPerDegLat, mPerDegLon };
}

const { mPerDegLat, mPerDegLon } = metersPerDegree(LAT0);

function toLonLat(x, y) {
  return [LON0 + x / mPerDegLon, LAT0 + y / mPerDegLat];
}

function rect(cx, cy, w, h) {
  const hw = w / 2;
  const hh = h / 2;
  const ring = [
    toLonLat(cx - hw, cy - hh),
    toLonLat(cx + hw, cy - hh),
    toLonLat(cx + hw, cy + hh),
    toLonLat(cx - hw, cy + hh),
    toLonLat(cx - hw, cy - hh),
  ];
  return [ring];
}

function lShape(cx, cy, s = 36) {
  const ring = [
    toLonLat(cx, cy),
    toLonLat(cx + s, cy),
    toLonLat(cx + s, cy + s * 0.4),
    toLonLat(cx + s * 0.4, cy + s * 0.4),
    toLonLat(cx + s * 0.4, cy + s),
    toLonLat(cx, cy + s),
    toLonLat(cx, cy),
  ];
  return [ring];
}

function uShape(cx, cy, s = 40) {
  const t = s * 0.28;
  const ring = [
    toLonLat(cx, cy),
    toLonLat(cx + s, cy),
    toLonLat(cx + s, cy + s),
    toLonLat(cx + s - t, cy + s),
    toLonLat(cx + s - t, cy + t),
    toLonLat(cx + t, cy + t),
    toLonLat(cx + t, cy + s),
    toLonLat(cx, cy + s),
    toLonLat(cx, cy),
  ];
  return [ring];
}

function heightOf(floors, useName) {
  const table = heightCfg.floorHeightM;
  const fh = table[useName] ?? table._default;
  return fh * floors + heightCfg.parapetM;
}

function feat(id, coordinates, floors, useName, extra = {}) {
  return {
    type: 'Feature',
    properties: {
      id,
      floors,
      useName,
      height: extra.height ?? heightOf(floors, useName),
      heightSource: 'synthetic',
      name: extra.name ?? id,
    },
    geometry: extra.multi
      ? { type: 'MultiPolygon', coordinates }
      : { type: 'Polygon', coordinates },
  };
}

const uses = ['공동주택', '단독주택', '제1종근린생활', '업무시설', '공장'];
const features = [];

features.push(
  feat('south-tower', rect(20, -190, 42, 28), 15, '업무시설', {
    name: '남측 고층(동지 음영 기준물)',
  }),
);
features.push(
  feat('concave-l', lShape(90, 50), 8, '공동주택', { name: '오목 L동' }),
);
features.push(
  feat('concave-u', uShape(-120, 40), 6, '제1종근린생활', { name: '오목 U동' }),
);
features.push(
  feat(
    'multi-block',
    [rect(-40, -40, 22, 18), rect(-8, -48, 18, 16)],
    4,
    '단독주택',
    { multi: true, name: 'MultiPolygon 분해 대상' },
  ),
);
features.push(
  feat('apt-5f', rect(-60, 80, 30, 22), 5, '공동주택', {
    name: '공동주택 5층(15.75m)',
  }),
);

const slots = [];
for (let row = -2; row <= 2; row++) {
  for (let col = -3; col <= 3; col++) {
    const x = col * 70 + 8;
    const y = row * 70 + 10;
    if (Math.hypot(x - 20, y + 190) < 55) continue;
    if (Math.hypot(x - 90, y - 50) < 50) continue;
    if (Math.hypot(x + 120, y - 40) < 55) continue;
    if (Math.hypot(x + 60, y - 80) < 40) continue;
    if (Math.hypot(x + 40, y + 40) < 40) continue;
    slots.push([x, y]);
  }
}

let n = 0;
for (const [x, y] of slots) {
  if (features.length >= 42) break;
  const floors = 2 + ((n * 3) % 10);
  const useName = uses[n % uses.length];
  features.push(
    feat(`b${String(n).padStart(2, '0')}`, rect(x, y, 18 + (n % 5) * 2, 14 + (n % 4) * 2), floors, useName),
  );
  n += 1;
}

while (features.length < 42) {
  const i = features.length;
  features.push(
    feat(`pad-${i}`, rect(-200 + i * 12, 200, 16, 14), 3, '단독주택'),
  );
}

const fc = {
  type: 'FeatureCollection',
  features: features.slice(0, 42),
};

const outDir = path.join(root, 'public/data/demo');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'buildings_demo.geojson'), JSON.stringify(fc));

const meta = {
  source: '합성 데모 데이터',
  synthetic: true,
  downloadedAt: null,
  featureCount: fc.features.length,
  aoiBboxWgs84: [126.8266, 37.6535, 126.8374, 37.6625],
  warning: '실제 건물이 아닙니다. 분석·보고 용도로 사용 금지.',
};
fs.writeFileSync(path.join(outDir, 'buildings_demo.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);

console.log(`wrote ${fc.features.length} features to ${outDir}`);
