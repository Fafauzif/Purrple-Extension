/* Shared compact toolbar and private extension-origin floating dashboard. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),client=PurrpleClient,params=new URLSearchParams(location.search);
 const panel=params.get('panel')==='1'&&parent!==window;
 const api=globalThis.browser?.runtime?globalThis.browser:globalThis.chrome;
 const slots=PurrpleCore.SLOTS||['head','neck'];
 const companionDomain=globalThis.PurrpleCompanionDomain;
 const viewLabels={today:'Today',focus:'Focus',calendar:'Calendar',wardrobe:'Wardrobe',play:'Play',gifts:'Gifts',room:'Room'};
 const companionViews=['play','gifts','room'];
 const legacyTalk=params.get('view')==='talk';
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const catalog=()=>PurrpleCore.CATALOG||[],item=id=>catalog().find(i=>i.id===id);
 let state=null,view=Object.hasOwn(viewLabels,params.get('view'))?params.get('view'):'today';
 let selectedGame=view==='play'?params.get('game'):null;
 const renderListeners=new Set(),pendingCompletion=new Map();
 let taskFilter='open',taskLimit=16,taskDraft=null,taskTrigger=null,savingTask=false,wrapSignature='';
 let preview=null,shopFilter='all',shopQuery='',pose='idle',poseAt=performance.now(),ready=false,lastPaint=0,toastTimer=0,undoAction=null,artError=false,draftVersion=0,draftWrites=0,tasksSignature='',shopSignature='',submitting=false;
 const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
 $('compact-reshow').hidden=panel||!client.native;
 for(const option of $('compact-task-effort').options){
  const coins=PurrpleCore.EFFORT[option.value];
  option.textContent+=' · '+coins+' '+(coins===1?'coin':'coins');
 }
 $('compact-shop-filters').replaceChildren(...[['all','All'],['owned','Yours'],...slots.map(slot=>[slot,slot[0].toUpperCase()+slot.slice(1)])].map(([value,label])=>{
  const button=document.createElement('button');button.type='button';button.dataset.compactShop=value;button.textContent=label;
  return button;
 }));
 document.body.classList.toggle('is-panel',panel);document.body.classList.toggle('is-native-popup',client.native&&!panel);
 const post=(type,extra={})=>{if(panel)parent.postMessage({source:'purrple-panel',type,...extra},'*');};
 function notify(text,error=false,undo=null){
  clearTimeout(toastTimer);undoAction=undo;const el=$('compact-status');el.replaceChildren();const span=document.createElement('span');span.textContent=text;el.append(span);
  if(undo){span.classList.add('compact-commit-mark');const button=document.createElement('button');button.type='button';button.textContent='Undo';button.dataset.compactUndo='';el.append(button);}
  el.classList.toggle('is-error',error);el.hidden=false;toastTimer=setTimeout(()=>{el.hidden=true;undoAction=null;},undo?8500:4200);
 }
 function fail(error){notify(error?.message||'That change could not be saved. Please try again.',true);}
 function reaction(clip){pose=clip||'idle';poseAt=performance.now();}
 async function dispatch(action,message){try{const next=await client.action(action);receive(next);if(message)notify(message);return next;}catch(error){fail(error);throw error;}}
 function completionNotice(next,id,done){
  const saved=next.tasks.find(task=>task.id===id);
  const undo=saved?async()=>{
   await dispatch({type:'TASK_SET_DONE',id,done:!done,expectedUpdatedAt:saved.updatedAt},done?'Task moved back to To do.':'Task complete.');
   if(view==='today'&&[document.body,$('compact-task-title')].includes(document.activeElement)){
    $('compact-task-list').querySelector(`.task-check[data-id="${CSS.escape(id)}"]`)?.focus({preventScroll:true});
   }
  }:null;
  if(done)reaction('celebrate');
  notify(done?'Task complete.':'Task moved back to To do.',false,undo);
 }
 function receive(next){state=next;render();petMenu.refresh();}
 function showView(next,game=null){
  globalThis.PurrpleViewTransitions?.interrupt();
  if(next==='talk'){petMenu.enter('talk');return;}
  if(!Object.hasOwn(viewLabels,next))return;
  petMenu.close(false);view=next;preview=null;document.body.dataset.view=view;
  selectedGame=view==='play'&&companionDomain.games.includes(game)?game:null;
  document.title=`Purrple · ${viewLabels[view]}`;
  const inCompanion=companionViews.includes(view);
  document.querySelectorAll('[data-compact-view]').forEach(b=>{if(b.dataset.compactView===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  document.querySelectorAll('.compact-view').forEach(el=>el.hidden=el.id!==`compact-${inCompanion?'companion':view}`);
  $('compact-main').scrollTop=0;if(panel&&matchMedia('(max-height:420px)').matches)window.scrollTo(0,0);reaction(view==='focus'?'study':'idle');render();
 }
 const focusRemaining=()=>{const f=state?.focus;if(!f)return 0;return f.status==='running'?Math.max(0,(f.endsAt||Date.now())-Date.now()):Math.max(0,f.remainingMs||0);};
 const clock=ms=>{const n=Math.ceil(ms/1000);return`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
 const shortDate=at=>new Intl.DateTimeFormat('en',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(at);
 const civilDate=day=>new Intl.DateTimeFormat('en',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
 const taskDay=task=>task.dueDate||(task.dueAt==null?'':PurrpleCore.localDate(task.dueAt));
 const taskById=id=>state?.tasks.find(task=>task.id===id);
 const openTasks=()=>state.tasks.filter(task=>!task.done&&!task.archived);
 const remainingLabel=()=>`${state.focus.kind==='break'?'Break':'Focus'} · ${clock(focusRemaining())}${state.focus.status==='paused'?' · paused':''}`;
 function render(){
  if(!state)return;$('compact-loading').hidden=true;$('compact-main').hidden=false;$('preview-label').hidden=client.native;
  $('coin-balance').textContent=state.wallet?.balance||0;$('compact-coins').setAttribute('aria-label',`${state.wallet?.balance||0} coins`);$('compact-roam').checked=state.settings?.petEnabled!==false;
  $('compact-greeting').textContent=viewLabels[view];
  $('compact-summary').textContent={today:new Intl.DateTimeFormat('en',{weekday:'long',month:'short',day:'numeric'}).format(Date.now()),focus:'',wardrobe:preview?'Preview only':'',calendar:'',play:'',gifts:'',room:''}[view];
  $('outfit-preview-tag').hidden=!preview;
  if(view==='today')renderTasks();if(view==='focus')renderFocus();if(view==='wardrobe')renderShop();
  if(view==='calendar')planner?.render();
  $('compact-focus-summary').hidden=!state.focus||!['today','calendar'].includes(view);
  if(state.focus){
   $('compact-focus-summary-text').textContent=remainingLabel();
   $('compact-summary-pause').textContent=state.focus.status==='paused'?'Resume':'Pause';
  }
  for(const listener of renderListeners)listener(state,view,selectedGame);
 }
 function renderTasks(){
  const now=Date.now(),today=PurrpleCore.localDate(now);
  const priorities=new Set(state.priorities);
  const scheduled=new Set(state.calendar?.blocks.filter(block=>PurrpleCalendarDomain.includesDay(block,today)).map(block=>block.taskId));
  const rank=task=>{
   const day=taskDay(task);
   if(day&&day<=today)return 0;
   if(priorities.has(task.id)||scheduled.has(task.id))return 1;
   return task.priority==='high'?2:3;
  };
  const pending=openTasks().sort((a,b)=>rank(a)-rank(b)||(taskDay(a)||'~').localeCompare(taskDay(b)||'~')||a.createdAt-b.createdAt);
  const tasks=taskFilter==='open'?pending:state.tasks.filter(task=>task.done&&!task.archived).sort((a,b)=>b.completedAt-a.completedAt);
  $('compact-task-count').textContent=String(tasks.length);
  document.querySelectorAll('[data-compact-task-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.compactTaskFilter===taskFilter)));
  const input=$('compact-task-title');if(![input,$('compact-task-effort')].includes(document.activeElement)&&!submitting&&!draftWrites){input.value=state.drafts?.quickTask||'';$('compact-task-effort').value=state.drafts?.quickEffort||'small';}
  const rows=tasks.slice(0,taskLimit);
  const signature=JSON.stringify([taskFilter,taskLimit,today,state.focus?.id,tasks.length,rows.map(t=>[t.id,t.title,t.dueAt,t.dueDate,t.effort,t.priority,t.dueAt!=null&&t.dueAt<now,priorities.has(t.id),scheduled.has(t.id)]),[...pendingCompletion]]);
  if(signature===tasksSignature)return;tasksSignature=signature;
  const active=document.activeElement,list=$('compact-task-list'),wasInList=list.contains(active);
  const previousIndex=wasInList?[...list.children].indexOf(active.closest('.compact-task-row')):-1;
  list.innerHTML=rows.map(task=>{
   const id=escape(task.id),title=escape(task.title);
   const saving=pendingCompletion.has(task.id),shownDone=pendingCompletion.get(task.id)??task.done;
   const due=task.dueDate?civilDate(task.dueDate):task.dueAt!=null?shortDate(task.dueAt):'';
   const overdue=task.dueDate?task.dueDate<today:task.dueAt!=null&&task.dueAt<now;
   const metadata=[due&&`<span class="${overdue?'compact-overdue':''}">${overdue?'Overdue · ': 'Due '}${escape(due)}</span>`, priorities.has(task.id)?'Today’s priority':task.priority==='high'?'High priority':'',scheduled.has(task.id)?'Scheduled today':''].filter(Boolean);
   const actions=task.done?'':`<div class="compact-row-actions">${state.focus?'':`<button type="button" class="text-button" data-compact-action="start-task" data-id="${id}" aria-label="Focus on ${title}">Focus</button>`}<button type="button" class="text-button" data-compact-action="edit-task" data-id="${id}" aria-label="Edit ${title}">Edit</button><button type="button" class="text-button" data-compact-action="schedule-task" data-id="${id}" aria-label="Schedule ${title}">Schedule</button></div>`;
   return `<article class="compact-task-row"><button type="button" class="task-check ${shownDone?'is-done':''}" data-compact-action="${task.done?'reopen':'complete'}" data-id="${id}" aria-label="${shownDone?'Reopen':'Complete'} ${title}" aria-pressed="${shownDone}" ${saving?'aria-disabled="true" aria-busy="true"':''}>${shownDone?'✓':''}</button><div><strong>${title}</strong>${metadata.length?`<small>${metadata.join(' · ')}</small>`:''}${actions}</div></article>`;
  }).join('')||`<div class="compact-empty">${taskFilter==='open'?'No open tasks. Add one above.':'No completed tasks yet.'}</div>`;
  const more=$('compact-all-tasks');
  more.hidden=tasks.length<=taskLimit;
  more.textContent=`Show more (${tasks.length-rows.length} left)`;
  if(wasInList&&!active.isConnected){
   const same=active.dataset.id&&list.querySelector(`[data-compact-action="${CSS.escape(active.dataset.compactAction)}"][data-id="${CSS.escape(active.dataset.id)}"]`);
   const checks=list.querySelectorAll('.task-check');
   (same||checks[Math.min(previousIndex,checks.length-1)]||input).focus({preventScroll:true});
  }
 }
 function openTaskEditor(task,trigger=document.activeElement){
  if(!task)return;
  taskDraft={id:task.id,title:task.title,dueDate:taskDay(task),priority:task.priority,effort:task.effort};
  taskTrigger=trigger;
  for(const [field,value] of Object.entries(taskDraft)){
   if(field!=='id')$(`compact-edit-${field==='dueDate'?'due-date':field}`).value=value;
  }
  $('compact-task-edit-error').hidden=true;
  $('compact-task-dialog').showModal();
  $('compact-edit-title').focus();
 }
 const taskDialog=$('compact-task-dialog');
 $('compact-task-edit-close').onclick=$('compact-task-edit-cancel').onclick=()=>taskDialog.close();
 taskDialog.addEventListener('cancel',event=>{if(savingTask)event.preventDefault();});
 taskDialog.addEventListener('close',()=>{
  if(taskTrigger?.isConnected&&!taskTrigger.closest('[hidden]'))taskTrigger.focus({preventScroll:true});
  else if(view==='today'){
   const replacement=taskDraft&&$('compact-task-list').querySelector(`[data-compact-action="edit-task"][data-id="${CSS.escape(taskDraft.id)}"]`);
   (replacement||$('compact-task-title')).focus({preventScroll:true});
  }else if(view==='calendar'){
   const control=taskTrigger?.dataset.calendarFocus;
   const replacement=control&&$('compact-calendar-content').querySelector(`[data-calendar-focus="${CSS.escape(control)}"]`);
   (replacement||$('planner-add')).focus({preventScroll:true});
  }
  taskDraft=null;taskTrigger=null;
 });
 $('compact-task-edit-form').onsubmit=async event=>{
  event.preventDefault();
  if(savingTask||!taskDraft)return;
  const fields={title:$('compact-edit-title').value.trim(),dueDate:$('compact-edit-due-date').value,priority:$('compact-edit-priority').value,effort:$('compact-edit-effort').value};
  const patch=Object.fromEntries(Object.entries(fields).filter(([key,value])=>value!==taskDraft[key]));
  if(Object.hasOwn(patch,'dueDate')){
   patch.dueDate||=null;
   patch.dueAt=null;
  }
  if(!Object.keys(patch).length){taskDialog.close();return;}
  const controls=['compact-task-edit-close','compact-task-edit-cancel','compact-task-edit-save'].map($);
  const error=$('compact-task-edit-error');
  savingTask=true;controls.forEach(button=>button.disabled=true);error.hidden=true;
  try{await dispatch({type:'TASK_UPDATE',id:taskDraft.id,patch},'Task saved.');taskDialog.close();}
  catch(failure){error.textContent=failure.message;error.hidden=false;}
  finally{savingTask=false;controls.forEach(button=>button.disabled=false);}
 };
 function renderFocus(){
  const f=state.focus,active=!!f;
  $('compact-focus-form').hidden=active;$('compact-timer-actions').hidden=!active;
  const phase=active?(f.status==='paused'?'paused':f.kind==='break'?'break':'running'):'ready';
  document.body.dataset.focusPhase=phase;
  $('compact-timer-kind').textContent={paused:'Paused',break:'On a break',running:'Focusing',ready:'Ready'}[phase];
  $('compact-timer-display').textContent=active?clock(focusRemaining()):`${$('compact-minutes').value}:00`;
  $('compact-focus-pause').textContent=f?.status==='paused'?'Resume':'Pause';$('compact-break-start').disabled=active;
  $('compact-break-label').textContent=active?'A timer is already running.':'Take a break?';
  const last=state.focusHistory?.at(-1);
  const earn=last?.coins??(last?.kind==='focus'?PurrpleCore.focusReward(last.durationMs,last.rule):0);
  $('compact-focus-earned').textContent=active?'':last
    ? `Last session: ${last.kind==='focus'?'focus':'break'} complete${last.kind==='focus'?` · ${earn===0?'0':'+'+earn} ${earn===1?'coin':'coins'}`:''}.`
    : 'Focus earns 1 coin from 15 minutes or 2 coins from 30 minutes.';
  const select=$('compact-focus-task'),selected=select.value;
  const tasksHtml='<option value="">Just a quiet session</option>'+openTasks().map(t=>`<option value="${escape(t.id)}">${escape(t.title)}</option>`).join('');
  if(select.dataset.fingerprint!==tasksHtml){
   select.dataset.fingerprint=tasksHtml;
   select.innerHTML=tasksHtml;
   if([...select.options].some(o=>o.value===selected))select.value=selected;
  }
  const detail=$('compact-focus-active-task');
  const task=taskById(f?.taskId);
  detail.textContent=[task?.title,f?.intention].filter(Boolean).join(' · ');
  detail.hidden=!detail.textContent;
  const notes=$('compact-focus-notes');
  $('compact-focus-park').hidden=f?.kind!=='focus';
  notes.innerHTML=(f?.notes||[]).map(note=>`<li>${escape(note.text)}</li>`).join('');
  notes.hidden=!f?.notes?.length;
  renderWrap(last);
 }
 function renderWrap(session){
  const root=$('compact-focus-wrap'),task=taskById(session?.taskId);
  const visible=!!session&&session.id!==state.wrapSeen&&!state.focus;
  root.hidden=!visible;
  const signature=JSON.stringify([visible,session,task?.done,task?.archived]);
  if(signature===wrapSignature)return;wrapSignature=signature;
  if(!visible){root.replaceChildren();return;}
  const button=(action,label,extra='')=>`<button type="button" class="text-button" data-compact-action="${action}" data-id="${escape(session.id)}" ${extra}>${label}</button>`;
  root.innerHTML=`<h2>${session.kind==='break'?'Break complete':'Focus complete'}</h2>
   ${session.notes?.length?`<ul>${session.notes.map(note=>`<li>${escape(note.text)} ${note.captured?'<small>Added to tasks</small>':button('capture-note','Make task',`data-note="${escape(note.id)}"`)}</li>`).join('')}</ul>`:''}
   <div class="compact-wrap-actions">
    ${task&&!task.done&&!task.archived?button('complete-linked','Complete task',`data-task="${escape(task.id)}"`):''}
    ${session.kind==='focus'?button('wrap-break','Take 5-minute break'):''}
    ${button('wrap-dismiss','Done')}
   </div>`;
 }
 function renderShop(){
  const signature=JSON.stringify([state.owned,state.equipped,state.wallet.balance,shopFilter,shopQuery,preview]);if(signature===shopSignature)return;shopSignature=signature;
  const all=catalog(),owned=state.owned||[],selected=preview?item(preview):null;
  $('compact-outfit-heading').textContent=selected?'Trying on · '+selected.name:'Wearing now';
  const worn=slots.flatMap(slot=>item(state.equipped?.[slot])||[]);
  $('compact-outfit-copy').textContent=selected?(owned.includes(selected.id)?'Choose Wear to save this outfit.':'Buy this item to keep it, then choose Wear.'):worn.length?'':'No accessories equipped yet.';
  $('compact-worn-items').replaceChildren(...worn.map(c=>{
   const remove=document.createElement('button');remove.type='button';remove.className='text-button';
   remove.dataset.compactAction='remove';remove.dataset.id=c.id;remove.textContent='Remove '+c.name;return remove;
  }));
  $('compact-preview-reset').hidden=!preview;
  document.querySelectorAll('[data-compact-shop]').forEach(b=>b.setAttribute('aria-pressed',String(shopFilter===b.dataset.compactShop)));
  const list=all.filter(c=>(shopFilter==='all'||shopFilter==='owned'&&owned.includes(c.id)||c.slot===shopFilter)&&`${c.name} ${c.description}`.toLowerCase().includes(shopQuery));
  const focused=document.activeElement,action=focused?.dataset.compactAction,id=focused?.dataset.id;
  $('compact-shop-grid').innerHTML=list.map(c=>{
   const yours=owned.includes(c.id),worn=state.equipped?.[c.slot]===c.id,trying=preview===c.id,needed=Math.max(0,c.price-state.wallet.balance);
   const status=worn?'Equipped':yours?'Owned · not equipped':trying?'Trying on · not owned':'Not owned';
   return`<article class="compact-item ${trying?'is-preview':''}"><img src="assets/wardrobe/thumbs/${encodeURIComponent(c.id)}.png" alt="Purrple wearing ${escape(c.name)}" loading="lazy"><div class="compact-item-info"><h2>${escape(c.name)}</h2><p class="compact-item-status ${worn?'equipped':yours?'owned':''}">${status}</p><p class="compact-item-price">${yours?'Yours forever':`✧ ${c.price} coins`}</p><div class="compact-item-actions"><button type="button" class="button subtle" data-compact-action="try" data-id="${escape(c.id)}">Try on</button>${yours?`<button type="button" class="button primary" data-compact-action="wear" data-id="${escape(c.id)}" ${worn?'disabled':''}>${worn?'Wearing':'Wear'}</button>`:`<button type="button" class="button primary" data-compact-action="buy" data-id="${escape(c.id)}" ${needed?'disabled':''}>Buy</button>`}</div><p class="compact-item-needed">${!yours&&needed?`Need ${needed} more coins`:yours?'': 'Enough coins to buy'}</p></div></article>`;
  }).join('')||`<div class="compact-empty compact-shop-empty"><strong>${shopQuery?'No matching little things.':'No matching accessories.'}</strong>${shopQuery?'Try another word or clear the search.':'Complete tasks for coins, then choose something from All.'}</div>`;
  $('compact-shop-clear').hidden=!shopQuery;
  if(focused&&!focused.isConnected&&action&&id){const b=document.querySelector(`[data-compact-action="${CSS.escape(action)}"][data-id="${CSS.escape(id)}"]`);(b&&!b.disabled?b:$('compact-shop-search')).focus({preventScroll:true});}
 }
 async function reShow(){
  if(!client.native)throw Error('Install Purrple to show her on this site.');
  const result=await api.runtime.sendMessage({type:'PET_RESHOW_ACTIVE'});
  if(!result?.ok)throw Error(result?.error||'Open a regular webpage to show Purrple.');
  if(result.state)receive(result.state);
 }
 const petMenu=PurrplePetMenu.mount({
  menu:$('compact-pet-menu'),speech:$('compact-pet-speech'),actor:$('compact-pet'),state:()=>state,onReply:reaction,
  companion:()=>state?.companion?{
   unlockedGames:companionDomain?.unlockedGames(state.companion),
   resumableGame:companionDomain?.resumableGame?.(state.companion)
  }:undefined,
  execute:async entry=>{
   if(entry.kind==='talk'){
    const next=await client.talk(entry.promptId);receive(next);
    const reply=next.talk?.last;
    return {text:reply?.text,reaction:reply?.reaction};
   }
   if(entry.kind==='focus'){
    const next=await client.action(entry.mode==='resume'?{type:'FOCUS_RESUME'}:{type:'FOCUS_START',minutes:entry.minutes});
    receive(next);
    return {text:entry.mode==='resume'?'Back to it. I kept your place.':'Notebook open. I’ll keep you company.',reaction:'study'};
   }
   if(entry.kind==='route'){
    const game=entry.id.match(/^companion-play-(.+)$/)?.[1];
    if(game||entry.id==='companion-play'){
     await client.openGame(game||null);
     return {restoreFocus:false};
    }
    const routed={'companion-gifts':'gifts','companion-room':'room'}[entry.id]||entry.id;
    if(Object.hasOwn(viewLabels,routed))showView(routed);
    else await client.openApp(['dashboard','app-today'].includes(entry.id)?'today':entry.id);
    return {restoreFocus:false};
   }
   if(entry.kind==='care')return {text:'Prrr. A very good little head pat.',reaction:'pat'};
   if(entry.id==='reshow'){await reShow();return {text:'Purrple is ready to join this site.'};}
  }
 });
 $('compact-pet').onclick=()=>petMenu.toggle();
 $('compact-reshow').onclick=()=>reShow().then(()=>notify('Purrple is ready to join this site.')).catch(fail);
 async function saveDraft(){
  if(submitting)return;const text=$('compact-task-title').value,effort=$('compact-task-effort').value;if(!draftWrites&&text===(state?.drafts?.quickTask||'')&&effort===(state?.drafts?.quickEffort||'small'))return;const version=++draftVersion;draftWrites++;
  try{receive(await client.saveQuickDraft(text,effort));}
  catch{if(version===draftVersion)notify('Draft could not be saved. Keep this panel open until you add the task.',true);}
  finally{draftWrites--;}
 }
 $('compact-task-title').addEventListener('input',e=>{if(!e.isComposing)saveDraft();});
 $('compact-task-title').addEventListener('compositionend',saveDraft);
 $('compact-task-effort').addEventListener('change',saveDraft);
 $('compact-task-form').addEventListener('submit',async e=>{
  e.preventDefault();if(e.isComposing||submitting)return;const title=$('compact-task-title').value.trim();
  if(!title){$('compact-task-error').textContent='Enter a task name.';$('compact-task-error').hidden=false;$('compact-task-title').focus();return;}
  submitting=true;draftVersion++;$('compact-task-error').hidden=true;$('compact-task-add').disabled=true;$('compact-task-title').disabled=true;$('compact-task-effort').disabled=true;
  try{await dispatch({type:'TASK_ADD',title,effort:$('compact-task-effort').value,priority:'normal',recurrence:'none',dueAt:null,subtasks:[],fromDraft:true},'Task added.');$('compact-task-title').value='';}
  catch{}finally{submitting=false;$('compact-task-add').disabled=false;$('compact-task-title').disabled=false;$('compact-task-effort').disabled=false;$('compact-task-title').focus();renderTasks();}
 });
 document.addEventListener('click',async e=>{
  if(!e.composedPath().includes($('compact-hero'))&&petMenu.visible())petMenu.close(false);
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.compactView){
   const update=()=>showView(b.dataset.compactView);
   if(state&&b.getAttribute('aria-current')!=='page'&&globalThis.PurrpleViewTransitions)PurrpleViewTransitions.run(update,state.settings.reducedMotion);
   else update();
   return;
  }
  if(b.dataset.compactGo){showView(b.dataset.compactGo);return;}
  if(b.dataset.compactRoute){client.openApp(b.dataset.compactRoute).catch(fail);return;}
  if(b.dataset.compactShop){shopFilter=b.dataset.compactShop;renderShop();return;}
  if(b.dataset.compactTaskFilter){taskFilter=b.dataset.compactTaskFilter;taskLimit=16;renderTasks();return;}
  if(b.hasAttribute('data-compact-undo')){
   if(!undoAction)return;
   const undo=undoAction;undoAction=null;$('compact-status').hidden=true;
   try{await undo();}catch{}
   return;
  }
  const action=b.dataset.compactAction,id=b.dataset.id;if(!action)return;
  if(action==='edit-task'){openTaskEditor(taskById(id),b);return;}
  if(action==='schedule-task'){planner?.scheduleTask(id,b);return;}
  if(action==='try'){preview=id;render();return;}
  if(action==='complete'||action==='reopen'){
   const task=taskById(id);
   if(!task||task.archived||pendingCompletion.has(id))return;
   const done=!task.done;
   pendingCompletion.set(id,done);renderTasks();
   try{
    const next=await dispatch({type:'TASK_SET_DONE',id,done});
    completionNotice(next,id,done);
   }catch{}finally{pendingCompletion.delete(id);renderTasks();}
   return;
  }
  b.disabled=true;
  try{
   if(action==='complete-linked'){
    const taskId=b.dataset.task;
    const next=await dispatch({type:'TASK_SET_DONE',id:taskId,done:true});
    completionNotice(next,taskId,true);
   }
   if(action==='start-task'){
    const minutes=$('compact-minutes');
    await dispatch({type:'FOCUS_START',minutes:minutes.validity.valid?Number(minutes.value):25,taskId:id},'Focus started.');
    reaction('study');
    $('compact-summary-pause').focus({preventScroll:true});
   }
   if(action==='capture-note'){await dispatch({type:'FOCUS_NOTE_TASK',id,noteId:b.dataset.note},'Thought added to tasks.');}
   if(action==='wrap-dismiss'){await dispatch({type:'FOCUS_WRAP_DISMISS',id});}
   if(action==='wrap-break'){await startBreak();}
   if(action==='buy'){await dispatch({type:'SHOP_BUY',id},`${item(id).name} is yours. Choose Wear to put it on.`);preview=id;render();}
   if(action==='wear'){preview=null;await dispatch({type:'EQUIP',slot:item(id).slot,id},'Outfit saved.');}
   if(action==='remove'){preview=null;await dispatch({type:'EQUIP',slot:item(id).slot,id:null},'Accessory removed.');$('compact-outfit-heading').tabIndex=-1;$('compact-outfit-heading').focus({preventScroll:true});}
  }catch{}finally{if(b.isConnected)b.disabled=false;}
 });
 $('compact-preview-reset').onclick=()=>{preview=null;render();};
 $('compact-shop-search').addEventListener('input',e=>{if(e.isComposing)return;shopQuery=e.target.value.trim().toLowerCase();renderShop();});
 $('compact-shop-search').addEventListener('compositionend',e=>{shopQuery=e.target.value.trim().toLowerCase();renderShop();});
 $('compact-shop-clear').onclick=()=>{shopQuery='';$('compact-shop-search').value='';renderShop();$('compact-shop-search').focus();};
 $('compact-focus-form').addEventListener('submit',async e=>{
  e.preventDefault();if(e.isComposing||!$('compact-minutes').reportValidity())return;
  const button=$('compact-focus-start');button.disabled=true;
  try{
   await dispatch({type:'FOCUS_START',minutes:Number($('compact-minutes').value),taskId:$('compact-focus-task').value||null,intention:$('compact-focus-intention').value},'Focus started.');
   $('compact-focus-intention').value='';
   $('compact-focus-pause').focus();
   reaction('study');
  }catch{}finally{button.disabled=false;}
 });
 $('compact-focus-park').onsubmit=async event=>{
  event.preventDefault();
  const note=$('compact-focus-note'),button=event.currentTarget.querySelector('button');
  if(button.disabled||!state.focus)return;
  button.disabled=true;
  try{await dispatch({type:'FOCUS_PARK',text:note.value,sessionId:state.focus.id},'Thought parked.');note.value='';note.focus();}
  catch{}finally{button.disabled=false;}
 };
 $('compact-minutes').onchange=()=>{if(!state?.focus)$('compact-timer-display').textContent=`${$('compact-minutes').value}:00`;};
 async function toggleTimer(event){
  const focus=state.focus,button=event.currentTarget;
  if(!focus||button.disabled)return;
  button.disabled=true;
  try{await dispatch({type:focus.status==='paused'?'FOCUS_RESUME':'FOCUS_PAUSE',sessionId:focus.id});}
  catch{}finally{button.disabled=false;}
 }
 $('compact-focus-pause').onclick=$('compact-summary-pause').onclick=toggleTimer;
 $('compact-focus-end').onclick=async()=>{try{await dispatch({type:'FOCUS_CANCEL',sessionId:state.focus?.id},'Session ended.');reaction('idle');}catch{}};
 async function startBreak(){try{await dispatch({type:'BREAK_START',minutes:5},'Break started.');reaction('sleep');}catch{}}
 $('compact-break-start').onclick=startBreak;
 $('compact-roam').onchange=async e=>{const checked=e.target.checked;try{await dispatch({type:'SETTINGS',patch:{petEnabled:checked}});}catch{e.target.checked=!checked;}};
 $('open-app').onclick=()=>client.openApp('today').catch(fail);
 $('compact-calendar-expand').onclick=()=>client.openApp('calendar').catch(fail);
 $('compact-all-tasks').onclick=()=>{
  const oldCount=$('compact-task-list').childElementCount;
  taskLimit+=16;renderTasks();
  $('compact-task-list').children[oldCount]?.querySelector('.task-check')?.focus();
 };
 $('open-sidebar').onclick=()=>client.openSidebar().catch(fail);
 $('panel-close').onclick=()=>{if(panel)post('CLOSE');else window.close();};
 const pin=$('panel-pin');
 pin.hidden=!panel;
 pin.onclick=()=>{
  if(!panel)return;
  const pinned=pin.getAttribute('aria-pressed')!=='true';
  pin.setAttribute('aria-pressed',String(pinned));
  post('PIN',{pinned});
 };
 $('panel-move').hidden=!panel;
 let drag=null;const handle=$('panel-move');
 handle.addEventListener('pointerdown',e=>{if(!panel)return;drag=e.pointerId;handle.setPointerCapture(e.pointerId);post('DRAG_START',{screenX:e.screenX,screenY:e.screenY});e.preventDefault();});
 handle.addEventListener('pointermove',e=>{if(drag===e.pointerId)post('DRAG_MOVE',{screenX:e.screenX,screenY:e.screenY});});
 const dragEnd=(e,cancel)=>{if(drag!==e.pointerId)return;post(cancel?'DRAG_CANCEL':'DRAG_END',{screenX:e.screenX||0,screenY:e.screenY||0});drag=null;};
 handle.addEventListener('pointerup',e=>dragEnd(e,false));handle.addEventListener('pointercancel',e=>dragEnd(e,true));handle.addEventListener('lostpointercapture',e=>dragEnd(e,true));
 handle.addEventListener('keydown',e=>{const d={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]}[e.key];if(!d||!panel)return;e.preventDefault();post('DRAG_START',{screenX:0,screenY:0});post('DRAG_MOVE',{screenX:d[0],screenY:d[1]});post('DRAG_END',{screenX:d[0],screenY:d[1]});});
 const planner=globalThis.PurrplePlanner?.mount({root:$('compact-calendar-content'),state:()=>state,dispatch,notify,showView,editTask:id=>openTaskEditor(taskById(id))});
 if(planner){
  const add=$('planner-add'),headingActions=document.createElement('div');
  headingActions.className='compact-calendar-actions';
  add.before(headingActions);
  headingActions.append(add,$('compact-calendar-expand'));
  const date=$('planner-jump'),dateLabel=date.closest('label');
  const jump=document.createElement('details'),summary=document.createElement('summary');
  jump.className='compact-calendar-jump';
  summary.textContent='Jump…';
  dateLabel.before(jump);
  jump.append(summary,dateLabel);
  date.addEventListener('change',()=>{if(date.value){jump.open=false;summary.focus({preventScroll:true});}});
 }
 document.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.isComposing||e.keyCode===229)&&e.target.closest('form'))e.preventDefault();if(e.key==='Escape'&&!e.isComposing){
  if(document.querySelector('dialog[open]'))return;
  if(drag!==null){post('DRAG_CANCEL');if(handle.hasPointerCapture(drag))handle.releasePointerCapture(drag);drag=null;e.preventDefault();return;}
  if(!petMenu.escape(e)&&panel){e.preventDefault();post('CLOSE');}
 }});
 client.subscribe(receive);
 client.compact().then(next=>{state=next;showView(view,selectedGame);if(legacyTalk)petMenu.enter('talk');}).catch(error=>{$('compact-loading').hidden=true;$('compact-error').textContent=error.message||'Purrple could not open this panel. Close it and reopen it from her menu.';$('compact-error').hidden=false;}).finally(()=>post('READY'));
 PurrpleRenderer.preload({all:false}).then(()=>ready=true).catch(()=>{$('compact-error').textContent='Purrple’s artwork could not open. Your saved tasks are safe. Try reopening this panel.';$('compact-error').hidden=false;});
 const actorCanvas=$('compact-canvas'),actorContext=actorCanvas.getContext('2d');
 let renderedClip=null,renderedPoseAt=-1,clipStarted=0,staticFrame='';
 function paint(now){
  requestAnimationFrame(paint);
  const interval=1000/(state?.settings?.fps||30);
  if(!ready||!state||document.hidden||now-lastPaint<interval||!actorCanvas.getClientRects().length)return;
  lastPaint=now-((now-lastPaint)%interval);
  const motion=!state.settings.reducedMotion&&!motionPreference.matches;
  if(now-poseAt>4000&&!['idle','sleep','study','read','heart'].includes(pose))reaction('idle');
  let clip=pose;
  if(['today','focus'].includes(view)&&!petMenu.visible()&&state.focus&&clip!=='celebrate')clip=state.focus.kind==='break'?'sleep':state.focus.status==='paused'?'idle':'study';
  if(view==='wardrobe'&&preview)clip=PurrpleRenderer.itemFit(preview)?.previewPose||clip;
  if(clip!==renderedClip||poseAt!==renderedPoseAt){renderedClip=clip;renderedPoseAt=poseAt;clipStarted=now;}
  const outfit={...state.equipped,...(preview?{[item(preview)?.slot]:preview}:{})};
  const y=actorCanvas.height-13;
  const size=PurrpleRenderer.surfaceSize(actorCanvas,state.settings.size,y,{miniature:true});
  if(!size)return;
  const imageKey=motion?'':JSON.stringify([clip,outfit,size]);
  if(imageKey&&imageKey===staticFrame)return;
  const options={clip,time:motion?(now-clipStarted)/1000:0,size,x:actorCanvas.width/2,y,equipped:outfit,motion,rootMotion:false};
  try{
   if(!PurrpleRenderer.isDrawReady(options))return;
   actorContext.clearRect(0,0,actorCanvas.width,actorCanvas.height);
   PurrpleRenderer.draw(actorContext,options);
   staticFrame=imageKey;
  }catch{
   if(!artError){artError=true;ready=false;$('compact-error').textContent='Purrple’s artwork could not be displayed. Reopen the dashboard to try again.';$('compact-error').hidden=false;}
  }
 }
 requestAnimationFrame(paint);
 setInterval(()=>{
  if(!state?.focus||document.hidden)return;
  const text=clock(focusRemaining());if(view==='focus')$('compact-timer-display').textContent=text;
  $('compact-focus-summary-text').textContent=remainingLabel();
  if(state.focus.status==='running'&&focusRemaining()===0)client.get().then(receive).catch(fail);
 },500);
 const getState=()=>state;
 globalThis.PurrpleCompact={getState,state:getState,showView,open:showView,dispatch,notify,
  onRender(listener){
   renderListeners.add(listener);
   if(state)listener(state,view,selectedGame);
   return()=>renderListeners.delete(listener);
  },
  refresh:()=>client.get().then(receive),getView:()=>view};
 globalThis.PurrpleUI={getState:()=>state,showView,refresh:()=>client.get().then(receive)};
})();
