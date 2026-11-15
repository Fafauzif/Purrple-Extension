(() => {
  'use strict';
  const $=id=>document.getElementById(id),client=PurrpleClient;
  const popup=document.body.classList.contains('popup-body');
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state=null,view='today',taskFilter='open',shopFilter='all',search='',taskLimit=25,preview=null,lastSettings='',toastTimer=0;
  let pose='idle',poseStarted=performance.now(),rendererReady=false,lastPaint=0,artErrorShown=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const catalog=()=>PurrpleCore.CATALOG||[];
  const owned=id=>state?.owned?.includes(id);
  const item=id=>catalog().find(c=>c.id===id);
  const equipped=()=>({...state?.equipped,...(preview?{[item(preview)?.slot]:preview}:{})});
  const date=at=>new Intl.DateTimeFormat('en',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(at);
  function notify(text,error=false){const el=$('toast');if(!el)return;clearTimeout(toastTimer);el.textContent=text;el.classList.toggle('error',error);el.hidden=false;toastTimer=setTimeout(()=>el.hidden=true,4500);}
  function setPose(id){pose=id;poseStarted=performance.now();}
  function receive(next){state=next;render();}
  async function dispatch(action,message){
    try{const next=await client.action(action);receive(next);if(message)notify(message);return next;}
    catch(error){notify(error.message,true);throw error;}
  }
  function remaining(){const f=state?.focus;if(!f)return 0;return f.status==='running'?Math.max(0,(f.endsAt||Date.now())-Date.now()):Math.max(0,f.remainingMs||0);}
  function formatTime(ms){const seconds=Math.ceil(ms/1000);return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;}
  function showView(next){view=next;preview=null;document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==`view-${view}`);document.querySelectorAll('[data-view]').forEach(b=>{if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});setPose(next==='focus'?'study':'idle');render();}
  function render(){
    if(!state)return;
    const active=document.activeElement;
    const focusSpec=active?.dataset?.action&&active.dataset.id?{action:active.dataset.action,id:active.dataset.id}:active?.dataset?.shopFilter?{shopFilter:active.dataset.shopFilter}:active?.dataset?.taskFilter?{taskFilter:active.dataset.taskFilter}:null;
    $('loading').hidden=true;$('coin-balance').textContent=state.wallet?.balance??0;
    $('preview-label').hidden=client.native;
    if(popup){renderPopup();return;}
    $('main').hidden=false;
    $('today-date').textContent=new Intl.DateTimeFormat('en',{weekday:'long',month:'long',day:'numeric'}).format(Date.now());
    $('welcome-copy').textContent=state.settings?.name?`A small plan for today, ${state.settings.name}. Purrple is right here.`:'Make a small plan. Purrple will keep you company.';
    renderTasks();renderFocus();renderShop();renderSettings();
    const start=new Date();start.setHours(0,0,0,0);
    const today=(state.tasks||[]).filter(t=>t.done&&t.completedAt>=start.getTime()).length;
    $('today-done').textContent=`${today} little win${today===1?'':'s'} today`;
    if(active&&!active.isConnected&&focusSpec){
      const selector=focusSpec.action?`[data-action="${CSS.escape(focusSpec.action)}"][data-id="${CSS.escape(focusSpec.id)}"]`:focusSpec.shopFilter?`[data-shop-filter="${CSS.escape(focusSpec.shopFilter)}"]`:`[data-task-filter="${CSS.escape(focusSpec.taskFilter)}"]`;
      const replacement=document.querySelector(selector);(replacement&&!replacement.disabled?replacement:$('quick-title')).focus({preventScroll:true});
    }
  }
  function renderTasks(){
    const list=$('task-list'),focused=document.activeElement?.dataset.focus;
    const tasks=state.tasks||[];const open=tasks.filter(t=>!t.done&&!t.archived);
    $('open-count').textContent=open.length;
    $('task-summary').textContent=taskFilter==='open'?`${open.length} to do`:taskFilter==='done'?'Little wins, kept here.':'Saved out of the way.';
    document.querySelectorAll('[data-task-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.taskFilter===taskFilter)));
    const selected=tasks.filter(t=>(taskFilter==='archived'?t.archived:!t.archived&&(taskFilter==='done'?t.done:!t.done))&&t.title.toLowerCase().includes(search)).sort((a,b)=>taskFilter==='done'?(b.completedAt||0)-(a.completedAt||0):Number(b.priority==='high')-Number(a.priority==='high')||(a.dueAt||Infinity)-(b.dueAt||Infinity)||b.createdAt-a.createdAt);
    $('clear-task-search').hidden=!search;
    const visible=selected.slice(0,taskLimit);
    list.innerHTML=visible.map(t=>{
      const reward={small:10,medium:20,large:30}[t.effort]||20;
      const earned=(state.ledger||[]).some(entry=>entry.id==='task:'+t.id);
      const subtasks=t.subtasks||[];
      return `<article class="task-card ${t.done?'is-done':''}" data-task="${esc(t.id)}"><div class="task-main"><button type="button" class="task-check ${t.done?'done':''}" data-action="toggle-task" data-id="${esc(t.id)}" data-focus="toggle-${esc(t.id)}" aria-label="${t.done?'Reopen':'Complete'} ${esc(t.title)}" aria-pressed="${t.done}">${t.done?'✓':''}</button><div class="task-body"><div class="task-title">${esc(t.title)}</div><div class="task-meta">${t.priority==='high'?'<span class="important">Important</span>':''}${t.dueAt?`<span class="${!t.done&&t.dueAt<Date.now()?'overdue':''}">${!t.done&&t.dueAt<Date.now()?'Due ':''}${esc(date(t.dueAt))}</span>`:''}${t.recurrence!=='none'?`<span>↻ ${esc(t.recurrence)}</span>`:''}<span class="reward">${earned?`${reward} coins earned`:`+${reward} coins`}</span></div></div><div class="task-menu">${!t.archived?`<button class="text-button" type="button" data-action="edit-task" data-id="${esc(t.id)}" data-focus="edit-${esc(t.id)}">Edit</button>`:''}<button class="text-button" type="button" data-action="archive-task" data-id="${esc(t.id)}" data-archived="${!t.archived}">${t.archived?'Restore':'Archive'}</button></div></div>${subtasks.length?`<div class="task-subtasks">${subtasks.map(s=>`<label class="subtask"><input type="checkbox" ${s.done?'checked':''} data-subtask="${esc(s.id)}" data-task-id="${esc(t.id)}" aria-label="${esc(s.title)}"><span>${esc(s.title)}</span></label>`).join('')}</div>`:''}</article>`;
    }).join('');
    if(!visible.length)list.innerHTML=`<div class="empty-state"><span class="empty-symbol" aria-hidden="true">✧</span><strong>${search?'No little plans found.':taskFilter==='open'?'Room for a little plan.':taskFilter==='done'?'Your little wins will live here.':'Nothing tucked away yet.'}</strong><p>${search?'Try another word, or clear your search.':taskFilter==='open'?'Add an assignment, an errand, or just one small thing.':taskFilter==='done'?'Finish a task to earn coins for Purrple’s wardrobe.':'Archived tasks stay safe and can be restored.'}</p></div>`;
    $('load-more').hidden=selected.length<=taskLimit;
    if(focused)document.querySelector(`[data-focus="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
  }
  function renderFocus(){
    const focus=state.focus,active=focus&&['running','paused'].includes(focus.status);
    $('focus-form').hidden=!!active;$('active-timer-actions').hidden=!active;
    $('timer-kind').textContent=active?(focus.kind==='break'?'A little break':'Focus session'):'Focus session';
    $('timer-display').textContent=active?formatTime(remaining()):`${$('focus-minutes').value}:00`;
    $('timer-caption').textContent=active?(focus.status==='paused'?'Take your time. Resume when you’re ready.':focus.kind==='break'?'A stretch, a sip, a little rest.':'Purrple is working beside you.'):'Pick a little window of time.';
    $('focus-pause').textContent=focus?.status==='paused'?'Resume':'Pause';
    document.querySelectorAll('[data-break]').forEach(b=>{b.disabled=!!active;b.title=active?'End the current session before starting a break.':'';});
    document.querySelector('.break-actions>.muted').textContent=active?'End this session to take a break.':'Time for a breather?';
    const select=$('focus-task'),selected=select.value;
    select.innerHTML='<option value="">Just a quiet session</option>'+(state.tasks||[]).filter(t=>!t.done&&!t.archived).map(t=>`<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('');
    if([...select.options].some(o=>o.value===selected))select.value=selected;
    const history=(state.focusHistory||[]).slice().reverse().slice(0,12);
    $('focus-total').textContent=`${state.stats?.focusMinutes||0} minutes together`;
    $('focus-history').innerHTML=history.length?history.map(s=>`<div class="history-item"><span><strong>${Math.round((s.durationMs||s.minutes*60000||0)/60000)} minutes</strong> ${s.kind==='break'?'of rest':'of focus'}</span><span class="muted">${esc(date(s.completedAt||s.endedAt||s.startedAt||Date.now()))}</span></div>`).join(''):'<div class="empty-state"><strong>A fresh notebook.</strong><p>Your completed sessions will appear here.</p></div>';
    if(view==='focus'&&pose!=='sleep')$('focus-cat-line').textContent=active?(focus.kind==='break'?'A little breather. I’ll be right here.':focus.status==='paused'?'Paws off the notebook for a moment.':'Just you, me, and the next small step.'):'Notebook ready. Tiny paws, big plans.';
  }
  function renderShop(){
    const active=document.activeElement;
    const activeAction=active?.dataset?.action,activeId=active?.dataset?.id;
    const all=catalog(),list=all.filter(c=>shopFilter==='all'||shopFilter==='owned'&&owned(c.id)||c.slot===shopFilter);
    document.querySelectorAll('[data-shop-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shopFilter===shopFilter)));
    $('shop-count').textContent=`${list.length} little thing${list.length===1?'':'s'}`;
    $('shop-grid').innerHTML=list.map(c=>{
      const yours=owned(c.id),worn=state.equipped?.[c.slot]===c.id,afford=state.wallet.balance>=c.price;
      return `<article class="shop-card ${preview===c.id?'selected':''}"><img class="shop-thumb" src="assets/wardrobe/thumbs/${encodeURIComponent(c.id)}.png" alt="Purrple wearing ${esc(c.name)}" loading="lazy"><div class="shop-info"><h3>${esc(c.name)}</h3><p class="shop-description">${esc(c.description||'A little something for Purrple.')}</p><span class="shop-price">${yours?(worn?'Wearing it':'Yours forever'):`✧ ${c.price} coins`}</span><div class="shop-actions"><button class="button subtle" type="button" data-action="preview-item" data-id="${esc(c.id)}">Try on</button>${yours?`<button class="button primary" type="button" data-action="equip-item" data-id="${esc(c.id)}" ${worn?'disabled':''}>${worn?'Wearing':'Wear'}</button>`:`<button class="button primary" type="button" data-action="buy-item" data-id="${esc(c.id)}" ${!afford?'disabled':''} title="${afford?'Buy permanently':`Save ${c.price-state.wallet.balance} more coins`}">Buy</button>`}</div></div></article>`;
    }).join('')||'<div class="empty-state shop-empty"><strong>A little space for your favorites.</strong><p>Complete tasks to earn coins, then choose something to keep.</p></div>';
    $('head-name').textContent=item(state.equipped?.head)?.name||'Nothing yet';$('neck-name').textContent=item(state.equipped?.neck)?.name||'Nothing yet';
    $('preview-name').textContent=preview?item(preview)?.name||'A little preview':'Her everyday look';
    $('preview-copy').textContent=preview?`${owned(preview)?'Already yours. Choose Wear to save it.':'Just trying it on. Your saved outfit stays safe.'}`:'Choose a little something to try on.';
    $('preview-tag').hidden=!preview;
    document.querySelectorAll('[data-remove-slot]').forEach(b=>b.disabled=!state.equipped?.[b.dataset.removeSlot]);
    document.querySelectorAll('.shop-thumb').forEach(img=>img.onerror=()=>{img.onerror=null;img.style.visibility='hidden';img.closest('.shop-card').classList.add('thumb-unavailable');});
    if(activeAction&&activeId&&active&&!active.isConnected)document.querySelector(`[data-action="${CSS.escape(activeAction)}"][data-id="${CSS.escape(activeId)}"]`)?.focus({preventScroll:true});
  }
  function renderSettings(){
    const s=state.settings||{},key=JSON.stringify(s);if(key===lastSettings)return;lastSettings=key;
    $('setting-name').value=s.name||'';$('setting-pet').checked=s.petEnabled!==false;$('setting-size').value=s.size||128;$('setting-size-label').value=`${s.size||128} px`;
    $('setting-fps').value=String(s.fps||30);$('setting-motion').checked=!!s.reducedMotion;$('setting-chat').value=s.chattiness||'balanced';$('setting-notifications').checked=s.notifications!==false;
    $('setting-quiet').checked=!!s.quietHours?.enabled;$('quiet-start').value=s.quietHours?.start||'22:00';$('quiet-end').value=s.quietHours?.end||'07:00';$('hidden-hosts').value=(s.hiddenHosts||[]).join('\n');
  }
  function renderPopup(){
    $('popup-content').hidden=false;const tasks=(state.tasks||[]).filter(t=>!t.done&&!t.archived).sort((a,b)=>(a.dueAt||Infinity)-(b.dueAt||Infinity));
    $('popup-greeting').textContent=state.settings?.name?`Hi, ${state.settings.name}.`:'A little company.';
    $('popup-summary').textContent=tasks.length?`${tasks.length} little plan${tasks.length===1?'':'s'} waiting for you.`:'A quiet moment. Your list is clear.';
    $('popup-tasks').innerHTML=tasks.slice(0,3).map(t=>`<div class="popup-task"><button class="task-check" type="button" data-action="toggle-task" data-id="${esc(t.id)}" aria-label="Complete ${esc(t.title)}"></button><span>${esc(t.title)}</span></div>`).join('');
    $('popup-pet').checked=state.settings?.petEnabled!==false;
    document.querySelector('.coin-pill').setAttribute('aria-label',`${state.wallet?.balance||0} coins`);
    $('popup-focus').hidden=!state.focus;
    if(state.focus)$('popup-focus').textContent=`${state.focus.kind==='break'?'Break':'Study session'} · ${formatTime(remaining())}${state.focus.status==='paused'?' · paused':''}`;
  }
  function openTask(id){
    const t=(state.tasks||[]).find(t=>t.id===id);$('task-id').value=id||'';$('task-dialog-title').textContent=t?'Edit your little plan.':'A little plan.';
    $('task-title').value=t?.title||'';$('task-effort').value=t?.effort||'medium';$('task-priority').value=t?.priority||'normal';$('task-recurrence').value=t?.recurrence||'none';
    $('task-subtasks').value=(t?.subtasks||[]).map(s=>s.title).join('\n');
    if(t?.dueAt){const local=new Date(t.dueAt-new Date(t.dueAt).getTimezoneOffset()*60000);$('task-due').value=local.toISOString().slice(0,16);}else $('task-due').value='';
    $('task-error').hidden=true;$('task-title').removeAttribute('aria-invalid');$('task-dialog').showModal();$('task-title').focus();
  }
  function animate(now){
    const interval=1000/(state?.settings?.fps||30);
    if(rendererReady&&state&&!document.hidden&&now-lastPaint>=interval){
      lastPaint=now-((now-lastPaint)%interval);const motion=!state.settings.reducedMotion&&!reduced.matches;
      let clip=pose,time=motion?(now-poseStarted)/1000:0;
      if(!['idle','sleep','study','read','heart'].includes(pose)&&time>3.4){setPose('idle');clip='idle';time=0;}
      const canvases=popup?[$('popup-canvas')]:[$('companion-canvas'),$('focus-canvas'),$('wardrobe-canvas')];
      for(const canvas of canvases){if(!canvas||canvas.closest('[hidden]'))continue;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
        const wardrobe=canvas.id==='wardrobe-canvas';const focus=canvas.id==='focus-canvas';let chosen=clip;
        if(focus)chosen=state.focus?.kind==='break'?'sleep':state.focus?.status==='paused'?'idle':'study';
        try{PurrpleRenderer.draw(ctx,{clip:chosen,time,size:popup?200:wardrobe?360:focus?300:270,x:canvas.width/2,y:canvas.height-22,equipped:wardrobe?equipped():state.equipped,motion,rootMotion:false});}catch(error){
          if(!artErrorShown){artErrorShown=true;rendererReady=false;$('load-error').textContent='Purrple’s artwork could not be displayed. Your saved tasks are safe. Try reopening this page.';$('load-error').hidden=false;}
        }
      }
    }
    requestAnimationFrame(animate);
  }
  document.addEventListener('click',async event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.view){showView(b.dataset.view);return;}if(b.dataset.go){showView(b.dataset.go);return;}
    if(b.dataset.pet){setPose(b.dataset.pet);const lines={pat:'Prrr. Excellent forehead technique.',brush:'A very tidy little kitten, coming up.',toy:'Tiny hunter. Enormous confidence.',sleep:'I’ll handle looking sleepy.'};$('cat-line').textContent=lines[b.dataset.pet];$('companion-state').textContent=b.dataset.pet==='sleep'?'Taking a nap':'A little attention';return;}
    if(b.dataset.taskFilter){taskFilter=b.dataset.taskFilter;taskLimit=25;renderTasks();return;}
    if(b.dataset.shopFilter){shopFilter=b.dataset.shopFilter;renderShop();return;}
    if(b.dataset.break){try{await dispatch({type:'BREAK_START',minutes:Number(b.dataset.break)},'A little rest starts now.');setPose('sleep');}catch{}return;}
    if(b.dataset.removeSlot){try{await dispatch({type:'EQUIP',slot:b.dataset.removeSlot,id:null},'Outfit saved.');preview=null;renderShop();}catch{}return;}
    const id=b.dataset.id,action=b.dataset.action;if(!action)return;
    if(!['edit-task','preview-item'].includes(action))b.disabled=true;
    try{
      if(action==='toggle-task'){const task=state.tasks.find(t=>t.id===id);const wasDone=task?.done;b.disabled=true;await dispatch({type:'TASK_TOGGLE',id},wasDone?'Task reopened.':'A little win. Well done!');if(!wasDone)setPose('celebrate');}
      if(action==='edit-task')openTask(id);
      if(action==='archive-task')await dispatch({type:'TASK_ARCHIVE',id,archived:b.dataset.archived==='true'},b.dataset.archived==='true'?'Task tucked into the archive.':'Task restored.');
      if(action==='preview-item'){preview=id;setPose('idle');renderShop();}
      if(action==='buy-item'){await dispatch({type:'SHOP_BUY',id},`${item(id)?.name||'Your little favorite'} is yours forever.`);preview=id;renderShop();}
      if(action==='equip-item'){preview=null;await dispatch({type:'EQUIP',slot:item(id).slot,id},'Purrple’s outfit is saved.');}
    }catch{}finally{if(b.isConnected)b.disabled=false;}
  });
  document.addEventListener('change',async event=>{const el=event.target;if(el.dataset.subtask)try{await dispatch({type:'TASK_SUBTASK',id:el.dataset.taskId,subtaskId:el.dataset.subtask,done:el.checked});}catch{el.checked=!el.checked;}});
  function listen(id,type,fn){$(id)?.addEventListener(type,fn);}
  listen('quick-form','submit',async e=>{e.preventDefault();if(!state||e.currentTarget.dataset.busy)return;const title=$('quick-title').value.trim();if(!title){$('quick-error').textContent='Give this little task a name.';$('quick-error').hidden=false;$('quick-title').focus();return;}$('quick-error').hidden=true;
    const form=e.currentTarget;form.dataset.busy='1';$('quick-title').disabled=true;form.querySelector('button').disabled=true;
    try{await dispatch({type:'TASK_ADD',title,effort:'medium',priority:'normal',recurrence:'none',dueAt:null,subtasks:[]},'A little plan, saved.');$('quick-title').value='';}catch{}
    finally{delete form.dataset.busy;$('quick-title').disabled=false;form.querySelector('button').disabled=false;$('quick-title').focus();}});
  listen('new-task','click',()=>openTask());listen('close-task','click',()=>$('task-dialog').close());listen('cancel-task','click',()=>$('task-dialog').close());
  listen('task-form','submit',async e=>{e.preventDefault();const title=$('task-title').value.trim();if(!title){$('task-error').textContent='Give this task a name.';$('task-error').hidden=false;$('task-title').setAttribute('aria-invalid','true');$('task-title').focus();return;}
    const id=$('task-id').value,old=state.tasks.find(t=>t.id===id);const lines=$('task-subtasks').value.split('\n').map(x=>x.trim()).filter(Boolean);
    const available=(old?.subtasks||[]).slice();
    const details={title,effort:$('task-effort').value,priority:$('task-priority').value,recurrence:$('task-recurrence').value,dueAt:$('task-due').value?new Date($('task-due').value).getTime():null,subtasks:id?lines.map(title=>{const index=available.findIndex(s=>s.title===title);return index>=0?available.splice(index,1)[0]:{title,done:false};}):lines};
    $('save-task').disabled=true;try{await dispatch(id?{type:'TASK_UPDATE',id,patch:details}:{type:'TASK_ADD',...details},'Your little plan is saved.');$('task-dialog').close();}catch(error){$('task-error').textContent=error.message;$('task-error').hidden=false;}finally{$('save-task').disabled=false;}});
  listen('task-search','input',e=>{if(e.isComposing)return;search=e.target.value.trim().toLowerCase();taskLimit=25;renderTasks();});listen('task-search','compositionend',e=>{search=e.target.value.trim().toLowerCase();renderTasks();});
  listen('clear-task-search','click',()=>{$('task-search').value='';search='';renderTasks();$('task-search').focus();});listen('load-more','click',()=>{taskLimit+=25;renderTasks();});
  listen('focus-form','submit',async e=>{e.preventDefault();try{await dispatch({type:'FOCUS_START',minutes:Number($('focus-minutes').value),taskId:$('focus-task').value||null},'Notebook open. Let’s begin.');setPose('study');}catch{}});
  listen('focus-minutes','change',()=>{if(!state?.focus)$('timer-display').textContent=`${$('focus-minutes').value}:00`;});
  listen('focus-pause','click',async()=>{try{await dispatch({type:state.focus?.status==='paused'?'FOCUS_RESUME':'FOCUS_PAUSE'},state.focus?.status==='paused'?'Back to it, gently.':'Take your time.');}catch{}});
  listen('focus-cancel','click',async()=>{try{await dispatch({type:'FOCUS_CANCEL'},'Session ended. You can start fresh whenever you like.');setPose('idle');}catch{}});
  listen('reset-preview','click',()=>{preview=null;renderShop();});
  listen('setting-size','input',e=>$('setting-size-label').value=`${e.target.value} px`);
  listen('settings-form','submit',async e=>{e.preventDefault();const patch={name:$('setting-name').value.trim(),petEnabled:$('setting-pet').checked,size:Number($('setting-size').value),fps:Number($('setting-fps').value),reducedMotion:$('setting-motion').checked,chattiness:$('setting-chat').value,notifications:$('setting-notifications').checked,quietHours:{enabled:$('setting-quiet').checked,start:$('quiet-start').value,end:$('quiet-end').value},hiddenHosts:$('hidden-hosts').value.split('\n').map(s=>s.trim()).filter(Boolean)};try{await dispatch({type:'SETTINGS',patch},'Made comfortable. Preferences saved.');$('settings-save-note').textContent='Saved';}catch{}});
  listen('backup-export','click',()=>{const backup={format:'purrple-backup',version:1,exportedAt:Date.now(),state};const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Purrple_Backup_${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);notify('Your little world, backed up.');});
  listen('backup-import','click',()=>$('backup-file').click());
  let pendingBackup=null;
  listen('backup-file','change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{const data=JSON.parse(await file.text());PurrpleCore.validateBackup(data,Date.now());pendingBackup=data;$('confirm-copy').textContent=`Restore “${file.name}”? This replaces your current tasks, coins, outfits, sessions, and preferences.`;$('confirm-dialog').showModal();$('confirm-cancel').focus();}catch(error){notify(error.message||'This file is not a valid Purrple backup.',true);}});
  listen('confirm-cancel','click',()=>{pendingBackup=null;$('confirm-dialog').close();});listen('confirm-ok','click',async()=>{if(!pendingBackup)return;try{await dispatch({type:'BACKUP_IMPORT',backup:pendingBackup},'Your little world is restored.');pendingBackup=null;preview=null;$('confirm-dialog').close();}catch{}});
  listen('open-app','click',()=>client.openApp().catch(e=>notify(e.message,true)));listen('open-sidebar','click',()=>client.openSidebar().catch(e=>notify(e.message,true)));listen('popup-pet','change',async e=>{try{await dispatch({type:'SETTINGS',patch:{petEnabled:e.target.checked}});}catch{e.target.checked=!e.target.checked;}});
  async function permissions(){if(popup||!client.native)return;const row=document.createElement('div');row.className='permission-row';const p=document.createElement('p');p.textContent='Allow website access so Purrple can roam beside you. Your tasks and sidebar also work without it.';const b=document.createElement('button');b.type='button';b.className='button subtle';b.textContent='Allow Purrple on websites';b.onclick=async()=>{try{const granted=await client.requestWebsitePermission();if(granted){row.remove();notify('Purrple can now join you on supported websites.');}else notify('Website access stays off. Your sidebar still works.');}catch(error){notify(error.message,true);}};row.append(p,b);try{if(!await client.websitePermission())$('setting-pet').closest('.switch-row').after(row);}catch{}}
  client.subscribe(receive);
  client.get().then(receive).then(permissions).catch(error=>{$('loading').hidden=true;$('load-error').textContent=error.message||'Purrple could not open her saved data. Try reopening this page.';$('load-error').hidden=false;});
  Promise.resolve(globalThis.PurrpleRenderer?.preload?.()).then(()=>rendererReady=!!globalThis.PurrpleRenderer).catch(()=>notify('Purrple’s artwork could not load. Try reopening this page.',true));
  setInterval(()=>{if(!state)return;if(popup){if(state.focus)$('popup-focus').textContent=`${state.focus.kind==='break'?'Break':'Study session'} · ${formatTime(remaining())}${state.focus.status==='paused'?' · paused':''}`;}else if(state.focus)$('timer-display').textContent=formatTime(remaining());if(state.focus?.status==='running'&&remaining()===0)client.get().then(receive).catch(()=>{});},500);
  requestAnimationFrame(animate);
  globalThis.PurrpleUI={getState:()=>state,showView,refresh:()=>client.get().then(receive)};
})();
