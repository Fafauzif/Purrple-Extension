/* Actual shared-runtime motion inspection, with no product/storage mutations. */
(() => {
'use strict';
const $=id=>document.getElementById(id),R=globalThis.PurrpleRenderer,canvas=$('stage'),ctx=canvas.getContext('2d');
let clip=R.clips[0],time=0,playing=!matchMedia('(prefers-reduced-motion:reduce)').matches,speed=1,fps=30,size=256,background='paper',query='',category='All',tour=false;
let elapsed=0,last=0,paint=0,metric=0,paintCount=0,measured=0,ready=false,uiStamp=0;const errors=[];
const outfit=()=>({head:$('head').value,neck:$('neck').value});
function options(select,items){for(const [id,label] of items)select.add(new Option(label,id));}
function catalog(){
 const focus=document.activeElement?.dataset?.clip,focusCategory=document.activeElement?.dataset?.category;
 $('count').textContent=R.clips.length;
 $('categories').replaceChildren(...['All',...new Set(R.clips.map(c=>c.category))].map(c=>{const b=document.createElement('button');b.textContent=c;b.dataset.category=c;b.setAttribute('aria-pressed',category===c);b.onclick=()=>{category=c;catalog();};return b;}));
 const list=R.clips.filter(c=>(category==='All'||category===c.category)&&`${c.name} ${c.id}`.toLowerCase().includes(query));
 $('clips').replaceChildren(...list.map(c=>{const b=document.createElement('button');b.dataset.clip=c.id;b.setAttribute('aria-pressed',c.id===clip.id);const text=document.createElement('span');text.textContent=c.name;const meta=document.createElement('small');meta.textContent=c.sourceFrames+(c.sourceFrames===1?' key':' keys');b.append(text,meta);b.onclick=()=>select(c.id);return b;}));
 if(!list.length){const p=document.createElement('p');p.textContent='No movements match. Clear the search to see them all.';$('clips').append(p);}
 $('clear').hidden=!query;if(focus)document.querySelector(`[data-clip="${focus}"]`)?.focus({preventScroll:true});else if(focusCategory)document.querySelector(`[data-category="${focusCategory}"]`)?.focus({preventScroll:true});
}
function sync(){
 $('play').textContent=playing?'Pause':'Play';$('play').setAttribute('aria-label',playing?'Pause animation':'Play animation');
 $('time').textContent=`${time.toFixed(2)} / ${clip.duration.toFixed(2)} s`;$('scrub').value=String(time/clip.duration*1000);
 $('cadence').textContent=`${measured?measured+' / ':''}${fps} fps target`;
 const f=R.frameAt(clip.id,time);$('frame').textContent=`${f.clip} ${f.key+1} → ${f.nextKey+1}`;
 $('size-label').textContent=size+' px';
}
function select(id){const found=R.clips.find(c=>c.id===id);if(!found)return;clip=found;time=0;elapsed=0;playing=true;tour=false;$('loop').checked=clip.loop;$('name').textContent=clip.name;$('description').textContent=clip.category+' · '+(clip.loop?'A little repeating moment.':'One gesture, from start to settle.');$('source-count').textContent=clip.sourceFrames+(clip.sourceFrames===1?' illustrated pose':' illustrated poses');$('duration').textContent=clip.duration.toFixed(2)+' seconds';$('provenance').textContent=clip.artwork+'. Per-frame timing and accessory registration follow the source poses.';catalog();sync();render();}
function seek(t){time=Math.max(0,Math.min(clip.duration,t));elapsed=time;playing=false;tour=false;render();sync();}
function scene(){
 const dark=background==='dark';ctx.fillStyle=dark?'#282034':'#fbf8fc';ctx.fillRect(0,0,960,600);
 if(background==='checker'){for(let y=0;y<600;y+=24)for(let x=0;x<960;x+=24)if((x/24+y/24)%2){ctx.fillStyle='#e7ddec';ctx.fillRect(x,y,24,24);}}
 else{ctx.fillStyle=dark?'#33283e':'#f0e5f3';ctx.fillRect(0,486,960,114);ctx.strokeStyle=dark?'#584064':'#dfcde6';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,486);ctx.lineTo(960,486);ctx.stroke();}
}
function yarn(x,y){ctx.strokeStyle='#9a72b0';ctx.fillStyle='#d6b7e9';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,12,11,0,0,Math.PI*2);ctx.fill();ctx.stroke();for(let i=-5;i<=5;i+=5){ctx.beginPath();ctx.ellipse(x+i,y,4,10,.4,0,Math.PI*2);ctx.stroke();}}
function house(){const x=780,y=486;ctx.fillStyle=background==='dark'?'#624875':'#d7bce9';ctx.beginPath();ctx.moveTo(x-70,y-80);ctx.lineTo(x,y-145);ctx.lineTo(x+70,y-80);ctx.closePath();ctx.fill();ctx.fillStyle=background==='dark'?'#44314f':'#eee0f3';ctx.fillRect(x-57,y-80,114,80);ctx.fillStyle='#79588e';ctx.beginPath();ctx.roundRect(x-26,y-61,52,61,[26,26,0,0]);ctx.fill();}
function render(){scene();if(!ready)return;let x=480;const phase=Math.min(1,time/clip.duration);
 if(['home','chase'].includes(clip.id))house();
 if(clip.id==='home')x=480+300*(phase*phase*(3-2*phase));
 if(clip.id==='chase')x=260+360*Math.min(1,phase/.66);
 if(clip.id==='toy')x=480+size*.20*Math.sin(Math.PI*phase);
 if($('travel').checked&&['walk','run'].includes(clip.id)){const stride=R.strideFor?R.strideFor(clip.id,size):size*.5;const distance=elapsed/clip.duration*stride;const direction=$('facing').checked?-1:1;x=((480+direction*distance+size/2)%(960+size)+(960+size))%(960+size)-size/2;}
 ctx.fillStyle='rgba(94,55,116,.12)';ctx.beginPath();ctx.ellipse(x,489,size*.25,Math.max(4,size*.035),0,0,Math.PI*2);ctx.fill();
 ctx.save();if(clip.id==='home')ctx.globalAlpha=phase<.80?1:Math.max(0,1-(phase-.80)/.20);
 R.draw(ctx,{clip:clip.id,time,size,x,y:486,equipped:outfit(),rootMotion:true,motion:true,facing:$('facing').checked?-1:1});ctx.restore();
 if(clip.id==='toy')yarn(phase<.70?545:x+size*.09,476);
 if(clip.id==='chase')yarn(phase<.87?640:x+size*.09,476);
}
function tick(now){const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(playing&&ready&&!document.hidden){time+=dt*speed;elapsed+=dt*speed;if(time>=clip.duration){if(tour){const next=R.clips[(R.clips.indexOf(clip)+1)%R.clips.length];select(next.id);tour=true;}else if($('loop').checked)time%=clip.duration;else{time=clip.duration;playing=false;}}}
 if(now-paint>=1000/fps-.2){render();paint=now-((now-paint)%(1000/fps));paintCount++;}if(now-metric>=1000){measured=Math.round(paintCount*1000/(now-metric));paintCount=0;metric=now;}
 if(now-uiStamp>100){sync();uiStamp=now;}requestAnimationFrame(tick);}
