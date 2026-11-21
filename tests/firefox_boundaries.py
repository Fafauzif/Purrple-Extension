#!/usr/bin/env python3
"""Native strict-CSP page and zoom/short-viewport panel scenarios."""
import contextlib,http.server,json,threading,time,os
from pathlib import Path
import firefox_native as native
ROOT=Path(__file__).resolve().parents[1];EXT=Path(os.environ.get('PURRPLE_EXTENSION_DIR',str(ROOT/'extension')));OUT=ROOT/'verification/firefox-boundaries';SHADOW='shadow-6066-11e4-a52e-4f735466cecf'
class Handler(http.server.BaseHTTPRequestHandler):
 def do_GET(self):
  if self.path=='/host.js':data=b'document.getElementById("host-button").addEventListener("click",()=>document.getElementById("host-button").textContent="Still works");';mime='text/javascript'
  else:data=b'<!doctype html><html><head><title>Strict CSP Purrple fixture</title><script src="/host.js" defer></script></head><body><h1>Strict CSP page</h1><button id="host-button">Host button</button><input id="host-input" aria-label="Host input"></body></html>';mime='text/html'
  self.send_response(200);self.send_header('Content-Type',mime);
  if self.path!='/ordinary':self.send_header('Content-Security-Policy',"default-src 'self'; frame-src 'none'; script-src 'self'; img-src 'self'; style-src 'self'; object-src 'none'")
  self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
 def log_message(self,*args):pass

