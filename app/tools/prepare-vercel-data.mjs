import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(readFileSync(resolve(app,'config/data-release.json'),'utf8'));
const output=resolve(app,'public/data/seoul');
const marker=resolve(output,'.release-sha256');
const required=['buildings/index.json','trees/index.json','ground/meta.json','ground/heights.f32','snow-bases.geojson'];
if (existsSync(marker) && readFileSync(marker,'utf8').trim()===manifest.sha256
    && required.every(name=>existsSync(resolve(output,name)))) {
  console.log('Full Seoul release already prepared:',manifest.tag);
} else {
  const url=`https://github.com/${manifest.repository}/releases/download/${encodeURIComponent(manifest.tag)}/${encodeURIComponent(manifest.asset)}`;
  console.log('Downloading public Seoul release:',manifest.tag);
  const response=await fetch(url,{signal:AbortSignal.timeout(180_000)});
  if (!response.ok) throw new Error(`Data release download failed: HTTP ${response.status}`);
  const archive=new Uint8Array(await response.arrayBuffer());
  if (archive.length!==manifest.bytes || createHash('sha256').update(archive).digest('hex')!==manifest.sha256) {
    throw new Error('Data release checksum/size mismatch; refusing to deploy.');
  }
  const entries=unzipSync(archive);
  for (const name of required) if (!entries[name]) throw new Error(`Release missing ${name}`);
  const names=Object.keys(entries);
  let bytes=0;
  for (const name of names) {
    if (name.startsWith('/') || name.includes('\\') || name.includes(':') || name.split('/').includes('..')) {
      throw new Error('Unsafe archive path');
    }
    bytes+=entries[name].length;
  }
  if (bytes>900*1024*1024) throw new Error('Unexpected uncompressed data size');
  for (const name of names) {
    if (name.endsWith('/')) continue;
    const path=resolve(output,name);
    if (!path.startsWith(output+sep)) throw new Error('Archive entry outside dataset');
    mkdirSync(dirname(path),{recursive:true});writeFileSync(path,entries[name]);
  }
  writeFileSync(resolve(output,'profile.json'),JSON.stringify({mode:'full',tag:manifest.tag,sha256:manifest.sha256}));
  writeFileSync(marker,manifest.sha256+'\n');
  console.log(`Prepared full Seoul release: ${names.length} files, ${bytes} bytes, SHA256 verified`);
}
