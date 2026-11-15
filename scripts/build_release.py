#!/usr/bin/env python3
"""Create runtime and GitHub-source ZIPs without network access or credentials."""
from pathlib import Path
import json,hashlib,zipfile,re

ROOT=Path(__file__).resolve().parents[1]
EXT=ROOT/'extension'
DIST=ROOT/'dist'

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def add_file(archive,path,name):
    # Stable metadata makes identical runtime contents yield identical archives.
    info=zipfile.ZipInfo(str(name).replace('\\','/'),(2026,1,1,0,0,0))
    info.external_attr=0o100644<<16
    archive.writestr(info,path.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=7)

def main():
    DIST.mkdir(exist_ok=True)
    manifest=json.loads((EXT/'manifest.json').read_text())
    required=['app.html','popup.html','js/core.js','js/background.js','js/client.js',
              'js/renderer-data.js','js/renderer.js','js/content.js','js/app.js',
              'assets/icon128.png','START_HERE.html']
    for name in required:
        if not (EXT/name).is_file():raise SystemExit('Missing runtime file: '+name)
    # Never ship remote code, API credentials or the retired AI integration.
    for p in EXT.rglob('*.js'):
        text=p.read_text()
        if re.search(r'openrouter|api\.openai|runAI|api[_-]?key',text,re.I):
            raise SystemExit('Unexpected external-provider reference in '+str(p))
    hashes={str(p.relative_to(EXT)):sha(p) for p in sorted(EXT.rglob('*')) if p.is_file()}
    runtime=DIST/'Purrple_Firefox_Extension.zip'
    with zipfile.ZipFile(runtime,'w',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
        for name in hashes:add_file(z,EXT/name,name)
    source=DIST/'Purrple_Complete_Source.zip'
    # Actual critique scores/exchanges remain private working material. Test
    # scripts and factual verification summaries may be included in source.
    excluded={'dist','qa-runtime','node_modules','__pycache__','.git','.cache','profiles'}
    with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
        for p in sorted(ROOT.rglob('*')):
            if not p.is_file():continue
            rel=p.relative_to(ROOT)
            if any(part in excluded for part in rel.parts):continue
            if rel.parts[:2]==('verification','review'):continue
            if rel.suffix in {'.log','.pyc'} or (p.name.startswith('.') and p.name!='.gitignore'):continue
            if 'profile' in p.name.lower() or 'geckodriver' in p.name.lower():continue
            add_file(z,p,Path('Purrple')/rel)
    for p in [runtime,source]:
        with zipfile.ZipFile(p) as z:
            assert z.testzip() is None
            assert not any('qa-runtime/' in n or 'verification/review/' in n for n in z.namelist())
    result={'version':manifest['version'],'runtime':str(runtime),'source':str(source),
            'runtime_files':len(hashes),'runtime_sha256':sha(runtime),'source_sha256':sha(source),
            'runtime_bytes':runtime.stat().st_size,'source_bytes':source.stat().st_size}
    (DIST/'release.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))

if __name__=='__main__':main()
