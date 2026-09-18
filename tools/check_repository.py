"""Pre-push checks. Report locations only, never print possible secret values."""
import re
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
names=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode('utf-8').split('\0')
patterns=[re.compile(r'gh[pousr]_[A-Za-z0-9]{25,}'),re.compile(r'github_pat_[A-Za-z0-9_]{30,}'),
          re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
          re.compile(r'AKIA[0-9A-Z]{16}'),
          re.compile(r'(?:SECRET|TOKEN|PASSWORD|API_KEY)\s*[:=]\s*[\"\']([A-Za-z0-9/+_=.-]{24,})[\"\']',re.I)]
blocked=['source-data/','data/','reference/','app/data/','app/docs/','app/public/data/seoul/','.artifacts/']
issues=[];total=0;count=0
for name in filter(None,names):
    file=ROOT/name
    if any(name.startswith(prefix) for prefix in blocked) or any(part in ['node_modules','dist','.vercel'] for part in file.relative_to(ROOT).parts):
        issues.append((name,'local-only file tracked'))
    if file.name.startswith('.env') or file.suffix in ['.pem','.key','.pfx']:
        issues.append((name,'credential file tracked'))
    size=file.stat().st_size;total+=size;count+=1
    if size>=50*1024*1024: issues.append((name,'file >=50MiB'))
    if file.suffix in ['.png','.f32','.zip']: continue
    try: text=file.read_text(encoding='utf-8-sig')
    except UnicodeDecodeError: continue
    for number,line in enumerate(text.splitlines(),1):
        if any(pattern.search(line) for pattern in patterns): issues.append((f'{name}:{number}','possible credential'))
for location,reason in issues: print(location,reason)
print(f'Checked {count} tracked files, {total/1024/1024:.2f} MiB; findings={len(issues)}')
raise SystemExit(1 if issues else 0)
