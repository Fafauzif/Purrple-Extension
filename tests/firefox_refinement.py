#!/usr/bin/env python3
"""Actual Firefox 1.1 workflows, including private closed-shadow iframe.

Uses the privileged WebDriver shadow endpoint only in this test process.
No production hook, API mock or accelerated clock is installed.
"""
import contextlib, hashlib, http.server, json, shutil, sys, threading, time
from pathlib import Path
import firefox_native as native
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'verification/firefox-refinement'
SHADOW='shadow-6066-11e4-a52e-4f735466cecf'


def main():
    OUT.mkdir(parents=True,exist_ok=True);native.OUT=OUT
    report={'version':'1.1.0','native_extension':True,'mocked_apis':False,'scope':'Native Firefox WebDriver user flows, privileged closed-shadow inspection, real 60-second alarm','checks':[]}
    def check(name,value,detail=None):
        report['checks'].append({'check':name,'pass':bool(value),'detail':detail});print(('PASS ' if value else 'FAIL ')+name,flush=True)
    d=None;server=None
    def install(profile=None):
        nonlocal d
        d=native.Driver(profile);report['browser_version']=d.capabilities['browserVersion']
        aid=d.command('/moz/addon/install',{'path':str(ROOT/'extension'),'temporary':True})
        d.command('/moz/context',{'context':'chrome'})
        uuid=d.js("window.SidebarController.hide();return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))['purrple-companion@purrple.local'];")
        d.command('/moz/context',{'context':'content'})
        d.top_handle=d.command('/window',method='GET')
        return 'moz-extension://'+uuid+'/',aid
    def popup(base):
        d.navigate(base+'popup.html');d.wait("return globalThis.PurrpleCompact?.getState() && !document.getElementById('compact-main').hidden",timeout=35)
    def app(base):
        d.navigate(base+'app.html');d.wait("return globalThis.PurrpleUI?.getState() && !document.getElementById('main').hidden",timeout=35)
    def shadow():
        host=d.command('/element',{'using':'css selector','value':'purrple-companion'})
        return d.command('/element/'+host[native.ELEMENT]+'/shadow',method='GET')[SHADOW]
    def sf(selector):return d.command('/shadow/'+shadow()+'/element',{'using':'css selector','value':selector})
    def sc(selector):
        el=sf(selector);return d.command('/element/'+el[native.ELEMENT]+'/click',{})
    def inside(selector,script='return arguments[0].hidden;'):
        return d.js(script,sf(selector))
    def frame():
        el=None
        for _ in range(80):
            try:el=sf('.panel iframe');break
            except RuntimeError as e:
                if 'no such element' not in str(e):raise
                time.sleep(.1)
        if not el:raise AssertionError('Authorized floating iframe did not appear')
        d.command('/frame',{'id':el})
        d.wait("return globalThis.PurrpleCompact?.getState() && !document.getElementById('compact-main').hidden",timeout=30)
    def top():d.command('/window',{'handle':d.top_handle})
    def reopen_panel(talk=False):
        sc('.paw');sc('[data-action="talk" ]' if talk else '[data-action="dashboard"]');frame()
    try:
        # A real version-1.0 profile was copied before this implementation loaded.
        upgrade=ROOT/'qa-runtime/upgrade-v1-profile'
        if upgrade.exists():
            base,aid=install(upgrade);popup(base);old=d.state()
            check('version-1-save-preserved-on-1-1-install',old['version']==1 and old['wallet']['balance']==15 and old['equipped']['head']=='moon-bow' and 'moon-bow' in old['owned'] and len(old['focusHistory'])==1,{'balance':old['wallet']['balance'],'equipped':old['equipped'],'focusHistory':len(old['focusHistory'])})
            check('old-save-talk-defaults-migrate-without-data-loss',d.action('TALK_REPLY',promptId='love-you').get('ok'))
            d.close();d=None
        else:
            report.setdefault('skipped',[]).append({'check':'version-1-save-upgrade','reason':'Optional prior-version browser profile is not present; no upgrade verification claimed.'})
        profile=ROOT/'qa-runtime/refinement-profile'
        if profile.exists():shutil.rmtree(profile)
        base,aid=install(profile);check('native-1-1-install',aid=='purrple-companion@purrple.local')
        popup(base)
        check('compact-native-not-preview',d.js('return PurrpleClient.native && document.getElementById("preview-label").hidden'))
        check('fresh-state-no-invented-tasks-or-coins',not d.state()['tasks'] and d.state()['wallet']['balance']==0)
        d.wait('return PurrpleRenderer.assetsReady',timeout=35)
        check('native-shared-renderer-forty-five-clips',d.js('return PurrpleRenderer.clips.length')==45)
        check('native-talk-bank-eighty-with-three-to-five-replies',d.js('return PurrpleTalk.CATALOG.length>=80 && PurrpleTalk.CATALOG.every(p=>p.variants.length>=3 && p.variants.length<=5)'))
        d.fill('#compact-task-title','Draft closed immediately, without pressing save')
        # No deliberate wait for a draft status or storage response.
        d.navigate('about:blank');popup(base)
        check('native-immediate-popup-close-keeps-draft',d.js('return document.getElementById("compact-task-title").value')=='Draft closed immediately, without pressing save')
        d.click('#compact-task-add');d.wait('return PurrpleCompact.getState().tasks.length===1')
        first=d.state()['tasks'][0];check('native-compact-form-task-created',first['title']=='Draft closed immediately, without pressing save')
        check('native-committed-task-clears-draft',d.state()['drafts']['quickTask']=='')
        app(base);d.click('[data-action="edit-task"]');d.wait('return document.getElementById("task-dialog").open')
        d.fill('#task-title','Edited in full home, seen in compact');d.click('#save-task');d.wait('return !document.getElementById("task-dialog").open')
        popup(base);check('native-two-surface-task-edit-shared',d.state()['tasks'][0]['title']=='Edited in full home, seen in compact' and 'Edited in full home' in d.js('return document.getElementById("compact-task-list").textContent'))
        d.click('[data-compact-action="complete"]');d.wait('return PurrpleCompact.getState().wallet.balance===20')
        check('native-compact-completion-earns-twenty',d.state()['wallet']['balance']==20)
        dedup=d.async_js('const done=arguments[arguments.length-1];Promise.all(Array.from({length:6},()=>browser.runtime.sendMessage({type:"ACTION",requestId:"same-native-refinement",action:{type:"TASK_TOGGLE",id:arguments[0]}}))).then(done);',first['id'])
        check('native-duplicate-request-no-reward-farming',d.state()['wallet']['balance']==20 and sum(l.get('ref')==first['id'] and l['amount']>0 for l in d.state()['ledger'])==1)
        before=d.state();invalid=d.action('BACKUP_IMPORT',backup={'app':'Purrple','state':{'version':999}})
        check('native-invalid-import-preserves-save',not invalid.get('ok') and d.state()==before)
        for i in range(40):
            r=d.action('TASK_ADD',title='Outfit QA '+str(i),effort='large');task=next(t for t in r['state']['tasks'] if t['title']=='Outfit QA '+str(i));d.action('TASK_TOGGLE',id=task['id'])
        items=d.js('return PurrpleCore.CATALOG')
        for item in items:d.action('SHOP_BUY',id=item['id'])
        check('native-fifteen-permanent-purchases',len(d.state()['owned'])==15)
        d.click('[data-compact-view="wardrobe"]');d.click('[data-compact-action="try"][data-id="cozy-beanie"]')
        check('native-try-on-keeps-save-unequipped',d.state()['equipped']['head'] is None)
        d.click('[data-compact-action="wear"][data-id="cozy-beanie"]');d.wait('return PurrpleCompact.getState().equipped.head==="cozy-beanie"')
        d.click('[data-compact-action="wear"][data-id="star-bandana"]');d.wait('return PurrpleCompact.getState().equipped.neck==="star-bandana"')
        check('native-head-neck-combined-outfit',d.state()['equipped']=={'head':'cozy-beanie','neck':'star-bandana'})
        d.screenshot('compact-wardrobe-native.png')
        d.click('[data-compact-view="today"]')
        d.js('const e=document.getElementById("compact-task-effort");e.value="large";e.dispatchEvent(new Event("change",{bubbles:true}));')
        d.fill('#compact-task-title','A large draft remembers its size')
        d.navigate('about:blank');popup(base)
        check('native-immediate-draft-close-keeps-title-and-large-size',d.js('return document.getElementById("compact-task-title").value==="A large draft remembers its size" && document.getElementById("compact-task-effort").value==="large"'))
        draft_balance=d.state()['wallet']['balance'];d.click('#compact-task-add');d.wait('return PurrpleCompact.getState().tasks.some(t=>t.title==="A large draft remembers its size")')
        large=next(t for t in d.state()['tasks'] if t['title']=='A large draft remembers its size')
        d.click('[data-compact-action="complete"][data-id="'+large['id']+'"]');d.wait('return PurrpleCompact.getState().wallet.balance==='+str(draft_balance+30))
        check('native-restored-large-draft-earns-thirty',d.state()['wallet']['balance']==draft_balance+30 and large['effort']=='large')
        d.click('[data-compact-view="talk"]');d.fill('[data-talk-search]','I love you');d.click('[data-talk-send="love-you"]');d.wait('return PurrpleCompact.getState().talk.last?.promptId==="love-you"')
        firstreply=d.state()['talk']['last'];d.click('[data-talk-send="love-you"]');d.wait('return PurrpleCompact.getState().talk.last.text!==arguments[0]' if False else 'return PurrpleCompact.getState().talk.last.id!=='+json.dumps(firstreply['id']))
        check('native-talk-rotates-local-authored-replies',d.state()['talk']['last']['text']!=firstreply['text'])
        d.click('[data-talk-favorite="love-you"]');d.wait('return PurrpleCompact.getState().talk.favorites.includes("love-you")')
        popup(base);d.click('[data-compact-view="talk"]');check('native-talk-history-and-favorite-survive-reopen',len(d.state()['talk']['history'])==2 and 'love-you' in d.state()['talk']['favorites'])
        d.screenshot('compact-talk-native.png')
        d.click('[data-compact-view="focus"]');d.click('#compact-focus-start');d.wait('return PurrpleCompact.getState().focus?.status==="running"')
        d.click('#compact-focus-pause');d.wait('return PurrpleCompact.getState().focus?.status==="paused"');remain=d.state()['focus']['remainingMs'];popup(base)
        check('native-compact-paused-focus-persists',d.state()['focus']['status']=='paused' and d.state()['focus']['remainingMs']==remain)
        d.click('[data-compact-view="focus"]');d.click('#compact-focus-pause');d.wait('return PurrpleCompact.getState().focus?.status==="running"');d.click('#compact-focus-end');d.wait('return !PurrpleCompact.getState().focus')
        check('native-compact-focus-resume-and-cancel',d.state()['focus'] is None)
        started=d.action('FOCUS_START',minutes=1,taskId=None);end=started['state']['focus']['endsAt'];balance=started['state']['wallet']['balance'];timer_start=time.monotonic()
        check('native-real-alarm-scheduled',any(a['name']=='purrple-next' for a in d.async_js('const done=arguments[arguments.length-1];browser.alarms.getAll().then(done);')))
        d.close();d=None;base,aid=install(profile);popup(base)
        check('native-running-timer-survives-restart',d.state()['focus']['endsAt']==end)
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),native.QuietHandler);threading.Thread(target=server.serve_forever,daemon=True).start();url='http://127.0.0.1:'+str(server.server_port)+'/'
        d.navigate(url);d.wait("return document.querySelector('purrple-companion')?.dataset.active==='true'",timeout=40)
        check('native-roaming-closed-shadow-boundary',d.js('return document.querySelector("purrple-companion").shadowRoot===null'))
        check('native-focus-body-double-study',d.js('return document.querySelector("purrple-companion").dataset.clip')=='study')
        d.click('#host-button');check('native-host-page-clickthrough',d.js('return document.getElementById("host-button").textContent')=='Still works')
        reopen_panel();check('native-floating-panel-authorized-and-loaded',d.js('return PurrpleClient.native && !!PurrpleCompact.getState()'))
        top();d.wait('return arguments.length===0 && true')
        check('native-panel-ready-handshake-hides-loading-strip',inside('.panel-status'))
        check('native-panel-stays-open-while-iframe-focused',not inside('.panel'))
        d.screenshot('floating-panel-native.png')
        frame();d.fill('#compact-task-title','Floating draft, closed in the same breath')
        with contextlib.suppress(RuntimeError):d.command('/actions',{'actions':[{'type':'key','id':'keyboard','actions':[{'type':'keyDown','value':'\ue00c'},{'type':'keyUp','value':'\ue00c'}]}]})
        top();time.sleep(.15)
        check('native-iframe-escape-closes-panel',inside('.panel'))
        check('native-panel-close-restores-cat-focus',inside('.actor','return arguments[0].getRootNode().activeElement===arguments[0];'))
        reopen_panel();check('native-floating-immediate-close-keeps-draft',d.js('return document.getElementById("compact-task-title").value')=='Floating draft, closed in the same breath')
        d.click('#panel-close');top();time.sleep(.15);check('native-iframe-close-button-handshake',inside('.panel'))
        reopen_panel(True);d.fill('[data-talk-search]','I love you');d.click('[data-talk-send="love-you"]');d.wait('return PurrpleCompact.getState().talk.history.length===3');tokenURL=d.js('return location.href');top();time.sleep(.15)
        check('native-floating-talk-same-saved-history',not inside('.panel'))
        d.screenshot('floating-talk-native.png')
        sc('.panel-close');check('native-outer-close-removes-private-frame',inside('.panel','return !arguments[0].querySelector("iframe");'))
        # A page can request public popup resources, but cannot authorize itself.
        d.js('const f=document.createElement("iframe");f.id="host-forged";f.src=arguments[0];document.body.append(f);',base+'popup.html?panel=1')
        fake=d.command('/element',{'using':'css selector','value':'#host-forged'});d.command('/frame',{'id':fake});d.wait('return document.getElementById("compact-error") && !document.getElementById("compact-error").hidden')
        check('native-unapproved-frame-cannot-read-state',not d.message({'type':'GET_STATE'}).get('ok'))
        check('native-unapproved-frame-cannot-mutate',not d.action('TASK_ADD',title='Forged page task').get('ok'))
        top();d.js('document.getElementById("host-forged").src=arguments[0];',tokenURL)
        fake=d.command('/element',{'using':'css selector','value':'#host-forged'});d.command('/frame',{'id':fake});time.sleep(.4)
        check('native-closed-panel-token-revoked',not d.message({'type':'GET_STATE'}).get('ok'));top();d.js('document.getElementById("host-forged").remove();')
        # Real pointer throw, sampled in real time through public diagnostics.
        xy=d.js('const h=document.querySelector("purrple-companion");return{x:Number(h.dataset.x),y:Number(h.dataset.y)-60};')
        d.command('/actions',{'actions':[{'type':'pointer','id':'mouse','parameters':{'pointerType':'mouse'},'actions':[{'type':'pointerMove','duration':0,'x':round(xy['x']),'y':round(xy['y'])},{'type':'pointerDown','button':0},{'type':'pointerMove','duration':110,'x':round(xy['x']-260),'y':round(xy['y']-180)}]}]})
        check('native-cat-real-pointer-held',d.js('return document.querySelector("purrple-companion").dataset.state')=='held')
        d.command('/actions',{'actions':[{'type':'pointer','id':'mouse','parameters':{'pointerType':'mouse'},'actions':[{'type':'pointerUp','button':0}]}]})
        trace=[];start=time.monotonic()
        while time.monotonic()-start<6:
            clip=d.js('return document.querySelector("purrple-companion").dataset.clip')
            if not trace or trace[-1]!=clip:trace.append(clip)
            time.sleep(.04)
        check('native-strong-throw-dramatic-cry-and-recovery',all(c in trace for c in ['released','tumble','impact','cry','paw-wipe']) and trace[-1] not in ['released','tumble','impact','cry','paw-wipe'],trace)
        check('native-throw-settles-and-host-still-works',d.js('return !["air","held"].includes(document.querySelector("purrple-companion").dataset.state) && document.getElementById("host-button").textContent==="Still works"'))
        d.screenshot('throw-recovered-native.png')
        popup(base)
        ownership=d.async_js('''const done=arguments[arguments.length-1],url=arguments[0];(async()=>{const app=await browser.tabs.getCurrent(),wait=ms=>new Promise(r=>setTimeout(r,ms)),s=async id=>{try{return await browser.tabs.sendMessage(id,{type:'PET_STATUS'});}catch{return null;}},ready=async id=>{for(let i=0;i<60;i++){const x=await s(id);if(x?.active)return x;await wait(100);}return s(id);};const a=await browser.tabs.create({url:url+'a',active:true}),a1=await ready(a.id),b=await browser.tabs.create({url:url+'b',active:true}),b1=await ready(b.id),a0=await s(a.id);await browser.tabs.update(a.id,{active:true});const a2=await ready(a.id),b0=await s(b.id);await browser.runtime.sendMessage({type:'ACTION',action:{type:'SETTINGS',patch:{hiddenHosts:['127.0.0.1']}}});await wait(250);const hidden=await s(a.id);await browser.runtime.sendMessage({type:'ACTION',action:{type:'SETTINGS',patch:{hiddenHosts:[]}}});const visible=await ready(a.id);await browser.tabs.update(app.id,{active:true});await browser.tabs.remove([a.id,b.id]);done({a1,b1,a0,a2,b0,hidden,visible});})().catch(e=>done({error:String(e)}));''',url)
        check('native-tab-handoff-one-visible-cat',ownership.get('a1',{}).get('active') and ownership.get('b1',{}).get('active') and not ownership.get('a0',{}).get('active') and ownership.get('a2',{}).get('active') and not ownership.get('b0',{}).get('active'),ownership)
        check('native-hidden-host-and-unhide',not ownership.get('hidden',{}).get('active') and ownership.get('visible',{}).get('active'))
        while time.monotonic()-timer_start<62:time.sleep(min(2,62-(time.monotonic()-timer_start)))
        raw=d.async_js('const done=arguments[arguments.length-1];browser.storage.local.get("purrpleState").then(x=>done(x.purrpleState));')
        check('native-real-minute-alarm-completes-without-ui-reconcile',raw['focus'] is None and raw['wallet']['balance']==balance+5 and len(raw['focusHistory'])==1)
        d.action('FOCUS_FINISH');check('native-focus-bonus-remains-once',d.state()['wallet']['balance']==balance+5)
        backup=d.message({'type':'BACKUP_EXPORT'});restored=d.action('BACKUP_IMPORT',backup=backup['backup'])
        check('native-talk-outfit-draft-backup-roundtrip',restored.get('ok') and restored['state']['equipped']=={'head':'cozy-beanie','neck':'star-bandana'} and len(restored['state']['talk']['history'])==3 and restored['state']['drafts']['quickTask']=='Floating draft, closed in the same breath' and restored['state']['drafts']['quickEffort']=='large')
        d.command('/moz/context',{'context':'chrome'});errors=d.js('return Services.console.getMessageArray().filter(m=>m.sourceName && m.sourceName.startsWith(arguments[0]) && m.errorMessage).map(m=>({message:m.errorMessage,source:m.sourceName,line:m.lineNumber}));',base)
        check('native-no-extension-script-errors',not errors,errors)
        report['script_errors']=errors
    except Exception as e:
        report['error']=str(e);check('native-refinement-harness-completes',False,str(e))
        if d:
            with contextlib.suppress(Exception):d.screenshot('failure-native.png')
    finally:
        if server:server.shutdown()
        if d:d.close()
        report['passed']=sum(c['pass'] for c in report['checks']);report['failed']=sum(not c['pass'] for c in report['checks'])
        (OUT/'native-refinement-checks.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'passed':report['passed'],'failed':report['failed'],'error':report.get('error')},indent=2))
    if report['failed']:raise SystemExit(1)
if __name__=='__main__':main()
