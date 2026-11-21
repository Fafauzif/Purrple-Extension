/* Durable companion progress and deterministic, locally played rounds. */
(function (root, factory) {
  const domain = factory();
  if (typeof module === 'object' && module.exports) module.exports = domain;
  root.PurrpleCompanionDomain = domain;
})(globalThis, function () {
  'use strict';

  const DAY = 86_400_000;
  const OCCASION_GRACE = 7;
  const LEVELS = [0, 4, 9, 17, 27, 40, 55, 72, 91, 112];
  const DAILY_XP_LIMIT = 10;
  const GAME_IDS = ['paw-pairs', 'cozy-clues', 'lantern-paths', 'pocket-pong', 'three-paws'];
  const GAME_NAMES = ['Paw Pairs', 'Cozy Clues', 'Lantern Paths', 'Pocket Pong', 'Three Paws'];
  const GAME_LEVELS = [1, 3, 5, 1, 2];
  const GAME_SCENES = [null, 'clue-notebook', 'lantern-window', 'first-pairs', 'quiet-shelf'];
  const PICTURES = ['Moon', 'Spool', 'Teacup', 'Leaf', 'Notebook', 'Lantern', 'Feather', 'Star', 'Bell', 'Acorn', 'Key', 'Cloud'];
  const LAYOUTS = {'3x4': [3, 4], '4x4': [4, 4], '4x6': [4, 6]};
  const MODES = [['gentle','sharp'], ['guess','give'], ['garden','woods'], ['soft','quick'], ['gentle','sharp']];
  const MILESTONES = {
    'paw-pairs':['first-pairs','First deck','The first deck is back in its box. I make no promises about where the Moon card ended up. I pushed a spool onto the desk for our next game.',null],
    'cozy-clues':['first-clues','First case','Our first investigation has its own page. It happens to be next to the paw prints.',null],
    'lantern-paths':['first-paths','First trail','Our first route is folded into the notebook. I drew the turns I remember.',null],
    'pocket-pong':['first-pong','A spool across the desk','The spool made it back onto the desk. There are no official rules about how it got under the chair.',null],
    'three-paws':['first-three','Three in a row','I saved the grid in case we need to settle a rematch. The three tiny paw marks are mine.',null]
  };
  const GIFT_LIST = [
    ['pressed-flower', 'A pressed flower', 1, 'You kept it flat for me. That is a very specific kind of care. I’m putting it where the light lands.', 'pressed-flower-frame'],
    ['paper-star', 'A folded paper star', 3, 'A whole star, and it fits under one paw. I’ll give it the good spot above the window.', 'window-garland'],
    ['wool-pom', 'A wool pom-pom', 5, 'Thank you. I’m going to ignore it for five minutes so it doesn’t get ideas.', 'reading-lamp']
  ];
  const SCENES = [
    ['quiet-shelf', 2, 40, 'The empty shelf', 'I cleared a shelf for things worth keeping. So far, it’s an excellent shelf for intentions.', 'lavender-shelf'],
    ['clue-notebook', 3, 50, 'A note in the notebook', 'Found a clue in a book about clues. I suspect a theme. Cozy Clues is open if you want to investigate.', null],
    ['scrapbook-drawer', 4, 45, 'The bottom drawer', 'I put the loose memories in order. More or less. The scrapbook is on the good shelf now.', null],
    ['lantern-window', 5, 55, 'The light in the window', 'That lantern has been out there all evening. I marked a route through the garden. Want to see if we can reach it?', 'reading-lamp'],
    ['lantern-afterglow', 6, 48, 'After the last light', 'I thought the nicest part would be reaching the lantern. It was the bit where we paused to choose a turn. There’s a Starglow pencil in your wardrobe for our next map.', 'lantern-keepsake'],
    ['window-weather', 7, 42, 'Weather for staying in', 'The rain is doing a convincing impression of applause. That seems like permission to try the long way through the woods.', 'window-garland'],
    ['shelf-exhibit', 8, 46, 'An exhibit of small things', 'Would you put the keepsakes somewhere I can see them from my cushion? I’m taking my curatorial duties seriously.', 'pressed-flower-frame'],
    ['window-map', 9, 43, 'A different view', 'I drew two versions of the room. One for thinking, one for staring through the window without being asked what I’m thinking.', null],
    ['room-at-rest', 10, 60, 'Somewhere to return', 'We have a room full of small things we chose to keep. That is quite a lot of evidence that we were here.', 'moon-globe']
  ];
  const OCCASIONS = {
    player: ['Your birthday', 'I put a postcard by the window. Today deserves at least one little thing you didn’t have to ask for.', 'birthday-postcard', 100],
    purrple: ['Purrple’s birthday', 'A birthday in my honor. I accept the premise and any reasonable number of cushions.', 'purrple-birthday-ornament', 95],
    anniversary: ['Our first-visit anniversary', 'You were here a year ago, too. I’d like to keep that fact where I can see it.', 'anniversary-frame', 98]
  };
  const DECOR = {
    'plum-cushion':['Plum cushion','floor'], 'reading-lamp':['Reading lamp','floor'], 'lavender-shelf':['Lavender shelf','wall'],
    'pressed-flower-frame':['Pressed-flower frame','wall'], 'lantern-keepsake':['Lantern keepsake','shelf'],
    'birthday-postcard':['Birthday postcard','shelf'], 'purrple-birthday-ornament':['Birthday ornament','shelf'],
    'anniversary-frame':['Anniversary frame','wall'], 'window-garland':['Window garland','wall'], 'moon-globe':['Moon globe','shelf']
  };
  const PLACEMENT = { floor:{x:[10,90],y:[69,91]}, wall:{x:[9,91],y:[20,57]}, shelf:{x:[15,85],y:[56,67]} };
  const CLUES = [
    ['Bookmark','I know where you stopped. I live between two pages.', ['bookmark','book mark'], ['Cup','Bookmark','Pencil'], 'People use me to mark their place.'],
    ['Kettle','I hold water and give a little whistle when I’m ready.', ['kettle','tea kettle','teakettle'], ['Kettle','Clock','Pan'], 'I sit near the mugs.'],
    ['Lantern','I carry a small light through a big dark garden.', ['lantern','lamp'], ['Lantern','Mirror','Wool'], 'I have a handle so you can carry the light.'],
    ['Cushion','I catch elbows, naps, and the occasional falling cat.', ['cushion','pillow'], ['Book','Cushion','Teapot'], 'You can sit on me.'],
    ['Scarf','I am a long bit of warmth with nowhere to go but around.', ['scarf','neck scarf'], ['Shoe','Key','Scarf'], 'I go around your neck.'],
    ['Window','I let you watch the rain while staying dry.', ['window','window pane','windowpane'], ['Blanket','Door','Window'], 'I am usually made of clear glass.'],
    ['Spool','I keep thread wrapped in a tidy circle until a cat intervenes.', ['spool','bobbin','thread spool','reel'], ['Spool','Glove','Feather'], 'I sit in a sewing kit.'],
    ['Envelope','A note goes inside me before I go away.', ['envelope','letter envelope'], ['Tray','Envelope','Ribbon'], 'You can seal me.']
  ];
  // Keep CLUES and its original seed order stable for rounds begun in 2.0.
  const CLUE_PACKS = {
    desk: [
      ['Bookmark','I remember where you stopped, and I sleep between two pages.', ['book mark'], ['I save your place in a book.','I measure the margin.','I erase pencil marks.'], 'You might use a ribbon instead.'],
      ['Eraser','Every time I do my job, a little less of me is left.', ['rubber'], ['I rub out pencil marks.','I cut paper straight.','I sharpen pencils.'], 'I leave little crumbs on your desk.'],
      ['Ruler','I help you draw a line, and I get blamed when it goes crooked.', [], ['I measure in even marks.','I staple pages together.','I hold things by a magnet.'], 'I have numbers all along one edge.'],
      ['Paperclip','I hold a family of papers together without making a hole.', ['paper clip'], ['I grip pages with a bend of wire.','I fold paper in half.','I seal an envelope.'], 'You can bend me out of shape.'],
      ['Envelope','I carry a private note, usually with a stamp for company.', ['letter envelope'], ['I hold a letter you can mail.','I mark a date on a calendar.','I print words in ink.'], 'My flap folds shut.'],
      ['Pencil','The more I write, the closer my head and feet get together.', ['lead pencil'], ['I make marks with a graphite tip.','I cut a line with two blades.','I display a time on a dial.'], 'A sharpener gives me a new point.']
    ],
    kitchen: [
      ['Kettle','I warn everyone in the kitchen when my water is ready.', ['tea kettle','teakettle'], ['I heat water for tea.','I hold the salt.','I strain the noodles.'], 'The old-fashioned kind whistles.'],
      ['Colander','I am a bowl that lets water escape but keeps dinner in place.', ['strainer','drainer'], ['I drain pasta through little holes.','I stir batter with loops of wire.','I keep a roast warm.'], 'I live next to the sink at dinnertime.'],
      ['Apron','I catch the flour so you can wear the same shirt after baking.', [], ['I tie around you to protect your clothes.','I cover a bowl to keep the heat in.','I dry forks and spoons.'], 'I usually have a pocket and waist ties.'],
      ['Whisk','I make eggs fluffy without adding any feathers.', ['egg whisk','egg beater','beater'], ['I mix in air with loops of wire.','I divide dough into squares.','I skim foam from the top.'], 'You beat eggs with me.'],
      ['Rolling pin','I travel back and forth, and every hill I cross gets flatter.', ['rollingpin'], ['I flatten dough by rolling.','I slice a loaf with a blade.','I weigh ingredients in a bowl.'], 'I am a cylinder with handles at the ends.'],
      ['Oven mitt','I shake hands with a hot pan without getting burned.', ['oven glove','pot holder','potholder'], ['I cover your hand when lifting a hot tray.','I grate cheese with tiny blades.','I pour water from a spout.'], 'I have a padded thumb.']
    ],
    garden: [
      ['Acorn','I wear a little cap and might grow taller than the house.', [], ['I am the seed of an oak.','I stick to fur on a walk.','I grow on a blackberry cane.'], 'Squirrels sometimes bury me.'],
      ['Watering can','I make it rain whenever the sky forgets.', ['wateringcan','sprinkling can'], ['I sprinkle water over plants.','I protect hands from thorns.','I carry cut flowers indoors.'], 'My long spout often ends in a perforated rose.'],
      ['Snail','My front door goes wherever I go.', ['garden snail'], ['I carry a spiral shell.','I jump between the hedges.','I fly using two pairs of wings.'], 'I leave a silver trail.'],
      ['Trowel','I am the small shovel that fits in one hand and a flowerpot.', ['hand shovel','garden trowel'], ['I dig small holes for seedlings.','I clip stems with blades.','I sweep fallen petals.'], 'My pointed blade scoops soil.'],
      ['Trellis','I stand still while the peas climb over me.', [], ['I support climbing plants.','I protect roots from frost.','I store rainwater for dry days.'], 'I look like a lattice or a ladder.'],
      ['Lantern','I carry a little light through a rather big garden.', ['lamp','garden lantern'], ['I carry a portable light.','I catch falling leaves.','I measure the rain.'], 'I have a handle and shield the light from wind.']
    ]
  };
  const RESULTS = {
    'paw-pairs': {
      win:['You kept your eyes on the cards. I kept mine on you. In hindsight, that was a strategic error.', 'You won by remembering where things go. A talent I respect and will never practice.'],
      loss:['I won by a very small amount. I intend to mention it a very large number of times.', 'I will be insufferable for approximately one rematch.'],
      tie:['A draw. Equal brilliance, equal dignity.', 'We tied. I’m assuming that was a generous artistic decision.']
    },
    'cozy-clues': {
      win:['You found the answers I thought I’d hidden properly.', 'That was good detective work. I’m putting a paw print on the case file.'],
      loss:['A few clues escaped. We can leave the notebook open and try again.', 'The mystery survives. I rather like it that way.'],
      tie:['We found just enough answers to look mysterious ourselves.', 'A respectable half-mystery. The other half can wait.']
    },
    'lantern-paths': {
      win:['We got there together. My paws are very proud of their work.', 'A clear path, a lit lantern, and a very satisfied cat.'],
      loss:['The path ran out. The lantern is still there if we want to try again.', 'I rather liked that route. It was just missing a small detail called the destination.']
    },
    'pocket-pong': {
      win:['Fine. The spool respects you more.', 'That last return went straight past my paw. I was there. I saw it.'],
      loss:['I kept the spool on the desk. Mostly.', 'I’d like to thank the net, the desk, and my surprisingly precise left paw.']
    },
    'three-paws': {
      win:['Three in a row. I was counting snack breaks instead.', 'I will leave your line on the board until I think of a clever excuse.'],
      loss:['Three paws. I happen to have a spare.', 'I’ve drawn the line with my paws. Shall we clear it?'],
      tie:['The board is full. I would now like that much room on the cushion.', 'I blocked you, you blocked me, and the notebook ran out of squares.']
    }
  };

  function dateKey(at) {
    const date = new Date(at);
    return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
  }
  function dayNumber(day) {
    const [year, month, date] = day.split('-').map(Number);
    return Date.UTC(year,month-1,date)/DAY;
  }
  const localDay = day => typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&
    Number.isFinite(Date.parse(day+'T00:00:00Z'))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;
  const safeId = id => typeof id==='string'&&/^[a-z0-9_-]{1,128}$/.test(id);
  const safeTime = time => Number.isSafeInteger(time)&&time>=0&&time<=8_640_000_000_000_000;
  const plain = value => value&&typeof value==='object'&&!Array.isArray(value);
  const requireValid = (condition, message='The backup has invalid companion data.') => {if(!condition)throw Error(message);};
  function hash(value) {
    let h=2166136261;
    for(const char of String(value))h=Math.imul(h^char.charCodeAt(0),16777619);
    return h>>>0;
  }
  function shuffle(values, seed) {
    const items=[...values];
    for(let i=items.length-1;i>0;i--){
      const j=hash(seed+'-'+i)%(i+1);
      [items[i],items[j]]=[items[j],items[i]];
    }
    return items;
  }
  function key(prefix) {
    return prefix+'_'+(globalThis.crypto?.randomUUID?.()??Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
  }
  function empty(now=Date.now()) {
    return {
      version:1, firstDate:dateKey(now), birthday:null, lastSeenAt:null, returnFrom:null,
      xp:0, xpReceipts:[], latestXpDay:null, rounds:{}, results:[],
      discoveries:[], favorites:[], hidden:[], room:{theme:'daylight',placements:{'plum-cushion':{x:33,y:86}},undo:null}
    };
  }
  function level(companion) {return LEVELS.filter(threshold=>threshold<=(companion?.xp??0)).length;}
  function unlockedGames(companion) {
    return GAME_IDS.filter((_,index)=>level(companion)>=GAME_LEVELS[index]&&
      (!GAME_SCENES[index]||companion?.discoveries.some(item=>item.id===GAME_SCENES[index])));
  }
  function award(state, reason, id, now) {
    const data=state.companion??(state.companion=empty(state.createdAt??now));
    if(typeof id!=='string'||!['talk','focus','game','scene','gift'].includes(reason))return;
    // Only the first three distinct prompts contribute. Repeat play and focus use a daily budget.
    if(reason==='talk'&&data.xpReceipts.filter(receipt=>receipt.reason==='talk').length>=3)return;
    if(data.xpReceipts.some(receipt=>receipt.reason===reason&&receipt.id===id))return;
    const day=dateKey(now), repeat=['focus','game'].includes(reason);
    const nominal={talk:2,focus:2,game:3,scene:5,gift:2}[reason];
    let amount=nominal;
    if(repeat){
      const spent=data.xpReceipts.filter(receipt=>receipt.day===day&&['focus','game'].includes(receipt.reason)).reduce((sum,receipt)=>sum+receipt.amount,0);
      amount=data.latestXpDay&&day<data.latestXpDay?0:Math.min(nominal,DAILY_XP_LIMIT-spent);
      if(!data.latestXpDay||day>data.latestXpDay)data.latestXpDay=day;
    }
    data.xp+=amount;data.xpReceipts.push({reason,id,day,amount});
  }
  function pawPairs(round) {
    const [rows, columns] = LAYOUTS[round.variant ?? '3x4'];
    const pictures = PICTURES.slice(0, rows * columns / 2);
    const deck=shuffle([...pictures,...pictures],round.id);
    const matched=new Set(),memory=new Map(),score=[0,0];
    let pending=null, seen=[], turn=0;
    for(const entry of round.moves){
      const cell=entry.cell;
      requireValid(Number.isInteger(cell)&&cell>=0&&cell<deck.length&&pending!==cell&&!matched.has(cell), 'Choose an available card.');
      memory.set(cell,deck[cell]);
      if(pending===null){
        pending=cell;seen=[];
        continue;
      }
      seen=[{owner:'You',cards:[pending,cell],pair:deck[pending]===deck[cell]}];
      if(seen[0].pair){matched.add(pending);matched.add(cell);score[0]++;}
      pending=null;
      if(matched.size===deck.length)continue;
      const available=shuffle(deck.map((_,i)=>i).filter(i=>!matched.has(i)),round.id+'-cat-'+turn);
      const recall=round.mode==='sharp'||hash(round.id+turn)%5<3;
      const remembered=recall&&available.find(i=>memory.has(i)&&available.some(j=>j!==i&&memory.get(j)===memory.get(i)));
      const first=Number.isInteger(remembered)?remembered:available.find(i=>!memory.has(i))??available[0];
      memory.set(first,deck[first]);
      const second=(recall?available.find(i=>i!==first&&memory.get(i)===deck[first]):undefined)??available.find(i=>i!==first&&!memory.has(i))??available.find(i=>i!==first);
      memory.set(second,deck[second]);
      const pair=deck[first]===deck[second];
      seen.push({owner:'Purrple',cards:[first,second],pair});
      if(pair){matched.add(first);matched.add(second);score[1]++;}
      turn++;
    }
    const outcome=matched.size<deck.length?null:score[0]>score[1]?'win':score[0]===score[1]?'tie':'loss';
    return {deck,rows,columns,matched:[...matched],pending,seen,score,outcome};
  }
  const normalizeAnswer = answer => answer.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g,'').trim().replace(/\s+/g,' ');
  function cozyClues(round) {
    if (round.variant) return categorizedClues(round);
    const pack=shuffle(CLUES,round.id).slice(0,5);
    const reverse=[['Keeps your place','Makes a room brighter','Holds a drink'],['Heats water','Opens a door','Covers a table'],
      ['Carries a portable light','Shows you your face','Measures the rain'],['Soft enough for a nap','Marks your place in a book','Has a glass pane'],
      ['Wraps around a neck','Holds a hot drink','Stores loose thread'],['Lets you see the rain','Carries small coins','Makes tea whistle'],
      ['Holds wound thread','Goes around your neck','Has pages'],['Holds a note you can mail','Lights a path','Soft enough to sleep on']];
    let index=0,score=0,hinted=false,feedback='';
    for(const move of round.moves){
      requireValid(index<pack.length,'That round is already over.');
      if(move.type==='hint'){
        requireValid(!hinted,'The hint is already open.');
        hinted=true;
        continue;
      }
      const [word,,aliases]=pack[index];
      const skip=move.type==='skip';
      requireValid(skip||move.type==='answer'&&typeof move.answer==='string'&&move.answer.length<=60&&normalizeAnswer(move.answer),'Give an answer or choose Skip.');
      const answer=skip?'':normalizeAnswer(move.answer);
      const correct=round.mode==='guess'?aliases.includes(answer):answer===normalizeAnswer(reverse[CLUES.indexOf(pack[index])][0]);
      if(correct)score++;
      feedback=skip?'We can leave that puzzle here. The answer was '+word+'.':round.mode==='give'?(correct?'Purrple guessed '+word+'. One for the detective!':'Purrple considered that clue. Her guess missed '+word+'.'):(correct?'Yes. '+word+' belongs in our little notebook.':'The answer was '+word+'. The next clue is ready.');
      index++;hinted=false;
    }
    const clue=pack[index];
    const choices=clue?shuffle(round.mode==='guess'?clue[3]:reverse[CLUES.indexOf(clue)],round.id+index):[];
    return {clue:clue?{word:round.mode==='give'?clue[0]:null,prompt:round.mode==='guess'?clue[1]:'Give Purrple the clue that best describes '+clue[0]+'.',hint:round.mode==='guess'?clue[4]:'Pick the detail that sets this object apart.',choices}:null,index,score,hinted,feedback,outcome:index<5?null:score>=4?'win':score===3?'tie':'loss'};
  }
  function categorizedClues(round) {
    const pack = shuffle(CLUE_PACKS[round.variant], round.id).slice(0, 5);
    const giving = round.mode === 'give';
    let index = 0;
    let score = 0;
    let hintStage = 0;
    let feedback = '';
    for (const move of round.moves) {
      requireValid(index < pack.length, 'That round is already over.');
      if (move.type === 'hint') {
        requireValid(hintStage < 2, 'All hints for this clue are open.');
        hintStage++;
        continue;
      }
      const [word, , aliases, suggestions] = pack[index];
      const skip = move.type === 'skip';
      const answer = !skip && move.type === 'answer' && typeof move.answer === 'string' && move.answer.length <= 60 &&
        normalizeAnswer(move.answer);
      requireValid(skip || answer, 'Give an answer or choose Reveal.');
      const correct = !skip && (giving ? answer === normalizeAnswer(suggestions[0]) :
        [word, ...aliases].some(alias => answer === normalizeAnswer(alias)));
      if (correct) score++;
      feedback = skip ? 'The answer was ' + word + '.' :
        giving ? (correct ? 'Purrple guessed ' + word + '.' : 'That clue sent Purrple the wrong way. The answer was ' + word + '.') :
          (correct ? 'You found it. ' + word + ' belongs in our notebook.' : 'The answer was ' + word + '.');
      index++;
      hintStage = 0;
    }
    const entry = pack[index];
    let clue = null;
    if (entry) {
      const [word, prompt, , suggestions, hint] = entry;
      const alternatives = pack.filter(choice => choice !== entry).slice(0, 2).map(choice => choice[0]);
      const hints = giving ? ['Name something that belongs to this object.', suggestions[0]] : [hint, `It starts with “${word[0]}”.`];
      clue = {
        prompt: giving ? 'Choose the clue that describes ' + word + '.' : prompt,
        hint,
        hints: hints.slice(0, hintStage),
        choices: giving || hintStage === 2 ? shuffle(giving ? suggestions : [word, ...alternatives], round.id + index) : []
      };
    }
    return {clue,index,score,hintStage,feedback,outcome:index<5?null:score>=4?'win':score===3?'tie':'loss'};
  }
  function neighbors(cell) {
    const row=Math.floor(cell/5), col=cell%5;
    return [row>0?cell-5:-1,col<4?cell+1:-1,row<4?cell+5:-1,col>0?cell-1:-1].filter(index=>index>=0);
  }
  function lanternPaths(round) {
    const goal=24,blocked=round.mode==='woods'?[2,7,11,16,18,23]:[7,11,13,16];
    const budget=round.mode==='woods'?12:10;
    const path=[{cell:0,owner:'Start'}];
    const legal=()=>neighbors(path.at(-1).cell).filter(cell=>!blocked.includes(cell)&&!path.some(tile=>tile.cell===cell));
    const distance=start=>{
      let frontier=[start],seen=new Set([...blocked,...path.map(tile=>tile.cell)]),steps=0;
      seen.add(start);
      while(frontier.length){
        if(frontier.includes(goal))return steps;
        frontier=frontier.flatMap(neighbors).filter(cell=>{if(seen.has(cell))return false;seen.add(cell);return true;});
        steps++;
      }
      return Infinity;
    };
    const outcome=()=>path.at(-1).cell===goal?'win':path.length-1>=budget||!legal().length?'loss':null;
    for(const move of round.moves){
      requireValid(!outcome()&&legal().includes(move.cell),'Choose a highlighted square next to the route.');
      path.push({cell:move.cell,owner:'You'});
      if(!outcome()){
        const candidates=legal().sort((a,b)=>distance(a)-distance(b)||hash(round.id+a)-hash(round.id+b));
        path.push({cell:candidates[0],owner:'Purrple'});
      }
    }
    return {path,blocked,goal,budget,legal:outcome()?[]:legal(),outcome:outcome()};
  }
  const PONG_LANES = [0, 1, 2, 3, 4];
  function pocketPong(round) {
    const score = [0, 0];
    const quick = round.mode === 'quick';
    const rallyLimit = quick ? 3 : 4;
    let rally = 0;
    let last = null;
    let serveLane = hash(round.id + '-serve') % 5;
    const outcome = () => score[0] === 3 ? 'win' : score[1] === 3 ? 'loss' : null;
    const legal = () => PONG_LANES.filter(lane => Math.abs(lane - serveLane) <= 1);
    function guarding() {
      const point = score[0] + score[1];
      const center = hash(round.id + '-guard-' + point + '-' + rally) % 5;
      return PONG_LANES.filter(lane => Math.abs(lane - center) <= (quick ? 1 : 0));
    }
    for (const {cell} of round.moves) {
      requireValid(!outcome() && legal().includes(cell), 'Use a return lane next to the incoming spool.');
      const caught = guarding().includes(cell);
      last = {cell, caught, point: null};
      if (caught) {
        rally++;
        if (rally === rallyLimit) last.point = 1;
      } else last.point = 0;
      if (last.point !== null) {
        score[last.point]++;
        rally = 0;
      }
      serveLane = caught && last.point === null
        ? (cell + 1 + hash(round.id + '-bounce-' + (score[0] + score[1]) + '-' + rally) % 3) % 5
        : hash(round.id + '-serve-' + (score[0] + score[1])) % 5;
    }
    return {score, serveLane, guarding:guarding(), legal:outcome()?[]:legal(), rally, rallyLimit, last, outcome:outcome()};
  }
  const GRID_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const openCells = board => board.flatMap((owner, index) => owner === null ? [index] : []);
  const lineFor = board => GRID_LINES.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
  function gridScore(board, owner, memo, depth = 0) {
    const line = lineFor(board);
    if (line) return board[line[0]] === 'purrple' ? 10 - depth : depth - 10;
    const legal = openCells(board);
    if (!legal.length) return 0;
    const position = owner + board.map(mark => mark?.[0] ?? '.').join('');
    if (memo.has(position)) return memo.get(position);
    const values = legal.map(cell => {
      board[cell] = owner;
      const result = gridScore(board, owner === 'you' ? 'purrple' : 'you', memo, depth + 1);
      board[cell] = null;
      return result;
    });
    const rank = owner === 'purrple' ? Math.max(...values) : Math.min(...values);
    memo.set(position, rank);
    return rank;
  }
  function threePaws(round) {
    const board = Array(9).fill(null);
    let last = null, turn = 0;
    const outcome = () => {
      const line = lineFor(board);
      return line ? (board[line[0]] === 'you' ? 'win' : 'loss') : board.includes(null) ? null : 'tie';
    };
    for (const {cell} of round.moves) {
      requireValid(!outcome() && openCells(board).includes(cell), 'Choose an empty square.');
      board[cell] = 'you';
      if (outcome()) continue;
      const options = shuffle(openCells(board), round.id + '-grid-' + turn++);
      if (round.mode === 'sharp') {
        const memo = new Map();
        const ranked = options.map(index => {
          board[index] = 'purrple';
          const rank = gridScore(board, 'you', memo);
          board[index] = null;
          return {index, rank};
        }).sort((a, b) => b.rank - a.rank);
        last = ranked[0].index;
      } else {
        last = options.find(index => {
          board[index] = 'purrple';
          const wins = !!lineFor(board);
          board[index] = null;
          return wins;
        }) ?? options[0];
      }
      board[last] = 'purrple';
    }
    return {board, last, line:lineFor(board) ?? [], legal:outcome()?[]:openCells(board), outcome:outcome()};
  }
  function game(round) {
    if(!round)return null;
    const methods={'paw-pairs':pawPairs,'cozy-clues':cozyClues,'lantern-paths':lanternPaths,
      'pocket-pong':pocketPong,'three-paws':threePaws};
    return methods[round.game](round);
  }
  function gameDetail(gameId,model) {
    switch (gameId) {
      case 'paw-pairs':
      case 'pocket-pong': return model.score;
      case 'cozy-clues': return [model.score];
      case 'lantern-paths': return [model.path.length - 1];
      case 'three-paws': return [model.board.filter(Boolean).length];
    }
  }
  function gameVariant(gameId,variant) {
    if (variant === undefined) return undefined;
    requireValid(typeof variant === 'string' && (
      (gameId === 'paw-pairs' && Object.hasOwn(LAYOUTS,variant)) ||
      (gameId === 'cozy-clues' && Object.hasOwn(CLUE_PACKS,variant))),
      'Choose a board size or clue collection.'
    );
    return variant;
  }
  function gameMove(gameId,move) {
    if (gameId !== 'cozy-clues') return {cell:move?.cell};
    requireValid(['hint','skip','answer'].includes(move?.type),'Choose a clue action.');
    return move.type === 'answer' ? {type:'answer',answer:move.answer} : {type:move.type};
  }
  function resumableGame(data) {
    return Object.values(data?.rounds??{}).filter(round=>round.finishedAt===null).sort((a,b)=>b.startedAt-a.startedAt)[0]?.game??null;
  }
  function resultLine(gameId,outcome,seed) {
    const choices=RESULTS[gameId]?.[outcome]??[];
    return choices.length?choices[hash(seed)%choices.length]:'';
  }
  function annualDate(year,month,day) {
    if(month===2&&day===29&&new Date(Date.UTC(year,1,29)).getUTCMonth()!==1)day=28;
    return String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  }
  function occasionDate(day,month,monthDay) {
    const year=Number(day.slice(0,4));
    return [year,year-1].map(value=>annualDate(value,month,monthDay)).find(value=>{
      const since=dayNumber(day)-dayNumber(value);
      return since>=0&&since<OCCASION_GRACE;
    })??null;
  }
  function discoveriesAvailable(data,now=Date.now()) {
    if(!data)return [];
    const today=dateKey(now), rank=level(data);
    const unlocked=SCENES.filter(([,minimum])=>rank>=minimum).map(([id,,priority,title,line,decor])=>({id,priority,title,line,decor,kind:'story'}));
    const [firstYear,firstMonth,firstDay]=data.firstDate.split('-').map(Number);
    const occasionInputs={player:data.birthday?[data.birthday.month,data.birthday.day]:null,purrple:[11,20],anniversary:[firstMonth,firstDay]};
    for(const [type,input] of Object.entries(occasionInputs)){
      if(!input)continue;
      const date=occasionDate(today,...input);
      if(!date||type==='anniversary'&&Number(date.slice(0,4))<=firstYear)continue;
      const [title,line,decor,priority]=OCCASIONS[type];
      unlocked.push({id:type+'-'+date.slice(0,4),priority,title,line,decor,kind:'occasion'});
    }
    if(data.returnFrom)unlocked.push({id:'return-'+data.returnFrom,priority:20,title:'A little while',line:'The door still opens the same way. I kept the cushion in its usual spot.',decor:null,kind:'return'});
    const lastGame=data.results.at(-1);
    if(lastGame&&lastGame.at<now&&dateKey(lastGame.at)<today){
      const name=GAME_NAMES[GAME_IDS.indexOf(lastGame.game)];
      const details={
        'paw-pairs':lastGame.detail[0]+' pairs for you and '+lastGame.detail[1]+' for me.',
        'cozy-clues':lastGame.detail[0]+' clues solved out of five.',
        'lantern-paths':lastGame.outcome==='win'?'We connected the lantern in '+lastGame.detail[0]+' steps.':'We drew a '+lastGame.detail[0]+'-step path through the garden.',
        'pocket-pong':lastGame.detail[0]+' points for you and '+lastGame.detail[1]+' for me.',
        'three-paws':lastGame.outcome==='tie'?'We filled every last square.':'We left '+(9-lastGame.detail[0])+' squares empty.'
      };
      unlocked.push({id:'remember-'+lastGame.id,priority:30,title:name+' again?',line:'I remember our last '+name+' round. '+details[lastGame.game]+' There’s a place saved if you want another.',decor:null,kind:'callback'});
    }
    return unlocked.filter(scene=>!data.discoveries.some(item=>item.id===scene.id)).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
  }
  function decorIds(data) {
    return [...new Set(['plum-cushion',...data.discoveries.map(item=>item.decor).filter(Boolean)])];
  }
  function placementBounds(decor) {return PLACEMENT[DECOR[decor]?.[1]];}
  function placement(decor, value) {
    const bounds=placementBounds(decor);
    requireValid(bounds&&plain(value)&&Number.isFinite(value.x)&&Number.isFinite(value.y),'Choose a position inside the room.');
    const clamp=(number,limits)=>Math.round(Math.max(limits[0],Math.min(limits[1],number)));
    return {x:clamp(value.x,bounds.x),y:clamp(value.y,bounds.y)};
  }
  function roundEnd(state,data,round,model,now) {
    if(round.practice||data.results.some(result=>result.id===round.id))return;
    const detail=gameDetail(round.game,model);
    data.results.push({id:round.id,game:round.game,outcome:model.outcome,at:now,detail});
    award(state,'game',round.id,now);
    const [id,title,line,decor]=MILESTONES[round.game];
    if(!data.discoveries.some(item=>item.id===id))data.discoveries.push({id,kind:'game',title,line,decor,at:now});
    if(round.game==='lantern-paths'&&model.outcome==='win'&&!data.discoveries.some(item=>item.id==='first-lantern')){
      data.discoveries.push({id:'first-lantern',kind:'game',title:'First light',line:'We reached the lantern. A small thing to carry home, with a surprisingly long shadow.',decor:'lantern-keepsake',at:now});
    }
  }
  function reduce(state,action,now) {
    const data=state.companion??(state.companion=empty(state.createdAt??now));
    switch(action.type){
      case 'COMPANION_VISIT': {
        if(data.lastSeenAt!==null&&dayNumber(dateKey(now))-dayNumber(dateKey(data.lastSeenAt))>=2)data.returnFrom=dateKey(data.lastSeenAt);
        data.lastSeenAt=Math.max(data.lastSeenAt??0,now);
        break;
      }
      case 'COMPANION_BIRTHDAY': {
        if(action.month===null&&action.day===null){data.birthday=null;break;}
        requireValid(Number.isInteger(action.month)&&Number.isInteger(action.day)&&localDay(annualDate(2024,action.month,action.day)), 'Choose a valid birthday month and day.');
        data.birthday={month:action.month,day:action.day};
        break;
      }
      case 'COMPANION_GIFT': {
        const gift=GIFT_LIST.find(([id])=>id===action.id);
        requireValid(gift&&level(data)>=gift[2],'This gift is still locked.');
        const id='gift-'+gift[0];
        if(!data.discoveries.some(item=>item.id===id)){
          data.discoveries.push({id,kind:'gift',title:gift[1],line:gift[3],decor:gift[4],at:now});
          award(state,'gift',id,now);
        }
        break;
      }
      case 'COMPANION_SCENE_OPEN': {
        if(data.discoveries.some(item=>item.id===action.id))break;
        const scene=discoveriesAvailable(data,now).find(item=>item.id===action.id);
        requireValid(scene,'That discovery is no longer available.');
        const {id,kind,title,line,decor}=scene;
        data.discoveries.push({id,kind,title,line,decor,at:now});
        if(kind==='story')award(state,'scene',id,now);
        break;
      }
      case 'COMPANION_SCENE_FAVORITE':
      case 'COMPANION_SCENE_HIDE': {
        requireValid(data.discoveries.some(item=>item.id===action.id)&&typeof action.value==='boolean','Choose a saved discovery.');
        const list=action.type==='COMPANION_SCENE_HIDE'?'hidden':'favorites';
        data[list]=data[list].filter(id=>id!==action.id);
        if(action.value)data[list].push(action.id);
        break;
      }
      case 'COMPANION_GAME_START': {
        const index=GAME_IDS.indexOf(action.game);
        requireValid(unlockedGames(data).includes(action.game),'Discover this game in the room first.');
        requireValid(MODES[index].includes(action.mode),'Choose a game mode.');
        requireValid(action.mode!=='woods'||level(data)>=7,'The woodland route opens at bond level 7.');
        const variant=gameVariant(action.game,action.variant);
        const current=data.rounds[action.game];
        requireValid(!current||game(current).outcome||action.restart===true,'Resume the current round or choose Restart.');
        requireValid(!Object.hasOwn(action,'previousId')||(current?.id??null)===action.previousId,'That game round changed. Reopen the game to continue.');
        data.rounds[action.game]={game:action.game,id:key('round'),mode:action.mode,...(variant?{variant}:{}),practice:action.practice===true,startedAt:now,finishedAt:null,moves:[]};
        break;
      }
      case 'COMPANION_GAME_MOVE': {
        const round=data.rounds[action.game];
        requireValid(round&&round.id===action.id,'That game round changed. Reopen the game to continue.');
        requireValid(round.finishedAt===null,'That round has already finished.');
        requireValid(action.revision===round.moves.length,'That move has already changed the board.');
        requireValid(round.moves.length<1000,'Restart this round to continue playing.');
        const move=gameMove(action.game,action.move);
        const model=game({...round,moves:[...round.moves,move]});
        round.moves.push(move);
        if(model.outcome){round.finishedAt=now;roundEnd(state,data,round,model,now);}
        break;
      }
      case 'COMPANION_ROOM_MOVE': {
        requireValid(decorIds(data).includes(action.id),'Collect this decoration before placing it.');
        const next=action.position===null?null:placement(action.id,action.position);
        const before=data.room.placements[action.id]??null;
        if(JSON.stringify(before)===JSON.stringify(next))break;
        data.room.undo={kind:'move',id:action.id,position:before};
        if(next)data.room.placements[action.id]=next;
        else delete data.room.placements[action.id];
        break;
      }
      case 'COMPANION_ROOM_THEME': {
        requireValid(['daylight','twilight','reading'].includes(action.theme),'Choose a room backdrop.');
        requireValid(action.theme==='daylight'||level(data)>=(action.theme==='reading'?9:5),'That backdrop is still locked.');
        if(data.room.theme===action.theme)break;
        data.room.undo={kind:'theme',theme:data.room.theme};
        data.room.theme=action.theme;
        break;
      }
      case 'COMPANION_ROOM_RESET': {
        requireValid(action.confirm===true,'Confirm restoring the room layout.');
        const previous={kind:'reset',theme:data.room.theme,placements:data.room.placements};
        data.room=empty(now).room;data.room.undo=previous;
        break;
      }
      case 'COMPANION_ROOM_UNDO': {
        if(Object.hasOwn(action,'expectedRoom')&&JSON.stringify(action.expectedRoom)!==JSON.stringify(data.room)){
          throw Error('The room changed. Undo the latest layout from Arrange room.');
        }
        const previous=data.room.undo;
        if(!previous)break;
        if(previous.kind==='move'){
          if(previous.position)data.room.placements[previous.id]=previous.position;
          else delete data.room.placements[previous.id];
        }else{
          data.room.theme=previous.theme;
          if(previous.kind==='reset')data.room.placements=previous.placements;
        }
        data.room.undo=null;
        break;
      }
      default: throw Error('That companion action is unavailable.');
    }
    return data;
  }
  function validate(input, now=Date.now()) {
    if(input===undefined)return empty(now);
    requireValid(plain(input)&&input.version===1&&localDay(input.firstDate));
    const data=empty(now);
    data.firstDate=input.firstDate;
    requireValid(input.birthday===null||plain(input.birthday)&&Number.isInteger(input.birthday.month)&&Number.isInteger(input.birthday.day)&&localDay(annualDate(2024,input.birthday.month,input.birthday.day)));
    data.birthday=input.birthday?{month:input.birthday.month,day:input.birthday.day}:null;
    requireValid(input.lastSeenAt===null||safeTime(input.lastSeenAt));
    requireValid(input.returnFrom===null||localDay(input.returnFrom)&&input.lastSeenAt!==null&&input.returnFrom<dateKey(input.lastSeenAt));
    data.lastSeenAt=input.lastSeenAt;data.returnFrom=input.returnFrom;
    requireValid(Array.isArray(input.results)&&Array.isArray(input.discoveries)&&Array.isArray(input.xpReceipts));
    const results=new Set(),discoveries=new Set(),receipts=new Set(),daily=new Map();
    data.results=input.results.map(record=>{
      requireValid(plain(record)&&safeId(record.id)&&!results.has(record.id)&&safeTime(record.at)&&GAME_IDS.includes(record.game)&&Object.hasOwn(RESULTS[record.game],record.outcome)&&Array.isArray(record.detail));
      const [a,b]=record.detail;
      const bounded=(n,low,high)=>Number.isInteger(n)&&n>=low&&n<=high;
      const detailLength=record.detail.length;
      const resultValid={
        'paw-pairs':()=>detailLength===2&&bounded(a,0,12)&&bounded(b,0,12)&&[6,8,12].includes(a+b)&&record.outcome===(a>b?'win':a===b?'tie':'loss'),
        'cozy-clues':()=>detailLength===1&&bounded(a,0,5)&&record.outcome===(a>=4?'win':a===3?'tie':'loss'),
        'lantern-paths':()=>detailLength===1&&bounded(a,1,12),
        'pocket-pong':()=>detailLength===2&&bounded(a,0,3)&&bounded(b,0,3)&&(record.outcome==='win'?a===3&&b<3:b===3&&a<3),
        'three-paws':()=>detailLength===1&&(record.outcome==='tie'?a===9:record.outcome==='win'?[5,7,9].includes(a):[6,8].includes(a))
      };
      requireValid(resultValid[record.game]());
      results.add(record.id);
      return {id:record.id,game:record.game,outcome:record.outcome,at:record.at,detail:[...record.detail]};
    });
    data.discoveries=input.discoveries.map(item=>{
      requireValid(plain(item)&&safeId(item.id)&&!discoveries.has(item.id)&&safeTime(item.at)&&typeof item.title==='string'&&item.title.length<=100&&typeof item.line==='string'&&item.line.length<=400);
      const scene=SCENES.find(([id])=>id===item.id);
      const gift=GIFT_LIST.find(([id])=>'gift-'+id===item.id);
      const occasion=Object.keys(OCCASIONS).find(type=>new RegExp('^'+type+'-\\d{4}$').test(item.id));
      let kind, decor;
      if(scene){kind='story';decor=scene[5];}
      else if(gift){kind='gift';decor=gift[4];}
      else if(occasion){kind='occasion';decor=OCCASIONS[occasion][2];}
      else if(item.id==='first-lantern'){kind='game';decor='lantern-keepsake';requireValid(data.results.some(r=>r.game==='lantern-paths'&&r.outcome==='win'));}
      else if(Object.values(MILESTONES).some(([id])=>item.id===id)){
        const gameId=GAME_IDS.find(id=>MILESTONES[id][0]===item.id);
        requireValid(data.results.some(r=>r.game===gameId));
        kind='game';decor=null;
      }
      else if(item.id.startsWith('return-')&&localDay(item.id.slice(7))){kind='return';decor=null;}
      else if(item.id.startsWith('remember-')&&results.has(item.id.slice(9))){kind='callback';decor=null;}
      requireValid(kind===item.kind&&decor===item.decor);
      discoveries.add(item.id);
      return {id:item.id,kind,title:item.title,line:item.line,decor,at:item.at};
    });
    let countTalk=0,latest=null;
    data.xpReceipts=input.xpReceipts.map(receipt=>{
      requireValid(plain(receipt)&&['talk','focus','game','scene','gift'].includes(receipt.reason)&&safeId(receipt.id)&&localDay(receipt.day)&&Number.isInteger(receipt.amount));
      const receiptKey=receipt.reason+':'+receipt.id;
      requireValid(!receipts.has(receiptKey));
      receipts.add(receiptKey);
      if(receipt.reason==='scene'||receipt.reason==='gift'){
        const discovery=data.discoveries.find(item=>item.id===receipt.id);
        requireValid(discovery?.kind===(receipt.reason==='scene'?'story':'gift')&&receipt.amount===(receipt.reason==='scene'?5:2));
      }else if(receipt.reason==='talk')requireValid(++countTalk<=3&&receipt.amount===2);
      else{
        const spent=daily.get(receipt.day)??0,nominal=receipt.reason==='focus'?2:3;
        if(receipt.reason==='game')requireValid(results.has(receipt.id));
        const expected=latest&&receipt.day<latest?0:Math.min(nominal,DAILY_XP_LIMIT-spent);
        requireValid(receipt.amount===expected);
        daily.set(receipt.day,spent+receipt.amount);
        if(!latest||receipt.day>latest)latest=receipt.day;
      }
      data.xp+=receipt.amount;
      return {reason:receipt.reason,id:receipt.id,day:receipt.day,amount:receipt.amount};
    });
    requireValid(input.xp===data.xp&&input.latestXpDay===latest);
    requireValid(data.results.every(record=>receipts.has('game:'+record.id)));
    requireValid(data.discoveries.every(item=>!['story','gift'].includes(item.kind)||receipts.has((item.kind==='story'?'scene':'gift')+':'+item.id)));
    data.latestXpDay=latest;
    const roundIds=new Set();
    requireValid(plain(input.rounds));
    for(const [gameId,round] of Object.entries(input.rounds)){
      const index=GAME_IDS.indexOf(gameId);
      requireValid(index>=0&&plain(round)&&round.game===gameId&&safeId(round.id)&&!roundIds.has(round.id)&&MODES[index].includes(round.mode)&&typeof round.practice==='boolean'&&safeTime(round.startedAt)&&(round.finishedAt===null||safeTime(round.finishedAt))&&Array.isArray(round.moves)&&round.moves.length<=1000);
      requireValid(unlockedGames(data).includes(gameId)&&!(round.mode==='woods'&&level(data)<7));
      roundIds.add(round.id);
      const moves=round.moves.map(move=>{
        requireValid(plain(move));
        return gameMove(gameId,move);
      });
      const variant=gameVariant(gameId,round.variant);
      const restored={game:gameId,id:round.id,mode:round.mode,...(variant?{variant}:{}),practice:round.practice,startedAt:round.startedAt,finishedAt:round.finishedAt,moves};
      const model=game(restored), saved=data.results.find(record=>record.id===round.id);
      requireValid(!!model.outcome===(round.finishedAt!==null));
      if(!model.outcome||round.practice)requireValid(!saved);
      else{
        const expected=gameDetail(gameId,model);
        requireValid(saved&&saved.game===gameId&&saved.outcome===model.outcome&&saved.at===round.finishedAt&&JSON.stringify(saved.detail)===JSON.stringify(expected));
      }
      data.rounds[gameId]=restored;
    }
    for(const list of ['favorites','hidden']){
      requireValid(Array.isArray(input[list])&&new Set(input[list]).size===input[list].length&&input[list].every(id=>discoveries.has(id)));
      data[list]=[...input[list]];
    }
    requireValid(plain(input.room));
    const allowed=decorIds(data);
    const validateTheme=theme=>{requireValid(['daylight','twilight','reading'].includes(theme));return theme;};
    const normalizedPosition=(id,position)=>{
      requireValid(allowed.includes(id));
      const value=placement(id,position);
      requireValid(value.x===position.x&&value.y===position.y);
      return value;
    };
    const validatePlacements=positions=>{
      requireValid(plain(positions));
      return Object.fromEntries(Object.entries(positions).map(([id,position])=>[id,normalizedPosition(id,position)]));
    };
    data.room={theme:validateTheme(input.room.theme),placements:validatePlacements(input.room.placements),undo:null};
    const undo=input.room.undo;
    requireValid(undo===null||plain(undo)&&['move','theme','reset'].includes(undo.kind));
    if(undo?.kind==='move'){
      requireValid(allowed.includes(undo.id));
      data.room.undo={kind:'move',id:undo.id,position:undo.position===null?null:normalizedPosition(undo.id,undo.position)};
    }
    if(undo?.kind==='theme')data.room.undo={kind:'theme',theme:validateTheme(undo.theme)};
    if(undo?.kind==='reset')data.room.undo={kind:'reset',theme:validateTheme(undo.theme),placements:validatePlacements(undo.placements)};
    return data;
  }
  return Object.freeze({empty,level,unlockedGames,award,reduce,validate,game,resumableGame,resultLine,discoveriesAvailable,decorIds,placement,bounds:placementBounds,
    thresholds:Object.freeze([...LEVELS]),games:Object.freeze([...GAME_IDS]),modes:Object.freeze(MODES.map(values=>Object.freeze([...values]))),
    gameLevels:Object.freeze([...GAME_LEVELS]),layouts:Object.freeze(Object.keys(LAYOUTS)),cluePacks:Object.freeze(Object.keys(CLUE_PACKS)),
    gifts:Object.freeze(GIFT_LIST.map(([id,name,level,,decor])=>Object.freeze({id,name,level,decor}))),decor:Object.freeze(DECOR),dateKey});
});