$('play').onclick=()=>{playing=!playing;sync();};$('restart').onclick=()=>{time=0;elapsed=0;playing=true;render();sync();};$('previous').onclick=()=>seek(time-1/fps);$('next').onclick=()=>seek(time+1/fps);$('scrub').oninput=e=>seek(+e.target.value/1000*clip.duration);
$('tour').onclick=()=>{select(R.clips[0].id);tour=true;};$('speed').onchange=e=>speed=+e.target.value;$('fps').onchange=e=>{fps=+e.target.value;paint=0;};$('size').oninput=e=>{size=+e.target.value;render();sync();};$('background').onchange=e=>{background=e.target.value;render();};
for(const id of ['head','neck','facing','travel'])$(id).onchange=render;
$('reset-outfit').onclick=()=>{$('head').value=$('neck').value='';render();};
$('search').oninput=e=>{if(e.isComposing)return;query=e.target.value.toLowerCase().trim();catalog();};$('search').addEventListener('compositionend',e=>{query=e.target.value.toLowerCase().trim();catalog();});$('clear').onclick=()=>{$('search').value='';query='';catalog();$('search').focus();};
$('export').onclick=()=>{const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');R.draw(g,{clip:clip.id,time,size:320,x:256,y:445,equipped:outfit(),rootMotion:false});const a=document.createElement('a');a.download='Purrple-'+clip.id+'.png';a.href=c.toDataURL('image/png');a.click();};
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|BUTTON|TEXTAREA/.test(e.target.tagName)||e.ctrlKey||e.altKey||e.metaKey)return;if(e.code==='Space'){e.preventDefault();playing=!playing;}if(e.key==='ArrowRight'){e.preventDefault();seek(time+1/fps);}if(e.key==='ArrowLeft'){e.preventDefault();seek(time-1/fps);}if(e.key.toLowerCase()==='r'){time=0;elapsed=0;playing=true;}});document.addEventListener('visibilitychange',()=>{last=0;});
for(const slot of ['head','neck'])options($(slot),Object.entries(PurrpleArt.items).filter(([,v])=>v.slot===slot).map(([id])=>[id,id.replaceAll('-',' ')]));
R.preload().then(()=>{ready=true;select(clip.id);if(matchMedia('(prefers-reduced-motion:reduce)').matches)playing=false;$('status').textContent='Ready. Choose a movement, then try her outfits.';render();sync();}).catch(e=>{errors.push(String(e));$('status').textContent=e.message;playing=false;});
window.PurrpleMotionStudio={select,seek,render,clips:R.clips,canvas,getState:()=>({id:clip.id,time,playing,ready,size,fps,measured,source:R.frameAt(clip.id,time),outfit:outfit(),errors:[...errors]}),setOutfit:v=>{for(const slot of ['head','neck'])if(slot in v)$(slot).value=v[slot]||'';render();},setBackground:v=>{background=v;$('background').value=v;render();},setSize:v=>{size=v;$('size').value=String(v);render();},pause:()=>{playing=false;sync();}};
catalog();requestAnimationFrame(tick);
})();
