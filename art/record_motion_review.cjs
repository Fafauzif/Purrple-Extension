/* Real-time capture of every final shared-renderer clip. No product mutations. */
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'verification/review/temporal');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../tests/browser_runtime.cjs').executable(),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--disable-gpu','--allow-file-access-from-files']});
 const page=await browser.newPage({viewport:{width:1200,height:900}});
 await page.goto('file://'+path.join(root,'extension/animations.html'));
 await page.waitForFunction(()=>PurrpleMotionStudio?.getState().ready);
 const result=await page.evaluate(async()=>{
  PurrpleMotionStudio.pause();const R=PurrpleRenderer,c=document.createElement('canvas');c.width=960;c.height=600;
  document.body.replaceChildren(c);c.style.cssText='width:960px;height:600px';const g=c.getContext('2d');
  const stream=c.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:2400000}),chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  const finished=new Promise(resolve=>recorder.onstop=resolve),timings=[];
  let index=0,start=0,lastPaint=0,paints=0,first=0;
  function frame(now){
   if(!first)first=now;if(!start){start=now;timings.push({id:R.clips[index].id,startSeconds:(now-first)/1000});}
   const clip=R.clips[index],time=(now-start)/1000,windowDuration=Math.max(.65,clip.duration)+.2;
   if(now-lastPaint>=1000/30-.3){
    lastPaint=now-(now-lastPaint)%(1000/30);paints++;g.fillStyle='#282034';g.fillRect(0,0,960,600);
    g.fillStyle='#f4e3fc';g.font='600 27px system-ui';g.fillText(String(index+1).padStart(2,'0')+' / 45   '+clip.name,42,52);
    g.fillStyle='#ceb3df';g.font='16px system-ui';g.fillText(clip.id+' · '+clip.sourceFrames+' illustrated '+(clip.sourceFrames===1?'pose':'poses')+' · '+clip.duration.toFixed(2)+' seconds',42,82);
    g.fillStyle='#33283e';g.fillRect(0,470,960,130);g.strokeStyle='#584064';g.beginPath();g.moveTo(0,470);g.lineTo(960,470);g.stroke();
    R.draw(g,{clip:clip.id,time:Math.min(time,clip.duration-.000001),x:248,y:470,size:128,equipped:{},rootMotion:true});
    R.draw(g,{clip:clip.id,time:Math.min(time,clip.duration-.000001),x:680,y:470,size:256,equipped:{head:'cozy-beanie',neck:'star-bandana'},rootMotion:true});
    g.fillStyle='#ceb3df';g.font='16px system-ui';g.fillText('128px · page companion size',126,525);g.fillText('256px · outfit inspection',563,525);
    g.fillStyle='#4a3657';g.fillRect(42,554,876,5);g.fillStyle='#ce9ff1';g.fillRect(42,554,876*Math.min(1,time/clip.duration),5);
    g.font='13px system-ui';g.fillStyle='#af92c2';g.fillText('30fps capture target · 30Hz geometry articulation · fixed illustrated source poses',42,585);
   }
   if(time>=windowDuration){index++;start=0;if(index===R.clips.length){recorder.stop();stream.getTracks().forEach(t=>t.stop());return;}}
   requestAnimationFrame(frame);
  }
  recorder.start(1000);requestAnimationFrame(frame);await finished;
  const blob=new Blob(chunks,{type:'video/webm'}),data=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob);});
  return{data,timings,paints,seconds:(performance.now()-first)/1000,diagnostics:R.getDiagnostics()};
 });
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'all-45-motion-playback.webm'),Buffer.from(result.data.split(',')[1],'base64'));delete result.data;
 fs.writeFileSync(path.join(out,'playback-capture.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
