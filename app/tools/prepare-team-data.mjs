import { existsSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(app, 'public/data/seoul');
const sample = resolve(app, 'team-data/seoul');
const required = ['buildings/index.json','trees/index.json','ground/meta.json','ground/heights.f32','snow-bases.geojson'];
if (required.every(file => existsSync(resolve(destination, file)))) {
  console.log('Seoul runtime data already present; preserving local dataset.');
} else {
  if (required.some(file => existsSync(resolve(destination, file)))) {
    throw new Error('Incomplete Seoul dataset. Restore the full release or move the incomplete folder before installing the sample.');
  }
  if (!required.every(file => existsSync(resolve(sample, file)))) throw new Error('Bundled team sample is incomplete.');
  mkdirSync(destination, { recursive: true });
  // Copy per file: avoid recursive fs.cp native crashes observed on Windows/Node24.
  const copyTree=(from,to)=>{
    mkdirSync(to,{recursive:true});
    for (const entry of readdirSync(from,{withFileTypes:true})) {
      const src=resolve(from,entry.name),dst=resolve(to,entry.name);
      if (entry.isDirectory()) copyTree(src,dst);
      else if (entry.isFile()) {
        if (existsSync(dst)) throw new Error(`Refusing to overwrite existing data: ${dst}`);
        copyFileSync(src,dst);
      } else throw new Error(`Unexpected entry in bundled data: ${src}`);
    }
  };
  copyTree(sample,destination);
  console.log('Prepared real-data team sample: Seoul Forest, Namsan, Yeouido.');
}
