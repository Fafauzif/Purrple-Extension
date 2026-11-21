(() => {
  'use strict';

  const domain=globalThis.PurrpleCompanionDomain;
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const gameUI=globalThis.PurrpleCompanionGames;
  const GAMES=gameUI.catalog;
  const TABS=[['room','Room'],['play','Play'],['gifts','Gifts'],['journal','Scrapbook']];
  const ZONE={floor:'Floor',shelf:'Ledge',wall:'Wall'};
  const GIFT_REACTIONS={
    'pressed-flower':{first:'peek',then:'heart',label:'Purrple noses the flower, then hugs it close.'},
    'paper-star':{first:'tilt',then:'celebrate',label:'Purrple tilts her head at the star and gives a little hop.'},
    'wool-pom':{first:'listen',then:'toy',label:'Purrple perks up and pounces at the pom-pom.'}
  };
  const NEXT_BOND=[
    '', '', 'The ledge and Three Paws discovery', 'Cozy Clues and a paper star', 'A scrapbook discovery',
    'Lantern Paths, a wool pom-pom, and the Twilight room', 'A discovery after the lantern lights',
    'The woodland route', 'A keepsake exhibit', 'The Reading nook', 'A room discovery'
  ];
  const SCENE_POSES={
    'quiet-shelf':'peek','clue-notebook':'read','scrapbook-drawer':'think','lantern-window':'look',
    'lantern-afterglow':'heart','window-weather':'listen','shelf-exhibit':'wave','window-map':'study',
    'room-at-rest':'loaf'
  };
  const button=(label,action,attrs='')=>`<button type="button" class="button subtle cp-button" data-cp="${action}" ${attrs}>${label}</button>`;
  const nameOf=id=>domain.decor[id][0];

  function mount({root,state,dispatch,notify,showView,compact=false,idPrefix='',gameOnly=false}){
    if(!root||!domain)return null;
    const ui=document.createElement('div'),live=document.createElement('p');
    const controller=new AbortController(),motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
    const listen=(type,callback,capture=false)=>root.addEventListener(type,callback,{signal:controller.signal,capture});
    root.classList.add('cp-root');
    root.classList.toggle('cp-compact',compact);
    root.classList.toggle('cp-game-only',gameOnly);
    live.className='cp-live sr-only';live.setAttribute('role','status');
    root.replaceChildren(ui,live);
    let routeRevision=0;
    let selectedVariant=null,roundDetails=false;
    let tab=gameOnly?'play':'room',selectedGame=null,selectedMode=null,selectedDecor='plum-cushion',preview=null;
    let currentStory=null,showOccasions=false,showHidden=false,answerDraft='',birthdayMonth=null,birthdayDay=null;
    let giftReplay=false,giftReturn=null,queuedPose=null,frame=0,lastPaint=0,stillCanvas=null,stillKey='';
    let signature='',busy=false,lastVisitDay=null,roomDrag=null,provisional=null,pose='idle',poseAt=0,arrangeRoom=false;
    const current=()=>state()?.companion;
    const visible=()=>!document.hidden&&!root.closest('[hidden],dialog:not([open])');
    const cpPrefix=idPrefix?escape(idPrefix)+'-':'';
    const fieldId=name=>cpPrefix+'cp-'+name;
    const field=name=>root.querySelector(`[data-cp-input="${name}"]`);
    const roomPosition=()=>({x:Number(field('x').value),y:Number(field('y').value)});
    const focusByKey=(key,reveal=false)=>root.querySelector(`[data-cp-key="${CSS.escape(key||'')}"]`)?.focus({preventScroll:!reveal});
    const descKey=text=>`data-cp-key="${text}"`;
    const dateText=at=>new Intl.DateTimeFormat('en',{dateStyle:'medium'}).format(at);
    const errorText=error=>error?.message||'Purrple couldn’t save that change. Try again.';
    const narrative=()=>current()?.discoveries.find(item=>item.id===currentStory);
    const stateKey=()=>visible()?domain.dateKey(Date.now()):null;
    const decorSource=id=>globalThis.PurrpleWardrobeV2?.decor?.find(item=>item.id===id)?.src??`assets/wardrobe/decor/${id}.png`;

    function react(clip,next=null){
      pose=clip;poseAt=performance.now();queuedPose=next;
      paintSoon();
    }
    function invalidate(){signature='';render();}
    function say(line,show=false){
      live.classList.toggle('sr-only',!show);
      live.textContent='';
      queueMicrotask(()=>{if(visible())live.textContent=line||'';});
    }
    async function save(action,message='',restore,apply){
      if(busy)return null;
      busy=true;
      const revision=routeRevision;
      let next=null;
      try {
        next=await dispatch(action);
        if(revision===routeRevision)apply?.();
      } catch(error){if(!notify)say(errorText(error),true);}
      finally {
        busy=false;render();
        if(revision===routeRevision&&restore)focusByKey(restore);
      }
      if(revision!==routeRevision||root.closest('[hidden],dialog:not([open])'))return null;
      if(next&&message)say(message);
      return next;
    }
    async function saveRoom(action,message,restore,apply){
      const before=JSON.stringify(current().room);
      const result=await save(action,'',restore,apply);
      const room=result?.companion?.room;
      if(room?.undo&&JSON.stringify(room)!==before){
        if(notify)notify(message,false,()=>dispatch({type:'COMPANION_ROOM_UNDO',expectedRoom:room},'Layout restored.'));
        else say(message,true);
      }
    }
    function enter(next,gameId=null){
      routeRevision++;
      tab=gameOnly?'play':TABS.some(([id])=>id===next)?next:'room';
      arrangeRoom=false;
      if(tab==='play'){
        selectedGame=Object.hasOwn(GAMES,gameId)?gameId:null;
        selectedMode=selectedGame?(current()?.rounds[selectedGame]?.mode??domain.modes[domain.games.indexOf(selectedGame)][0]):null;
        selectedVariant=current()?.rounds[selectedGame]?.variant??gameUI.variants[selectedGame]?.options[0][0];
        roundDetails=false;
      }
      currentStory=null;giftReplay=false;giftReturn=null;preview=null;answerDraft='';live.textContent='';
      react('idle');
      signature='';render(true);
    }
    function switchTab(next,gameId=null){
      enter(next,gameId);
      root.querySelector('.cp-heading')?.focus({preventScroll:true});
    }
    function ensureVisit(data){
      const day=stateKey();
      if(!day||day===lastVisitDay)return;
      lastVisitDay=day;
      if(data.lastSeenAt!==null&&domain.dateKey(data.lastSeenAt)===day)return;
      queueMicrotask(()=>{if(visible())dispatch({type:'COMPANION_VISIT'}).catch(()=>{lastVisitDay=null;});});
    }
    function memory(item,actions=true){
      const invitation={
        'quiet-shelf':'three-paws','first-pairs':'pocket-pong','clue-notebook':'cozy-clues','lantern-window':'lantern-paths'
      }[item?.id];
      return item?`<article class="cp-memory"><h3>${escape(item.title)}</h3><p>“${escape(item.line)}”</p>${actions?
        `<div class="cp-actions">${GAMES[invitation]?button('Play '+GAMES[invitation].name,'open-game',`data-id="${invitation}" ${descKey('scene-play')}`):''}
        ${item.decor?button('Place in room','place-gift',`data-id="${item.decor}" ${descKey('place-gift')}`):''}
        ${button('Close','close-story',descKey('close-story'))}
        ${button(current()?.favorites.includes(item.id)?'Remove favorite':'Favorite','favorite',`data-id="${item.id}" ${descKey('current-favorite')}`)}</div>`:''}</article>`:'';
    }
    function decorAt(id,point,options={}){
      const [name,zone]=domain.decor[id];
      return `<button type="button" class="cp-decor cp-decor-${id}${options.preview?' provisional':''}" style="left:${point.x}%;top:${point.y}%" data-cp="select-decor" data-decor="${id}" aria-label="${escape(name)} on ${ZONE[zone].toLowerCase()}" aria-pressed="${id===selectedDecor}" ${descKey('placed-'+id)}><img src="${decorSource(id)}" alt="" draggable="false"></button>`;
    }
    function roomStage(theme,content,label='Purrple’s room'){
      return `<div class="cp-stage cp-theme-${theme}" role="group" aria-label="${label}">
        <div class="cp-backdrop" aria-hidden="true"></div>
        ${content}
      </div>`;
    }
    function positionControl(axis,label,point,bounds){
      const field=fieldId(axis);
      return '<div class="cp-axis"><label for="'+field+'">'+label+'</label>'+
        '<output for="'+field+'" aria-hidden="true">'+point+'%</output>'+
        '<input type="range" id="'+field+'" min="'+bounds[0]+'" max="'+bounds[1]+'" value="'+point+
        '" data-cp-input="'+axis+'" '+descKey(axis)+'></div>';
    }
    function room(data){
      const discoveries=domain.discoveriesAvailable(data);
      const selection=domain.decorIds(data).includes(selectedDecor)?selectedDecor:'plum-cushion';
      const point=preview??data.room.placements[selection]??domain.placement(selection,{x:50,y:65});
      const placed=Object.entries(data.room.placements).filter(([id])=>id!==selection||!preview);
      const bounds=domain.bounds(selection),theme=data.room.theme;
      const birthday=data.birthday??{};
      const month=birthdayMonth??birthday.month??'', day=birthdayDay??birthday.day??'';
      const next=discoveries[0];
      const discovery=narrative()?memory(narrative()):next?`<section class="cp-discovery">
          <div><h3>${escape(next.title)}</h3>${discoveries.length>1?`<p>${discoveries.length} discoveries waiting.</p>`:''}</div>
          ${button('See discovery','discover',`data-id="${next.id}" ${descKey('discover')}`)}</section>`:
          '';
      return `<div class="cp-room-layout">
        <div class="cp-room-main">
          <div class="cp-room-tools">${button('Pet Purrple','pet',descKey('pet'))}${button('Give a gift','room-route',`data-id="gifts" ${descKey('room-gift')}`)}${button('Play','room-route',`data-id="play" ${descKey('room-play')}`)}</div>
          ${roomStage(theme,`
            ${placed.map(([id,at])=>decorAt(id,at)).join('')}
            ${preview?decorAt(selection,preview,{preview:true}):''}
            <canvas class="cp-cat" width="320" height="270" role="img" aria-label="Purrple in her saved outfit"></canvas>
          `)}
          ${discovery}
        </div>
        <details class="cp-room-arrange" ${arrangeRoom?'open':''}>
          <summary ${descKey('arrange')}>Arrange room</summary>
          <section class="cp-room-controls" aria-label="Room layout">
          <div class="cp-fields"><label for="${fieldId('decor')}">Decoration</label><select id="${fieldId('decor')}" data-cp-input="decor" ${descKey('decor')}>${domain.decorIds(data).map(id=>`<option value="${id}" ${id===selection?'selected':''}>${escape(nameOf(id))}${data.room.placements[id]?' · placed':''}</option>`).join('')}</select></div>
          <p class="cp-help">${ZONE[domain.decor[selection][1]]} item. Drag an object in the room or set a position below.</p>
          <div class="cp-position" aria-label="Preview decoration position">
            ${positionControl('x','Left to right',point.x,bounds.x)}
            ${positionControl('y','Top to bottom',point.y,bounds.y)}
          </div>
          <div class="cp-actions">
            ${!preview&&!data.room.placements[selection]?button('Preview decoration','preview-decor',descKey('preview-decor')):''}
            ${button('Place decoration','place',descKey('place'))}${preview?button('Discard preview','discard',descKey('discard')):''}
            ${data.room.placements[selection]?button('Put away','put-away',descKey('put-away')):''}
          </div>
          <div class="cp-fields"><label for="${fieldId('theme')}">Backdrop</label><select id="${fieldId('theme')}" data-cp-input="theme" ${descKey('theme')}>
            <option value="daylight" ${theme==='daylight'?'selected':''}>Daylight</option>
            <option value="twilight" ${theme==='twilight'?'selected':''} ${domain.level(data)<5?'disabled':''}>Twilight${domain.level(data)<5?' · Level 5':''}</option>
            <option value="reading" ${theme==='reading'?'selected':''} ${domain.level(data)<9?'disabled':''}>Reading nook${domain.level(data)<9?' · Level 9':''}</option>
          </select></div>
          <div class="cp-actions">${button('Undo layout change','undo-room',`${descKey('undo-room')} ${data.room.undo?'':'disabled'}`)}
            ${button('Reset layout','reset-room',descKey('reset-room'))}</div>
          </section>
        </details>
      </div>
      <details class="cp-panel cp-occasions" ${showOccasions?'open':''}><summary>Occasions</summary>
        <p>Set your birthday for a local postcard. Purrple’s birthday is November 20. Your first visit is remembered on ${escape(data.firstDate)}.</p>
        <form data-cp-form="birthday"><div class="cp-birthday-fields">
          <label>Month<select name="month" data-cp-input="birthday-month" required><option value="">Choose month</option>${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${Number(month)===i+1?'selected':''}>${new Date(2024,i,1).toLocaleString('en',{month:'long'})}</option>`).join('')}</select></label>
          <label>Day<input type="number" name="day" data-cp-input="birthday-day" min="1" max="31" value="${escape(day)}" required></label></div>
          <div class="cp-actions"><button class="button primary" type="submit" ${descKey('save-birthday')}>Save birthday</button>
          ${data.birthday?button('Clear birthday','clear-birthday',descKey('clear-birthday')):''}</div>
        </form>
        <p class="cp-help">Cards are available for seven local days, including the occasion. February 29 falls on February 28 in other years.</p>
      </details>`;
    }
    function gameList(data){
      const unlocked=domain.unlockedGames(data);
      const resume=domain.resumableGame(data);
      const ordered=resume?[resume,...domain.games.filter(id=>id!==resume)]:domain.games;
      if(gameOnly)return `<section class="cg-picker"><h2 tabindex="-1" class="cp-heading">Play</h2><ul>${ordered.map(id=>{
        const info=GAMES[id];
        if(!unlocked.includes(id))return `<li><strong>${info.name}</strong><small>${info.locked}</small></li>`;
        const label=data.rounds[id]?.finishedAt===null?'Resume '+info.name:info.name;
        return `<li>${button(label,'open-game',`data-id="${id}" ${descKey('game-'+id)}`)}</li>`;
      }).join('')}</ul></section>`;
      return `<div class="cp-game-list cg-library">${ordered.map(id=>{
        const info=GAMES[id];
        const active=data.rounds[id]?.finishedAt===null;
        return `<article class="cp-game-card cg-library-row">
          <div class="cg-game-icon">${gameUI.icon(info.image)}</div>
          <div><h4>${info.name}</h4><p>${unlocked.includes(id)?info.intro:info.locked}</p></div>
          ${unlocked.includes(id)?button(active?'Resume '+info.name:'Open '+info.name,'open-game',`data-id="${id}" ${descKey('game-'+id)}`):''}
        </article>`;
      }).join('')}</div>`;
    }
    function roundControls(data, round, insideDetails, hasReadyBoard=false){
      const info=GAMES[selectedGame];
      const modes=domain.modes[domain.games.indexOf(selectedGame)];
      const variants=gameUI.variants[selectedGame];
      const continuable=round?.finishedAt===null;
      const options=`<div class="cg-round-controls">
        <label for="${fieldId('mode')}">Mode<select id="${fieldId('mode')}" data-cp-input="mode" ${descKey('mode')}>${modes.map((mode,index)=>`<option value="${mode}"
          ${selectedMode===mode?'selected':''} ${mode==='woods'&&domain.level(data)<7?'disabled':''}>${info.modes[index]}${mode==='woods'&&domain.level(data)<7?' · Level 7':''}</option>`).join('')}</select></label>
        ${variants?`<label for="${fieldId('variant')}">${variants.label}<select id="${fieldId('variant')}" data-cp-input="variant" ${descKey('variant')}>${variants.options.map(([value,label])=>
          `<option value="${value}" ${selectedVariant===value?'selected':''}>${label}</option>`).join('')}</select></label>`:''}`;
      const start=button(continuable?'Replace round':round?'Rematch':'Start round','start-game',descKey('start-game'));
      const practice=button(continuable?'Replace with practice':'Practice','practice-game',descKey('practice-game'));
      if(gameOnly){
        const summary=continuable?'Round options':'Options';
        const details=`<details class="cg-round-details" ${roundDetails?'open':''}><summary>${summary}</summary>
          ${options}<div class="cp-actions cg-round-buttons">${continuable?start:''}${practice}</div></div></details>`;
        return continuable||hasReadyBoard?details:`<div class="cg-start">${start}</div>${details}`;
      }
      const controls=`${options}
        <div class="cp-actions cg-round-buttons">${start}${practice}</div>
        ${continuable?'<p class="cp-help">Replacing ends the current round. Leave through All games to keep it.</p>':'<p class="cp-help">Practice rounds skip records and Bond XP.</p>'}
      </div>`;
      return insideDetails?`<details class="cg-round-details" ${roundDetails?'open':''}><summary>${continuable?'Round options':'Rematch or change mode'}</summary>${controls}</details>`:controls;
    }
    function play(data){
      if(!selectedGame||!domain.unlockedGames(data).includes(selectedGame))return gameList(data);
      const info=GAMES[selectedGame];
      const round=data.rounds[selectedGame];
      const model=domain.game(round);
      const result=model?.outcome;
      const board=entry=>gameUI.boards[selectedGame](entry,domain.game(entry),{escape,button,key:descKey,answerDraft,fieldId});
      const ready=gameOnly&&!round;
      // Draw a covered practice board before the first committed round.
      const sample=ready?{game:selectedGame,id:'preview-'+selectedGame,mode:selectedMode??domain.modes[domain.games.indexOf(selectedGame)][0],variant:selectedVariant,moves:[],startedAt:0,finishedAt:null,practice:true}:null;
      const stage=round?board(round):ready?`<div class="cg-ready-board">
        <div inert aria-hidden="true" class="cg-ready-sample">${board(sample)}</div>
        <div class="cg-begin">${button('Begin','start-game',descKey('start-game'))}</div></div>`
        :`<p class="cg-instructions">${info.intro}</p>`;
      return `<section class="cg-play-workspace">
        ${gameOnly?`<h2 class="cp-heading cg-game-title" tabindex="-1">${info.name}</h2>`:`<header class="cp-game-top cg-game-top"><div>${button('All games','leave-game',descKey('leave-game'))}<h3>${info.name}</h3></div>
          <canvas class="cp-game-cat" width="250" height="190" role="img" aria-label="Purrple playing alongside you"></canvas>
        </header>`}
        ${stage}
        ${result?`<section class="cp-game-result cg-result" tabindex="-1" ${descKey('round-result')}><h4>${gameUI.resultTitle(selectedGame,result,round.practice)}</h4>
          <p>${escape(domain.resultLine(selectedGame,result,round.id))}</p></section>`:''}
        ${roundControls(data,round,!!round&&!result,ready)}
        ${round&&!gameOnly?`<details class="cg-rules"><summary>How to play</summary><p>${info.intro}</p></details>`:''}
      </section>`;
    }
    function gifts(data) {
      const note=narrative();
      const presented=domain.gifts.find(gift=>'gift-'+gift.id===note?.id);
      const object=gift=>`<span class="cp-gift-object cp-gift-object-${gift.id}" aria-hidden="true"><i></i></span>`;
      return `<section class="cp-gift-layout"><div class="cp-gift-reception" ${presented?`tabindex="-1" ${descKey('gift-response')}`:''}>
        ${roomStage(data.room.theme,`
          <canvas class="cp-gift-cat" width="320" height="240" role="img" aria-label="${presented?'Purrple receiving the gift':'Purrple waiting in her room'}"></canvas>
          ${presented?`<div class="cp-gift-present" aria-hidden="true">${object(presented)}</div>`:''}
        `,'Gift presentation')}
        ${presented?`<article class="cp-memory cp-thank-you">
          <h3>${giftReplay?'Purrple remembers your gift':'You gave Purrple '+escape(presented.name.toLowerCase())}</h3>
          <p class="cp-help">${GIFT_REACTIONS[presented.id].label}</p>
          <p>“${escape(note.line)}”</p>
          <div class="cp-keepsake"><img src="${decorSource(note.decor)}" alt="" width="38" height="38"><span>${escape(nameOf(note.decor))}</span></div>
          <div class="cp-actions">${button('Place in room','place-gift',`data-id="${note.decor}" ${descKey('place-gift')}`)}
          ${button('Close thank-you','close-story',descKey('close-story'))}</div>
        </article>`:''}
        </div>
        <div class="cp-gift-list">${domain.gifts.map(gift=>{
          const given=data.discoveries.some(item=>item.id==='gift-'+gift.id);
          const available=domain.level(data)>=gift.level;
          const replay=button('Replay thank-you','replay',`data-id="gift-${gift.id}" aria-label="Replay thank-you for ${escape(gift.name.toLowerCase())}" ${descKey('gift-'+gift.id)}`);
          const give=button('Give to Purrple','give',`data-id="${gift.id}" aria-label="Give Purrple ${escape(gift.name.toLowerCase())}" ${descKey('gift-'+gift.id)}`);
          return `<article class="cp-gift">${object(gift)}<div class="cp-gift-details"><h3>${escape(gift.name)}</h3>
            ${given?replay:available?give:`<p class="cp-help">Unlocks at bond level ${gift.level}</p>`}</div></article>`;
        }).join('')}</div></section>`;
    }
    function journal(data){
      const story=narrative();
      const replay=story?`<div class="cp-scrapbook-replay">${roomStage(data.room.theme,`<canvas class="cp-story-cat" width="320" height="240" role="img" aria-label="Purrple retelling this memory"></canvas>`,'Scrapbook playback')}${memory(story)}</div>`:'';
      return `<section class="cp-panel cp-journal"><div class="cp-journal-top"><div><h3>Journal library</h3><p>Find, favorite, and replay Purrple’s authored conversations.</p></div>${button('Browse Talk library','talk-library',descKey('talk-library'))}</div></section>
        ${domain.level(data)<4?`<section class="cp-panel cp-journal"><h3>Scrapbook</h3><p>Opens at bond level 4. Discoveries you make now are saved for it.</p></section>`:
          `<section class="cp-panel cp-journal"><div class="cp-journal-top"><div><h3>Scrapbook</h3><p>Revisit a moment or hide it from this list.</p></div><label class="cp-check"><input type="checkbox" data-cp-input="hidden" ${showHidden?'checked':''} ${descKey('hidden')}>Show hidden entries</label></div>
          ${replay}
          <div class="cp-journal-list">${[...data.discoveries].filter(item=>showHidden||!data.hidden.includes(item.id))
            .sort((a,b)=>Number(data.favorites.includes(b.id))-Number(data.favorites.includes(a.id))||b.at-a.at).map(item=>`<article>
              <div><strong>${escape(item.title)}</strong><p class="cp-help">${dateText(item.at)}${data.favorites.includes(item.id)?' · Favorite':''}${data.hidden.includes(item.id)?' · Hidden':''}</p></div>
              <div class="cp-actions">${button('Replay','replay',`data-id="${item.id}" ${descKey('entry-'+item.id)}`)}${button(data.hidden.includes(item.id)?'Restore entry':'Hide entry','hide',`data-id="${item.id}" ${descKey('hide-'+item.id)}`)}</div></article>`).join('')||'<p>No discoveries here yet. Purrple will leave them in the room.</p>'}</div>
        </section>`}`;
    }
    function bond(data){
      const rank=domain.level(data),upcoming=domain.thresholds[rank];
      if(upcoming===undefined)return `<div class="cp-bond"><strong>Bond level ${rank}</strong><p class="cp-level">Highest level · ${data.xp} XP</p></div>`;
      const floor=domain.thresholds[rank-1],title=NEXT_BOND[rank+1];
      return `<div class="cp-bond">
        <div class="cp-bond-top"><strong>Bond level ${rank}</strong><span>${data.xp} / ${upcoming} XP</span></div>
        <progress max="${upcoming-floor}" value="${data.xp-floor}" aria-label="Progress to bond level ${rank+1}"></progress>
        <p class="cp-level">${upcoming-data.xp} XP to level ${rank+1}${title?` · ${escape(title)}`:''}</p>
      </div>`;
    }
    function render(force=false){
      const data=current();
      if(!data||!visible()||(busy&&!force))return;
      if(tab==='room'&&!domain.decorIds(data).includes(selectedDecor)){
        selectedDecor='plum-cushion';
        preview=null;
      }
      if(!gameOnly)ensureVisit(data);
      root.classList.toggle('cp-motion-off',state()?.settings?.reducedMotion===true);
      const next=JSON.stringify([tab,selectedGame,selectedMode,selectedVariant,selectedDecor,preview,currentStory,giftReplay,showHidden,showOccasions,arrangeRoom,data,stateKey()]);
      if(next===signature){paintSoon();return;}
      signature=next;
      const active=root.contains(document.activeElement)?document.activeElement.dataset.cpKey:null;
      const previousCanvas=activeCanvas();
      const dialogGame=tab==='play'&&!!root.closest('dialog');
      const popupGame=tab==='play'&&(compact||dialogGame);
      const isolatedGame=popupGame&&selectedGame&&domain.unlockedGames(data).includes(selectedGame);
      const navTabs=tab==='room'?TABS.filter(([id])=>id!=='play'&&id!=='gifts'):TABS;
      const nav=`<nav class="cp-nav" aria-label="Companion views">${navTabs.map(([id,label])=>button(label,'tab',`data-id="${id}" ${descKey('tab-'+id)} ${tab===id?'aria-current="page"':''}`)).join('')}${!compact?button('Wardrobe','wardrobe',descKey('wardrobe')):''}</nav>`;
      const title={room:'Purrple’s room',gifts:'Give a gift',journal:'Scrapbook',play:'Play'};
      const heading=compact?'h2':'h1';
      const body=tab==='room'?room(data):tab==='play'?play(data):tab==='gifts'?gifts(data):journal(data);
      ui.innerHTML=gameOnly?body:`${isolatedGame?'':`<header class="cp-header">
        <${heading} class="cp-heading cp-main-title" tabindex="-1">${title[tab]}</${heading}>${bond(data)}</header>${dialogGame?'':nav}`}
        ${body}`;
      const nextCanvas=activeCanvas();
      if(previousCanvas&&nextCanvas&&previousCanvas.className===nextCanvas.className){
        previousCanvas.setAttribute('aria-label',nextCanvas.getAttribute('aria-label'));
        nextCanvas.replaceWith(previousCanvas);
      }
      paintSoon();
      if(active)focusByKey(active);
    }
    function previewPosition(point){
      preview=domain.placement(selectedDecor,point);
      const stage=root.querySelector('.cp-stage');
      const existing=stage?.querySelector(`[data-decor="${selectedDecor}"]`);
      if(existing){
        existing.style.left=preview.x+'%';existing.style.top=preview.y+'%';existing.classList.add('provisional');
      }else stage?.insertAdjacentHTML('beforeend',decorAt(selectedDecor,preview,{preview:true}));
    }
    function move(action,control){
      const round=current()?.rounds[selectedGame];
      if(!round)return;
      save({type:'COMPANION_GAME_MOVE',game:selectedGame,id:round.id,revision:round.moves.length,move:action}).then(next=>{
        if(!next)return;
        if(action.type==='answer'||action.type==='skip'){answerDraft='';const value=field('answer');if(value)value.value='';}
        const model=domain.game(current().rounds[selectedGame]);
        if(model.outcome){react(model.outcome==='win'?'celebrate':'idle');focusByKey('round-result',true);}
        else if(selectedGame==='cozy-clues'){focusByKey('clue');}
        else{
          const same=root.querySelector(`[data-cp-key="${CSS.escape(control??'')}"]:not([disabled])`);
          (same||root.querySelector('button[data-cp="cell"]:not([disabled])'))?.focus({preventScroll:true});
        }
        const turn=selectedGame==='paw-pairs'?model.seen.find(entry=>entry.owner==='Purrple'):null;
        if(!model.outcome){
          if(turn?.pair||model.last?.point===1)react('celebrate','idle');
          else if(turn||selectedGame==='pocket-pong'||selectedGame==='three-paws')react('peek','idle');
        }
        const announcement=model.outcome?domain.resultLine(selectedGame,model.outcome,round.id):selectedGame==='cozy-clues'?
          (action.type==='hint'?(model.clue?.hints?.at(-1)??model.clue?.hint):model.feedback):turn?
            `Purrple ${turn.pair?'matched':'turned over'} ${turn.cards.map(card=>model.deck[card]+' card '+(card+1)).join(' and ')}.`:
            selectedGame==='paw-pairs'?'Pick a second card.':root.querySelector('.cp-game-feedback')?.textContent;
        if(announcement)say(announcement);
      });
    }

    function presentGift(id,replay){
      const gift=GIFT_REACTIONS[id.slice('gift-'.length)];
      if(!gift)return;
      if(tab!=='gifts'){
        const previous=tab;
        enter('gifts');
        giftReturn=previous;
      }
      currentStory=id;giftReplay=replay;
      react(gift.first,gift.then);
      invalidate();
      focusByKey('gift-response',true);
      say(narrative()?.line);
    }
    listen('click',event=>{
      const summary=event.target.closest('.cp-room-arrange > summary');
      if(summary)arrangeRoom=!summary.parentElement.open;
      const control=event.target.closest('button[data-cp]');
      if(!control)return;
      const {cp,id,cpKey,cell,answer,decor}=control.dataset;
      const data=current();
      if(cp==='tab'||cp==='room-route'){
        if(id==='play'&&!gameOnly&&tab!=='play')showView('companion-play');
        else switchTab(id);
      }
      else if(cp==='wardrobe')showView('wardrobe');
      else if(cp==='talk-library')showView('talk');
      else if(cp==='open-game'){
        if(!gameOnly&&!root.closest('dialog'))showView('companion-play-'+id);
        else switchTab('play',id);
        const playable=root.querySelector('button[data-cp="cell"]:not([disabled])');
        if(playable)playable.focus();
      }
      else if(cp==='leave-game'){const previous=selectedGame;enter('play');focusByKey('game-'+previous);}
      else if(cp==='start-game'||cp==='practice-game'){
        const round=data.rounds[selectedGame];
        save({type:'COMPANION_GAME_START',game:selectedGame,mode:selectedMode??domain.modes[domain.games.indexOf(selectedGame)][0],variant:selectedVariant,previousId:round?.id??null,practice:cp==='practice-game',restart:!!round},'The round is ready.',null,()=>{roundDetails=false;}).then(next=>{
          if(next)(root.querySelector('button[data-cp="cell"]:not([disabled])')??root.querySelector('.cp-clue-text'))?.focus({preventScroll:true});
        });
      }
      else if(cp==='cell')move({cell:Number(cell)},cpKey);
      else if(cp==='clue-choice')move({type:'answer',answer},cpKey);
      else if(cp==='clue-hint')move({type:'hint'},cpKey);
      else if(cp==='clue-skip')move({type:'skip'},cpKey);
      else if(cp==='pet'){react('pat');say('Purrple responds to your pat.');}
      else if(cp==='discover'||cp==='give'){
        const gift=cp==='give';
        save({type:gift?'COMPANION_GIFT':'COMPANION_SCENE_OPEN',id}).then(next=>{
          if(!next)return;
          if(gift){presentGift('gift-'+id,false);return;}
          currentStory=id;
          react(SCENE_POSES[id]||'heart');invalidate();
          say(narrative()?.line);focusByKey('close-story',true);
        });
      }
      else if(cp==='replay'){
        if(id.startsWith('gift-')){presentGift(id,true);return;}
        currentStory=id;react(SCENE_POSES[id]||'heart');invalidate();
        say(narrative()?.line);focusByKey('close-story',true);
      }
      else if(cp==='close-story'){
        const previous=currentStory,returnTab=giftReturn;
        currentStory=null;giftReplay=false;giftReturn=null;react('idle');
        if(returnTab)enter(returnTab);else invalidate();
        focusByKey(tab==='journal'?'entry-'+previous:previous?.startsWith('gift-')?previous:'discover',true);
      }
      else if(cp==='place-gift'){
        if(!domain.decorIds(data).includes(id))return;
        enter('room');
        selectedDecor=id;arrangeRoom=true;
        if(!data.room.placements[id])preview=domain.placement(id,{x:51,y:65});
        invalidate();focusByKey('place',true);
      }
      else if(cp==='favorite')save({type:'COMPANION_SCENE_FAVORITE',id,value:!data.favorites.includes(id)},'Favorites saved.',cpKey);
      else if(cp==='hide')save({type:'COMPANION_SCENE_HIDE',id,value:!data.hidden.includes(id)},'Scrapbook updated.',cpKey).then(()=>{if(!root.contains(document.activeElement))focusByKey('hidden');});
      else if(cp==='select-decor'){
        if(selectedDecor===decor&&arrangeRoom)return;
        selectedDecor=decor;arrangeRoom=true;preview=null;invalidate();focusByKey(cpKey);
      }
      else if(cp==='preview-decor'){
        const position=roomPosition();
        previewPosition(position);invalidate();focusByKey('place');
      }
      else if(cp==='place'){
        const position=preview??roomPosition();
        saveRoom({type:'COMPANION_ROOM_MOVE',id:selectedDecor,position},'Decoration placed.',cpKey,()=>{preview=null;});
      }
      else if(cp==='discard'){preview=null;invalidate();focusByKey('place');}
      else if(cp==='put-away'){
        saveRoom({type:'COMPANION_ROOM_MOVE',id:selectedDecor,position:null},'Decoration put away.', 'decor',()=>{preview=null;});
      }
      else if(cp==='undo-room'){
        preview=null;save({type:'COMPANION_ROOM_UNDO'},'Restored the last layout.', 'decor');
      }
      else if(cp==='reset-room'){
        preview=null;saveRoom({type:'COMPANION_ROOM_RESET',confirm:true},'Starter layout restored.', 'reset-room');
      }
      else if(cp==='clear-birthday'){
        save({type:'COMPANION_BIRTHDAY',month:null,day:null},'Birthday cleared.').then(next=>{
          if(next){birthdayMonth=null;birthdayDay=null;invalidate();root.querySelector('[name="month"]')?.focus();}
        });
      }
    });
    listen('input',event=>{
      const input=event.target;
      if(input.dataset.cpInput==='answer')answerDraft=input.value;
      if(input.dataset.cpInput==='birthday-day')birthdayDay=input.value;
      if(input.dataset.cpInput==='birthday-month')birthdayMonth=input.value;
      if(input.dataset.cpInput==='x'||input.dataset.cpInput==='y'){
        arrangeRoom=true;
        input.closest('.cp-axis').querySelector('output').value=input.value+'%';
        previewPosition(roomPosition());
      }
    });
    listen('toggle',event=>{
      if(event.target.matches('.cg-round-details'))roundDetails=event.target.open;
    },true);
    listen('change',event=>{
      const input=event.target;
      if(input.dataset.cpInput==='decor'){selectedDecor=input.value;preview=null;invalidate();}
      if(input.dataset.cpInput==='theme')saveRoom({type:'COMPANION_ROOM_THEME',theme:input.value},'Backdrop saved.','theme');
      if(['mode','variant'].includes(input.dataset.cpInput)){
        if(input.dataset.cpInput==='mode')selectedMode=input.value;
        else selectedVariant=input.value;
        if(gameOnly&&selectedGame&&!current()?.rounds[selectedGame]){
          roundDetails=!!input.closest('details')?.open;
          render();
        }
      }
      if(input.dataset.cpInput==='hidden'){showHidden=input.checked;invalidate();}
      if(input.dataset.cpInput==='x'||input.dataset.cpInput==='y')invalidate();
    });
    listen('toggle',event=>{
      if(event.target.matches('.cp-occasions'))showOccasions=event.target.open;
      if(event.target.matches('.cp-room-arrange'))arrangeRoom=event.target.open;
    },true);
    listen('submit',event=>{
      const form=event.target;
      if(form.dataset.cpForm==='answer'){event.preventDefault();move({type:'answer',answer:form.elements.answer.value});}
      if(form.dataset.cpForm==='birthday'){
        event.preventDefault();
        save({type:'COMPANION_BIRTHDAY',month:Number(form.elements.month.value),day:Number(form.elements.day.value)},'Birthday saved.', 'save-birthday').then(next=>{
          if(next){birthdayMonth=null;birthdayDay=null;invalidate();}
        });
      }
    });
    listen('pointerdown',event=>{
      const item=event.target.closest('.cp-decor'),stage=item?.closest('.cp-stage');
      if(!stage||event.button!==0||roomDrag)return;
      roomDrag={pointerId:event.pointerId,stage,id:item.dataset.decor,x:event.clientX,y:event.clientY,dragging:false,originalSelected:selectedDecor,originalPreview:preview};
    });
    listen('pointermove',event=>{
      if(roomDrag?.pointerId!==event.pointerId)return;
      if(!roomDrag.dragging){
        if(Math.hypot(roomDrag.x-event.clientX,roomDrag.y-event.clientY)<6)return;
        roomDrag.dragging=true;roomDrag.stage.setPointerCapture(event.pointerId);selectedDecor=roomDrag.id;
      }
      const rect=roomDrag.stage.getBoundingClientRect();
      previewPosition({x:(event.clientX-rect.left)/rect.width*100,y:(event.clientY-rect.top)/rect.height*100});
    });
    function finishDrag(event,commit){
      if(roomDrag?.pointerId!==event.pointerId)return;
      const drag=roomDrag;
      roomDrag=null;
      if(drag.stage.hasPointerCapture(drag.pointerId))drag.stage.releasePointerCapture(drag.pointerId);
      if(!drag.dragging)return;
      if(!commit){selectedDecor=drag.originalSelected;preview=drag.originalPreview;}
      if(commit)arrangeRoom=true;
      invalidate();
      if(commit)focusByKey('place',true);
    }
    listen('pointerup',event=>finishDrag(event,true));
    listen('pointercancel',event=>finishDrag(event,false));
    listen('lostpointercapture',event=>finishDrag(event,false));
    listen('keydown',event=>{
      if(event.key!=='Escape'||event.isComposing||(!roomDrag&&!preview))return;
      event.preventDefault();
      event.stopPropagation();
      if(roomDrag){finishDrag({pointerId:roomDrag.pointerId},false);return;}
      preview=null;invalidate();focusByKey('place');
    });
    const activeCanvas=()=>root.querySelector('.cp-cat,.cp-game-cat,.cp-gift-cat,.cp-story-cat');
    function paintSoon(){
      if(!controller.signal.aborted&&!frame&&visible()&&activeCanvas())frame=requestAnimationFrame(paint);
    }
    function paint(now){
      frame=0;
      if(!visible())return;
      const canvas=activeCanvas(),config=state(),renderer=globalThis.PurrpleRenderer;
      if(!canvas||!config)return;
      if(!renderer?.ready){paintSoon();return;}
      const motion=!config.settings?.reducedMotion&&!motionPreference.matches;
      if(motion)paintSoon();
      if(motion&&canvas===stillCanvas&&now-lastPaint<48)return;
      let elapsed=(now-poseAt)/1000;
      const duration=renderer.clips.find(clip=>clip.id===pose)?.duration??1;
      if(pose!=='idle'&&motion&&elapsed>=duration){
        pose=queuedPose??'idle';queuedPose=null;poseAt=now;elapsed=0;
      }
      const clip=motion?pose:queuedPose??pose;
      const y=canvas.height-9;
      const size=renderer.surfaceSize(canvas,config.settings?.size,y,{miniature:canvas.classList.contains('cp-game-cat')});
      if(!size)return;
      const stillSignature=motion?'':JSON.stringify([clip,config.equipped,size]);
      if(!motion&&canvas===stillCanvas&&stillKey===stillSignature)return;
      const options={clip,time:motion?elapsed:clip==='idle'?0:.52,size,
        x:canvas.width/2,y,equipped:config.equipped,motion,rootMotion:false};
      if(!renderer.isDrawReady(options)){paintSoon();return;}
      lastPaint=now;
      stillCanvas=canvas;stillKey=stillSignature;
      const ctx=canvas.getContext('2d');
      ctx.clearRect(0,0,canvas.width,canvas.height);
      renderer.draw(ctx,options);
    }
    const resizeWatch=new ResizeObserver(paintSoon);resizeWatch.observe(root);
    document.addEventListener('visibilitychange',paintSoon,{signal:controller.signal});
    motionPreference.addEventListener('change',paintSoon,{signal:controller.signal});
    function destroy(){
      controller.abort();
      resizeWatch.disconnect();
      cancelAnimationFrame(frame);
      frame=0;
      root.replaceChildren();
    }
    return {render,open:enter,destroy,getRoute:()=>({tab,game:selectedGame})};
  }
  globalThis.PurrpleCompanion=Object.freeze({mount});
})();
