const fs=require('fs'),path=require('path');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../tests/browser_runtime.cjs').executable(),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--disable-gpu','--allow-file-access-from-files']});
 const page=await browser.newPage();await page.goto('file://'+path.join(root,'art/fit-preview.html'));await page.waitForFunction(()=>window.PurrpleFit?.ready);
 const result=await page.evaluate(()=>{
  const ids=Object.keys(PurrpleArt.items),poses=Object.keys(PurrpleArt.sprites).flatMap(clip=>Array.from({length:PurrpleArt.sprites[clip].frames.length},(_,key)=>({clip,key})));
  const contacts={},metrics=[];
  function painted(clip,key,equip){const c=document.createElement('canvas');c.width=c.height=320;const ctx=c.getContext('2d');ctx.translate(32,32);PurrpleRenderer.drawFrame(ctx,clip,key,equip);return c;}
  const all=document.createElement('canvas');all.width=1000;all.height=720;const allctx=all.getContext('2d');allctx.fillStyle='#f8f1fb';allctx.fillRect(0,0,1000,720);
  for(let index=0;index<ids.length;index++){
   const id=ids[index],cfg=PurrpleArt.items[id],sheet=document.createElement('canvas');sheet.width=1200;sheet.height=Math.ceil(poses.length/12)*120;
   const cx=sheet.getContext('2d');cx.fillStyle='#fbf6ff';cx.fillRect(0,0,sheet.width,sheet.height);cx.font='10px system-ui';cx.fillStyle='#624870';
   for(let pi=0;pi<poses.length;pi++){
    const {clip,key}=poses[pi],equip={[cfg.slot]:id},base=painted(clip,key,{}),fit=painted(clip,key,equip);
    const ba=base.getContext('2d').getImageData(0,0,320,320).data,fa=fit.getContext('2d').getImageData(0,0,320,320).data;let diff=0;
    for(let i=0;i<ba.length;i+=4)if(ba[i]!==fa[i]||ba[i+1]!==fa[i+1]||ba[i+2]!==fa[i+2]||ba[i+3]!==fa[i+3])diff++;
    let edge=0;for(let n=0;n<320;n++)for(const i of [n*4,(319*320+n)*4,(n*320)*4,(n*320+319)*4])if(fa[i+3])edge++;
    metrics.push({item:id,clip,key,changedPixels:diff,edgePixels:edge});const x=pi%12*100,y=Math.floor(pi/12)*120;
    cx.drawImage(fit,0,0,320,320,x,y,100,100);cx.fillText(clip+' / '+key,x+3,y+112);
   }
   contacts[id]=sheet.toDataURL('image/png').split(',')[1];
   const x=index%5*200,y=Math.floor(index/5)*240;allctx.drawImage(painted('idle',0,{[cfg.slot]:id}),0,0,320,320,x,y,200,200);allctx.fillStyle='#624870';allctx.font='14px system-ui';allctx.fillText(id,x+12,y+220);
  }
  const critical={};
  const checks=[['idle',0],['look',0],['walk',2],['run',3],['jump',2],['held',2],['tumble',3],['sleep',2],['stretch',3],['study',1],['read',4],['heart',3]];
  for(const [theme,color] of [['light','#fcf7ff'],['dark','#292135']]){
   const c=document.createElement('canvas');c.width=1536;c.height=9*156;const d=c.getContext('2d');d.fillStyle=color;d.fillRect(0,0,c.width,c.height);d.font='10px system-ui';
   ids.slice(0,9).forEach((id,row)=>checks.forEach(([clip,key],col)=>{
    d.drawImage(painted(clip,key,{head:id}),0,0,320,320,col*128,row*156,128,128);d.fillStyle=theme==='dark'?'#e0c8ed':'#624870';d.fillText(id,col*128+3,row*156+137);d.fillText(clip+'/'+key,col*128+3,row*156+151);
   }));critical['hat-critical-'+theme]=c.toDataURL('image/png').split(',')[1];
   for(const [name,equip]of [['bow-bandana',{head:'moon-bow',neck:'star-bandana'}],['beanie-scarf',{head:'cozy-beanie',neck:'cozy-scarf'}]]){
    const c=document.createElement('canvas');c.width=1200;c.height=Math.ceil(poses.length/12)*120;const d=c.getContext('2d');d.fillStyle=color;d.fillRect(0,0,c.width,c.height);d.font='10px system-ui';
    poses.forEach(({clip,key},i)=>{const x=i%12*100,y=Math.floor(i/12)*120;d.drawImage(painted(clip,key,equip),0,0,320,320,x,y,100,100);d.fillStyle=theme==='dark'?'#e0c8ed':'#624870';d.fillText(clip+'/'+key,x+3,y+112);});
    critical['combined-'+name+'-'+theme]=c.toDataURL('image/png').split(',')[1];
   }
  }
  return {contacts,metrics,critical,overview:all.toDataURL('image/png').split(',')[1]};
 });
 const out=path.join(root,'verification/wardrobe');fs.mkdirSync(out,{recursive:true});
 for(const [id,b64]of Object.entries(result.contacts))fs.writeFileSync(path.join(out,id+'-all-poses.png'),Buffer.from(b64,'base64'));
 for(const [id,b64]of Object.entries(result.critical))fs.writeFileSync(path.join(out,id+'.png'),Buffer.from(b64,'base64'));
 fs.writeFileSync(path.join(out,'all-items.png'),Buffer.from(result.overview,'base64'));
 fs.writeFileSync(path.join(out,'coverage.json'),JSON.stringify({count:result.metrics.length,zero:result.metrics.filter(x=>x.changedPixels<4),clipped:result.metrics.filter(x=>x.edgePixels),metrics:result.metrics},null,2));
 // Shop images are the exact fitted idle actor, not a differently generated cat.
 for(const id of Object.keys(result.contacts)){
  const b64=await page.evaluate(id=>{const c=document.createElement('canvas');c.width=c.height=320;const ctx=c.getContext('2d');ctx.translate(32,32);PurrpleRenderer.drawFrame(ctx,'idle',0,{[PurrpleArt.items[id].slot]:id});return c.toDataURL('image/png').split(',')[1];},id);
  fs.writeFileSync(path.join(root,'extension/assets/wardrobe/thumbs',id+'.png'),Buffer.from(b64,'base64'));
 }
 await browser.close();console.log(JSON.stringify({count:result.metrics.length,zero:result.metrics.filter(x=>x.changedPixels<4).length,clipped:result.metrics.filter(x=>x.edgePixels).length}));
})().catch(e=>{console.error(e);process.exit(1)});
