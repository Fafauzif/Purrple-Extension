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

def sync_install_guide():
    """Keep the same offline guide at runtime and repository root."""
    guide=(EXT/'INSTALL-PURRPLE.html').read_text()
    root_guide=guide.replace('src="assets/','src="extension/assets/').replace('href="assets/','href="extension/assets/').replace("url('assets/","url('extension/assets/")
    (ROOT/'INSTALL-PURRPLE.html').write_text(root_guide)

RUNTIME_PAGES = {'app.html','popup.html','animations.html','START_HERE.html',
                 'INSTALL-PURRPLE.html','CALENDAR-SETUP.html','manifest.json'}
ART_JSON = {'pose-registration.json','renderer-base.json','renderer-motion-anchors.json',
            'wardrobe-data.json','neckwear-fit.json'}
ROOT_FILES = {'AGENTS.md','ARCHITECTURE.md','CONTEXT.md','DESIGN.md','.gitattributes','.gitignore',
              'INSTALL-PURRPLE.html','PRODUCT.md','README.md','UX-CONTRACT.md','VERIFICATION.md',
              'package.json','package-lock.json','premium-ui.json','ui-desktop.png'}


def runtime_paths():
    for p in sorted(EXT.rglob('*')):
        if not p.is_file() or p.is_symlink():
            continue
        rel = p.relative_to(EXT)
        first = rel.parts[0]
        if (rel.as_posix() in RUNTIME_PAGES or
            len(rel.parts)==2 and ((first=='js' and p.suffix=='.js') or
                                   (first=='css' and p.suffix=='.css')) or
            first=='assets' and (p.suffix in {'.png','.ttf','.txt'} or
                rel.as_posix() in {'assets/atlas-manifest.json','assets/refinement/manifest.json',
                                    'assets/refinement/supplemental-manifest.json'})):
            yield rel.as_posix(),p


def source_paths():
    allowed_dirs = {
        'art': {'.md','.py','.cjs','.png','.html','.txt'},
        'docs': {'.md'},
        'scripts': {'.py'},
        'tests': {'.py','.cjs','.html'}
    }
    art_data = {'art/refinement-source/' + n for n in
                ('prompts.json','supplemental-prompts.json','registration-report.json',
                 'supplemental-registration-report.json')}
    for name in sorted(ROOT_FILES | {'art/'+n for n in ART_JSON} | art_data):
        p=ROOT/name
        if p.is_file() and not p.is_symlink():
            yield name,p
    for prefix,suffixes in allowed_dirs.items():
        for p in sorted((ROOT/prefix).rglob('*')):
            rel=p.relative_to(ROOT)
            if (p.is_file() and not p.is_symlink() and p.suffix in suffixes and
                not any(part.startswith('.') or part in {'__pycache__','profiles','node_modules'} for part in rel.parts)):
                yield rel.as_posix(),p
    for name in ['tools/calendar/calendar_host.py','tools/calendar/setup_calendar.py']:
        yield name,ROOT/name
    for name,p in runtime_paths():
        yield 'extension/'+name,p


def main():
    DIST.mkdir(exist_ok=True)
    manifest=json.loads((EXT/'manifest.json').read_text())
    package=json.loads((ROOT/'package.json').read_text())
    if manifest['version']!=package['version']:raise SystemExit('Manifest and package versions must match.')
    if manifest.get('browser_specific_settings',{}).get('gecko',{}).get('id')!='purrple-companion@purrple.local':
        raise SystemExit('The stable extension identity must be preserved.')
    required=['app.html','popup.html','js/talk.js','js/talk-ui.js','js/core.js','js/background.js','js/client.js',
              'js/renderer-data.js','js/renderer.js','js/content.js','js/app.js','js/compact.js',
              'css/app.css','css/talk.css','css/compact.css','assets/icon128.png','START_HERE.html','INSTALL-PURRPLE.html',
              'CALENDAR-SETUP.html','js/ambient.js','js/calendar-ui.js']
    for name in required:
        if not (EXT/name).is_file():raise SystemExit('Missing runtime file: '+name)
    sync_install_guide()
    # Never ship remote code, API credentials or the retired AI integration.
    for p in EXT.rglob('*.js'):
        text=p.read_text()
        if re.search(r'openrouter|api\.openai|runAI|api[_-]?key',text,re.I):
            raise SystemExit('Unexpected external-provider reference in '+str(p))
    runtime_files=dict(runtime_paths())
    hashes={name:sha(p) for name,p in runtime_files.items()}
    runtime=DIST/'Purrple_Firefox_Extension.zip'
    with zipfile.ZipFile(runtime,'w',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
        for name in hashes:add_file(z,EXT/name,name)
    source=DIST/'Purrple_Complete_Source.zip'
    with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
        for name,path in source_paths():
            add_file(z,path,name)
    for p in [runtime,source]:
        with zipfile.ZipFile(p) as z:
            assert z.testzip() is None
            assert not any('qa-runtime/' in n or 'verification/review/' in n or 'privateverification/' in n or n=='verification/premium-audit.json' for n in z.namelist())
            assert not any(n.startswith('verification/') and Path(n).suffix.lower() in {'.png','.jpg','.jpeg','.webp','.gif','.webm','.mp4','.pdf'} for n in z.namelist())
    with zipfile.ZipFile(source) as z:
        assert 'extension/manifest.json' in z.namelist()
        assert 'INSTALL-PURRPLE.html' in z.namelist()
        assert not any(n.startswith('Purrple/') for n in z.namelist())
    result={'version':manifest['version'],'runtime':str(runtime),'source':str(source),
            'runtime_files':len(hashes),'runtime_sha256':sha(runtime),'source_sha256':sha(source),
            'runtime_bytes':runtime.stat().st_size,'source_bytes':source.stat().st_size,
            'source_layout':'repository root contents; no enclosing directory',
            'signing_status':'unsigned development ZIP; no Mozilla signing claim'}
    (DIST/'release.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))

if __name__=='__main__':main()
