#!/usr/bin/env python3
"""Native visible Play routes, recovery and artwork reacquisition."""
import base64,contextlib,http.server,io,json,os,threading,time
from pathlib import Path
import firefox_native as native
ROOT=Path(__file__).resolve().parents[1];EXT=Path(os.environ.get('PURRPLE_EXTENSION_DIR',str(ROOT/'extension')));OUT=ROOT/'verification/firefox-play';SHADOW='shadow-6066-11e4-a52e-4f735466cecf'
def main():
 OUT.mkdir(parents=True,exist_ok=True);native.OUT=OUT;d=None;server=None;report={'native_extension':True,'mocked_apis':False,'installed_from':str(EXT),'runtime_sha256':os.environ.get('PURRPLE_RUNTIME_SHA256'),'checks':[]}
 def check(name,value,detail=None):report['checks'].append({'check':name,'pass':bool(value),'detail':detail});print(('PASS 'if value else'FAIL ')+name,flush=True)
 try:
  d=native.Driver();report['browser_version']=d.capabilities['browserVersion'];d.command('/moz/addon/install',{'path':str(EXT),'temporary':True});d.command('/moz/context',{'context':'chrome'});d.js('window.SidebarController.hide();');d.command('/moz/context',{'context':'content'})
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),native.QuietHandler);threading.Thread(target=server.serve_forever,daemon=True).start();url='http://127.0.0.1:'+str(server.server_port)+'/'
  d.navigate(url);d.wait("return document.querySelector('purrple-companion')?.dataset.active==='true'",timeout=40)
  def sf(selector):
   host=d.command('/element',{'using':'css selector','value':'purrple-companion'});shadow=d.command('/element/'+host[native.ELEMENT]+'/shadow',method='GET')[SHADOW];return d.command('/shadow/'+shadow+'/element',{'using':'css selector','value':selector})
  def sc(selector):el=sf(selector);return d.command('/element/'+el[native.ELEMENT]+'/click',{})
  def menu():sc('.actor')
  game_only=(EXT/'game.html').is_file()
  menu();sc('[data-action="play"]')
  check('native-visible-play-has-starter-game',d.js('return !arguments[0].hidden && !!arguments[0].querySelector("[data-action=companion-play-paw-pairs]");',sf('.menu')))
  if game_only:
   handle=d.command('/window',method='GET')
   sc('[data-action="companion-play-paw-pairs"]')
   for _ in range(80):
    try:frame=sf('.panel iframe');break
    except RuntimeError:time.sleep(.1)
   else:raise AssertionError('Game iframe did not appear')
   d.command('/frame',{'id':frame})
   d.wait('return location.pathname==="/game.html" && document.querySelector("#game-content .cg-game-title")?.textContent==="Paw Pairs"',timeout=15)
   check('native-selected-game-has-no-planner-controls',d.js('return !document.querySelector(".compact-nav,.cp-nav")'))
   d.click('[data-cp=start-game]');d.wait('return document.querySelectorAll(".cg-card").length===12')
   d.click('#game-close');d.command('/window',{'handle':handle})
   d.wait('return document.querySelector("purrple-companion").dataset.active==="true"')
   check('native-game-close-restores-purrple-focus',d.js('return arguments[0].getRootNode().activeElement===arguments[0]',sf('.actor')))
  else:
   sc('.menu [data-action=back]')
   sc('.menu header button')
  for clip in ['knead','wave','nuzzle','roll','stretch','loaf']:
   menu();sc('[data-action="care"]' if game_only else '[data-action="play"]');sc('[data-action="tricks"]')
   sc('.menu [data-action="'+clip+'"]');d.wait('return document.querySelector("purrple-companion").dataset.clip==='+json.dumps(clip),timeout=3)
   check('native-visible-play-'+clip+'-reaches-authored-clip',True)
  menu();sc('[data-action="care"]');sc('[data-action="nap"]');d.wait('return document.querySelector("purrple-companion").dataset.clip==="doze"');check('native-nap-enters-doze-then-sleep',bool(d.wait('return document.querySelector("purrple-companion").dataset.clip==="sleep"',timeout=5)))
  menu();sc('[data-action="care"]');sc('[data-action="nap"]');d.wait('return document.querySelector("purrple-companion").dataset.clip==="wake"');check('native-wake-reaches-authored-clip',True)
  menu();sc('[data-action="care"]');sc('[data-action="home"]');d.wait('return document.querySelector("purrple-companion").dataset.atHome==="true"',timeout=12);sc('.house');d.wait('return document.querySelector("purrple-companion").dataset.atHome==="false"')
  overlap=d.js('const p=arguments[0].getBoundingClientRect(),h=arguments[1].getBoundingClientRect();return {overlap:p.left<h.right&&p.right>h.left&&p.top<h.bottom&&p.bottom>h.top};',sf('.actor'),sf('.house'))
  check('native-house-wake-keeps-cat-control-clear',not overlap['overlap'],overlap)
  def throw(strong):
   xy=d.js('const h=document.querySelector("purrple-companion");return{x:Number(h.dataset.x),y:Number(h.dataset.y)-58};')
   moves=[{'type':'pointerMove','duration':0,'x':round(xy['x']),'y':round(xy['y'])},{'type':'pointerDown','button':0},{'type':'pointerMove','duration':100 if strong else 500,'x':round(xy['x']-(260 if strong else 35)),'y':round(xy['y']-(180 if strong else 30))}]
   if not strong:moves.append({'type':'pause','duration':220})
   d.command('/actions',{'actions':[{'type':'pointer','id':'mouse','parameters':{'pointerType':'mouse'},'actions':moves}]});d.command('/actions',{'actions':[{'type':'pointer','id':'mouse','parameters':{'pointerType':'mouse'},'actions':[{'type':'pointerUp','button':0}]}]})
   trace=[];started=time.monotonic()
   while time.monotonic()-started<(7 if strong else 2.5):
    clip=d.js('return document.querySelector("purrple-companion").dataset.clip')
    if not trace or trace[-1]!=clip:trace.append(clip)
    time.sleep(.035)
   return trace
  soft=throw(False);check('native-soft-drop-has-no-dramatic-cry','cry' not in soft and 'soothe' not in soft,soft)
  strong=throw(True);check('native-strong-throw-reaches-soothe-before-settling',all(c in strong for c in ['released','tumble','impact','cry','paw-wipe','soothe']) and strong[-1] not in ['released','tumble','impact','cry','paw-wipe','soothe'],strong)
  first=d.command('/window',method='GET');second=d.command('/window/new',{'type':'tab'})['handle'];d.command('/window',{'handle':second});d.navigate(url+'second');d.wait('return document.querySelector("purrple-companion")?.dataset.active==="true"',timeout=30)
  d.command('/window',{'handle':first});d.wait('return document.querySelector("purrple-companion")?.dataset.active==="true"',timeout=30);time.sleep(.4)
  encoded=d.command('/element/'+sf('.actor')[native.ELEMENT]+'/screenshot',method='GET');data=base64.b64decode(encoded);(OUT/'native-reacquired-cat.png').write_bytes(data)
  from PIL import Image
  pixels=Image.open(io.BytesIO(data)).convert('RGB');raw=pixels.tobytes();purple=sum(1 for r,g,b in zip(raw[0::3],raw[1::3],raw[2::3])if b>g+12 and r>g+8 and b>90)
  check('native-tab-return-reacquires-visible-cat-artwork',purple>150,{'purplePixels':purple,'size':pixels.size})
  d.click('#host-button');check('native-play-and-recovery-preserve-host-clickthrough',d.js('return document.getElementById("host-button").textContent')=='Still works');d.screenshot('native-play-recovered.png')
 except Exception as e:
  report['error']=str(e);check('native-play-harness-completes',False,str(e))
  if d:
   with contextlib.suppress(Exception):d.screenshot('native-play-failure.png')
 finally:
  if d:d.close()
  if server:server.shutdown()
  report['passed']=sum(c['pass']for c in report['checks']);report['failed']=sum(not c['pass']for c in report['checks']);(OUT/'native-play-checks.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
 if report['failed']:raise SystemExit(1)
if __name__=='__main__':main()
