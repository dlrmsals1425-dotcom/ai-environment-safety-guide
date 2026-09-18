import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const root=resolve(app,'public/data/seoul');
const json=path=>JSON.parse(readFileSync(path,'utf8'));
for (const kind of ['buildings','trees']) {
  const index=json(resolve(root,kind,'index.json'));
  let count=0;
  for (const tile of index.tiles) {
    assert(tile.url.startsWith('/data/seoul/') && !tile.url.includes('..'));
    const data=json(resolve(root,tile.url.slice('/data/seoul/'.length)));
    assert.equal(data.type,'FeatureCollection');
    assert.equal(data.features.length,tile.featureCount);
    count+=data.features.length;
  }
  assert.equal(count,index.featureCount);
  if (index.coverageAreas) assert.equal(index.coverageAreas.length,3);
  console.log(`${kind}: ${count} features, ${index.tiles.length} tiles`);
}
const ground=json(resolve(root,'ground/meta.json'));
const bytes=readFileSync(resolve(root,'ground/heights.f32'));
assert.equal(bytes.length,ground.grid.width*ground.grid.height*4);
assert(existsSync(resolve(root,'ground/ATTRIBUTION.txt')));
const snow=json(resolve(root,'snow-bases.geojson'));
assert.equal(snow.features.length,86);
console.log(`ground: ${ground.grid.width} x ${ground.grid.height}; snow bases: 86; data checks passed`);
