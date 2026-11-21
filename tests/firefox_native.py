#!/usr/bin/env python3
"""Native Firefox WebDriver integration checks, no Selenium dependency.

Set PURRPLE_FIREFOX and PURRPLE_GECKODRIVER to local official browser binaries.
The browser and its WebDriver server share this process/network namespace.
No extension API is mocked. Tests use a fresh, temporary Firefox profile.
"""
import base64
import contextlib
import http.server
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'verification/firefox'
FIREFOX=os.environ.get('PURRPLE_FIREFOX',str(ROOT/'qa-runtime/firefox/firefox'))
GECKO=os.environ.get('PURRPLE_GECKODRIVER',str(ROOT/'qa-runtime/geckodriver'))
ELEMENT='element-6066-11e4-a52e-4f735466cecf'


class Driver:
    def __init__(self,profile=None):
        self.log=open(OUT/'geckodriver.log','w')
        with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
        self.url=f'http://127.0.0.1:{port}'
        test_env=os.environ.copy();test_env['MOZ_REMOTE_ALLOW_SYSTEM_ACCESS']='1'
        self.process=subprocess.Popen([GECKO,'--host','127.0.0.1','--port',str(port),'--log','warn'],stdout=self.log,stderr=subprocess.STDOUT,env=test_env)
        for _ in range(100):
            try:self.req('GET','/status');break
            except Exception:time.sleep(.1)
        args=['-headless','--allow-system-access']
        if profile:
            Path(profile).mkdir(parents=True,exist_ok=True);args+=['-profile',str(profile)]
        caps={'capabilities':{'alwaysMatch':{'browserName':'firefox','moz:firefoxOptions':{
            'binary':FIREFOX,'args':args,
            'prefs':{'browser.shell.checkDefaultBrowser':False,'browser.startup.homepage_override.mstone':'ignore',
                     'datareporting.policy.dataSubmissionEnabled':False,'toolkit.telemetry.reportingpolicy.firstRun':False,
                     'extensions.webextensions.enablePermissionPrompts':False}}}}}
        created=self.req('POST','/session',caps)
        self.sid=created['sessionId'];self.capabilities=created['capabilities']
        self.req('POST',self.path('/timeouts'),{'script':30000,'pageLoad':30000,'implicit':0})

    def req(self,method,path,data=None):
        payload=None if data is None else json.dumps(data).encode()
        req=urllib.request.Request(self.url+path,payload,{'Content-Type':'application/json'},method=method)
        try:
            result=json.load(urllib.request.urlopen(req,timeout=65))
        except urllib.error.HTTPError as e:
            raise RuntimeError(e.read().decode()) from e
        value=result.get('value',result)
        if isinstance(value,dict) and value.get('error') and 'stacktrace' in value:raise RuntimeError(json.dumps(value))
        return value

    def path(self,path):return '/session/'+self.sid+path
    def command(self,path,data=None,method='POST'):return self.req(method,self.path(path),data)
    def js(self,script,*args):return self.command('/execute/sync',{'script':script,'args':list(args)})
    def async_js(self,script,*args):return self.command('/execute/async',{'script':script,'args':list(args)})
    def navigate(self,url):return self.command('/url',{'url':url})
    def wait(self,script,timeout=20):
        start=time.monotonic();last=None
        while time.monotonic()-start<timeout:
            try:
                last=self.js(script)
                if last:return last
            except Exception as e:last=str(e)
            time.sleep(.15)
        raise AssertionError(f'Wait failed: {script}: {last}')
    def click(self,selector):
        e=self.command('/element',{'using':'css selector','value':selector})
        return self.command('/element/'+e[ELEMENT]+'/click',{})
    def fill(self,selector,value):
        e=self.command('/element',{'using':'css selector','value':selector})
        self.command('/element/'+e[ELEMENT]+'/clear',{})
        return self.command('/element/'+e[ELEMENT]+'/value',{'text':str(value)})
    def screenshot(self,name):
        data=self.command('/screenshot',method='GET')
        (OUT/name).write_bytes(base64.b64decode(data))
    def message(self,message):
        return self.async_js('const done=arguments[arguments.length-1];browser.runtime.sendMessage(arguments[0]).then(done,e=>done({ok:false,error:String(e)}));',message)
    def state(self):
        response=self.message({'type':'GET_STATE'})
        if not response.get('ok'):raise AssertionError(response)
        return response['state']
    def action(self,typ,**fields):
        return self.message({'type':'ACTION','action':{'type':typ,**fields}})
    def close(self):
        with contextlib.suppress(Exception):self.req('DELETE',self.path(''))
        self.process.terminate()
        with contextlib.suppress(Exception):self.process.wait(timeout=10)
        if self.process.poll() is None:self.process.kill()
        self.log.close()


class QuietHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        content=b'<!doctype html><html><head><title>Purrple native browser test</title></head><body><h1>A normal webpage</h1><button id="host-button" onclick="this.textContent=\'Still works\'">Host page button</button><textarea id="host-input"></textarea><p>The companion must not block this page.</p></body></html>'
        self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Length',str(len(content)));self.end_headers();self.wfile.write(content)
    def log_message(self,*args):pass


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    report={'browser':'Native Firefox','native_extension':True,'mocked_apis':False,'checks':[]}
    def check(name,condition,detail=None):
        report['checks'].append({'check':name,'pass':bool(condition),'detail':detail})
        print(('PASS ' if condition else 'FAIL ')+name,flush=True)
    driver=None
    try:
        profile=ROOT/'qa-runtime/native-test-profile'
        if profile.exists():shutil.rmtree(profile)
        driver=Driver(profile);d=driver
        report['browser_version']=d.capabilities['browserVersion']
        addon=d.command('/moz/addon/install',{'path':str(ROOT/'extension'),'temporary':True})
        check('native-temporary-addon-install',addon=='purrple-companion@purrple.local',addon)
        d.command('/moz/context',{'context':'chrome'})
        uuid=d.js("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))['purrple-companion@purrple.local'];")
        check('native-extension-uuid',bool(uuid),uuid)
        sidebar=d.js("return {open:window.SidebarController.isOpen,width:window.document.getElementById('sidebar-box').getBoundingClientRect().width};")
        check('native-sidebar-open',sidebar['open'] and sidebar['width']>=300,sidebar)
        time.sleep(1.5);d.screenshot('sidebar-native.png')
        d.js('window.SidebarController.hide();')
        d.command('/moz/context',{'context':'content'})
        base='moz-extension://'+uuid+'/'
        report['extension_base']=base
        d.navigate(base+'app.html')
        d.wait("return document.getElementById('main') && !document.getElementById('main').hidden",timeout=30)
        check('dashboard-native-load',not d.js("return !!document.getElementById('preview-label') && !document.getElementById('preview-label').hidden"))
        state=d.state();check('fresh-state-zero-coins',state['wallet']['balance']==0)
        check('catalog-fifteen-items',d.js('return PurrpleCore.CATALOG.length')==15)
        d.screenshot('dashboard-native.png')

        # Exercise a real user-facing form, not only API helpers.
        d.fill('#quick-title','A task entered through the real Firefox UI')
        d.click('#quick-form button[type="submit"]')
        d.wait("return document.querySelectorAll('[data-task]').length===1")
        ui_task=d.state()['tasks'][0]
        check('real-ui-task-create',ui_task['title']=='A task entered through the real Firefox UI')
        d.click('.task-actions > summary')
        d.click('[data-action="edit-task"]')
        d.wait("return document.getElementById('task-dialog').open")
        d.fill('#task-title','Edited in Firefox')
        d.click('#save-task');d.wait("return !document.getElementById('task-dialog').open")
        check('real-ui-task-edit',d.state()['tasks'][0]['title']=='Edited in Firefox')
        d.action('TASK_ARCHIVE',id=ui_task['id'],archived=True)

        # Actual background action processing and shared extension storage.
        added=d.action('TASK_ADD',title='Native Firefox task',effort='large',priority='high',recurrence='none',subtasks=['Read brief','Write notes'])
        check('native-task-add',added.get('ok') and len(added['state']['tasks'])==2)
        task=next(t for t in added['state']['tasks'] if t['title']=='Native Firefox task')
        toggles=d.async_js('const done=arguments[arguments.length-1];Promise.all(Array.from({length:8},()=>browser.runtime.sendMessage({type:"ACTION",action:{type:"TASK_TOGGLE",id:arguments[0]}}))).then(done);',task['id'])
        state=d.state();rewards=[x for x in state['ledger'] if x['amount']>0 and x['ref']==task['id']]
        check('concurrent-toggle-reward-once',len(rewards)==1 and state['wallet']['balance']==30,{'rewards':len(rewards),'balance':state['wallet']['balance']})
        purchase=d.async_js('const done=arguments[arguments.length-1];Promise.all(Array.from({length:5},()=>browser.runtime.sendMessage({type:"ACTION",action:{type:"SHOP_BUY",id:"moon-bow"}}))).then(done);')
        state=d.state();check('concurrent-purchase-once',state['owned'].count('moon-bow')==1 and state['wallet']['balance']==10,state['wallet'])
        check('equip-owned-item',d.action('EQUIP',slot='head',id='moon-bow').get('ok'))
        unowned=d.action('EQUIP',slot='neck',id='cozy-scarf');check('reject-unowned-item',not unowned.get('ok'),unowned.get('error'))
        bad=d.action('BACKUP_IMPORT',backup={'version':1,'tasks':[]});check('invalid-backup-rejected',not bad.get('ok'),bad.get('error'))
        state=d.state();check('invalid-import-preserves-data',state['equipped']['head']=='moon-bow' and state['wallet']['balance']==10)
        text=d.action('TASK_ADD',title='<img src=x onerror="document.body.dataset.xss=1">',effort='small')
        check('task-text-payload-stored-as-text',text.get('ok'))
        time.sleep(.3)
        check('no-task-html-execution',not d.js('return document.body.dataset.xss'))

        d.click('[data-view="wardrobe"]');time.sleep(.5)
        d.screenshot('wardrobe-native.png')
        d.click('[data-view="focus"]');time.sleep(.2)
        d.screenshot('focus-native.png')
        focus=d.action('FOCUS_START',minutes=1,taskId=None);check('native-focus-start',focus.get('ok') and focus['state']['focus']['status']=='running')
        pause=d.action('FOCUS_PAUSE');check('native-focus-pause',pause.get('ok') and pause['state']['focus']['status']=='paused')
        remaining=pause['state']['focus']['remainingMs'];time.sleep(.35)
        check('paused-time-stays-fixed',d.state()['focus']['remainingMs']==remaining)
        resumed=d.action('FOCUS_RESUME');check('native-focus-resume',resumed.get('ok') and resumed['state']['focus']['status']=='running')
        cancelled=d.action('FOCUS_CANCEL');check('cancel-focus-no-bonus',cancelled.get('ok') and cancelled['state']['wallet']['balance']==10)
        d.action('FOCUS_START',minutes=1,taskId=None)
        timer_started=time.monotonic()
        expected_end=d.state()['focus']['endsAt']
        alarms=d.async_js('const done=arguments[arguments.length-1];browser.alarms.getAll().then(done);')
        check('native-alarm-scheduled',any(a['name']=='purrple-next' for a in alarms),alarms)
        driver.close();driver=None
        driver=Driver(profile);d=driver
        d.command('/moz/addon/install',{'path':str(ROOT/'extension'),'temporary':True})
        d.command('/moz/context',{'context':'chrome'})
        uuid=d.js("window.SidebarController.hide();return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))['purrple-companion@purrple.local'];")
        d.command('/moz/context',{'context':'content'});base='moz-extension://'+uuid+'/'
        d.navigate(base+'app.html');d.wait("return !document.getElementById('main').hidden")
        resumed_after_restart=d.state()['focus']
        check('running-focus-survives-native-browser-restart',resumed_after_restart and resumed_after_restart['status']=='running' and resumed_after_restart['endsAt']==expected_end)
        d.command('/window/rect',{'width':500,'height':844})
        dimensions=d.js('return {width:innerWidth,scroll:document.documentElement.scrollWidth}')
        check('narrow-no-horizontal-overflow',dimensions['scroll']<=dimensions['width'],dimensions)
        d.screenshot('narrow-native.png')
        d.command('/window/rect',{'width':1280,'height':950})

        # Popup is a real moz-extension page with the same background state.
        d.navigate(base+'popup.html');d.wait("return document.getElementById('compact-main') && !document.getElementById('compact-main').hidden")
        check('popup-shares-native-state',d.js("return document.getElementById('coin-balance').textContent")=='10')
        d.screenshot('popup-native.png')

        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),QuietHandler)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        host='http://127.0.0.1:'+str(server.server_port)+'/'
        ownership=d.async_js('''
          const done=arguments[arguments.length-1],url=arguments[0];
          (async()=>{
            const app=await browser.tabs.getCurrent();
            const wait=ms=>new Promise(r=>setTimeout(r,ms));
            const status=async id=>{try{return await browser.tabs.sendMessage(id,{type:'PET_STATUS'});}catch{return null;}};
            const ready=async id=>{for(let i=0;i<40;i++){const s=await status(id);if(s?.active)return s;await wait(100);}return status(id);};
            const a=await browser.tabs.create({url:url+'first',active:true});const aFirst=await ready(a.id);
            const b=await browser.tabs.create({url:url+'second',active:true});const bActive=await ready(b.id);const aHidden=await status(a.id);
            await browser.tabs.update(a.id,{active:true});const aAgain=await ready(a.id);const bHidden=await status(b.id);
            await browser.runtime.sendMessage({type:'ACTION',action:{type:'SETTINGS',patch:{hiddenHosts:['127.0.0.1']}}});await wait(200);
            const siteHidden=await status(a.id);
            await browser.runtime.sendMessage({type:'ACTION',action:{type:'SETTINGS',patch:{hiddenHosts:[]}}});const siteRestored=await ready(a.id);
            await browser.tabs.update(app.id,{active:true});await browser.tabs.remove([a.id,b.id]);
            done({aFirst,bActive,aHidden,aAgain,bHidden,siteHidden,siteRestored});
          })().catch(e=>done({error:String(e)}));
        ''',host)
        check('native-first-tab-cat-active',ownership.get('aFirst',{}).get('active'),ownership)
        check('native-tab-handoff-single-owner',ownership.get('bActive',{}).get('active') and not ownership.get('aHidden',{}).get('active'),ownership)
        check('native-tab-return-handoff',ownership.get('aAgain',{}).get('active') and not ownership.get('bHidden',{}).get('active'),ownership)
        check('native-hidden-host-hides-cat',not ownership.get('siteHidden',{}).get('active'),ownership)
        check('native-unhide-host-restores-cat',ownership.get('siteRestored',{}).get('active'),ownership)
        d.navigate(host);d.wait("return document.querySelector('purrple-companion')?.dataset.active==='true'",timeout=30)
        check('roaming-cat-native-visible',d.js("return document.querySelector('purrple-companion').dataset.active==='true'"))
        d.wait("return document.querySelector('purrple-companion').dataset.clip==='study'",timeout=5)
        check('native-focus-body-double',d.js("return document.querySelector('purrple-companion').dataset.clip==='study'"))
        d.click('#host-button');check('host-button-works',d.js("return document.getElementById('host-button').textContent")=='Still works')
        d.screenshot('roaming-native.png')
        actor=d.js("const h=document.querySelector('purrple-companion');return {x:Number(h.dataset.x),y:Number(h.dataset.y)-58};")
        d.command('/actions',{'actions':[{'type':'pointer','id':'mouse','parameters':{'pointerType':'mouse'},'actions':[
            {'type':'pointerMove','duration':0,'x':round(actor['x']),'y':round(actor['y'])},
            {'type':'pointerDown','button':0},
            {'type':'pointerMove','duration':250,'x':round(actor['x']-150),'y':round(actor['y']-120)},
            {'type':'pause','duration':150}]}]})
        check('native-pointer-pickup-held',d.js("return document.querySelector('purrple-companion').dataset.state==='held'"))
        d.command('/actions',{'actions':[{'type':'pointer','id':'mouse','parameters':{'pointerType':'mouse'},'actions':[{'type':'pointerUp','button':0}]}]})
        time.sleep(.05)
        check('native-pointer-release-airborne',d.js("return document.querySelector('purrple-companion').dataset.state==='air'"))
        time.sleep(2.5)
        check('native-pointer-drag-no-page-break',d.js("return document.querySelector('purrple-companion').dataset.active==='true' && document.getElementById('host-button').textContent==='Still works'"))
        check('native-throw-settles',d.js("return document.querySelector('purrple-companion').dataset.state!=='air' && document.querySelector('purrple-companion').dataset.state!=='held'"))
        d.screenshot('after-native-drag.png')

        # Deadline and data security checks still use the real background context.
        d.navigate(base+'app.html');d.wait("return !document.getElementById('main').hidden")
        due=d.action('TASK_ADD',title='Native due reminder',effort='small',dueAt=int(time.time()*1000)-5000)
        due_task=next(t for t in due['state']['tasks'] if t['title']=='Native due reminder')
        snooze=d.action('REMINDER_SNOOZE',id=due_task['id'],minutes=5)
        check('native-reminder-snooze',snooze.get('ok') and next(t for t in snooze['state']['tasks'] if t['id']==due_task['id'])['reminder']['snoozeUntil']>int(time.time()*1000))
        backup=d.message({'type':'BACKUP_EXPORT'})
        check('native-backup-export',backup.get('ok') and backup['backup']['app']=='Purrple')
        restored=d.action('BACKUP_IMPORT',backup=backup['backup'])
        check('native-backup-roundtrip',restored.get('ok') and restored['state']['equipped']['head']=='moon-bow')
        # Let an actual 60s alarm complete. No shortened or mocked timer.
        while time.monotonic()-timer_started<62:
            time.sleep(min(2,62-(time.monotonic()-timer_started)))
        raw=d.async_js('const done=arguments[arguments.length-1];browser.storage.local.get("purrpleState").then(x=>done(x.purrpleState));')
        check('native-alarm-completed-without-get-state',raw['focus'] is None and raw['wallet']['balance']==15)
        final=d.state()
        check('real-one-minute-focus-completes',final['focus'] is None and len(final['focusHistory'])==1)
        check('real-focus-bonus-once',final['wallet']['balance']==15 and sum(l['type']=='focus' for l in final['ledger'])==1,final['wallet'])
        d.state();d.action('FOCUS_FINISH')
        check('focus-repeat-finish-no-extra-coins',d.state()['wallet']['balance']==15)
        d.screenshot('completed-focus-native.png')
        # Restart Firefox and reload the temporary add-on under the same identity.
        driver.close();driver=None
        driver=Driver(profile);d=driver
        d.command('/moz/addon/install',{'path':str(ROOT/'extension'),'temporary':True})
        d.command('/moz/context',{'context':'chrome'})
        uuid=d.js("window.SidebarController.hide();return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))['purrple-companion@purrple.local'];")
        d.command('/moz/context',{'context':'content'});d.navigate('moz-extension://'+uuid+'/app.html')
        d.wait("return !document.getElementById('main').hidden")
        restarted=d.state();check('native-browser-restart-keeps-progress',restarted['wallet']['balance']==15 and restarted['equipped']['head']=='moon-bow' and len(restarted['focusHistory'])==1)
        d.command('/moz/context',{'context':'chrome'})
        script_errors=d.js("return Services.console.getMessageArray().filter(m=>m.sourceName && m.sourceName.startsWith(arguments[0]) && m.errorMessage).map(m=>({message:m.errorMessage,source:m.sourceName,line:m.lineNumber}));",'moz-extension://'+uuid+'/')
        check('native-extension-no-script-errors',not script_errors,script_errors)
        report['extension_script_errors']=script_errors
        d.command('/moz/context',{'context':'content'})
        server.shutdown()
    except Exception as e:
        report['error']=str(e);check('harness-completes',False,str(e))
        if driver:
            with contextlib.suppress(Exception):driver.screenshot('failure-native.png')
    finally:
        if driver:driver.close()
        report['passed']=sum(x['pass'] for x in report['checks']);report['failed']=sum(not x['pass'] for x in report['checks'])
        (OUT/'native-checks.json').write_text(json.dumps(report,indent=2))
        print(json.dumps({'passed':report['passed'],'failed':report['failed'],'error':report.get('error')},indent=2))
    if report['failed']:raise SystemExit(1)


if __name__=='__main__':main()
