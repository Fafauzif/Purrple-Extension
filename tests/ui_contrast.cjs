/* Computed text contrast audit for visible production UI in browser preview. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:require('./browser_runtime.cjs').executable(),args:['--no-sandbox','--disable-dev-shm-usage','--single-process','--no-zygote','--allow-file-access-from-files']});
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),results=[];
 await page.goto('file://'+path.join(root,'extension/app.html'));await page.waitForFunction(()=>PurrpleUI.getState());
 await page.evaluate(async()=>{
  for(const title of ['A little normal task','An important task'])await PurrpleClient.action({type:'TASK_ADD',title,priority:title.includes('important')?'high':'normal',effort:'medium',recurrence:'none',dueAt:Date.now()-1000,subtasks:['A little step']});
 });
 for(const tab of ['today','focus','wardrobe','settings']){
  await page.locator(`[data-view="${tab}"]`).click();
  const checks=await page.evaluate(()=>{
   const rgb=s=>{const n=s.match(/[\d.]+/g)?.map(Number);return n?{r:n[0],g:n[1],b:n[2],a:n[3]??1}:{r:255,g:255,b:255,a:0};};
   const blend=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
   const lum=c=>{const v=[c.r,c.g,c.b].map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return .2126*v[0]+.7152*v[1]+.0722*v[2];};
   const result=[];
   for(const el of document.querySelectorAll('body *')){
    if(el.closest('[hidden]')||el.closest('[disabled]')||!el.getClientRects().length||['SCRIPT','STYLE','CANVAS','SVG','PATH'].includes(el.tagName))continue;
    const text=[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent.trim()).join(' ').trim();if(!text)continue;
    const style=getComputedStyle(el);if(style.visibility==='hidden'||Number(style.opacity)===0)continue;
    if(el.getAttribute('aria-hidden')==='true'||el.closest('[aria-hidden="true"]'))continue;
    let bg={r:255,g:255,b:255,a:1};const ancestors=[];for(let a=el;a;a=a.parentElement)ancestors.unshift(a);
    for(const a of ancestors)bg=blend(rgb(getComputedStyle(a).backgroundColor),bg);
    const fg=blend(rgb(style.color),bg),l1=lum(fg),l2=lum(bg),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
    const large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700),required=large?3:4.5;
    result.push({text:text.slice(0,85),selector:el.tagName.toLowerCase()+(el.id?'#'+el.id:el.className?'.'+String(el.className).trim().split(' ').join('.'):''),ratio:Number(ratio.toFixed(2)),required,pass:ratio+.015>=required,color:style.color});
   }
   return result;
  });results.push({view:tab,checks});
 }
 const failed=results.flatMap(r=>r.checks.filter(c=>!c.pass).map(c=>({view:r.view,...c})));
 const report={scope:'Computed foreground/background contrast of visible text; decorative aria-hidden glyphs and disabled controls excluded.',count:results.reduce((n,r)=>n+r.checks.length,0),failed,results};
 fs.mkdirSync(path.join(root,'verification/ui'),{recursive:true});fs.writeFileSync(path.join(root,'verification/ui/contrast.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({count:report.count,failed},null,2));await browser.close();if(failed.length)process.exitCode=1;
})();
