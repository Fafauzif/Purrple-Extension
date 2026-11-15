#!/usr/bin/env python3
"""Operate Firefox's actual pinned toolbar popup, not a popup.html tab.

Firefox WebDriver's privileged chrome context locates the extension's native
popup browser. Its built-in Marionette actor executes the same native element
interaction methods because a XUL browser is not an HTML iframe.
"""
import base64,contextlib,json,time,http.server,threading,os
from pathlib import Path
import firefox_native as native
ROOT=Path(__file__).resolve().parents[1];EXT=Path(os.environ.get('PURRPLE_EXTENSION_DIR',str(ROOT/'extension')));OUT=ROOT/'verification/firefox-toolbar'
def main():
 OUT.mkdir(parents=True,exist_ok=True);native.OUT=OUT;d=None;server=None;report={'native_extension':True,'mocked_apis':False,'installed_from':str(EXT),'runtime_sha256':os.environ.get('PURRPLE_RUNTIME_SHA256'),'actual_toolbar_popup':True,'checks':[]}
 def check(name,value,detail=None):report['checks'].append({'check':name,'pass':bool(value),'detail':detail});print(('PASS 'if value else'FAIL ')+name,flush=True)
 try:
  d=native.Driver();report['browser_version']=d.capabilities['browserVersion'];d.command('/moz/addon/install',{'path':str(EXT),'temporary':True});time.sleep(1.5);d.command('/moz/context',{'context':'chrome'})
  d.js("window.SidebarController.hide();window.CustomizableUI.addWidgetToArea('purrple-companion_purrple_local-browser-action',window.CustomizableUI.AREA_NAVBAR);")
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),native.QuietHandler);threading.Thread(target=server.serve_forever,daemon=True).start();d.command('/moz/context',{'context':'content'});d.navigate('http://127.0.0.1:'+str(server.server_port)+'/');d.wait("return document.querySelector('purrple-companion')?.dataset.active==='true'",timeout=40);d.command('/moz/context',{'context':'chrome'})
  def open_popup():
   d.click('#purrple-companion_purrple_local-BAP')
   d.wait('return !!document.querySelector("browser.webextension-popup-browser")')
   for _ in range(60):
    ready=pjs('return globalThis.PurrpleCompact?.getState() && !!globalThis.PurrpleRenderer?.assetsReady;')
    if ready:break
    time.sleep(.1)
  def actor(script,*args):
   return d.async_js('const done=arguments[arguments.length-1];const b=document.querySelector("browser.webextension-popup-browser");if(!b){done({error:"No actual popup browser"});return;}const a=b.browsingContext.currentWindowGlobal.getActor("MarionetteCommands");Promise.resolve((async(a)=>{'+script+'})(a)).then(done,e=>done({error:String(e)}));',*args)
  def pjs(script,*args):return actor('return await a.executeScript(arguments[0],arguments[1],{timeout:20000});',script,list(args))
  def native_click(selector):return actor('const el=await a.findElement("css selector",arguments[0],{});return await a.clickElement(el,new Map([["moz:accessibilityChecks",false],["moz:webdriverClick",true]]));',selector)
  def native_type(selector,text):return actor('const el=await a.findElement("css selector",arguments[0],{});return await a.sendKeysToElement(el,arguments[1],new Map([["moz:accessibilityChecks",false],["moz:webdriverClick",true],["strictFileInteractability",false]]));',selector,text)
  def snapshot(name):
   encoded=actor('return await a.takeScreenshot(null,0,false,false);')
   if isinstance(encoded,str):(OUT/name).write_bytes(base64.b64decode(encoded))
   else:raise AssertionError(encoded)
  open_popup();geometry=pjs('return {width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,native:PurrpleClient.native,preview:!document.getElementById("preview-label").hidden,className:document.body.className};')
  check('actual-toolbar-popup-usable-intrinsic-size',360<=geometry['width']<=380 and 500<=geometry['height']<=610,geometry)
  check('actual-toolbar-popup-no-horizontal-overflow',geometry['scroll']<=geometry['width'])
  check('actual-toolbar-popup-native-ready',geometry['native'] and not geometry['preview'])
  check('actual-toolbar-popup-four-working-tabs',pjs('return document.querySelectorAll("[data-compact-view]").length===4'))
  result=native_type('#compact-task-title','Typed in the real Firefox toolbar popup');check('actual-toolbar-native-keyboard-input',not isinstance(result,dict) or not result.get('error'),result)
  result=native_click('#compact-task-add');time.sleep(.2);check('actual-toolbar-native-click-adds-task',pjs('return PurrpleCompact.getState().tasks.some(t=>t.title==="Typed in the real Firefox toolbar popup")'),result)
  native_click('[data-compact-view="focus"]');check('actual-toolbar-focus-tab-opens',pjs('return PurrpleCompact.getView()')=='focus')
  native_click('[data-compact-view="wardrobe"]');check('actual-toolbar-wardrobe-catalog-visible',pjs('return document.querySelectorAll("#compact-shop-grid [data-compact-action=try]").length')==15)
  native_click('[data-compact-view="talk"]');native_click('[data-talk-quick="love-you"]');time.sleep(.2);check('actual-toolbar-talk-reply-saved',pjs('return PurrpleCompact.getState().talk.last?.promptId')=='love-you')
  reply=pjs('return PurrpleCompact.getState().talk.last');snapshot('actual-toolbar-talk-native.png')
  native_click('[data-compact-view="today"]');snapshot('actual-toolbar-today-native.png')
  native_click('#panel-close');d.wait('return !document.querySelector("browser.webextension-popup-browser")')
  check('actual-toolbar-close-button-closes-native-popup',True)
  d.command('/moz/context',{'context':'content'});d.wait('return document.querySelector("purrple-companion")?.dataset.active==="true" && document.querySelector("purrple-companion").dataset.clip==='+json.dumps(reply['reaction']),timeout=3)
  host=d.command('/element',{'using':'css selector','value':'purrple-companion'});shadow=d.command('/element/'+host[native.ELEMENT]+'/shadow',method='GET')['shadow-6066-11e4-a52e-4f735466cecf'];speech=d.command('/shadow/'+shadow+'/element',{'using':'css selector','value':'.speech'})
  check('actual-toolbar-reply-appears-immediately-on-cat-reclaim',d.js('return !arguments[0].hidden && arguments[0].querySelector("p").textContent===arguments[1];',speech,reply['text']))
  d.screenshot('actual-toolbar-reply-on-page-native.png');d.command('/moz/context',{'context':'chrome'})
  open_popup();check('actual-toolbar-reopen-keeps-task-and-talk',pjs('return PurrpleCompact.getState().tasks.length===1 && PurrpleCompact.getState().talk.history.length===1'))
 except Exception as e:
  report['error']=str(e);check('native-toolbar-harness-completes',False,str(e))
 finally:
  if d:d.close()
  if server:server.shutdown()
  report['passed']=sum(c['pass']for c in report['checks']);report['failed']=sum(not c['pass']for c in report['checks']);(OUT/'actual-toolbar-checks.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
 if report['failed']:raise SystemExit(1)
if __name__=='__main__':main()