def main():
 OUT.mkdir(parents=True,exist_ok=True);native.OUT=OUT;d=None;server=None;report={'native_extension':True,'mocked_apis':False,'installed_from':str(EXT),'runtime_sha256':os.environ.get('PURRPLE_RUNTIME_SHA256'),'checks':[],'csp':"default-src 'self'; frame-src 'none'; script-src 'self'; img-src 'self'; style-src 'self'; object-src 'none'"}
 def check(name,value,detail=None):report['checks'].append({'check':name,'pass':bool(value),'detail':detail});print(('PASS 'if value else'FAIL ')+name,flush=True)
 try:
  d=native.Driver();report['browser_version']=d.capabilities['browserVersion'];d.command('/moz/addon/install',{'path':str(EXT),'temporary':True});d.command('/moz/context',{'context':'chrome'});uuid=d.js("window.SidebarController.hide();return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))['purrple-companion@purrple.local'];");d.command('/moz/context',{'context':'content'});base='moz-extension://'+uuid+'/'
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();url='http://127.0.0.1:'+str(server.server_port)+'/strict';d.navigate(url);top_handle=d.command('/window',method='GET');d.wait("return document.querySelector('purrple-companion')?.dataset.active==='true'",timeout=40)
  def sf(selector):
   host=d.command('/element',{'using':'css selector','value':'purrple-companion'});shadow=d.command('/element/'+host[native.ELEMENT]+'/shadow',method='GET')[SHADOW];return d.command('/shadow/'+shadow+'/element',{'using':'css selector','value':selector})
  def sc(selector,native_pointer=True):
   el=sf(selector)
   if not native_pointer:return d.js('arguments[0].click();',el)
   xy=d.js('const r=arguments[0].getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};',el);d.command('/actions',{'actions':[{'type':'pointer','id':'native-mouse','parameters':{'pointerType':'mouse'},'actions':[{'type':'pointerMove','duration':0,'x':xy['x'],'y':xy['y']},{'type':'pointerDown','button':0},{'type':'pointerUp','button':0}]}]})
  def enter():el=sf('.panel iframe');d.command('/frame',{'id':el});d.wait('return globalThis.PurrpleCompact?.getState()',timeout=12)
  def top():d.command('/window',{'handle':top_handle})
  check('strict-csp-roaming-active',True)
  check('strict-csp-canvas-extension-origin-protection',d.js('const c=arguments[0];try{c.getContext("2d").getImageData(0,0,1,1);return false;}catch(e){return e.name==="SecurityError" && c.width>0 && c.height>0;}',sf('.scene')))
  d.click('#host-button');check('strict-csp-host-js-and-clickthrough',d.js('return document.getElementById("host-button").textContent')=='Still works')
  sc('.actor');sc('.menu [data-action=today]');enter();check('strict-csp-private-iframe-native-state',d.js('return PurrpleClient.native && document.getElementById("preview-label").hidden'));top()
  d.wait('return arguments.length===0 && true');time.sleep(.1);check('strict-csp-ready-handshake-completes',d.js('return arguments[0].hidden;',sf('.panel-status')));d.screenshot('strict-csp-panel-native.png')
  enter();d.click('#panel-close');top();d.command('/window/rect',{'width':500,'height':420});d.command('/moz/context',{'context':'chrome'});d.js('gBrowser.selectedBrowser.fullZoom=1.5;');d.command('/moz/context',{'context':'content'});time.sleep(.2)
  check('native-page-zoom-one-hundred-fifty-percent',d.js('return Math.abs(devicePixelRatio-1.5)<.01'),d.js('return {devicePixelRatio,innerWidth,innerHeight}'))
  sc('.actor',False);sc('.menu [data-action=today]',False);time.sleep(.2)
  geometry=d.js('const r=arguments[0].getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,innerWidth,innerHeight};',sf('.panel'))
  check('native-zoomed-short-panel-clamped-to-viewport',geometry['x']>=11 and geometry['y']>=11 and geometry['right']<=geometry['innerWidth']-10 and geometry['bottom']<=geometry['innerHeight']-10,geometry)
  enter();check('native-zoomed-short-panel-no-horizontal-overflow',d.js('return document.documentElement.scrollWidth<=innerWidth'),d.js('return {innerWidth,scroll:document.documentElement.scrollWidth,innerHeight}'))
  check('native-short-panel-usable-content-scroll-owner',d.js('const m=document.getElementById("compact-main");return m.clientHeight>=120 && document.documentElement.scrollHeight>innerHeight;'),d.js('return {mainHeight:document.getElementById("compact-main").clientHeight,documentHeight:document.documentElement.scrollHeight,innerHeight};'))
  d.click('#compact-pet');d.click('#compact-pet-menu [data-action=talk]')
  check('native-short-panel-talk-control-operates',d.js('return !document.getElementById("compact-pet-menu").hidden && document.getElementById("compact-pet-menu").dataset.level==="talk"'))
  d.click('#compact-pet-menu [data-action=joke]');d.wait('return PurrpleCompact.getState().talk.last?.promptId==="joke"')
  d.js('document.getElementById("compact-pet-speech").scrollIntoView({block:"center"});')
  check('native-short-panel-reply-can-be-scrolled-fully-into-view',d.js('const r=document.getElementById("compact-pet-speech").getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight;'));top();d.screenshot('zoomed-short-panel-native.png')
  d.command('/moz/context',{'context':'chrome'});d.js('gBrowser.selectedBrowser.fullZoom=1;');d.command('/moz/context',{'context':'content'});d.command('/window/rect',{'width':1280,'height':950})
  enter();d.click('#panel-close');top();d.navigate(url.replace('/strict','/ordinary'));d.wait("return document.querySelector('purrple-companion')?.dataset.active==='true'",timeout=30)
  # Ordinary host-created frames have no access even without the panel query.
  for path in (['popup.html','app.html','game.html?game=paw-pairs'] if (EXT/'game.html').exists() else ['popup.html','app.html']):
   d.js('const f=document.createElement("iframe");f.id="unauthorized";f.src=arguments[0];document.body.append(f);',base+path)
   el=d.command('/element',{'using':'css selector','value':'#unauthorized'})
   try:
    d.command('/frame',{'id':el});time.sleep(.35)
    state=d.message({'type':'GET_STATE'});backup=d.message({'type':'BACKUP_EXPORT'});change=d.action('TASK_ADD',title='Host frame attempt')
    check('native-host-created-'+path+'-private-operations-denied',not state.get('ok') and not backup.get('ok') and not change.get('ok'),{'state':state,'backup':backup,'action':change})
   except RuntimeError as e:
    if path!='app.html' or not any(reason in str(e) for reason in ('no such frame','browser is not defined')):raise
    manifest=json.loads((EXT/'manifest.json').read_text());resources=manifest['web_accessible_resources'][0]['resources']
    check('native-full-app-not-web-accessible-and-frame-blocked','app.html' not in resources,'Firefox rejected the frame or opened it without extension APIs.')
   top();d.js('document.getElementById("unauthorized").remove();')
 except Exception as e:
  report['error']=str(e);check('native-boundaries-harness-complete',False,str(e))
  if d:
   with contextlib.suppress(Exception):d.screenshot('boundary-failure.png')
 finally:
  if server:server.shutdown()
  if d:d.close()
  report['passed']=sum(c['pass']for c in report['checks']);report['failed']=sum(not c['pass']for c in report['checks']);(OUT/'native-boundaries-checks.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
 if report['failed']:raise SystemExit(1)
if __name__=='__main__':main()
