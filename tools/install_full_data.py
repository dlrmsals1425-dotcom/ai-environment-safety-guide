"""Install the checksummed prepared-data release; retain the previous dataset.
Python 3.11+. GitHub CLI login/access is needed unless --archive is provided.
"""
import argparse
import hashlib
import json
import stat
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

ROOT=Path(__file__).resolve().parents[1]


def inside(path):
    resolved=path.resolve()
    if ROOT not in resolved.parents: raise RuntimeError('Path outside the project: '+str(resolved))
    return resolved


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--archive',type=Path)
    args=parser.parse_args()
    manifest=json.loads((ROOT/'data-catalog/runtime-release.json').read_text(encoding='utf-8'))
    cache=inside(ROOT/'.artifacts');cache.mkdir(exist_ok=True)
    archive=args.archive.resolve() if args.archive else cache/manifest['asset']
    if not args.archive:
        subprocess.run(['gh','release','download',manifest['tag'],'--repo',manifest['repository'],
            '--pattern',manifest['asset'],'--dir',str(cache),'--clobber'],check=True)
    with archive.open('rb') as stream: digest=hashlib.file_digest(stream,'sha256').hexdigest()
    if digest!=manifest['sha256']: raise RuntimeError('SHA256 mismatch; nothing was installed.')
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    stage=inside(cache/f'seoul-install-{stamp}');stage.mkdir()
    with zipfile.ZipFile(archive) as bundle:
        for item in bundle.infolist():
            name=PurePosixPath(item.filename.replace('\\','/'))
            if name.is_absolute() or '..' in name.parts or ':' in item.filename or stat.S_ISLNK(item.external_attr>>16):
                raise RuntimeError('Unsafe archive member; installation stopped.')
        bundle.extractall(stage)
    for required in ['buildings/index.json','trees/index.json','ground/heights.f32','ground/meta.json','snow-bases.geojson']:
        if not (stage/required).is_file(): raise RuntimeError('Archive is incomplete: '+required)
    target=inside(ROOT/'app/public/data/seoul')
    backup=inside(cache/f'seoul-previous-{stamp}')
    # Resolved source/destination/backup paths have all been checked inside ROOT.
    target.parent.mkdir(parents=True,exist_ok=True)
    had_previous=target.exists()
    if had_previous: target.rename(backup)
    try: stage.rename(target)
    except Exception:
        if had_previous: backup.rename(target)
        raise
    print('Installed full Seoul runtime data:',target)
    if had_previous: print('Previous dataset retained:',backup)


if __name__=='__main__': main()
