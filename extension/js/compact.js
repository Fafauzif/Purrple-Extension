/* Shared compact toolbar and private extension-origin floating dashboard. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),client=PurrpleClient,params=new URLSearchParams(location.search);
 const panel=params.get('panel')==='1'&&parent!==window;
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const catalog=()=>PurrpleCore.CATALOG||[],item=id=>catalog().find(i=>i.id===id);
 let state=null,view=['today','focus','wardrobe','talk'].includes(params.get('view'))?params.get('view'):'today';
 let preview=null,shopFilter='all',shopQuery='',pose='idle',poseAt=performance.now(),ready=false,lastPaint=0,toastTimer=0,undoAction=null,artError=false,draftVersion=0,draftWrites=0,tasksSignature='',shopSignature='',submitting=false;
 const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
 document.body.classList.toggle('is-panel',panel);document.body.classList.toggle('is-native-popup',client.native&&!panel);
 const post=(type,extra={})=>{if(panel)parent.postMessage({source:'purrple-panel',type,...extra},'*');};
 function notify(text,error=false,undo=null){
  clearTimeout(toastTimer);undoAction=undo;const el=$('compact-status');el.replaceChildren();const span=document.createElement('span');span.textContent=text;el.append(span);
  if(undo){const button=document.createElement('button');button.type='button';button.textContent='Undo';button.dataset.compactUndo='';el.append(button);}
  el.classList.toggle('is-error',error);el.hidden=false;toastTimer=setTimeout(()=>{el.hidden=true;undoAction=null;},undo?8500:4200);
 }
 function fail(error){notify(error?.message||'That change could not be saved. Please try again.',true);}
 function reaction(clip){pose=clip||'idle';poseAt=performance.now();}
 async function dispatch(action,message,undo){try{const next=await client.action(action);receive(next);if(message)notify(message,false,undo);return next;}catch(error){fail(error);throw error;}}
 function receive(next){state=next;render();}
 function showView(next){
  if(!['today','focus','wardrobe','talk'].includes(next))return;view=next;preview=null;document.body.dataset.view=view;
  document.title=`Purrple · ${{today:'Today',focus:'Focus',wardrobe:'Wardrobe',talk:'Talk'}[view]}`;
  document.querySelectorAll('[data-compact-view]').forEach(b=>{if(b.dataset.compactView===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  document.querySelectorAll('.compact-view').forEach(el=>el.hidden=el.id!==`compact-${view}`);
  $('compact-main').scrollTop=0;if(panel&&matchMedia('(max-height:420px)').matches)window.scrollTo(0,0);reaction(view==='focus'?'study':'idle');render();
 }
 const focusRemaining=()=>{const f=state?.focus;if(!f)return 0;return f.status==='running'?Math.max(0,(f.endsAt||Date.now())-Date.now()):Math.max(0,f.remainingMs||0);};
 const clock=ms=>{const n=Math.ceil(ms/1000);return`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
 const shortDate=at=>new Intl.DateTimeFormat('en',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(at);
 function render(){
  if(!state)return;$('compact-loading').hidden=true;$('compact-main').hidden=false;$('preview-label').hidden=client.native;
  $('coin-balance').textContent=state.wallet?.balance||0;$('compact-coins').setAttribute('aria-label',`${state.wallet?.balance||0} coins`);$('compact-roam').checked=state.settings?.petEnabled!==false;
  const heading={today:state.settings?.name?`Hi, ${state.settings.name}.`:'A little at a time.',focus:'A quiet study buddy.',wardrobe:preview?'Trying something on.':'Her little wardrobe.',talk:'A little hello?'};
  $('compact-greeting').textContent=heading[view];
  $('compact-summary').textContent={today:'One small thing is a good start.',focus:state.focus?'The timer stays with you.':'Your next few minutes, together.',wardrobe:preview?'Your saved outfit stays safe.':'Tiny favorites, kept forever.',talk:'Pick a thought. The ears are listening.'}[view];
  $('outfit-preview-tag').hidden=!preview;
  if(view==='today')renderTasks();if(view==='focus')renderFocus();if(view==='wardrobe')renderShop();if(view==='talk')talkUI.render();
  $('compact-focus-summary').hidden=!state.focus;
  if(state.focus)$('compact-focus-summary-text').textContent=`${state.focus.kind==='break'?'Break':'Focus'} · ${clock(focusRemaining())}${state.focus.status==='paused'?' · paused':''}`;
 }
 function renderTasks(){
  const tasks=(state.tasks||[]).filter(t=>!t.done&&!t.archived).sort((a,b)=>Number(b.priority==='high')-Number(a.priority==='high')||(a.dueAt||Infinity)-(b.dueAt||Infinity)||a.createdAt-b.createdAt);
  $('compact-task-count').textContent=`${tasks.length} to do`;
  const input=$('compact-task-title');if(![input,$('compact-task-effort')].includes(document.activeElement)&&!submitting&&!draftWrites){input.value=state.drafts?.quickTask||'';$('compact-task-effort').value=state.drafts?.quickEffort||'medium';}
  const signature=JSON.stringify([tasks.map(t=>[t.id,t.title,t.dueAt,t.effort,t.priority]),(state.ledger||[]).filter(e=>e.type==='task').map(e=>e.id)]);
  if(signature===tasksSignature)return;tasksSignature=signature;
  const focused=document.activeElement?.dataset?.id;
  $('compact-task-list').innerHTML=tasks.slice(0,6).map(t=>{
   const earned=(state.ledger||[]).some(e=>e.id==='task:'+t.id),reward={small:10,medium:20,large:30}[t.effort]||20;
   return`<article class="compact-task-row"><button type="button" class="task-check" data-compact-action="complete" data-id="${escape(t.id)}" aria-label="Complete ${escape(t.title)}"></button><div><strong>${escape(t.title)}</strong><small>${t.dueAt?`<span class="${t.dueAt<Date.now()?'compact-overdue':''}">${escape(shortDate(t.dueAt))}</span> · `:''}${earned?`${reward} coins earned`:`+${reward} coins`}</small></div></article>`;
  }).join('')||'<div class="compact-empty"><strong>A little room to begin.</strong>Add a task above. Even a small one counts.</div>';
  $('compact-all-tasks').textContent=tasks.length>6?`All ${tasks.length} tasks & details →`:'All tasks & details →';
  if(focused&&document.activeElement===document.body)$('compact-task-title').focus({preventScroll:true});
 }
 function renderFocus(){
  const f=state.focus,active=!!f;
  $('compact-focus-form').hidden=active;$('compact-timer-actions').hidden=!active;
  $('compact-timer-kind').textContent=f?.kind==='break'?'A little breather':'A quiet focus session';
  $('compact-timer-display').textContent=active?clock(focusRemaining()):`${$('compact-minutes').value}:00`;
  $('compact-timer-caption').textContent=active?(f.status==='paused'?'Paused. Take your time.':f.kind==='break'?'A stretch, a sip, a little rest.':'One little step at a time.'):'Purrple is ready when you are.';
  $('compact-focus-pause').textContent=f?.status==='paused'?'Resume':'Pause';$('compact-break-start').disabled=active;
  $('compact-break-label').textContent=active?'End this session for a break.':'A little breather?';
  const select=$('compact-focus-task'),selected=select.value;
  select.innerHTML='<option value="">Just a quiet session</option>'+(state.tasks||[]).filter(t=>!t.done&&!t.archived).map(t=>`<option value="${escape(t.id)}">${escape(t.title)}</option>`).join('');
  if([...select.options].some(o=>o.value===selected))select.value=selected;
 }
 function renderShop(){
  const signature=JSON.stringify([state.owned,state.equipped,state.wallet.balance,shopFilter,shopQuery,preview]);if(signature===shopSignature)return;shopSignature=signature;
  const all=catalog(),owned=state.owned||[],selected=preview?item(preview):null;
  $('compact-outfit-heading').textContent=selected?'Trying on · '+selected.name:'Wearing now';
  const worn=[item(state.equipped?.head)?.name,item(state.equipped?.neck)?.name].filter(Boolean).join(' + ');
  $('compact-outfit-copy').textContent=selected?(owned.includes(selected.id)?'You own this. Choose Wear to save it.':'Preview only. Buy it to own it, then choose Wear.'):worn||'Her original little look. Nothing equipped.';
  $('compact-preview-reset').hidden=!preview;
  document.querySelectorAll('[data-compact-shop]').forEach(b=>b.setAttribute('aria-pressed',String(shopFilter===b.dataset.compactShop)));
  const list=all.filter(c=>(shopFilter==='all'||shopFilter==='owned'&&owned.includes(c.id)||c.slot===shopFilter)&&`${c.name} ${c.description}`.toLowerCase().includes(shopQuery));
  const focused=document.activeElement,action=focused?.dataset.compactAction,id=focused?.dataset.id;
  $('compact-shop-grid').innerHTML=list.map(c=>{
   const yours=owned.includes(c.id),worn=state.equipped?.[c.slot]===c.id,trying=preview===c.id,needed=Math.max(0,c.price-state.wallet.balance);
   const status=worn?'Equipped':yours?'Owned · not equipped':trying?'Trying on · not owned':'Not owned';
   return`<article class="compact-item ${trying?'is-preview':''}"><img src="assets/wardrobe/thumbs/${encodeURIComponent(c.id)}.png" alt="Purrple wearing ${escape(c.name)}" loading="lazy"><div class="compact-item-info"><h2>${escape(c.name)}</h2><p class="compact-item-status ${worn?'equipped':yours?'owned':''}">${status}</p><p class="compact-item-price">${yours?'Yours forever':`✧ ${c.price} coins`}</p><div class="compact-item-actions"><button type="button" class="button subtle" data-compact-action="try" data-id="${escape(c.id)}">Try on</button>${yours?`<button type="button" class="button primary" data-compact-action="wear" data-id="${escape(c.id)}" ${worn?'disabled':''}>${worn?'Wearing':'Wear'}</button>`:`<button type="button" class="button primary" data-compact-action="buy" data-id="${escape(c.id)}" ${needed?'disabled':''}>Buy</button>`}</div><p class="compact-item-needed">${!yours&&needed?`Need ${needed} more coins`:yours?'': 'Enough coins to buy'}</p></div></article>`;
  }).join('')||`<div class="compact-empty compact-shop-empty"><strong>${shopQuery?'No matching little things.':'Your favorites can grow here.'}</strong>${shopQuery?'Try another word or clear the search.':'Complete tasks for coins, then choose something from All.'}</div>`;
  $('compact-shop-clear').hidden=!shopQuery;
  if(focused&&!focused.isConnected&&action&&id){const b=document.querySelector(`[data-compact-action="${CSS.escape(action)}"][data-id="${CSS.escape(id)}"]`);(b&&!b.disabled?b:$('compact-shop-search')).focus({preventScroll:true});}
 }
 const talkUI=PurrpleTalkUI.mount($('compact-talk-root'),{getState:()=>state,dispatch,onReply:last=>reaction(last.reaction),compact:true});
 async function saveDraft(){
  if(submitting)return;const text=$('compact-task-title').value,effort=$('compact-task-effort').value;if(!draftWrites&&text===(state?.drafts?.quickTask||'')&&effort===(state?.drafts?.quickEffort||'medium'))return;const version=++draftVersion;draftWrites++;
  $('compact-draft-status').textContent='Saving draft…';
  try{const next=await client.saveQuickDraft(text,effort);receive(next);if(version===draftVersion)$('compact-draft-status').textContent=text?'Draft saved':'';}
  catch(error){if(version===draftVersion)$('compact-draft-status').textContent='Draft not saved. Please keep this open.';fail(error);}
  finally{draftWrites--;}
 }
 $('compact-task-title').addEventListener('input',e=>{if(!e.isComposing)saveDraft();});
 $('compact-task-title').addEventListener('compositionend',saveDraft);
 $('compact-task-effort').addEventListener('change',saveDraft);
 $('compact-task-form').addEventListener('submit',async e=>{
  e.preventDefault();if(e.isComposing||submitting)return;const title=$('compact-task-title').value.trim();
  if(!title){$('compact-task-error').textContent='Give this little task a name.';$('compact-task-error').hidden=false;$('compact-task-title').focus();return;}
  submitting=true;draftVersion++;$('compact-task-error').hidden=true;$('compact-task-add').disabled=true;$('compact-task-title').disabled=true;$('compact-task-effort').disabled=true;
  try{await dispatch({type:'TASK_ADD',title,effort:$('compact-task-effort').value,priority:'normal',recurrence:'none',dueAt:null,subtasks:[],fromDraft:true},'A little plan, saved.');$('compact-task-title').value='';$('compact-draft-status').textContent='';}
  catch{}finally{submitting=false;$('compact-task-add').disabled=false;$('compact-task-title').disabled=false;$('compact-task-effort').disabled=false;$('compact-task-title').focus();renderTasks();}
 });
 document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.compactView){showView(b.dataset.compactView);return;}if(b.dataset.compactGo){showView(b.dataset.compactGo);return;}
  if(b.dataset.compactShop){shopFilter=b.dataset.compactShop;renderShop();return;}
  if(b.hasAttribute('data-compact-undo')){if(!undoAction)return;const action=undoAction;undoAction=null;$('compact-status').hidden=true;try{await dispatch(action,'Task reopened. Coins are earned only once.');}catch{}return;}
  const action=b.dataset.compactAction,id=b.dataset.id;if(!action)return;
  if(action==='try'){preview=id;render();return;}
  b.disabled=true;
  try{
   if(action==='complete'){await dispatch({type:'TASK_SET_DONE',id,done:true},'A little win. Well done!',{type:'TASK_SET_DONE',id,done:false});reaction('celebrate');}
   if(action==='buy'){await dispatch({type:'SHOP_BUY',id},`${item(id).name} is yours. Choose Wear to put it on.`);preview=id;render();}
   if(action==='wear'){preview=null;await dispatch({type:'EQUIP',slot:item(id).slot,id},'Outfit saved. Purrple is wearing it now.');}
  }catch{}finally{if(b.isConnected)b.disabled=false;}
 });
 $('compact-preview-reset').onclick=()=>{preview=null;render();};
 $('compact-shop-search').addEventListener('input',e=>{if(e.isComposing)return;shopQuery=e.target.value.trim().toLowerCase();renderShop();});
 $('compact-shop-search').addEventListener('compositionend',e=>{shopQuery=e.target.value.trim().toLowerCase();renderShop();});
 $('compact-shop-clear').onclick=()=>{shopQuery='';$('compact-shop-search').value='';renderShop();$('compact-shop-search').focus();};
 $('compact-focus-form').addEventListener('submit',async e=>{e.preventDefault();if(e.isComposing)return;$('compact-focus-start').disabled=true;try{await dispatch({type:'FOCUS_START',minutes:Number($('compact-minutes').value),taskId:$('compact-focus-task').value||null},'Notebook ready. Let’s begin.');reaction('study');}catch{}finally{$('compact-focus-start').disabled=false;}});
 $('compact-minutes').onchange=()=>{if(!state?.focus)$('compact-timer-display').textContent=`${$('compact-minutes').value}:00`;};
 $('compact-focus-pause').onclick=async()=>{try{await dispatch({type:state.focus?.status==='paused'?'FOCUS_RESUME':'FOCUS_PAUSE'});}catch{}};
 $('compact-focus-end').onclick=async()=>{try{await dispatch({type:'FOCUS_CANCEL'},'Session ended. Start fresh whenever you like.');reaction('idle');}catch{}};
 $('compact-break-start').onclick=async()=>{try{await dispatch({type:'BREAK_START',minutes:5},'A little rest starts now.');reaction('sleep');}catch{}};
 $('compact-roam').onchange=async e=>{const checked=e.target.checked;try{await dispatch({type:'SETTINGS',patch:{petEnabled:checked}});}catch{e.target.checked=!checked;}};
 for(const id of ['open-app','compact-all-tasks'])$(id).onclick=()=>client.openApp().catch(fail);
 $('open-sidebar').onclick=()=>client.openSidebar().catch(fail);
 $('panel-close').onclick=()=>{if(panel)post('CLOSE');else window.close();};
 $('panel-move').hidden=!panel;
 let drag=null;const handle=$('panel-move');
 handle.addEventListener('pointerdown',e=>{if(!panel)return;drag=e.pointerId;handle.setPointerCapture(e.pointerId);post('DRAG_START',{screenX:e.screenX,screenY:e.screenY});e.preventDefault();});
 handle.addEventListener('pointermove',e=>{if(drag===e.pointerId)post('DRAG_MOVE',{screenX:e.screenX,screenY:e.screenY});});
 const dragEnd=e=>{if(drag!==e.pointerId)return;post('DRAG_END',{screenX:e.screenX||0,screenY:e.screenY||0});drag=null;};
 handle.addEventListener('pointerup',dragEnd);handle.addEventListener('pointercancel',dragEnd);handle.addEventListener('lostpointercapture',dragEnd);
 handle.addEventListener('keydown',e=>{const d={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]}[e.key];if(!d||!panel)return;e.preventDefault();post('DRAG_START',{screenX:0,screenY:0});post('DRAG_MOVE',{screenX:d[0],screenY:d[1]});post('DRAG_END',{screenX:d[0],screenY:d[1]});});
 addEventListener('message',e=>{if(e.source!==parent||e.data?.source!=='purrple-companion'||e.data.type!=='VIEW')return;showView(e.data.view==='talk'?'talk':'today');});
 document.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.isComposing||e.keyCode===229)&&e.target.closest('form'))e.preventDefault();if(e.key==='Escape'&&!e.isComposing&&panel){e.preventDefault();post('CLOSE');}});
 client.subscribe(receive);
 client.compact().then(next=>{receive(next);showView(view);}).catch(error=>{$('compact-loading').hidden=true;$('compact-error').textContent=error.message||'Purrple could not open this dashboard. Close it and reopen it from her menu.';$('compact-error').hidden=false;}).finally(()=>post('READY'));
 PurrpleRenderer.preload().then(()=>ready=true).catch(()=>{$('compact-error').textContent='Purrple’s artwork could not open. Your saved tasks are safe. Try reopening this panel.';$('compact-error').hidden=false;});
 function paint(now){
  const fps=state?.settings?.fps||30,interval=1000/fps;
  if(ready&&state&&!document.hidden&&now-lastPaint>=interval){
   lastPaint=now-((now-lastPaint)%interval);const canvas=$('compact-canvas'),ctx=canvas.getContext('2d'),motion=!state.settings.reducedMotion&&!motionPreference.matches;
   let clip=pose;const time=motion?(now-poseAt)/1000:0;
   if(time>4&&!['idle','sleep','study','read','heart'].includes(clip)){reaction('idle');clip='idle';}
   if(view==='focus')clip=state.focus?.kind==='break'?'sleep':state.focus?.status==='paused'?'idle':'study';
   const outfit={...state.equipped,...(preview?{[item(preview)?.slot]:preview}:{})};
   ctx.clearRect(0,0,canvas.width,canvas.height);
   try{PurrpleRenderer.draw(ctx,{clip,time,size:245,x:200,y:222,equipped:outfit,motion,rootMotion:false});}
   catch{if(!artError){artError=true;ready=false;$('compact-error').textContent='Purrple’s artwork could not be displayed. Reopen the dashboard to try again.';$('compact-error').hidden=false;}}
  }requestAnimationFrame(paint);
 }
 requestAnimationFrame(paint);
 setInterval(()=>{
  if(!state?.focus||document.hidden)return;
  const text=clock(focusRemaining());if(view==='focus')$('compact-timer-display').textContent=text;
  $('compact-focus-summary-text').textContent=`${state.focus.kind==='break'?'Break':'Focus'} · ${text}${state.focus.status==='paused'?' · paused':''}`;
  if(state.focus.status==='running'&&focusRemaining()===0)client.get().then(receive).catch(fail);
 },500);
 globalThis.PurrpleCompact={getState:()=>state,showView,refresh:()=>client.get().then(receive),getView:()=>view};
 globalThis.PurrpleUI={getState:()=>state,showView,refresh:()=>client.get().then(receive)};
})();
