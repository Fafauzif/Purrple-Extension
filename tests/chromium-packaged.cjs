/* Test exact extracted extension bytes in a fresh vendor browser over its debugging pipe. */
const assert = require('node:assert/strict');
const {createServer} = require('node:http');
const { spawn, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const {tmpdir} = require('node:os');
const path = require('node:path');

// PURRPLE_BROWSER=/path/to/browser node tests/chromium-packaged.cjs chromium [archive.zip]
const name=process.argv[2] || 'brave';
const browsers={brave:'brave-browser',chrome:'google-chrome',chromium:'chromium'};
if (!Object.hasOwn(browsers,name)) throw new Error('Choose brave, chrome, or chromium.');
const archive=path.resolve(process.argv[3] || path.join(__dirname,'../dist/Purrple_Chromium_Extension.zip'));
const executable=process.env.PURRPLE_BROWSER || browsers[name];
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
const fixturePath=process.env.PURRPLE_BACKUP_PATH;
const backupOutput=process.env.PURRPLE_BACKUP_OUTPUT;
const overlayOnly=process.env.PURRPLE_OVERLAY_ONLY==='1';
const placementOnly=process.env.PURRPLE_PLACEMENT_ONLY==='1';

async function main(){
  const staging=await fs.mkdtemp(path.join(tmpdir(), 'purrple-vendor-'));
  const profile=path.join(staging,'profile');
  const runtime=path.join(staging,'runtime');
  await fs.mkdir(profile);
  await fs.mkdir(runtime);
  const sha256=createHash('sha256').update(await fs.readFile(archive)).digest('hex');
  const entries=execFileSync('unzip',['-Z1',archive],{encoding:'utf8'}).trim().split('\n');
  assert(entries.every(entry=>!entry.startsWith('/') && !entry.split('/').includes('..')));
  assert(entries.includes('manifest.json'));
  execFileSync('unzip',['-qt',archive]);
  execFileSync('unzip',['-q',archive,'-d',runtime]);
  const archiveVersion=JSON.parse(await fs.readFile(path.join(runtime, 'manifest.json'), 'utf8')).version;
  const browserVersion=execFileSync(executable,['--version'],{encoding:'utf8'}).trim();
  console.log('Archive SHA-256',sha256);
  const flags=[...(process.env.PURRPLE_HEADED === '1' ? [] : ['--headless']),'--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--disable-component-update','--no-first-run','--no-default-browser-check','--enable-unsafe-extension-debugging','--remote-debugging-pipe','--user-data-dir='+profile,'about:blank'];
  if (process.env.PURRPLE_NO_BROWSER_SANDBOX === '1') flags.unshift('--no-sandbox');
  if (process.env.PURRPLE_SINGLE_PROCESS === '1') flags.unshift('--single-process','--no-zygote');
  const browser=spawn(executable,flags,{stdio:['ignore','ignore','pipe','pipe','pipe']});
  console.log('Spawned',name,'PID',browser.pid);
  browser.stderr.on('data',buffer=>process.stderr.write(buffer));
  let sequence=0, carry='', closed=false;
  const pending=new Map();
  browser.on('close',code=>{
    closed=true;
    for(const request of pending.values()) request.reject(new Error('Browser closed (exit '+code+')'));
  });
  browser.on('error',error=>{
    closed=true;
    for(const request of pending.values()) request.reject(error);
  });
  for(const pipe of [browser.stdio[3], browser.stdio[4]]) {
    pipe.on('error',error=>{
      for(const request of pending.values()) request.reject(error);
    });
  }
  browser.stdio[4].setEncoding('utf8');
  browser.stdio[4].on('data',data=>{
    carry+=data;
    for(;;){
      const end=carry.indexOf('\0');
      if(end<0)break;
      const message=JSON.parse(carry.slice(0,end));
      carry=carry.slice(end+1);
      const request=pending.get(message.id);
      if(!request)continue;
      pending.delete(message.id);
      if(message.error) request.reject(new Error(request.method+': '+JSON.stringify(message.error)));
      else request.resolve(message.result);
    }
  });
  function call(method,params={},sessionId,timeout=30000){
    if(closed) return Promise.reject(new Error('Closed before '+method));
    const id=++sequence;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        pending.delete(id);
        reject(new Error('Timed out: '+method));
      },timeout);
      pending.set(id,{method,resolve(value){clearTimeout(timer);resolve(value);},reject(error){clearTimeout(timer);reject(error);}});
      browser.stdio[3].write(JSON.stringify({id,method,params,sessionId})+'\0');
    });
  }
  const report={vendor:name,browserVersion,archive:path.basename(archive),archiveVersion,sha256,checks:{},launchMode:(process.env.PURRPLE_HEADED === '1' ? 'Headed' : 'Headless')+' browser binary, disposable profile, CDP unpacked install'};
  let hostServer;
  try{
    report.engine=await call('Browser.getVersion',{},undefined,105000);
    console.log('CDP connected',report.engine.product);
    const {id}=await call('Extensions.loadUnpacked',{path:runtime});
    report.checks.unpack=!!id;
    console.log('Installed extension',id);
    const {targetId}=await call('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
    await call('Page.enable',{},sessionId);
    const base='chrome-extension://'+id+'/';
    async function evaluate(expression){
      const response=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
      if(response.exceptionDetails)throw new Error(JSON.stringify(response.exceptionDetails));
      return response.result.value;
    }
    async function waitFor(expr,attempts=50){
      let last;
      for(let i=0;i<attempts;i++){
        try{last=await evaluate(expr);if(last)return last;}catch(error){last=error.message;}
        await delay(200);
      }
      throw new Error('No result for '+expr+'; last result '+last);
    }
    const send=(type,more={})=>evaluate('chrome.runtime.sendMessage('+JSON.stringify({type,...more})+')');
    const get=async()=>{const r=await send('GET_STATE'); assert(r.ok,JSON.stringify(r)); return r.state;};
    const action=async(type,fields={})=>{const r=await send('ACTION',{action:{type,...fields}});assert(r.ok,JSON.stringify(r));return r.state;};
    await call('Page.navigate',{url:base+'app.html'},sessionId);
    await waitFor("document.querySelector('#main') && !document.querySelector('#main').hidden");
    const manifest=await evaluate('chrome.runtime.getManifest()');
    assert.equal(manifest.version,archiveVersion);
    assert.equal(manifest.manifest_version,3);
    report.checks.dashboard=(await get()).wallet.balance===0;
    report.checks.sidePanel=!!manifest.side_panel?.default_path;
    report.sidePanelAPI=await evaluate("typeof chrome.sidePanel?.open === 'function'");
    await waitFor('typeof PurrpleRenderer !== "undefined" && PurrpleRenderer.assetsReady');
    report.checks.renderer=true;
    if(overlayOnly){
      const seeded=await action('TASK_ADD',{title:'Vendor smoke task'});
      assert(seeded.tasks.some(task=>task.title==='Vendor smoke task'));
      report.overlayRegressionOnly=true;
    }else{
      await evaluate(`(()=>{document.querySelector('#quick-title').value='Vendor smoke task';document.querySelector('#quick-form').requestSubmit();return true;})()`);
      await waitFor("document.querySelector('#task-list').textContent.includes('Vendor smoke task')");
      report.checks.task=(await get()).tasks.some(task=>task.title==='Vendor smoke task'&&task.effort==='small');
      await evaluate("document.querySelector('[data-view=calendar]').click(); true");
      await waitFor("document.querySelector('#planner-heading')?.getBoundingClientRect().height");
      await evaluate("document.querySelector('#planner-add').click(); document.querySelector('#planner-block-title').value='Offline vendor smoke block'; document.querySelector('#planner-form').requestSubmit(); true");
      await waitFor("!document.querySelector('#planner-dialog').open");
      report.checks.calendar=(await get()).calendar.blocks.some(block=>block.title==='Offline vendor smoke block');
      assert((await action('FOCUS_START',{minutes:25})).focus.status==='running');
      assert((await action('FOCUS_PAUSE')).focus.status==='paused');
      assert((await action('FOCUS_RESUME')).focus.status==='running');
      assert(!(await action('FOCUS_CANCEL')).focus);
      report.checks.timer=true;
      if(name==='brave' && fixturePath){
        const fromFirefox=JSON.parse(await fs.readFile(fixturePath,'utf8'));
        assert((await send('BACKUP_PREVIEW',{backup:fromFirefox})).ok);
        await action('BACKUP_IMPORT',{backup:fromFirefox});
        assert.equal((await get()).tasks.length,fromFirefox.state.tasks.length);
        const {ok,backup}=await send('BACKUP_EXPORT');
        assert(ok);
        if (backupOutput) await fs.writeFile(backupOutput,JSON.stringify(backup,null,2)+'\n');
        else console.log('Backup export completed. Set PURRPLE_BACKUP_OUTPUT to save the result.');
        report.checks.portability=true;
      }
      await call('Page.navigate',{url:base+'popup.html'},sessionId);
      await waitFor("document.querySelector('#compact-main') && !document.querySelector('#compact-main').hidden");
      if(Number(archiveVersion.split('.')[0])>=3){
        const {verifyCompactWorkday}=require('./workday-v3-smoke.cjs');
        await verifyCompactWorkday({evaluate,waitFor,get,navigate:async()=>call('Page.navigate',{url:base+'popup.html'},sessionId)});
        report.checks.compactWorkdayAndPawPairs=true;
      }
      await evaluate("document.querySelector('.compact-pet').click();true");
      await waitFor("document.querySelector('#compact-pet-menu') && !document.querySelector('#compact-pet-menu').hidden");
      report.checks.popup=true;
    }
    const host = createServer((request, response) => {
      const target = new URL(request.url, 'http://127.0.0.1');
      if(target.pathname !== '/panels'){
        response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; frame-src 'none'; object-src 'none'");
      }
      if (target.pathname === '/controls.js') {
        response.writeHead(200, {'Content-Type':'text/javascript'});
        response.end('document.querySelector("#host-button").addEventListener("click", event => event.currentTarget.textContent="Still works");');
      } else if (target.pathname === '/icon.ico') {
        response.writeHead(404); response.end();
      } else {
        response.writeHead(200, {'Content-Type':'text/html'});
        response.end('<!doctype html><html lang="en"><meta charset="utf-8"><title>Purrple strict CSP fixture</title><link rel="icon" href="/icon.ico"><h1>Local test page</h1><button type="button" id="host-button">Host control</button><script src="/controls.js" defer></script></html>');
      }
    });
    hostServer = host;
    await new Promise((resolve,reject)=>host.once('error',reject).listen(0,'127.0.0.1',resolve));
    const url = 'http://127.0.0.1:'+host.address().port+'/';
    console.log('Opening strict CSP host page');
    await call('Page.navigate',{url},sessionId);
    await call('Page.bringToFront',{},sessionId);
    await call('DOM.enable',{},sessionId);
    await waitFor("document.querySelector('purrple-companion')?.dataset.active === 'true'",100);
    assert.equal(await evaluate("document.querySelector('purrple-companion').shadowRoot === null && !document.documentElement.outerHTML.includes('Vendor smoke task') && !window.chrome?.runtime?.id"),true);
    report.checks.overlayIsolation = true;
    console.log('Leased closed-shadow cat mounted');

    async function closedShadowHandle(){
      const {root} = await call('DOM.getDocument',{depth:0,pierce:true},sessionId);
      const {nodeId} = await call('DOM.querySelector',{nodeId:root.nodeId,selector:'purrple-companion'},sessionId);
      const {node} = await call('DOM.describeNode',{nodeId,depth:1,pierce:true},sessionId);
      const {object} = await call('DOM.resolveNode',{backendNodeId:node.shadowRoots[0].backendNodeId},sessionId);
      return object.objectId;
    }
    let shadowObject = await closedShadowHandle();
    async function nodeValue(selector, functionDeclaration) {
      const response=await call('Runtime.callFunctionOn',{
        objectId:shadowObject,
        arguments:[{value:selector}],
        functionDeclaration:`function(selector){const node=this.querySelector(selector);return node?(${functionDeclaration}).call(node):null;}`,
        returnByValue:true
      },sessionId);
      if(response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
      return response.result.value;
    }
    async function waitNode(selector, fn) {
      let last;
      for(let attempt=0;attempt<55;attempt++) {
        try { const value=await nodeValue(selector,fn); if(value) return value; }
        catch(error) { last=error.message; }
        await delay(150);
      }
      throw new Error('No visible state for '+selector+' '+(last||''));
    }
    async function clickPoint(point){
      assert(point && point.width>0 && point.height>0,'Expected a visible click target');
      const {x,y}=point;
      await call('Input.dispatchMouseEvent',{type:'mouseMoved',x,y},sessionId);
      for(const type of ['mousePressed','mouseReleased']) {
        await call('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,x,y},sessionId);
      }
    }
    const center = "function(){const rect=this.getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2,width:rect.width,height:rect.height};}";
    async function clickShadow(selector){
      const point=await nodeValue(selector,center);
      assert(point,'Missing closed-shadow node '+selector);
      await clickPoint(point);
    }
    async function screenshot(name){
      if(!process.env.PURRPLE_CAPTURES) return;
      const {data} = await call('Page.captureScreenshot',{format:'png'},sessionId);
      await fs.mkdir(process.env.PURRPLE_CAPTURES,{recursive:true});
      await fs.writeFile(path.join(process.env.PURRPLE_CAPTURES,name),Buffer.from(data,'base64'));
    }
    if(!placementOnly){
      await clickShadow('.actor');
      await waitNode('.menu',"function(){return !this.hidden;}");
      const actions=await nodeValue('.menu',"function(){return [...this.querySelectorAll('.actions>button')].map(x=>x.dataset.action);}");
      const expected=Number(archiveVersion.split('.')[0])>=3?['today','focus','play','talk','care','more']:['talk','focus','play','care','more'];
      assert.deepEqual(actions,expected);
      await clickShadow('.menu [data-action=talk]');
      await clickShadow('.menu [data-action=joke]');
      const reply = await waitNode('.speech',"function(){return !this.hidden && this.querySelector('p')?.textContent;}");
      assert.equal(await nodeValue('.pet-announcement',"function(){return this.textContent;}"),reply);
      assert.equal(await nodeValue('.panel',"function(){return this.hidden;}"),true);
      await screenshot(name+'-strict-csp-reply.png');
      await clickShadow('.speech [data-action=joke]');
      const next = await waitNode('.speech',`function(){const text=this.querySelector('p').textContent;return !this.hidden && text!==${JSON.stringify(reply)} && text;}`);
      assert.equal(await nodeValue('.pet-announcement',"function(){return this.textContent;}"),next);
      for(const type of ['keyDown','keyUp']) await call('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);
      await waitNode('.speech',"function(){return this.hidden;}");
      assert.equal(await nodeValue('.actor',"function(){return this.getRootNode().activeElement===this;}"),true);
      report.checks.overlayTalkAndEscape = true;
      console.log('Webpage talk, repeat reply and Escape passed');

    }
    await clickShadow('.actor');
    await clickShadow('.menu [data-action=more]');
    await clickShadow('.menu [data-action=move]');
    const oldX=await nodeValue('.actor',"function(){return this.getBoundingClientRect().x;}");
    await clickShadow('.menu [data-action=move-left]');
    assert((await nodeValue('.actor',"function(){return this.getBoundingClientRect().x;}")) < oldX);
    await waitNode('.menu [data-action=move-left]',"function(){return this.getRootNode().activeElement===this;}");
    await clickShadow('.menu [data-action=reset-pet]');
    await waitNode('.menu [data-action=reset-pet]',"function(){return this.getRootNode().activeElement===this;}");
    for(const type of ['keyDown','keyUp']) await call('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);
    await waitNode('.menu',"function(){return this.hidden;}");
    assert.equal(await nodeValue('.actor',"function(){return this.getRootNode().activeElement===this;}"),true);
    report.checks.overlayPlacement = true;
    console.log('Placement retained focus and Escape closed the menu');
    await clickShadow('.actor');
    await waitNode('.menu [data-action=focus]',"function(){return !this.closest('.menu').hidden;}");
    await clickShadow('.menu [data-action=focus]');
    await clickShadow('.menu [data-action=start-25]');
    await waitNode('.speech',"function(){return !this.hidden && this.textContent.includes('Notebook open');}");
    await clickPoint(await evaluate("("+center+").call(document.querySelector('#host-button'))"));
    assert.equal(await evaluate("document.querySelector('#host-button').textContent"),'Still works');
    report.checks.overlayHostClickThrough = true;
    await call('Page.navigate',{url:base+'popup.html'},sessionId);
    await waitFor("document.querySelector('#compact-main') && !document.querySelector('#compact-main').hidden");
    assert.equal((await get()).focus.durationMs,25*60*1000);
    await action('FOCUS_CANCEL');
    report.checks.overlaySharedTimer = true;
    if(Number(archiveVersion.split('.')[0])>=3){
      await call('Page.navigate',{url:url+'panels'},sessionId);
      await waitFor("document.querySelector('purrple-companion')?.dataset.active === 'true'",100);
      shadowObject=await closedShadowHandle();
      const redesigned = Number(archiveVersion.split('.')[0])>3 || Number(archiveVersion.split('.')[1])>=1;
      const waitForPanel = view => waitNode('.panel iframe',`function(){
        const ready=this.closest('.panel').querySelector('.panel-status').hidden;
        const url=new URL(this.src);
        return ready && (${JSON.stringify(view)}==='play'&&${redesigned}?url.pathname.endsWith('/game.html'):url.searchParams.get('view')===${JSON.stringify(view)});
      }`);
      if(redesigned){
        await clickShadow('.actor');
        await clickShadow('.menu [data-action=today]');
      }else await clickShadow('.paw');
      await waitForPanel('today');
      if(redesigned){
        for(const type of ['keyDown','keyUp'])await call('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);
        await waitNode('.panel',"function(){return this.hidden;}");
      }else await clickShadow('.panel-close');
      await clickShadow('.actor');
      await clickShadow('.menu [data-action=play]');
      await clickShadow('.menu [data-action=companion-play-paw-pairs]');
      await waitForPanel('play');
      assert.equal(await evaluate('location.href'),url+'panels');
      assert.equal(await evaluate("document.querySelector('purrple-companion').shadowRoot === null && !document.documentElement.outerHTML.includes('Vendor smoke task')"),true);
      report.checks.overlayTodayAndPlayInPlace=true;
    }
    assert(Object.values(report.checks).every(Boolean),JSON.stringify(report));
  } catch(error){
    process.exitCode=1;
    report.error=String(error);
    console.error(error);
  }finally{
    console.log('QA_REPORT_JSON '+JSON.stringify(report));
    hostServer?.close();
    if(!closed){
      const exited=new Promise(resolve=>browser.once('close',resolve));
      browser.kill('SIGKILL');
      await Promise.race([exited,delay(1500)]);
    }
    await fs.rm(staging,{recursive:true,force:true,maxRetries:4,retryDelay:150});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
