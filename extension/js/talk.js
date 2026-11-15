/* Purrple's handwritten English prompt library. Fixed local words, no model. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PurrpleTalk=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const rows=[
 ['hello','Hello, Purrple!','blink','Hello! I brought my whole tiny self.','There you are. I saved you a spot beside me.','Hi, lovely human. The ears are listening.'],
 ['good-morning','Good morning','stretch','Morning! One stretch, then we can consider being awake.','Good morning. I have inspected today. It needs a cat.','Morning, you. Shall we start gently?'],
 ['good-afternoon','Good afternoon','blink','Afternoon check-in: still fluffy, still here.','Hello again. The day is allowed to have a fresh middle.','Good afternoon. I kept this little corner warm.'],
 ['good-evening','Good evening','idle','Evening already? Come settle beside me for a moment.','Hello, evening human. We can lower our shoulders now.','Good evening. Tiny paws, quieter plans.'],
 ['good-night','Good night','sleep','Good night. Let tomorrow have tomorrow for a bit.','Sleep well, you. I will practice my professional napping.','Night-night. Your pillow has been waiting very patiently.'],
 ['welcome-back','I’m back','celebrate','You are! My extremely small welcome committee is ready.','Welcome back. I kept being a cat while you were gone.','There you are. One tiny forehead bump for the returning human.'],
 ['missed-you','I missed you','heart','Then we should have a little reunion. Forehead bumps first.','I have a very small head available for affectionate bonking.','Come sit close to my little corner. The purring is on.'],
 ['how-are-you','How are you?','tilt','Fluffy, mildly nosy, and available for company.','Quite well. My paws remain excellent.','Considering a nap, but I can fit you into the schedule.'],
 ['what-doing','What are you doing?','think','Supervising this patch of screen. It is demanding work.','Organising my thoughts. One has escaped under the sofa.','Holding a very important meeting with my tail.'],
 ['say-hi','Just saying hi','blink','Hi back. No task required for a little hello.','An excellent reason to stop by. Hello, you.','Then I am waving one very tiny paw.'],

 ['keep-company','Keep me company','idle','Of course. We can simply sit here together.','I will take this little spot beside your work.','Company, coming right up. It fits neatly into one small cat.'],
 ['sit-with-me','Sit with me','pat','Gladly. I have brought absolutely no agenda.','Settling in. You do not have to say anything clever.','One tiny seatmate, reporting for duty.'],
 ['quiet-company','Can we be quiet?','sleep','Yes. I can be a very quiet little presence.','We can leave the words alone for a bit.','Quiet company it is. Soft paws only.'],
 ['stay-near','Stay near me','heart','I can keep you company right here in the browser.','I will settle in this corner. You do your human things.','Right here, with my paws tucked and my ears available.'],
 ['working-alone','I’m working alone','study','Then I will open my tiny notebook beside yours.','We can begin together. I will handle the little pencil.','A small study companion has entered the room.'],
 ['boring-task','This task is boring','think','We could give it five minutes, then reconsider with dignity.','A boring task may still deserve a very small first step.','I would offer to do it, but the keyboard is mostly larger than me.'],
 ['one-minute','Can I have a minute?','idle','Take your minute. It does not need to prove anything.','Of course. I will spend it being reassuringly small.','A quiet minute, reserved just for you.'],
 ['not-alone','Remind me I have company','heart','There is a little lavender cat in your corner. Hello.','You have company here, and you can reach out to your people too.','I am here for a tiny pause beside your day.'],
 ['little-chat','Let’s have a little chat','tilt','You choose the next little thought. I will bring the ears.','A little chat sounds lovely. Which thought shall we pick?','Yes please. My nap can wait for a moment.'],
 ['just-existing','I’m just existing today','idle','Existing counts as being here. We can keep it gentle.','No grand performance needed. A small day can still be yours.','Then we shall form a very relaxed committee of two.'],

 ['start-study','Let’s start studying','study','Notebook open. Pick one thing; we can start there.','I am ready. What is the smallest useful first step?','Tiny pencil prepared. Your first few minutes can be simple.'],
 ['hard-start','Starting feels hard','think','Try making the first step almost comically small. I approve of small.','Could you just open the page? That is a real beginning.','We do not need the whole task yet. Only the first little piece.'],
 ['five-minutes','Just five minutes?','study','Five minutes sounds like a perfectly respectable beginning.','Yes. A small start still gets its own little nod.','Five minutes, one thing, and a cat beside you.'],
 ['focus-please','Help me focus','study','Choose one task, put the others aside, and start a short session with me.','One thing at a time. My tiny notebook only has room for one.','Shall we park the wandering thought and return to this page?'],
 ['distracted','I got distracted','blink','Welcome back. Returning is part of the work too.','The thought wandered off. We can gently fetch it.','No scolding from this cat. What were you doing before the detour?'],
 ['overwhelmed-work','There’s too much to do','think','Let us choose what needs attention first, then one small step.','You can put the list somewhere safe instead of holding all of it at once.','A large list is not a command to do everything this minute.'],
 ['explain-cat','Can I explain it to you?','think','Please do. Teaching a tiny cat is excellent practice.','I have prepared my most thoughtful face. Start wherever makes sense.','Go ahead. If it needs simpler words, I support simpler words.'],
 ['difficult-page','I don’t understand this page','read','Maybe take one paragraph and put it into your own words first.','You can mark the confusing part and find a clearer explanation.','One question at a time. Even my little book has margins.'],
 ['nearly-done','I’m nearly done','celebrate','Look at that. One final little stretch of the path.','Nearly there. Check the last details, then let yourself finish.','I have restrained my celebration until you say the word. Mostly.'],
 ['done-studying','I finished studying','celebrate','Notebook closed! You made room for a real bit of work.','Well done. A drink or a stretch might be a nice next chapter.','That deserves a little celebration from the notebook department.'],

 ['take-break','Should we take a break?','stretch','A short break sounds good. Let your eyes visit something farther away.','Yes. We can put the pencil down and stretch a little.','Break committee says: a small pause is welcome.'],
 ['drink-water','Remind me about water','reminder','If you would like a drink, this is your little nudge.','Water check. Your glass may appreciate a visit.','A small sip break? I will supervise the cup.'],
 ['stretch-time','Time to stretch','stretch','Front paws out. Human shoulders may wish to join in.','A gentle stretch, according to your own comfortable range.','I will demonstrate a very dramatic cat version. Yours can be simpler.'],
 ['rest-eyes','My eyes need a break','blink','Let them rest on something away from the screen for a little while.','The page can wait while your eyes look elsewhere.','We can pause here. Your eyes have done plenty of reading.'],
 ['tired','I’m tired','yawn','Then we can make the next thing smaller, or choose rest.','Tired is useful information. You are allowed to listen to it.','Come settle for a moment. Even my tiny paws take breaks.'],
 ['sleepy','I’m sleepy','sleep','The nap department would like to be consulted.','Maybe it is time to save your work and consider proper rest.','Sleepy human, sleepy cat. A remarkably persuasive combination.'],
 ['slow-day','I need a slow day','idle','We can keep the plans light and leave space between them.','A slower pace still belongs to you.','Soft paws today. We do not have to rush every little thing.'],
 ['back-break','I’m back from my break','blink','Welcome back. Shall we choose the next little piece?','Refreshed ears, refreshed human. A promising arrangement.','There you are. The notebook has not run away.'],
 ['stop-tonight','I should stop for tonight','sleep','Save your place. Tomorrow can meet you there.','A stopping point is useful too. Close the notebook gently.','I support handing the evening back to yourself.'],
 ['no-rush','Tell me not to rush','pat','You can move carefully. Everything does not need your fastest pace.','One breath, one step. We have no tiny cat race to win.','Let us do the next thing at a pace you can actually keep.'],

 ['rough-day','I had a rough day','pat','That sounds like a lot. We can take a soft little pause here.','I am sorry it was rough. You do not have to turn this moment into a task.','A gentle forehead bump, if you want one.'],
 ['frustrated','I’m frustrated','think','It may help to step back before trying the same thing again.','That feeling is allowed. We can give it a little room.','You can be frustrated and still choose a kind next step for yourself.'],
 ['nervous','I’m nervous','pat','A small breath and one next step may be enough for this moment.','We can slow down. You do not need to solve every possibility right now.','The tiny cat vote is for a gentler pace and a little support.'],
 ['sad','I feel sad','heart','I am sorry. A quiet pause and some kindness may be welcome.','We can sit with the feeling for a moment. No performance needed.','A little comfort here; reaching out to someone you trust can help too.'],
 ['lonely','I feel lonely','heart','I can offer a little company here. Is there someone you would like to message too?','A tiny hello from this corner. Your people may be glad to hear from you.','Lonely can feel heavy. You deserve real company and gentle moments.'],
 ['bad-mistake','I made a mistake','pat','A mistake can be something to repair, without being a verdict on you.','Let us find what can be fixed first. The scolding can retire.','You are still allowed to be kind to yourself while learning.'],
 ['not-perfect','It isn’t perfect','tilt','Does it need to be perfect, or does it need one useful revision?','A finished useful thing can have little imperfections. So can cats.','We can improve the part that matters most and leave room to breathe.'],
 ['need-kindness','Say something kind','heart','You deserve a little patience, including from yourself.','You do not need a productive day to deserve care.','There is room for you here, even on the untidy days.'],
 ['try-again','Can I try again?','blink','Yes. A fresh attempt does not require a perfect previous one.','You can begin again from what you know now.','The little notebook has another page ready.'],
 ['need-hug','A little hug?','heart','One very small, very soft imaginary cat hug.','Tiny paws around your finger. That is my available hug size.','A heart hug from this lavender corner, coming right up.'],

 ['finished-task','I finished a task!','celebrate','You did! A little happy hop is clearly required.','One task finished. Please imagine extremely enthusiastic tiny applause.','That is a real little win. Let us give it its moment.'],
 ['small-win','It was only a small thing','celebrate','Small things are my specialty. They absolutely count.','A small thing done is still something you no longer have to carry.','Only small? I am personally quite small and have excellent value.'],
 ['proud-me','Are you proud of me?','heart','I am offering my most approving little forehead bump.','You gave it your attention. That is worth noticing.','The tiny applause department has opened especially for you.'],
 ['made-progress','I made some progress','celebrate','Some progress is movement. We can mark that kindly.','Look at the part that is different now. You did that bit.','A little farther along, with a little cat cheering beside you.'],
 ['kept-going','I kept going','pat','You stayed with it. Now check whether you need a pause too.','That took effort. Let us acknowledge it without demanding more immediately.','A determined human and a tiny companion make a good team.'],
 ['good-enough','I think it’s good enough','blink','Then you can let it be finished. That is a skill too.','Good enough for its purpose sounds like a useful place to stop.','The little cat inspector approves of sensible finishing points.'],
 ['celebrate-me','Celebrate with me','celebrate','Happy hop! The paws are very committed to this celebration.','Celebration requested, tiny enthusiasm supplied.','Please allow one small cat to make a pleasantly large fuss.'],
 ['new-outfit','Look at your new outfit','tilt','I am attempting to admire it without falling over.','Excellent choice. I feel exceptionally accessorised.','This is a very serious little fashion moment.'],
 ['saved-coins','I saved some coins','reminder','A little wardrobe fund, built one useful step at a time.','You can save them for something you really like. No rush.','The tiny shopkeeper respects a thoughtful shopper.'],
 ['showed-up','I showed up today','heart','You did. Some days, that is the important part.','Here you are. We can begin from exactly this much.','I have noticed your arrival and prepared a very small welcome.'],

 ['play','Let’s play','toy','The tiny paws have been waiting for this announcement.','Yes! I will pretend to be an extremely fearsome hunter.','A little play break sounds excellent. Where is the yarn?'],
 ['pet-you','May I pet you?','pat','You may. The little forehead is available.','Right between the ears, please. I have professional standards.','Yes please. I shall try to remain dignified about it.'],
 ['brush-you','Time for a brush?','brush','The fluff is ready for a little attention.','Yes please. I intend to become impressively tidy.','Brush department open. Gentle around my finest ears.'],
 ['yarn','Where is your yarn?','toy','Somewhere suspicious. I must investigate with all four paws.','I was guarding it. The guarding may have included a nap.','The yarn and I have an ongoing professional disagreement.'],
 ['tiny-dance','Do a little dance','celebrate','A small bounce counts as dancing in my jurisdiction.','I have two left paws, but plenty of enthusiasm.','Tiny dance incoming. Please keep your applause reasonably enormous.'],
 ['boop','Boop!','blink','Boop received. Nose functioning as intended.','A bold move. I counter with one tiny forehead bump.','You have activated the little nose department.'],
 ['cute','You’re so cute','pat','Oh. My ears are attempting to blush.','Thank you. I practiced by being extremely small.','I shall accept this with almost no unnecessary smugness.'],
 ['silly','Be a little silly','tilt','I have declared this cursor a suspicious household insect.','My thoughts are in a neat row. One is sitting in a box.','I was going to be sensible, but my tail objected.'],
 ['joke','Tell me a cat joke','think','I tried to organise my thoughts. They knocked a glass off the table.','My to-do list said “be a cat.” Finally, a task matched to my qualifications.','I scheduled a meeting with my tail. It went round in circles.'],
 ['meow','Meow?','blink','Mrrp. A thoughtful contribution.','Meow, with a small upward question mark.','Prrp. I believe we have reached an understanding.'],

 ['your-name','Why Purrple?','tilt','Purple fur, a little purr, and an excellent name chosen for me.','It is purple with extra purring built in. Efficient naming.','I think the name suits my very lavender little situation.'],
 ['your-job','What is your job?','study','Company, little reminders, and accepting a frankly impressive number of pats.','I accompany your browser day and take my tiny notebook rather seriously.','Keeping you company while you do your human things. The paws help with morale.'],
 ['favorite-color','Your favorite color?','heart','Purple. A remarkable coincidence, considering my entire appearance.','Lavender, with a little plum on the side.','A soft purple corner seems like a very good place to be.'],
 ['favorite-hobby','What are your hobbies?','toy','Yarn inspection, strategic napping, and watching you choose a task.','Paw maintenance and extremely small adventures.','Being brushed, reading little books, and pretending the yarn started it.'],
 ['tiny-paws','Your paws are tiny','pat','Thank you for noticing my finest compact equipment.','Small paws. Very large confidence.','They were made this size so the little socks would fit.'],
 ['ears','Tell me about your ears','ear','Two excellent little listening triangles.','They can hear the word “break” from a respectable distance.','One ear handles serious matters. The other mostly supervises yarn.'],
 ['nap-expert','Are you a nap expert?','sleep','I have trained extensively. Sometimes twice in the same afternoon.','The nap department recognises my considerable experience.','I prefer “professional rest consultant,” but yes.'],
 ['supervisor','Are you supervising me?','think','Gently. I am mostly here to look encouraging beside the notebook.','Only this very small corner. Your choices remain yours.','I have a clipboard in spirit and absolutely no authority over your day.'],
 ['thank-you','Thank you, Purrple','heart','You are very welcome. One soft little head bonk.','Anytime. I am glad to add a little company to your day.','Prrr. I will file that under extremely nice things.'],
 ['see-you','See you later','blink','See you later. Save your place before you go.','I will keep practicing my sitting. Travel safely through your day.','Until the next little hello. Take good care of yourself.'],

 ['love-you','I love you!','heart','I love you too. Tiny forehead bump, enormous purr.','Prrr. Sending all my little-cat affection straight back.','Oh, now you have done it. The paws are requesting a cuddle.'],
 ['forehead-kiss','A kiss on your forehead','pat','Mrrp. Forehead kissed, dignity pleasantly compromised.','I shall hold very still for this important affection.','A tiny head bonk in return. Please mind the ears.'],
 ['hug-me','Hug me, Purrple','heart','Come here. One small lavender hug, with the paws tucked gently around you.','A soft imaginary cat hug. Stay a moment if you like.','My hug is pocket-sized, but I am putting my whole fluffy self into it.'],
 ['cuddle-time','Can we cuddle?','heart','Yes please. I have cleared a space in my very demanding nap schedule.','Settling close, paws tucked. The purring will begin shortly.','We can have a soft little cuddle break. No productivity required.'],
 ['missed-your-paws','I missed your little paws','pat','They missed being admired. An excellent reunion for everyone.','All four are here, and one is offering a tiny wave.','Then we should arrange a proper paw-to-finger greeting.'],
 ['love-back','Do you love me back?','heart','You have my very affectionate little-cat vote. Prrr.','Of course, lovely human. Here is one extremely sincere head bonk.','I am leaning my whole tiny head on you. That is a fairly strong yes.'],
 ['cutest-cat','You’re the cutest cat','tilt','A bold statement. I will accept it without consulting the other cats.','My ears have heard this and are becoming slightly too pleased.','Thank you. I shall try not to let it go to my very round head.'],
 ['compliment','You’re doing a good job','celebrate','Thank you. I take being a little companion quite seriously.','Prrr. That is going in my very small collection of lovely things.','One approving human and one delighted kitten. A good little moment.'],
 ['good-girl','Good girl, Purrple','pat','Prrr. My little forehead is now requesting its reward.','Thank you. I will attempt to maintain this excellent reputation.','The ears are pleased. The tail may become a little smug.'],
 ['sorry-throw','Sorry for throwing you','pat','Dignity is recovering. A few head pats may assist the process.','Apology accepted. Let us try a gentler flight next time, yes?','I have shaken off the surprise. A soft little cuddle would be welcome.']
 ];
 const groups=['Greetings','Company','Study','Rest','Feelings','Little wins','Play','About Purrple','Affection'];
 const CATALOG=Object.freeze(rows.map((r,index)=>Object.freeze({id:r[0],category:groups[Math.floor(index/10)],label:r[1],prompt:r[1],variants:Object.freeze(r.slice(3).map(text=>Object.freeze({text,reaction:r[2]})))})));
 const map=Object.assign(Object.create(null),Object.fromEntries(CATALOG.map(p=>[p.id,p])));
 const reactions=new Set(['idle','blink','tilt','pat','heart','celebrate','sleep','stretch','yawn','groom','think','reminder','toy','study','read','ear','brush']);
 const integer=(v,label)=>{if(!Number.isSafeInteger(v)||v<0)throw Error(`Invalid ${label}.`);return v;};
 const empty=()=>({counts:{},recent:[],history:[],favorites:[],last:null,total:0});
 function normalize(input){
  if(input==null)return empty();if(typeof input!=='object'||Array.isArray(input))throw Error('Invalid saved conversation.');
  const out=empty();if(!input.counts||typeof input.counts!=='object'||Array.isArray(input.counts))throw Error('Invalid conversation counters.');
  for(const [key,value]of Object.entries(input.counts)){if(!map[key])throw Error('Unknown conversation prompt.');out.counts[key]=integer(value,'conversation count');}
  for(const key of ['recent','history','favorites'])if(!Array.isArray(input[key]))throw Error('Invalid conversation lists.');
  out.total=integer(input.total??0,'conversation total');
  out.recent=input.recent.slice(-12).map(v=>{if(typeof v!=='string'||v.length>500)throw Error('Invalid recent reply.');return v;});
  out.favorites=[...new Set(input.favorites.map(key=>{if(typeof key!=='string'||!map[key])throw Error('Unknown favourite prompt.');return key;}))];
  const record=r=>{if(!r||typeof r.id!=='string'||r.id.length>120||typeof r.promptId!=='string'||!map[r.promptId]||typeof r.text!=='string'||r.text.length>500||!reactions.has(r.reaction)||!Number.isFinite(r.at)||r.at<0||!map[r.promptId].variants.some(v=>v.text===r.text&&v.reaction===r.reaction))throw Error('Invalid saved reply.');return{id:r.id,promptId:r.promptId,text:r.text,reaction:r.reaction,at:r.at};};
  out.history=input.history.slice(-80).map(record);out.last=input.last==null?null:record(input.last);return out;
 }
 function reply(promptId,input,now=Date.now()){
  const prompt=typeof promptId==='string'?map[promptId]:null;if(!prompt)throw Error('Choose one of Purrple’s conversation prompts.');
  if(!Number.isFinite(now)||now<0)throw Error('The local clock is invalid.');
  const state=normalize(input),count=state.counts[promptId]||0;
  let index=count%prompt.variants.length;
  for(let offset=0;offset<prompt.variants.length;offset++){const candidate=(count+offset)%prompt.variants.length;if(!state.recent.includes(prompt.variants[candidate].text)){index=candidate;break;}}
  if(prompt.variants[index].text===state.last?.text)index=(index+1)%prompt.variants.length;
  const chosen=prompt.variants[index];state.counts[promptId]=count+1;state.total++;
  const record={id:`talk_${state.total}_${Math.floor(now)}`,promptId,text:chosen.text,reaction:chosen.reaction,at:now};
  state.last=record;state.history=[...state.history,record].slice(-80);state.recent=[...state.recent,record.text].slice(-12);return state;
 }
 function favorite(promptId,input,value){if(typeof promptId!=='string'||!map[promptId])throw Error('Unknown conversation prompt.');const state=normalize(input),set=new Set(state.favorites),on=value===undefined?!set.has(promptId):value;if(typeof on!=='boolean')throw Error('Favourite must be on or off.');if(on)set.add(promptId);else set.delete(promptId);state.favorites=[...set];return state;}
 return Object.freeze({CATALOG,categories:Object.freeze(groups),empty,normalize,reply,favorite});
});
