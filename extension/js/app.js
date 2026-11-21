(() => {
  'use strict';
  const $=id=>document.getElementById(id),client=PurrpleClient;
  const popup=document.body.classList.contains('popup-body');
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state=null,view='today',taskFilter='open',shopFilter='all',shopQuery='',search='',taskLimit=25,preview=null,lastSettings='',toastTimer=0,tasksSignature='',shopSignature='',homeDraftWrites=0;
  const pendingCompletion=new Map();
  let pose='idle',poseStarted=performance.now(),focusPose='idle',focusPoseStarted=0;
  let rendererReady=false,lastPaint=0,artErrorShown=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const catalog=()=>PurrpleCore.CATALOG||[];
  const owned=id=>state?.owned?.includes(id);
  const item=id=>catalog().find(c=>c.id===id);
  const equipped=()=>({...state?.equipped,...(preview?{[item(preview)?.slot]:preview}:{})});
  const date=at=>new Intl.DateTimeFormat('en',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(at);
  const dayLabel=value=>new Intl.DateTimeFormat('en',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
  const coins=amount=>`${amount} coin${amount===1?'':'s'}`;
  const taskDay=task=>task.dueDate||(task.dueAt?PurrpleCore.localDate(task.dueAt):null);
  let wrapSignature='',daySignature='',audio=null,lastSeenSession=null,suggestionOpen=false,suggestionSignature='';
  function notify(text,error=false,undo=null,stamp=false){const el=$('toast');if(!el)return;clearTimeout(toastTimer);el.replaceChildren();const span=document.createElement('span');span.textContent=text;if(stamp)span.className='print-stamp';el.append(span);if(undo){const b=document.createElement('button');b.type='button';b.textContent='Undo';b.onclick=async()=>{b.disabled=true;try{await undo();}catch{}};el.append(b);}el.classList.toggle('error',error);el.hidden=false;toastTimer=setTimeout(()=>el.hidden=true,undo?8500:4500);}
  function setPose(id){pose=id;poseStarted=performance.now();}
  function receive(next){
    const finished=next.focusHistory?.at(-1);
    if(state&&finished?.id!==lastSeenSession&&finished&&state.focus?.id===finished.id&&next.settings.sound&&
      !PurrpleCore.quietNow(next.settings)&&!document.hidden&&audio?.state==='running'){
      const tone=audio.createOscillator(),volume=audio.createGain(),at=audio.currentTime;
      tone.frequency.value=523.25;volume.gain.setValueAtTime(.055,at);volume.gain.exponentialRampToValueAtTime(.001,at+.35);
      tone.connect(volume).connect(audio.destination);tone.start(at);tone.stop(at+.36);
    }
    lastSeenSession=finished?.id;
    if(!state&&$('focus-minutes'))$('focus-minutes').value=next.settings.focusPreset;
    state=next;render();
  }
  async function dispatch(action,message){
    try{const next=await client.action(action);receive(next);if(message)notify(message);return next;}
    catch(error){notify(error?.message||'That change could not be saved. Please try again.',true);throw error;}
  }
  function completionNotice(next,id,done){
    const saved=next.tasks.find(task=>task.id===id);
    const undo=saved?async()=>{
      await dispatch({type:'TASK_SET_DONE',id,done:!done,expectedUpdatedAt:saved.updatedAt},done?'Task reopened.':'Task completed.');
      if(view==='today'&&[document.body,$('quick-title')].includes(document.activeElement)){
        $('task-list')?.querySelector(`[data-focus="toggle-${CSS.escape(id)}"]`)?.focus({preventScroll:true});
      }
    }:null;
    if(done)setPose('celebrate');
    notify(done?'Done':'Task reopened.',false,undo,done);
  }
  function remaining(){const f=state?.focus;if(!f)return 0;return f.status==='running'?Math.max(0,(f.endsAt||Date.now())-Date.now()):Math.max(0,f.remainingMs||0);}
  function formatTime(ms){const seconds=Math.ceil(ms/1000);return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;}
  function showView(next){
    globalThis.PurrpleViewTransitions?.interrupt();
    if(next==='app-today')next='today';
    if(/^companion-play(?:-|$)/.test(next)&&state&&playWindow){
      const dialog=$('play-dialog');
      if(!dialog.open){
        playOpener=document.activeElement;
        dialog.append($('toast'));
        dialog.showModal();
      }
      playWindow.open('play',next.replace(/^companion-play-?/,'')||undefined);
      return;
    }
    if($('play-dialog').open)$('play-dialog').close();
    const toast=$('toast');
    if(!toast.querySelector('button')){clearTimeout(toastTimer);toast.hidden=true;}
    const labels={today:'Today',calendar:'Calendar',focus:'Focus',companion:'Purrple’s room',wardrobe:'Wardrobe',talk:'Conversation journal',settings:'Settings'};
    const selected=next.startsWith('companion-')?'companion':next;
    view=Object.hasOwn(labels,selected)?selected:'today';
    const route=selected===view?next:view;
    if(location.hash!=='#'+route)history.replaceState(null,'','#'+route);
    document.title='Purrple · '+labels[view];preview=null;
    dashboardPet?.close(false);
    document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==`view-${view}`);
    document.querySelectorAll('[data-view]').forEach(b=>{
      const parent=['wardrobe','talk'].includes(view)?'companion':view;
      if(b.dataset.view===parent)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
    });
    setPose(view==='focus'?'study':'idle');
    if(route==='companion'||route==='companion-room')companion?.open('room');
    if(route==='companion-gifts')companion?.open('gifts');
    render();
    if(['today','calendar'].includes(view))calendar?.showAgenda();
  }
  function render(){
    if(!state)return;
    const active=document.activeElement;
    const focusSpec=active?.dataset?.action&&active.dataset.id?{action:active.dataset.action,id:active.dataset.id}:active?.dataset?.shopFilter?{shopFilter:active.dataset.shopFilter}:active?.dataset?.taskFilter?{taskFilter:active.dataset.taskFilter}:null;
    $('loading').hidden=true;$('coin-balance').textContent=state.wallet?.balance??0;
    $('preview-label').hidden=client.native;
    if(popup){renderPopup();return;}
    $('main').hidden=false;
    $('today-date').textContent=new Intl.DateTimeFormat('en',{weekday:'long',month:'long',day:'numeric'}).format(Date.now());
    $('pet-intro').hidden=state.settings.welcomeDismissed;
    renderTasks();renderWorkday();renderSuggestion();renderFocus();renderShop();renderSettings();talkUI?.render();planner?.render();
    if(view==='companion')companion?.render();
    if($('play-dialog').open)playWindow?.render();
    if(![$('quick-title'),$('quick-effort')].includes(document.activeElement)&&!$('quick-form').dataset.busy&&!homeDraftWrites){$('quick-title').value=state.drafts?.quickTask||'';$('quick-effort').value=state.drafts?.quickEffort||'small';}
    const start=new Date();start.setHours(0,0,0,0);
    const today=(state.tasks||[]).filter(t=>t.done&&t.completedAt>=start.getTime()).length;
    $('today-done').textContent=today?`${today} done today`:'';
    if(active&&!active.isConnected&&focusSpec&&document.activeElement===document.body){
      const selector=focusSpec.action?`[data-action="${CSS.escape(focusSpec.action)}"][data-id="${CSS.escape(focusSpec.id)}"]`:focusSpec.shopFilter?`[data-shop-filter="${CSS.escape(focusSpec.shopFilter)}"]`:`[data-task-filter="${CSS.escape(focusSpec.taskFilter)}"]`;
      const replacement=document.querySelector(selector);(replacement&&!replacement.disabled?replacement:$('quick-title')).focus({preventScroll:true});
    }
  }
  function renderWorkday(){
    const today=PurrpleCore.localDate(Date.now());
    const priorities=state.priorities.map(id=>state.tasks.find(task=>task.id===id)).filter(Boolean);
    const latest=state.focusHistory.filter(session=>session.kind==='focus'&&PurrpleCore.localDate(session.completedAt)===today);
    const completed=state.tasks.filter(task=>task.completedAt&&task.done&&PurrpleCore.localDate(task.completedAt)===today);
    const last=state.focusHistory.at(-1);
    const signature=JSON.stringify([today,priorities,latest.map(x=>x.id),completed.map(x=>x.id),last?.id,state.wrapSeen]);
    if(signature===daySignature)return;daySignature=signature;
    const prioritiesRoot=$('today-priorities'),active=document.activeElement;
    prioritiesRoot.hidden=priorities.length===0;
    prioritiesRoot.innerHTML=`<div class="day-section-header"><h2>Priorities</h2><span class="muted">${priorities.length} of 3</span></div>`+(priorities.length?
      `<ul>${priorities.map(task=>`<li><span>${task.done?'✓ ':''}${esc(task.title)}</span><button class="text-button" type="button" data-action="priority" data-id="${esc(task.id)}" aria-label="Remove ${esc(task.title)} from priorities" aria-pressed="true">Remove</button></li>`).join('')}</ul>`:
      '<p class="muted">Choose up to three tasks to keep in view.</p>');
    const minutes=Math.round(latest.reduce((sum,session)=>sum+session.durationMs,0)/60000);
    const unfinished=priorities.filter(task=>!task.done&&!task.archived);
    $('day-review-content').innerHTML=`<p>${minutes} minutes of completed focus · ${completed.length} completed task${completed.length===1?'':'s'}</p>${unfinished.length?
      `<ul>${unfinished.map(task=>`<li><span>${esc(task.title)}</span><button class="text-button" type="button" data-action="schedule-task" data-id="${esc(task.id)}">Schedule ahead</button><button class="text-button" type="button" data-action="priority" data-id="${esc(task.id)}" aria-pressed="true">Unpin</button></li>`).join('')}</ul>`:
      '<p class="muted">No unfinished priorities to review.</p>'}`;
    if(active&&!active.isConnected&&active.dataset.action==='priority')$('quick-title')?.focus({preventScroll:true});
    const done=$('today-completion');
    done.hidden=!last||last.id===state.wrapSeen;
    done.textContent=last?.kind==='break'?'Break complete · View wrap-up':'Focus complete · View wrap-up';
  }
  function renderSuggestion(){
    const root=$('task-suggestion'),button=$('suggest-task');
    root.hidden=!suggestionOpen;
    button.setAttribute('aria-expanded',String(suggestionOpen));
    if(!suggestionOpen)return;
    const today=PurrpleCore.localDate(Date.now()),calendar=globalThis.PurrpleCalendarDomain;
    const planned=new Set((state.calendar?.blocks||[]).filter(block=>calendar?.includesDay(block,today)).map(block=>block.taskId));
    function rank(task){
      const day=taskDay(task);
      if(day&&day<today)return 0;
      if(day===today||planned.has(task.id))return 1;
      if(state.priorities.includes(task.id)||task.priority==='high')return 2;
      return 3;
    }
    const [task]=state.tasks.filter(task=>!task.done&&!task.archived)
      .sort((a,b)=>rank(a)-rank(b)||(taskDay(a)||'9999').localeCompare(taskDay(b)||'9999')||a.createdAt-b.createdAt);
    const chosen=task?[task.id,task.title,rank(task),planned.has(task.id),state.focus?.id]:[];
    const signature=JSON.stringify(chosen);
    if(signature===suggestionSignature)return;
    suggestionSignature=signature;
    if(!task){
      root.innerHTML='<p>Your list is clear. Capture something above when you’re ready.</p>';
      return;
    }
    const why=['Its deadline has passed.',planned.has(task.id)?'You made time for it today.':'It’s due today.','You marked it as a priority.','It’s waiting in your task list.'][rank(task)];
    root.innerHTML=`<p><strong>${esc(task.title)}</strong><span>${why}</span></p><button class="button subtle" type="button" data-action="suggestion-focus" data-id="${esc(task.id)}">${state.focus?'View your timer':'Start focus'}</button>`;
  }
  function renderTasks(){
    const today=PurrpleCore.localDate(Date.now()),scheduled=new Set(state.calendar?.blocks.map(b=>b.taskId)||[]);
    const signature=JSON.stringify([today,calendar?.connected,state.tasks,state.priorities,[...scheduled],state.ledger.filter(e=>e.type==='task'),taskFilter,search,taskLimit,[...pendingCompletion]]);if(signature===tasksSignature)return;tasksSignature=signature;
    const list=$('task-list'),active=document.activeElement;
    const focused=list.contains(active),focusKey=focused?active.dataset.focus:null;
    const previousRows=[...list.querySelectorAll('[data-task]')];
    const previousIndex=focused?previousRows.indexOf(active.closest('[data-task]')):-1;
    const expanded=new Set([...list.querySelectorAll('.task-actions[open]')].map(menu=>menu.closest('[data-task]').dataset.task));
    const tasks=state.tasks||[];const open=tasks.filter(t=>!t.done&&!t.archived);
    $('open-count').textContent=open.length;
    $('task-summary').textContent=taskFilter==='inbox'?'Unscheduled tasks':taskFilter==='done'?'Completed tasks':taskFilter==='archived'?'Archived tasks':'';
    document.querySelectorAll('[data-task-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.taskFilter===taskFilter)));
    const selected=tasks.filter(t=>(taskFilter==='archived'?t.archived:!t.archived&&(taskFilter==='done'?t.done:!t.done))&&
      (taskFilter!=='inbox'||!scheduled.has(t.id))&&`${t.title} ${t.project||''}`.toLowerCase().includes(search)).sort((a,b)=>taskFilter==='done'?(b.completedAt||0)-(a.completedAt||0):
      Number(state.priorities.includes(b.id))-Number(state.priorities.includes(a.id))||Number(b.priority==='high')-Number(a.priority==='high')||(taskDay(a)||'9999').localeCompare(taskDay(b)||'9999')||b.createdAt-a.createdAt);
    $('clear-task-search').hidden=!search;
    const visible=selected.slice(0,taskLimit);
    list.innerHTML=visible.map(t=>{
      const saving=pendingCompletion.has(t.id),shownDone=pendingCompletion.get(t.id)??t.done;
      const receipt=state.ledger.find(entry=>entry.id==='task:'+t.id),reward=receipt?.amount??PurrpleCore.EFFORT[t.effort];
      const earned=!!receipt,subtasks=t.subtasks||[],due=taskDay(t),late=!t.done&&due&&due<today;
      const priority=state.priorities.includes(t.id),actionButton=(action,label,extra='')=>`<button class="text-button" type="button" data-action="${action}" data-id="${esc(t.id)}" ${extra}>${label}</button>`;
      const details=[t.priority==='high'?'<span class="important">Important</span>':'',due?`<span class="${late?'overdue':''}">${late?'Overdue · ':''}${esc(t.dueDate?dayLabel(due):date(t.dueAt))}</span>`:'',
        t.project?`<span>${esc(t.project)}</span>`:'',t.estimate?`<span>${t.estimate} min</span>`:'',t.recurrence!=='none'?`<span>Repeats ${esc(t.recurrence)}</span>`:'',
        `<span class="reward">${earned?coins(reward)+' earned':'+'+coins(reward)}</span>`].join('');
      const actions=t.archived?'':(t.done?'':actionButton('priority',priority?'Unpin':'Prioritize',`aria-pressed="${priority}"`)+
        actionButton('schedule-task','Schedule…')+(late?actionButton('return-inbox','Return to inbox'):'')+actionButton('focus-on-task','Focus'))+
        actionButton('edit-task','Edit')+(calendar?.connected?actionButton('calendar-task','Send to Google'):'');
      return `<article class="task-card ${t.done?'is-done':''}" data-task="${esc(t.id)}"><div class="task-main"><button type="button" class="task-check ${shownDone?'done':''}" data-action="toggle-task" data-id="${esc(t.id)}" data-focus="toggle-${esc(t.id)}" aria-label="${shownDone?'Reopen':'Complete'} ${esc(t.title)}" aria-pressed="${shownDone}" ${saving?'aria-disabled="true" aria-busy="true"':''} ${t.archived?'disabled':''}>${shownDone?'✓':''}</button><div class="task-body"><div class="task-title">${esc(t.title)}</div><div class="task-meta">${details}</div><details class="task-actions" ${expanded.has(t.id)?'open':''}><summary aria-label="Actions for ${esc(t.title)}" data-focus="actions-${esc(t.id)}">Actions</summary><div class="task-menu">${actions}${actionButton('archive-task',t.archived?'Restore':'Archive',`data-archived="${!t.archived}"`)}</div></details></div></div>${subtasks.length?`<div class="task-subtasks">${subtasks.map(step=>`<label class="subtask"><input type="checkbox" ${step.done?'checked':''} data-subtask="${esc(step.id)}" data-task-id="${esc(t.id)}" aria-label="${esc(step.title)}"><span>${esc(step.title)}</span></label>`).join('')}</div>`:''}</article>`;
    }).join('');
    if(!visible.length)list.innerHTML=`<div class="empty-state"><strong>${search?'No matching tasks.':taskFilter==='open'?'No open tasks.':taskFilter==='done'?'No completed tasks.':'No archived tasks.'}</strong><p>${search?'Try another word or clear your search.':taskFilter==='open'?'Add your first task above.':''}</p></div>`;
    $('load-more').hidden=selected.length<=taskLimit;
    if(focused&&!active.isConnected){
      const same=focusKey?list.querySelector(`[data-focus="${CSS.escape(focusKey)}"]`):active.dataset.action&&active.dataset.id?
        list.querySelector(`[data-action="${CSS.escape(active.dataset.action)}"][data-id="${CSS.escape(active.dataset.id)}"]`):null;
      const checks=list.querySelectorAll('.task-check:not(:disabled)');
      (same&&!same.matches(':disabled')?same:checks[Math.min(previousIndex,checks.length-1)]||$('quick-title')).focus({preventScroll:true});
    }
  }
  function renderFocus(){
    const focus=state.focus,active=focus&&['running','paused'].includes(focus.status);
    const latest=state.focusHistory.at(-1);
    const finished=!active&&!!latest&&latest.id!==state.wrapSeen;
    const phase=active?(focus.status==='paused'?'paused':focus.kind):finished?'finished':'idle';
    const nextPose=phase==='focus'?'study':phase==='finished'||phase==='break'?'sleep':'idle';
    if(nextPose!==focusPose){focusPose=nextPose;focusPoseStarted=performance.now();}
    $('view-focus').dataset.session=phase;
    $('focus-form').hidden=!!active;$('active-timer-actions').hidden=!active;
    $('timer-kind').textContent={focus:'Focusing',paused:'Paused',break:'Break',finished:'Session complete',idle:'Ready'}[phase];
    $('timer-display').textContent=active?formatTime(remaining()):finished?'00:00':formatTime(Number($('focus-minutes').value)*60000);
    $('timer-caption').textContent=active?state.tasks.find(task=>task.id===focus.taskId)?.title||'':'';
    $('timer-caption').hidden=!$('timer-caption').textContent;
    $('focus-canvas').setAttribute('aria-label',{focus:'Purrple reads by the lit desk lamp',paused:'Purrple waits at the desk with the lamp dimmed',break:'Purrple rests on the desk',finished:'Purrple curls up after the session',idle:'Purrple waits at a desk by the window'}[phase]);
    $('focus-pause').textContent=focus?.status==='paused'?'Resume':'Pause';
    $('active-intention').textContent=focus?.intention||'';
    $('parking-form').hidden=focus?.kind!=='focus';
    $('parked-count').textContent=focus?.notes?.length?`${focus.notes.length} parked for wrap-up`:'';
    document.querySelectorAll('[data-break]').forEach(b=>{b.disabled=!!active;b.title=active?'End the current session before starting a break.':'';});
    document.querySelector('.break-actions>.muted').textContent=active?'End this session to take a break.':'Time for a breather?';
    const select=$('focus-task'),selected=select.value;
    select.innerHTML='<option value="">Just a quiet session</option>'+(state.tasks||[]).filter(t=>!t.done&&!t.archived).map(t=>`<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('');
    if([...select.options].some(o=>o.value===selected))select.value=selected;
    const history=(state.focusHistory||[]).slice().reverse().slice(0,12);
    $('focus-total').textContent=`${Math.round(state.stats?.focusMinutes||0)} min of focus`;
    renderWrap(history[0]);
    $('focus-history').innerHTML=history.length?history.map(s=>`<div class="history-item"><span><strong>${Math.round((s.durationMs||s.minutes*60000||0)/60000)} minutes</strong> ${s.kind==='break'?'of rest':'of focus'}</span><span class="muted">${esc(date(s.completedAt||s.endedAt||s.startedAt||Date.now()))}</span></div>`).join(''):'<div class="empty-state"><strong>A fresh notebook.</strong><p>Your completed sessions will appear here.</p></div>';
  }
  function renderWrap(session){
    const root=$('focus-wrap'),task=state.tasks.find(row=>row.id===session?.taskId);
    const latest=!!session&&session.id!==state.wrapSeen;
    root.hidden=!latest;
    const signature=JSON.stringify([latest,session,task?.done,task?.archived,Boolean(state.focus)]);
    if(signature===wrapSignature)return;wrapSignature=signature;
    if(!latest){root.replaceChildren();return;}
    const button=(action,label,extra='')=>`<button class="button subtle" type="button" data-action="${action}" data-id="${esc(session.id)}" ${extra}>${label}</button>`;
    root.innerHTML=`<h2>${session.kind==='break'?'Break complete':'Focus complete'}</h2><p>${Math.round(session.durationMs/60000)} min${session.kind==='focus'?` · ${coins(session.coins??0)} earned`:''}</p>
      ${session.notes?.length?`<h3>Parked thoughts</h3><ul>${session.notes.map(note=>`<li><span>${esc(note.text)}</span>${note.captured?' <span class="muted">Added to inbox</span>':button('capture-note','Make task',`data-note="${esc(note.id)}"`)}</li>`).join('')}</ul>`:''}
      <div class="wrap-actions">${task&&!task.done&&!task.archived?button('wrap-task','Mark task done',`data-task="${esc(task.id)}"`):''}${button('wrap-dismiss','Continue later')}${session.kind==='focus'&&!state.focus?button('wrap-break','Start 5-minute break'):''}</div>`;
  }
  function renderShop(){
    const signature=JSON.stringify([state.owned,state.equipped,state.wallet.balance,shopFilter,shopQuery,preview]);if(signature===shopSignature)return;shopSignature=signature;
    const active=document.activeElement;
    const activeAction=active?.dataset?.action,activeId=active?.dataset?.id;
    const all=catalog(),list=all.filter(c=>(shopFilter==='all'||shopFilter==='owned'&&owned(c.id)||c.slot===shopFilter)&&`${c.name} ${c.description}`.toLowerCase().includes(shopQuery));$('clear-shop-search').hidden=!shopQuery;
    document.querySelectorAll('[data-shop-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shopFilter===shopFilter)));
    $('shop-count').textContent=`${list.length} item${list.length===1?'':'s'}`;
    $('shop-grid').innerHTML=list.map(c=>{
      const yours=owned(c.id),worn=state.equipped?.[c.slot]===c.id,afford=state.wallet.balance>=c.price;
      return `<article class="shop-card ${preview===c.id?'selected':''}"><img class="shop-thumb" src="assets/wardrobe/thumbs/${encodeURIComponent(c.id)}.png" alt="Purrple wearing ${esc(c.name)}" loading="lazy"><div class="shop-info"><h3>${esc(c.name)}</h3><p class="shop-description">${esc(c.description||'A little something for Purrple.')}</p><span class="shop-state ${worn?'equipped':''}">${worn?'Equipped':yours?'Owned · not equipped':preview===c.id?'Trying on · not owned':'Not owned'}</span><span class="shop-price">${yours?'Yours forever':`✧ ${c.price} coins`}</span><div class="shop-actions"><button class="button subtle" type="button" data-action="preview-item" data-id="${esc(c.id)}">Try on</button>${yours?`<button class="button primary" type="button" data-action="equip-item" data-id="${esc(c.id)}" ${worn?'disabled':''}>${worn?'Wearing':'Wear'}</button>`:`<button class="button primary" type="button" data-action="buy-item" data-id="${esc(c.id)}" ${!afford?'disabled':''} title="${afford?'Buy permanently':`Save ${c.price-state.wallet.balance} more coins`}">Buy</button>`}</div>${!yours&&c.price>state.wallet.balance?`<p class="shop-needed">Need ${c.price-state.wallet.balance} more coins</p>`:''}</div></article>`;
    }).join('')||'<div class="empty-state shop-empty"><strong>A little space for your favorites.</strong><p>Complete tasks to earn coins, then choose something to keep.</p></div>';
    $('outfit-slots').innerHTML=PurrpleCore.SLOTS.map(slot=>`<div><span>${slot[0].toUpperCase()+slot.slice(1)}</span><strong>${esc(item(state.equipped?.[slot])?.name||'Empty')}</strong><button type="button" class="text-button" data-remove-slot="${slot}" aria-label="Remove ${slot} accessory">Remove</button></div>`).join('');
    $('preview-name').textContent=preview?'Trying on: '+(item(preview)?.name||'A little preview'):'Wearing now';
    $('preview-copy').textContent=preview?(owned(preview)?'Choose Wear to save this outfit.':'Buy this piece to add it to your wardrobe.'):'';
    $('preview-tag').hidden=!preview;
    document.querySelectorAll('[data-remove-slot]').forEach(b=>b.disabled=!state.equipped?.[b.dataset.removeSlot]);
    document.querySelectorAll('.shop-thumb').forEach(img=>img.onerror=()=>{img.onerror=null;img.style.visibility='hidden';img.closest('.shop-card').classList.add('thumb-unavailable');});
    if(activeAction&&activeId&&active&&!active.isConnected)document.querySelector(`[data-action="${CSS.escape(activeAction)}"][data-id="${CSS.escape(activeId)}"]`)?.focus({preventScroll:true});
  }
  function renderSettings(){
    const s=state.settings||{},key=JSON.stringify(s);if(key===lastSettings)return;lastSettings=key;
    $('setting-name').value=s.name||'';$('setting-pet').checked=s.petEnabled!==false;$('setting-size').value=s.size||128;$('setting-size-label').value=`${s.size||128} px`;
    $('setting-fps').value=String(s.fps||30);$('setting-motion').checked=!!s.reducedMotion;$('setting-chat').value=s.chattiness||'balanced';$('setting-site-remarks').checked=!!s.siteRemarks;$('setting-notifications').checked=!!s.notifications;$('setting-sound').checked=!!s.sound;
    $('setting-quiet').checked=!!s.quietHours?.enabled;$('quiet-start').value=s.quietHours?.start||'22:00';$('quiet-end').value=s.quietHours?.end||'07:00';$('hidden-hosts').value=(s.hiddenHosts||[]).join('\n');
  }
  function renderPopup(){
    $('popup-content').hidden=false;const tasks=(state.tasks||[]).filter(t=>!t.done&&!t.archived).sort((a,b)=>(a.dueAt||Infinity)-(b.dueAt||Infinity));
    $('popup-greeting').textContent=state.settings?.name?`Hi, ${state.settings.name}.`:'A little company.';
    $('popup-summary').textContent=tasks.length?`${tasks.length} little plan${tasks.length===1?'':'s'} waiting for you.`:'A quiet moment. Your list is clear.';
    $('popup-tasks').innerHTML=tasks.slice(0,3).map(t=>{
      const saving=pendingCompletion.has(t.id),shownDone=pendingCompletion.get(t.id)??false;
      return `<div class="popup-task"><button class="task-check ${shownDone?'done':''}" type="button" data-action="toggle-task" data-id="${esc(t.id)}" aria-label="Complete ${esc(t.title)}" aria-pressed="${shownDone}" ${saving?'aria-disabled="true" aria-busy="true"':''}>${shownDone?'✓':''}</button><span>${esc(t.title)}</span></div>`;
    }).join('');
    $('popup-pet').checked=state.settings?.petEnabled!==false;
    document.querySelector('.coin-pill').setAttribute('aria-label',`${state.wallet?.balance||0} coins`);
    $('popup-focus').hidden=!state.focus;
    if(state.focus)$('popup-focus').textContent=`${state.focus.kind==='break'?'Break':'Study session'} · ${formatTime(remaining())}${state.focus.status==='paused'?' · paused':''}`;
  }
  let taskEditorOpener=null;
  function openTask(id){
    taskEditorOpener=document.activeElement;
    const t=(state.tasks||[]).find(t=>t.id===id);$('task-id').value=id||'';$('task-dialog-title').textContent=t?'Edit task':'Add task';
    $('task-title').value=t?.title||'';$('task-effort').value=t?.effort||'small';$('task-priority').value=t?.priority||'normal';$('task-recurrence').value=t?.recurrence||'none';
    $('task-subtasks').value=(t?.subtasks||[]).map(s=>s.title).join('\n');
    $('task-due').value=t?taskDay(t)||'':'';
    $('task-project').value=t?.project||'';$('task-estimate').value=t?.estimate??'';
    $('task-error').hidden=true;$('task-title').removeAttribute('aria-invalid');$('task-dialog').showModal();$('task-title').focus();
  }
  function animate(now){
    const interval=1000/(state?.settings?.fps||30);
    if(rendererReady&&state&&!document.hidden&&now-lastPaint>=interval){
      lastPaint=now-((now-lastPaint)%interval);const motion=!state.settings.reducedMotion&&!reduced.matches;
      let clip=pose,time=motion?(now-poseStarted)/1000:0;
      if(!['idle','sleep','study','read','heart'].includes(pose)&&time>3.4){setPose('idle');clip='idle';time=0;}
      const canvases=popup?[$('popup-canvas')]:[$('companion-canvas'),$('focus-canvas'),$('wardrobe-canvas')];
      for(const canvas of canvases){if(!canvas||canvas.closest('[hidden]'))continue;const ctx=canvas.getContext('2d');
        const wardrobe=canvas.id==='wardrobe-canvas';const focus=canvas.id==='focus-canvas';let chosen=clip;
        if(wardrobe&&preview)chosen=PurrpleRenderer.itemFit?.(preview)?.previewPose||clip;
        if(focus)chosen=focusPose;
        const y=canvas.height-22;
        const size=PurrpleRenderer.surfaceSize(canvas,state.settings.size,y,{miniature:popup});
        if(!size)continue;
        const options={clip:chosen,time:focus&&motion?(now-focusPoseStarted)/1000:time,size,x:canvas.width/2,y,equipped:wardrobe?equipped():state.equipped,motion,rootMotion:false};
        try{
          if(!PurrpleRenderer.isDrawReady(options))continue;
          ctx.clearRect(0,0,canvas.width,canvas.height);
          PurrpleRenderer.draw(ctx,options);
        }catch(error){
          if(!artErrorShown){artErrorShown=true;rendererReady=false;$('load-error').textContent='Purrple’s artwork could not be displayed. Your saved tasks are safe. Try reopening this page.';$('load-error').hidden=false;}
        }
      }
    }
    requestAnimationFrame(animate);
  }
  document.addEventListener('click',async event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.view){
      const update=()=>showView(b.dataset.view);
      if(state&&b.getAttribute('aria-current')!=='page'&&globalThis.PurrpleViewTransitions)PurrpleViewTransitions.run(update,state.settings.reducedMotion);
      else update();
      return;
    }
    if(b.dataset.go){showView(b.dataset.go);return;}
    if(b.dataset.preset){
      const minutes=Number(b.dataset.preset);$('focus-minutes').value=minutes;$('timer-display').textContent=formatTime(minutes*60000);
      await dispatch({type:'SETTINGS',patch:{focusPreset:minutes}}).catch(()=>{});return;
    }
    if(b.dataset.template){
      const box=$('task-subtasks');const steps=b.dataset.template==='study'?['Open the reading or assignment','Work through one section','Write down one question']:['Name the next deliverable','Gather the files or information','Write the first rough draft'];
      box.value=[box.value.trim(),...steps].filter(Boolean).join('\n');box.focus();return;
    }
    if(b.dataset.pet){setPose(b.dataset.pet);const lines={pat:'Prrr. Excellent forehead technique.',brush:'A very tidy little kitten, coming up.',toy:'Tiny hunter. Enormous confidence.',sleep:'I’ll handle looking sleepy.'};$('cat-line').textContent=lines[b.dataset.pet];return;}
    if(b.dataset.taskFilter){taskFilter=b.dataset.taskFilter;taskLimit=25;renderTasks();return;}
    if(b.dataset.shopFilter){shopFilter=b.dataset.shopFilter;renderShop();return;}
    if(b.dataset.break){try{await dispatch({type:'BREAK_START',minutes:Number(b.dataset.break)},'A little rest starts now.');setPose('sleep');}catch{}return;}
    if(b.dataset.removeSlot){try{await dispatch({type:'EQUIP',slot:b.dataset.removeSlot,id:null},'Outfit saved.');preview=null;renderShop();}catch{}return;}
    const id=b.dataset.id,action=b.dataset.action;if(!action)return;
    if(action==='suggestion-focus'){
      if(!state.focus){
        b.disabled=true;
        try{await dispatch({type:'FOCUS_START',minutes:state.settings.focusPreset,taskId:id});}
        catch{if(b.isConnected)b.disabled=false;return;}
      }
      showView('focus');
      $('focus-pause').focus({preventScroll:true});
      return;
    }
    if(action==='schedule-task'){planner?.scheduleTask(id,b);return;}
    if(action==='focus-on-task'){showView('focus');$('focus-task').value=id;return;}
    if(action==='priority'){await dispatch({type:'TASK_PLAN_PRIORITY',id,enabled:b.getAttribute('aria-pressed')!=='true'}).catch(()=>{});return;}
    if(action==='return-inbox'){
      const task=state.tasks.find(task=>task.id===id);
      if(task)try{await dispatch({type:'TASK_UPDATE',id,patch:{dueAt:null,dueDate:null}},'Deadline cleared.');taskFilter='inbox';renderTasks();}catch{}
      return;
    }
    if(action==='wrap-dismiss'||action==='wrap-break'||action==='wrap-task'||action==='capture-note'){
      b.disabled=true;
      try{
        if(action==='capture-note')await dispatch({type:'FOCUS_NOTE_TASK',id,noteId:b.dataset.note},'Thought added to your inbox.');
        else if(action==='wrap-task'){
          const linked=b.dataset.task,next=await dispatch({type:'TASK_SET_DONE',id:linked,done:true});
          completionNotice(next,linked,true);
        }else if(action==='wrap-break'){
          await dispatch({type:'BREAK_START',minutes:5});await dispatch({type:'FOCUS_WRAP_DISMISS',id});
        }else await dispatch({type:'FOCUS_WRAP_DISMISS',id});
      }catch{}finally{if(b.isConnected)b.disabled=false;}
      return;
    }
    if(action==='calendar-task'){
      const task=state.tasks.find(task=>task.id===id);
      if(task)calendar.openDraft(task.title,task.dueAt,30);
      return;
    }
    if(action==='toggle-task'){
      const task=state.tasks.find(t=>t.id===id);
      if(!task||task.archived||pendingCompletion.has(id))return;
      const done=!task.done,paint=popup?renderPopup:renderTasks;
      pendingCompletion.set(id,done);
      paint();
      try{
        const next=await dispatch({type:'TASK_SET_DONE',id,done});
        completionNotice(next,id,done);
      }catch{}finally{pendingCompletion.delete(id);paint();}
      return;
    }
    if(!['edit-task','preview-item'].includes(action))b.disabled=true;
    try{
      if(action==='edit-task')openTask(id);
      if(action==='archive-task'){
        const archived=b.dataset.archived==='true',priorityIndex=state.priorities.indexOf(id);
        const next=await dispatch({type:'TASK_ARCHIVE',id,archived}),saved=next.tasks.find(task=>task.id===id);
        notify(archived?'Task archived.':'Task restored.',false,async()=>{
          const restored=await dispatch({type:'TASK_ARCHIVE',id,archived:!archived,expectedUpdatedAt:saved.updatedAt,restorePriorityIndex:priorityIndex});
          notify(archived&&priorityIndex>=0&&!restored.priorities.includes(id)?'Task restored. Today’s priorities are full.':'Archive change undone.');
          if(view==='today'&&[document.body,$('quick-title')].includes(document.activeElement)){
            $('task-list').querySelector(`[data-focus="toggle-${CSS.escape(id)}"]`)?.focus({preventScroll:true});
          }
        });
      }
      if(action==='preview-item'){preview=id;setPose('idle');renderShop();}
      if(action==='buy-item'){await dispatch({type:'SHOP_BUY',id},`${item(id)?.name||'Your little favorite'} is yours forever.`);preview=id;renderShop();}
      if(action==='equip-item'){preview=null;await dispatch({type:'EQUIP',slot:item(id).slot,id},'Purrple’s outfit is saved.');}
    }catch{}finally{if(b.isConnected)b.disabled=false;}
  });
  document.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.isComposing||event.keyCode===229)&&event.target.closest('form'))event.preventDefault();});
  document.addEventListener('change',async event=>{const el=event.target;if(el.dataset.subtask)try{await dispatch({type:'TASK_SUBTASK',id:el.dataset.taskId,subtaskId:el.dataset.subtask,done:el.checked});}catch{el.checked=!el.checked;}});
  function listen(id,type,fn){$(id)?.addEventListener(type,fn);}
  listen('quick-form','submit',async e=>{e.preventDefault();if(e.isComposing||!state||e.currentTarget.dataset.busy)return;const title=$('quick-title').value.trim();if(!title){$('quick-error').textContent='Give this little task a name.';$('quick-error').hidden=false;$('quick-title').focus();return;}$('quick-error').hidden=true;
    const form=e.currentTarget;form.dataset.busy='1';$('quick-title').disabled=true;$('quick-effort').disabled=true;form.querySelector('button').disabled=true;
    try{await dispatch({type:'TASK_ADD',title,effort:$('quick-effort').value,priority:'normal',recurrence:'none',dueAt:null,subtasks:[],fromDraft:true},'Task added.');$('quick-title').value='';}catch{}
    finally{delete form.dataset.busy;$('quick-title').disabled=false;$('quick-effort').disabled=false;form.querySelector('button').disabled=false;$('quick-title').focus();}});
  listen('new-task','click',()=>openTask());listen('close-task','click',()=>$('task-dialog').close());listen('cancel-task','click',()=>$('task-dialog').close());
  listen('task-dialog','close',()=>{
    const previous=taskEditorOpener;
    taskEditorOpener=null;
    if(previous?.isConnected&&!previous.closest('[hidden]')){previous.focus({preventScroll:true});return;}
    if(previous?.dataset.id){
      const task=CSS.escape(previous.dataset.id);
      const target=document.querySelector(`[data-task="${task}"] .task-actions > summary`);
      if(target&&!target.closest('[hidden]')){target.focus({preventScroll:true});return;}
    }
    if(view==='calendar')$('planner-add').focus({preventScroll:true});
    if(view==='today')$('quick-title').focus({preventScroll:true});
  });
  listen('task-form','submit',async e=>{e.preventDefault();if(e.isComposing||e.currentTarget.dataset.busy)return;const title=$('task-title').value.trim();if(!title){$('task-error').textContent='Give this task a name.';$('task-error').hidden=false;$('task-title').setAttribute('aria-invalid','true');$('task-title').focus();return;}
    const id=$('task-id').value,old=state.tasks.find(t=>t.id===id);const lines=$('task-subtasks').value.split('\n').map(x=>x.trim()).filter(Boolean);
    const available=(old?.subtasks||[]).slice();
    const dueDate=$('task-due').value||null,legacyDue=old?.dueAt&&dueDate===taskDay(old)&&!old.dueDate;
    const details={title,effort:$('task-effort').value,priority:$('task-priority').value,recurrence:$('task-recurrence').value,dueAt:legacyDue?old.dueAt:null,dueDate:legacyDue?null:dueDate,project:$('task-project').value.trim(),estimate:$('task-estimate').value?Number($('task-estimate').value):null,subtasks:id?lines.map(title=>{const index=available.findIndex(s=>s.title===title);return index>=0?available.splice(index,1)[0]:{title,done:false};}):lines};
    e.currentTarget.dataset.busy='1';$('save-task').disabled=true;try{await dispatch(id?{type:'TASK_UPDATE',id,patch:details}:{type:'TASK_ADD',...details},'Task saved.');$('task-dialog').close();}catch(error){$('task-error').textContent=error.message;$('task-error').hidden=false;}finally{delete $('task-form').dataset.busy;$('save-task').disabled=false;}});
  listen('task-search','input',e=>{if(e.isComposing)return;search=e.target.value.trim().toLowerCase();taskLimit=25;renderTasks();});listen('task-search','compositionend',e=>{search=e.target.value.trim().toLowerCase();renderTasks();});
  listen('clear-task-search','click',()=>{$('task-search').value='';search='';renderTasks();$('task-search').focus();});listen('load-more','click',()=>{taskLimit+=25;renderTasks();});
  listen('focus-form','submit',async e=>{e.preventDefault();if(e.isComposing)return;try{await dispatch({type:'FOCUS_START',minutes:Number($('focus-minutes').value),taskId:$('focus-task').value||null,intention:$('focus-intention').value},'Notebook open. Let’s begin.');setPose('study');}catch{}});
  listen('focus-minutes','input',()=>{if(!state?.focus)$('timer-display').textContent=formatTime(Number($('focus-minutes').value)*60000);});
  listen('parking-form','submit',async event=>{
    event.preventDefault();const field=$('parked-note'),value=field.value.trim();if(!value)return;
    const button=event.currentTarget.querySelector('button');if(button.disabled)return;button.disabled=true;
    try{await dispatch({type:'FOCUS_PARK',sessionId:state.focus?.id,text:value});field.value='';field.focus();}catch{}finally{button.disabled=false;}
  });
  listen('intro-dismiss','click',()=>dispatch({type:'SETTINGS',patch:{welcomeDismissed:true}}).catch(()=>{}));
  listen('intro-reopen','click',async()=>{await dispatch({type:'SETTINGS',patch:{welcomeDismissed:false}}).catch(()=>{});showView('today');$('dashboard-pet').focus();});
  document.addEventListener('click',()=>{
    if(!state?.settings.sound||!globalThis.AudioContext)return;
    audio??=new AudioContext();if(audio.state==='suspended')audio.resume().catch(()=>{});
  },{passive:true});
  listen('focus-pause','click',async()=>{try{await dispatch({type:state.focus?.status==='paused'?'FOCUS_RESUME':'FOCUS_PAUSE',sessionId:state.focus?.id},state.focus?.status==='paused'?'Back to it, gently.':'Take your time.');}catch{}});
  listen('focus-cancel','click',async()=>{try{await dispatch({type:'FOCUS_CANCEL',sessionId:state.focus?.id},'Session ended. You can start fresh whenever you like.');setPose('idle');}catch{}});
  listen('reset-preview','click',()=>{preview=null;renderShop();});
  listen('setting-size','input',e=>$('setting-size-label').value=`${e.target.value} px`);
  listen('settings-form','submit',async e=>{e.preventDefault();const patch={name:$('setting-name').value.trim(),petEnabled:$('setting-pet').checked,size:Number($('setting-size').value),fps:Number($('setting-fps').value),reducedMotion:$('setting-motion').checked,chattiness:$('setting-chat').value,siteRemarks:$('setting-site-remarks').checked,notifications:$('setting-notifications').checked,sound:$('setting-sound').checked,quietHours:{enabled:$('setting-quiet').checked,start:$('quiet-start').value,end:$('quiet-end').value},hiddenHosts:$('hidden-hosts').value.split('\n').map(s=>s.trim()).filter(Boolean)};try{await dispatch({type:'SETTINGS',patch},'Made comfortable. Preferences saved.');$('settings-save-note').textContent='Saved';}catch{}});
  async function downloadBackup(){
    try{
      const backup=await client.exportBackup(),blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),a=document.createElement('a');
      a.href=URL.createObjectURL(blob);a.download=`Purrple_Backup_${PurrpleCore.localDate(Date.now())}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);notify('Backup downloaded.');
    }catch(error){notify(error.message,true);}
  }
  listen('backup-export','click',downloadBackup);
  listen('confirm-download','click',downloadBackup);
  listen('backup-import','click',()=>$('backup-file').click());
  let pendingBackup=null;
  listen('backup-file','change',async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;pendingBackup=null;
    try{
      if(file.size>50*1024*1024)throw Error('Choose a backup smaller than 50 MB.');
      const data=JSON.parse(await file.text()),summary=await client.previewBackup(data);pendingBackup=data;
      $('confirm-copy').textContent=`Restore “${file.name}”? It contains ${summary.tasks} tasks, ${summary.blocks} calendar blocks, ${summary.sessions} sessions, and ${coins(summary.coins)}. Restoring replaces your current save. You can download a backup of this browser first.`;
      $('confirm-dialog').showModal();$('confirm-cancel').focus();
    }catch(error){notify(error.message||'This file is not a valid Purrple backup.',true);}
  });
  listen('confirm-dialog','close',()=>{pendingBackup=null;});
  listen('confirm-cancel','click',()=>{pendingBackup=null;$('confirm-dialog').close();});listen('confirm-ok','click',async()=>{if(!pendingBackup)return;try{await dispatch({type:'BACKUP_IMPORT',backup:pendingBackup},'Your little world is restored.');pendingBackup=null;preview=null;$('confirm-dialog').close();}catch{}});
  listen('open-app','click',()=>client.openApp().catch(e=>notify(e.message,true)));listen('open-sidebar','click',()=>client.openSidebar().catch(e=>notify(e.message,true)));listen('popup-pet','change',async e=>{try{await dispatch({type:'SETTINGS',patch:{petEnabled:e.target.checked}});}catch{e.target.checked=!e.target.checked;}});
  async function permissions(){if(popup||!client.native)return;const row=document.createElement('div');row.className='permission-row';const p=document.createElement('p');p.textContent='Allow website access so Purrple can roam beside you. Your tasks and sidebar also work without it.';const b=document.createElement('button');b.type='button';b.className='button subtle';b.textContent='Allow Purrple on websites';b.onclick=async()=>{try{const granted=await client.requestWebsitePermission();if(granted){row.remove();notify('Purrple can now join you on supported websites.');}else notify('Website access stays off. Your sidebar still works.');}catch(error){notify(error.message,true);}};row.append(p,b);try{if(!await client.websitePermission())$('setting-pet').closest('.switch-row').after(row);}catch{}}
  const talkUI=globalThis.PurrpleTalkUI?.mount($('talk-root'),{getState:()=>state,dispatch,onReply:last=>setPose(last.reaction)});
  listen('shop-search','input',e=>{if(e.isComposing)return;shopQuery=e.target.value.trim().toLowerCase();renderShop();});
  listen('shop-search','compositionend',e=>{shopQuery=e.target.value.trim().toLowerCase();renderShop();});
  listen('clear-shop-search','click',()=>{shopQuery='';$('shop-search').value='';renderShop();$('shop-search').focus();});
  const saveHomeDraft=()=>{if($('quick-form').dataset.busy)return;const text=$('quick-title').value,effort=$('quick-effort').value;if(!homeDraftWrites&&text===(state?.drafts?.quickTask||'')&&effort===(state?.drafts?.quickEffort||'small'))return;homeDraftWrites++;client.saveQuickDraft(text,effort).then(receive).catch(error=>notify(error.message||'Your draft could not be saved. Please keep this page open.',true)).finally(()=>homeDraftWrites--);};
  listen('quick-title','input',e=>{if(!e.isComposing)saveHomeDraft();});listen('quick-title','compositionend',saveHomeDraft);listen('quick-effort','change',saveHomeDraft);
  const planner=globalThis.PurrplePlanner?.mount({root:$('view-calendar'),todayRoot:$('local-today'),state:()=>state,dispatch,notify,showView,editTask:openTask,refreshProvider:()=>calendar?.refresh()});
  const calendar=globalThis.PurrpleCalendarUI?.mount({onChange:()=>{if(state)renderTasks();},onEvents:snapshot=>planner?.setProvider(snapshot)});
  const companion=globalThis.PurrpleCompanion?.mount({root:$('companion-content'),state:()=>state,dispatch,notify,showView});
  const playWindow=globalThis.PurrpleCompanion?.mount({root:$('play-dialog-content'),state:()=>state,dispatch,notify,showView,idPrefix:'play',gameOnly:true});
  let playOpener=null;
  listen('suggest-task','click',()=>{suggestionOpen=!suggestionOpen;renderSuggestion();});
  listen('close-play','click',()=>$('play-dialog').close());
  listen('play-dialog','close',()=>{
    if($('play-dialog').open)return;
    $('main').before($('toast'));
    if(location.hash.startsWith('#companion-play'))history.replaceState(null,'','#'+view);
    if(playOpener?.isConnected&&!playOpener.closest('[hidden]'))playOpener.focus({preventScroll:true});
    else if(view==='companion'){
      const room=$('companion-content');
      const key=playOpener?.dataset.cpKey;
      const replacement=key?room.querySelector(`[data-cp-key="${CSS.escape(key)}"]`):null;
      const target=replacement||room.querySelector('[data-cp-key="room-play"],[data-cp-key="tab-play"]');
      (target||document.querySelector('[data-view="companion"]')).focus({preventScroll:true});
    }else if(view==='today')$('dashboard-pet').focus({preventScroll:true});
    playOpener=null;
  });
  const dashboardPet=globalThis.PurrplePetMenu?.mount({menu:$('dashboard-pet-menu'),speech:$('dashboard-pet-speech'),actor:$('dashboard-pet'),state:()=>state,
    companion:()=>({unlockedGames:PurrpleCompanionDomain.unlockedGames(state.companion),resumableGame:PurrpleCompanionDomain.resumableGame(state.companion)}),
    onReply:reaction=>setPose(reaction||'idle'),execute:async entry=>{
      if(entry.kind==='talk'){const next=await dispatch({type:'TALK_REPLY',promptId:entry.promptId});return next.talk.last;}
      if(entry.kind==='route'){showView(entry.id);return;}
      if(entry.kind==='care'){
        if(entry.id==='gift'){showView('companion-gifts');return;}
        setPose('pat');return {text:'Prrr. Excellent forehead technique.',reaction:'pat'};
      }
      if(entry.kind==='focus'){
        if(entry.mode==='view'||entry.mode==='custom'){showView('focus');return;}
        await dispatch(entry.mode==='resume'?{type:'FOCUS_RESUME',sessionId:state.focus?.id}:{type:'FOCUS_START',minutes:entry.minutes});
        return {text:'Notebook open. I’ll keep you company.',reaction:'study'};
      }
      if(entry.id==='reshow'){await client.petReshow();return {text:'I’ll be there.'};}
    }});
  listen('dashboard-pet','click',()=>dashboardPet?.toggle());
  listen('view-today','keydown',event=>{if(event.key==='Escape')dashboardPet?.escape(event);});
  listen('calendar-focus','click',()=>calendar?.openDraft('Purrple focus block',null,Number($('focus-minutes').value)));
  listen('reset-layout','click',async()=>{
    if(!client.native){notify('Open the extension to reset the companion layout.');return;}
    try{
      for(const part of ['dock','panel','pet'])await client.resetPosition(part);
      notify('Companion positions reset.');
    }catch(error){notify(error.message,true);}
  });
  addEventListener('hashchange',()=>showView(location.hash.slice(1)||'today'));
  client.subscribe(receive);
  client.get().then(next=>{receive(next);showView(location.hash.slice(1)||'today');}).then(permissions).catch(error=>{$('loading').hidden=true;$('load-error').textContent=error.message||'Purrple could not open her saved data. Try reopening this page.';$('load-error').hidden=false;});
  Promise.resolve(globalThis.PurrpleRenderer?.preload?.()).then(()=>rendererReady=!!globalThis.PurrpleRenderer).catch(()=>notify('Purrple’s artwork could not load. Try reopening this page.',true));
  setInterval(()=>{if(!state)return;if(popup){if(state.focus)$('popup-focus').textContent=`${state.focus.kind==='break'?'Break':'Study session'} · ${formatTime(remaining())}${state.focus.status==='paused'?' · paused':''}`;}else if(state.focus)$('timer-display').textContent=formatTime(remaining());if(state.focus?.status==='running'&&remaining()===0)client.get().then(receive).catch(()=>{});},500);
  requestAnimationFrame(animate);
  globalThis.PurrpleUI={getState:()=>state,showView,refresh:()=>client.get().then(receive)};
})();
