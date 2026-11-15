/* Shared local prompt UI. Replies and favourites are stored by PurrpleCore. */
(() => {
 'use strict';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function mount(root,{getState,dispatch,onReply=()=>{},compact=false}){
  let query='',category='All',favorites=false,limit=12,lastReply=null,listSignature='',quickSignature='',busy=false;
  const bank=globalThis.PurrpleTalk?.CATALOG||[],preferred=['love-you','start-study','how-are-you','sorry-throw'];
  const filters=`<div class="talk-filters"><label>Browse<select data-talk-category><option value="All">All thoughts</option>${(globalThis.PurrpleTalk?.categories||[]).map(c=>`<option value="${escape(c)}">${escape(c)}</option>`).join('')}</select></label><button type="button" data-talk-favorites aria-pressed="false">♡ Favorites</button></div><div class="talk-count" data-talk-count></div><div class="talk-prompts" data-talk-prompts></div><button type="button" class="button subtle talk-more" data-talk-more>More little thoughts</button>`;
  root.className='talk-ui'+(compact?' talk-ui-compact':'');
  root.innerHTML=`<div class="talk-intro"><h2>A little conversation.</h2><p>Choose a thought. Purrple has a little reply ready.</p></div><div class="talk-reply" data-talk-reply aria-live="polite"><p>She is listening, with both very small ears.</p></div>${compact?'<div class="talk-quick" data-talk-quick-list aria-label="Quick thoughts"></div>':''}<p class="talk-pending" data-talk-status role="status" hidden></p><div class="talk-search"><label class="talk-search-label">Find a conversation prompt<input type="search" data-talk-search placeholder="Find a little thought…" autocomplete="off"></label><button type="button" class="text-button" data-talk-clear hidden>Clear</button></div>${compact?`<details class="talk-browse" data-talk-browse><summary>Browse all ${bank.length} thoughts</summary>${filters}</details>`:filters}<p class="talk-local-note">Handwritten replies, saved locally. No AI or internet needed.</p>`;
  const search=root.querySelector('[data-talk-search]'),browse=root.querySelector('[data-talk-browse]');
  function render(){
   const state=getState();if(!state)return;const talk=state.talk||{},saved=talk.favorites||[];
   const old=document.activeElement,sendId=old?.dataset.talkSend,favoriteId=old?.dataset.talkFavorite,quickId=old?.dataset.talkQuick;
   const last=talk.last;
   if(last?.id!==lastReply){lastReply=last?.id||null;root.querySelector('[data-talk-reply]').innerHTML=last?`<span>Purrple says</span><p>${escape(last.text)}</p>`:'<p>She is listening, with both very small ears.</p>';}
   const pending=root.querySelector('[data-talk-status]');pending.hidden=!busy;pending.textContent=busy?'Purrple is replying…':'';root.setAttribute('aria-busy',String(busy));
   // All reply controls share one visible pending state. A second choice is never apparently active then discarded.
   root.querySelectorAll('[data-talk-send],[data-talk-quick]').forEach(b=>b.disabled=busy);
   if(compact){
    const nextQuick=JSON.stringify(saved);if(nextQuick!==quickSignature){
     quickSignature=nextQuick;const ids=[...saved,...preferred,...bank.map(p=>p.id)].filter((id,i,a)=>a.indexOf(id)===i).slice(0,4);
     root.querySelector('[data-talk-quick-list]').innerHTML=ids.map(id=>{const p=bank.find(p=>p.id===id);return p?`<button type="button" data-talk-quick="${escape(id)}" ${busy?'disabled':''}>${escape(p.label)}</button>`:'';}).join('');
    }
   }
   const signature=JSON.stringify([saved,query,category,favorites,limit]);
   if(signature===listSignature)return;listSignature=signature;
   const list=bank.filter(p=>(category==='All'||p.category===category)&&(!favorites||saved.includes(p.id))&&`${p.label} ${p.prompt} ${p.category}`.toLowerCase().includes(query)).sort((a,b)=>{
    if(category!=='All'||query||favorites)return 0;const ai=preferred.indexOf(a.id),bi=preferred.indexOf(b.id);return(ai<0?100:ai)-(bi<0?100:bi);
   });
   root.querySelector('[data-talk-count]').textContent=`${list.length} ${favorites?'favorite ':''}thought${list.length===1?'':'s'}`;
   root.querySelector('[data-talk-prompts]').innerHTML=list.slice(0,limit).map(p=>`<div class="talk-prompt"><button type="button" data-talk-send="${escape(p.id)}" ${busy?'disabled':''}><span>${escape(p.label)}</span><small>${escape(p.category)}</small></button><button type="button" class="talk-favorite" data-talk-favorite="${escape(p.id)}" aria-pressed="${saved.includes(p.id)}" aria-label="${saved.includes(p.id)?'Remove':'Save'} ${escape(p.label)} ${saved.includes(p.id)?'from':'to'} favorites">${saved.includes(p.id)?'♥':'♡'}</button></div>`).join('')||`<div class="talk-empty"><strong>${favorites?'Your favorites can live here.':'No matching thoughts yet.'}</strong><p>${favorites?'Save a thought with its heart button.':'Try another word, category, or clear the search.'}</p></div>`;
   root.querySelector('[data-talk-more]').hidden=list.length<=limit;root.querySelector('[data-talk-clear]').hidden=!query;root.querySelector('[data-talk-favorites]').setAttribute('aria-pressed',String(favorites));
   if(old&&!old.isConnected){const target=sendId?root.querySelector(`[data-talk-send="${CSS.escape(sendId)}"]`):favoriteId?root.querySelector(`[data-talk-favorite="${CSS.escape(favoriteId)}"]`):quickId?root.querySelector(`[data-talk-quick="${CSS.escape(quickId)}"]`):null;(target&&!target.disabled?target:search).focus({preventScroll:true});}
  }
  function searchChanged(){query=search.value.trim().toLowerCase();limit=12;if(browse)browse.open=true;render();}
  search.addEventListener('input',e=>{if(!e.isComposing)searchChanged();});search.addEventListener('compositionend',searchChanged);
  root.querySelector('[data-talk-category]').addEventListener('change',e=>{category=e.target.value;limit=12;render();});
  root.addEventListener('click',async event=>{
   const button=event.target.closest('button');if(!button)return;
   if(button.hasAttribute('data-talk-clear')){query='';search.value='';limit=12;render();search.focus();return;}
   if(button.hasAttribute('data-talk-favorites')){favorites=!favorites;limit=12;render();return;}
   if(button.hasAttribute('data-talk-more')){limit+=12;render();return;}
   const promptId=button.dataset.talkSend||button.dataset.talkQuick;
   if(promptId){
    if(busy)return;busy=true;render();
    try{const next=await dispatch({type:'TALK_REPLY',promptId});render();if(next?.talk?.last)onReply(next.talk.last);}
    catch{}finally{busy=false;render();}
   }
   if(button.dataset.talkFavorite){button.disabled=true;try{await dispatch({type:'TALK_FAVORITE',promptId:button.dataset.talkFavorite});render();}catch{}finally{if(button.isConnected)button.disabled=false;}}
  });
  render();return{render,focusSearch:()=>search.focus()};
 }
 globalThis.PurrpleTalkUI={mount};
})();
