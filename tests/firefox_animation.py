#!/usr/bin/env python3
"""Native Firefox shared-renderer/explorer checks; no artificial clock."""
import contextlib,json,time,os
from pathlib import Path
import firefox_native as native
ROOT=Path(__file__).resolve().parents[1];EXT=Path(os.environ.get('PURRPLE_EXTENSION_DIR',str(ROOT/'extension')));OUT=ROOT/'verification/firefox-animation'

def main():
 OUT.mkdir(parents=True,exist_ok=True);native.OUT=OUT;d=None
 report={'native_extension':True,'mocked_apis':False,'installed_from':str(EXT),'runtime_sha256':os.environ.get('PURRPLE_RUNTIME_SHA256'),'scope':'Actual Firefox shared renderer, all clip/outfit samples, live RAF draw timing. Headless timing is not a promise for another device.','checks':[]}
 def check(name,value,detail=None):report['checks'].append({'check':name,'pass':bool(value),'detail':detail});print(('PASS 'if value else'FAIL ')+name,flush=True)
 try:
  d=native.Driver();report['browser_version']=d.capabilities['browserVersion'];d.command('/moz/addon/install',{'path':str(EXT),'temporary':True});d.command('/moz/context',{'context':'chrome'});uuid=d.js("window.SidebarController.hide();return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))['purrple-companion@purrple.local'];");d.command('/moz/context',{'context':'content'});base='moz-extension://'+uuid+'/'
  d.navigate(base+'animations.html');d.wait('return PurrpleRenderer.assetsReady && document.querySelectorAll("#clips [data-clip]").length===45',timeout=40)
  check('native-explorer-uses-all-forty-five-shared-clips',True)
  d.js('document.getElementById("head").value="moon-bow";document.getElementById("head").dispatchEvent(new Event("change"));document.getElementById("neck").value="star-bandana";document.getElementById("neck").dispatchEvent(new Event("change"));')
  d.click('[data-clip="walk"]');time.sleep(.5);d.screenshot('native-explorer-walk.png')
  check('native-explorer-frame-and-outfit-controls',d.js('return document.getElementById("head").value==="moon-bow" && document.getElementById("neck").value==="star-bandana" && document.getElementById("frame").textContent!=="—"'))
  samples={'clips':0,'draws':0,'failures':[]}
  clip_ids=d.js('return PurrpleRenderer.clips.map(c=>c.id)')
  for clip_id in clip_ids:
   sample=d.js('''const R=PurrpleRenderer,clip=R.clips.find(c=>c.id===arguments[0]),c=document.createElement('canvas');c.width=c.height=320;const ctx=c.getContext('2d'),failures=[];for(const id of [null,...R.itemIds]){const equipped=id?{head:id,neck:null}:{head:null,neck:null};if(id && ['star-bandana','moon-collar','cozy-scarf','petal-collar','cloud-bib','night-bandana'].includes(id)){equipped.head=null;equipped.neck=id;}for(const fraction of [0,.25,.5,.75]){ctx.clearRect(0,0,320,320);try{R.draw(ctx,{clip:clip.id,time:clip.duration*fraction,size:128,x:160,y:250,equipped});const pixels=ctx.getImageData(0,0,320,320).data;let alpha=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])alpha++;if(alpha<100)failures.push({clip:clip.id,id,fraction,alpha});}catch(e){failures.push({clip:clip.id,id,error:String(e)});}}}R.clearCache();return{draws:64,failures};''',clip_id)
   samples['clips']+=1;samples['draws']+=sample['draws'];samples['failures']+=sample['failures']
  check('native-every-clip-and-fifteen-item-render-samples',samples['clips']==45 and not samples['failures'],samples)
  timing=d.async_js('''const done=arguments[arguments.length-1],R=PurrpleRenderer;const canvas=document.createElement('canvas');canvas.width=canvas.height=640;const ctx=canvas.getContext('2d');(async()=>{const results=[];for(const size of [128,256])for(const equipped of [{head:'moon-bow',neck:'star-bandana'},{head:'cozy-beanie',neck:'cozy-scarf'}]){const costs=[],gaps=[],beg=performance.now();let last=beg,paint=0;await new Promise(resolve=>{function tick(now){gaps.push(now-last);last=now;if(now-paint>=1000/30-.2){const t=performance.now();ctx.clearRect(0,0,640,640);R.draw(ctx,{clip:'walk',time:(now-beg)/1000,size,x:320,y:510,equipped});costs.push(performance.now()-t);paint=now;}if(now-beg<2000)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});costs.sort((a,b)=>a-b);results.push({size,equipped,paintedFrames:costs.length,drawMeanMs:costs.reduce((a,b)=>a+b,0)/costs.length,drawP95Ms:costs[Math.floor(costs.length*.95)],measuredSeconds:(last-beg)/1000});}done(results);})().catch(e=>done({error:String(e)}));''')
  check('native-thirty-fps-draw-budget-at-128-and-256',isinstance(timing,list) and all(x['drawP95Ms']<33.34 and x['paintedFrames']>=40 for x in timing),timing)
  d.js('document.getElementById("head").value="cozy-beanie";document.getElementById("head").dispatchEvent(new Event("change"));document.getElementById("neck").value="cozy-scarf";document.getElementById("neck").dispatchEvent(new Event("change"));');d.click('[data-clip="cry"]');time.sleep(.4);d.screenshot('native-explorer-cry.png')
  d.click('#play');before=d.js('return document.getElementById("time").textContent');time.sleep(.25);check('native-explorer-pause-control',d.js('return document.getElementById("time").textContent')==before)
  d.click('#next');check('native-explorer-frame-step-control',d.js('return document.getElementById("time").textContent')!=before)
  d.command('/window/rect',{'width':500,'height':844});check('native-explorer-narrow-no-overflow',d.js('return document.documentElement.scrollWidth<=innerWidth'));d.screenshot('native-explorer-narrow.png')
  d.command('/moz/context',{'context':'chrome'});errors=d.js('return Services.console.getMessageArray().filter(m=>m.sourceName && m.sourceName.startsWith(arguments[0]) && m.errorMessage).map(m=>({message:m.errorMessage,source:m.sourceName,line:m.lineNumber}));',base);check('native-explorer-no-extension-errors',not errors,errors)
 except Exception as e:
  report['error']=str(e);check('native-animation-harness-complete',False,str(e))
  if d:
   with contextlib.suppress(Exception):d.screenshot('animation-failure.png')
 finally:
  if d:d.close()
  report['passed']=sum(c['pass']for c in report['checks']);report['failed']=sum(not c['pass']for c in report['checks']);(OUT/'native-animation-checks.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
 if report['failed']:raise SystemExit(1)
if __name__=='__main__':main()
