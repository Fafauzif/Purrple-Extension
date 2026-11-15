#!/usr/bin/env python3
"""Install the exact distributed ZIP after extraction and smoke-test in Firefox."""
import hashlib,json,sys,time,zipfile,shutil,contextlib,threading,http.server
from pathlib import Path
import firefox_native as native

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'verification/firefox-zip'
ZIP=ROOT/'dist/Purrple_Firefox_Extension.zip'
COPY=ROOT/'qa-runtime/install-copy'

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    native.OUT=OUT
    report={'version':json.loads((ROOT/'extension/manifest.json').read_text())['version'],'artifact':ZIP.name,'sha256':hashlib.sha256(ZIP.read_bytes()).hexdigest(),'native_extension':True,'checks':[]}
    def check(name,value,detail=None):
        report['checks'].append({'check':name,'pass':bool(value),'detail':detail});print(('PASS 'if value else'FAIL ')+name,flush=True)
    if COPY.exists():shutil.rmtree(COPY)
    with zipfile.ZipFile(ZIP) as z:
        assert z.testzip() is None
        for name in z.namelist():assert '..' not in Path(name).parts and not Path(name).is_absolute()
        z.extractall(COPY)
        check('zip-integrity',True,len(z.namelist()))
    check('root-manifest-present',(COPY/'manifest.json').is_file())
    exact=True
    for p in (ROOT/'extension').rglob('*'):
        if p.is_file():exact=exact and (COPY/p.relative_to(ROOT/'extension')).read_bytes()==p.read_bytes()
    check('extracted-runtime-matches-working-tree',exact and {str(p.relative_to(COPY))for p in COPY.rglob('*')if p.is_file()}=={str(p.relative_to(ROOT/'extension'))for p in (ROOT/'extension').rglob('*')if p.is_file()})
    d=None;server=None
    try:
        d=native.Driver();report['browser_version']=d.capabilities['browserVersion']
        check('exact-zip-native-install',d.command('/moz/addon/install',{'path':str(COPY),'temporary':True})=='purrple-companion@purrple.local')
        d.command('/moz/context',{'context':'chrome'})
        uuid=d.js("window.SidebarController.hide();return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))['purrple-companion@purrple.local'];")
        d.command('/moz/context',{'context':'content'});base='moz-extension://'+uuid+'/'
        d.navigate(base+'app.html');d.wait("return !document.getElementById('main').hidden")
        d.wait("return PurrpleRenderer.assetsReady",timeout=30)
        check('packaged-renderer-ready',True)
        check('packaged-native-data-zero-balance',d.state()['wallet']['balance']==0)
        # Earn coins through actual task completion, then unlock every catalog item.
        all_items=d.js('return PurrpleCore.CATALOG')
        for i in range(40):
            response=d.action('TASK_ADD',title='ZIP smoke reward '+str(i),effort='large')
            task=next(t for t in response['state']['tasks'] if t['title']=='ZIP smoke reward '+str(i))
            d.action('TASK_TOGGLE',id=task['id'])
        for item in all_items:d.action('SHOP_BUY',id=item['id'])
        check('packaged-all-fifteen-shop-items-purchasable',len(d.state()['owned'])==15)
        d.action('EQUIP',slot='head',id='cozy-beanie');d.action('EQUIP',slot='neck',id='star-bandana')
        d.click('[data-view="wardrobe"]')
        height=d.js('return document.documentElement.scrollHeight')
        for y in range(0,height,500):
            d.js('window.scrollTo(0,arguments[0]);',y);time.sleep(.12)
        d.wait("return Array.from(document.querySelectorAll('.shop-thumb')).length===15 && Array.from(document.querySelectorAll('.shop-thumb')).every(i=>i.complete && i.naturalWidth>0)",timeout=30)
        d.js('window.scrollTo(0,0);')
        check('packaged-all-fifteen-thumbnails-load',True)
        check('packaged-combined-equipped-outfit',d.state()['equipped']=={'head':'cozy-beanie','neck':'star-bandana'})
        d.screenshot('packaged-wardrobe-native.png')
        d.navigate(base+'popup.html');d.wait("return !document.getElementById('compact-main').hidden")
        check('packaged-popup-shares-outfit',d.state()['equipped']['head']=='cozy-beanie')
        check('packaged-compact-four-tabs',d.js('return document.querySelectorAll("[data-compact-view]").length')==4)
        check('packaged-talk-ninety-prompts-two-hundred-seventy-replies',d.js('return PurrpleTalk.CATALOG.length===90 && PurrpleTalk.CATALOG.reduce((n,p)=>n+p.variants.length,0)===270'))
        check('packaged-forty-five-shared-movements',d.js('return PurrpleRenderer.clips.length')==45)
        payload='<img src=x onerror="document.body.dataset.compactXss=1">'
        d.fill('#compact-task-title',payload);d.click('#compact-task-add');d.wait('return PurrpleCompact.getState().tasks.some(t=>t.title.startsWith("<img"))')
        check('packaged-compact-task-html-payload-is-text',d.js('return !document.body.dataset.compactXss && document.getElementById("compact-task-list").textContent.includes("<img") && !document.getElementById("compact-task-list").querySelector("img")'))
        d.screenshot('packaged-popup-native.png')
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),native.QuietHandler)
        threading.Thread(target=server.serve_forever,daemon=True).start()
        d.navigate('http://127.0.0.1:'+str(server.server_port)+'/')
        d.wait("return document.querySelector('purrple-companion')?.dataset.active==='true'",timeout=30)
        check('packaged-roaming-content-visible',True)
        d.screenshot('packaged-roaming-native.png')
        d.command('/moz/context',{'context':'chrome'})
        errors=d.js("return Services.console.getMessageArray().filter(m=>m.sourceName && m.sourceName.startsWith(arguments[0]) && m.errorMessage).map(m=>({message:m.errorMessage,source:m.sourceName,line:m.lineNumber}));",base)
        check('packaged-no-extension-script-errors',not errors,errors)
    except Exception as e:
        report['error']=str(e);check('packaged-harness-complete',False,str(e))
        if d:
            with contextlib.suppress(Exception):d.screenshot('packaged-failure.png')
    finally:
        if server:server.shutdown()
        if d:d.close()
        report['passed']=sum(x['pass'] for x in report['checks']);report['failed']=sum(not x['pass'] for x in report['checks'])
        (OUT/'packaged-checks.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
    if report['failed']:raise SystemExit(1)

if __name__=='__main__':main()
