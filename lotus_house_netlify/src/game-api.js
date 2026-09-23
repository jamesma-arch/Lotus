const PEOPLE=[
 ['jack','Jack Mercer'],['violette','Violette de Vere'],['isla','Isla McCrae'],
 ['milo','Milo Finch'],['cassandra','Dr Cassandra Ward'],['clara','Clara Fenwick'],
 ['finn','Finn O’Callaghan']
];
const IDS=PEOPLE.map(p=>p[0]);
const headers={'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const respond=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers});
const fail=(message,status=400)=>respond({error:message},status);
const clean=(text,limit=1200)=>typeof text==='string'?text.trim().slice(0,limit):'';
const bool=x=>x===true?1:0;
const digest=async (value)=>{let bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');};
const secretPin=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>String(n%10)).join('');
const dbGet=async(db,sql,...args)=>db.prepare(sql).bind(...args).first();
const dbAll=async(db,sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
async function authenticate(request, env){
 const id=request.headers.get('x-guest-id'), pin=request.headers.get('x-guest-pin');
 if(!IDS.includes(id)||!/^\d{8}$/.test(pin||''))return null;
 const record=await dbGet(env.DB,'SELECT * FROM guests WHERE id=?',id);
 if(!record)return null;
 const h=await digest(`${env.PIN_PEPPER||'LOTUS-DEV-ONLY'}:${id}:${pin}`);
 return h===record.pin_hash?record:null;
}
async function status(env,guest){
 const game=await dbGet(env.DB,'SELECT * FROM game WHERE id=1');
 if(!game)return {initialised:false};
 const rows=await dbAll(env.DB,'SELECT id,submitted FROM guests');
 const n=rows.filter(r=>r.submitted).length;
 let out={initialised:true,phase:game.phase,submissions:n,total:7,allSubmitted:n===7,hasMurderer:!!game.killer_id,judged:!!game.judged,ready:n===7&&!!game.killer_id&&!!game.judged};
 if(guest){out.you=guest.id;out.submitted=!!guest.submitted;out.killerPanel=game.killer_id===guest.id;out.claimPossible=!game.killer_id&&guest.id!=='jack';out.yourSubmission=guest.submitted?null:{accused:guest.accused||'',motive:guest.motive||'',clue:guest.clue||'',primary:!!guest.primary_done,bonus:!!guest.bonus_done};}
 if(game.phase==='revealed') out.results=await scores(env,game);
 return out;
}
async function scores(env,game){
 const people=await dbAll(env.DB,'SELECT * FROM guests');
 const jury=await dbAll(env.DB,'SELECT * FROM judgements');
 const judgement=Object.fromEntries(jury.map(r=>[r.id,r]));
 const count=people.filter(p=>p.id!==game.killer_id&&p.accused===game.killer_id).length;
 const survival=count<=1?7:count===2?5:count===3?3:1;
 let results=people.map(p=>{
  const killer=p.id===game.killer_id;
  const j=judgement[p.id]||{};
  const primary=j.primary_ok?2:0,bonus=j.bonus_ok?1:0;
  const named=!killer&&p.accused===game.killer_id?5:0;
  const motive=!killer&&j.motive_ok?2:0,clue=!killer&&j.clue_ok?2:0;
  const survive=killer?survival:0, clean=killer&&game.clean_clue?2:0;
  return {id:p.id,name:PEOPLE.find(x=>x[0]===p.id)[1],killer,accused:p.accused,points:{named,motive,clue,survive,clean,primary,bonus},total:named+motive+clue+survive+clean+primary+bonus};
 });
 results.sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
 let previous=null;results.forEach((r,i)=>{r.place=r.total===previous?results[i-1].place:i+1;previous=r.total;});
 return {killer:game.killer_id,accusationsAgainstKiller:count,results};
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
 if(request.method==='OPTIONS')return new Response('',{status:204,headers});
 try{
  if(url.pathname==='/api/bootstrap'&&request.method==='POST'){
   const admin=request.headers.get('x-setup-secret');
   if(!env.SETUP_SECRET||admin!==env.SETUP_SECRET)return fail('Setup secret required.',403);
   if(await dbGet(env.DB,'SELECT id FROM game WHERE id=1'))return fail('Game already initialised. Setup cannot run again.',409);
   if(!env.PIN_PEPPER||env.PIN_PEPPER.length<16)return fail('Configure PIN_PEPPER secret (at least 16 characters) first.',503);
   const pins=PEOPLE.map(([id,name])=>({id,name,pin:secretPin()}));
   const statements=[env.DB.prepare("INSERT INTO game(id,phase) VALUES(1,'open')")];
   for(const p of pins){let hash=await digest(`${env.PIN_PEPPER}:${p.id}:${p.pin}`);statements.push(env.DB.prepare('INSERT INTO guests(id,pin_hash) VALUES(?,?)').bind(p.id,hash));}
   await env.DB.batch(statements);
   return respond({message:'Store this response privately. Share only each player’s own PIN.',pins});
  }
  if(url.pathname==='/api/health')return respond({ok:true,...await status(env,null)});
  const guest=await authenticate(request,env);
  if(!guest)return fail('Character or access PIN not recognised.',401);
  if(url.pathname==='/api/me'&&request.method==='GET')return respond(await status(env,guest));
  const game=await dbGet(env.DB,'SELECT * FROM game WHERE id=1');
  if(!game)return fail('Game not initialised.',503);
  let body={}; if(request.method==='POST'){
    try{body=await request.json();}catch{return fail('Invalid JSON.');}
  }
  if(url.pathname==='/api/submit'&&request.method==='POST'){
   if(game.phase!=='open')return fail('Accusations are locked.',409);
   if(guest.submitted)return fail('You already submitted your final accusation.',409);
   if(!IDS.includes(body.accused)||body.accused===guest.id)return fail('Choose a different guest to accuse.');
   if(!clean(body.motive)||!clean(body.clue))return fail('Please enter a motive and explain the evidence.');
   await env.DB.prepare('UPDATE guests SET accused=?,motive=?,clue=?,primary_done=?,bonus_done=?,submitted=1 WHERE id=? AND submitted=0').bind(body.accused,clean(body.motive),clean(body.clue),bool(body.primary),bool(body.bonus),guest.id).run();
   return respond({ok:true,...await status(env,{...guest,submitted:1})});
  }
  if(url.pathname==='/api/claim'&&request.method==='POST'){
   if(guest.id==='jack')return fail('Jack was confirmed innocent and cannot claim this role.',403);
   if(game.phase!=='open')return fail('The game is no longer open.',409);
   const r=await env.DB.prepare('UPDATE game SET killer_id=? WHERE id=1 AND killer_id IS NULL').bind(guest.id).run();
   if(r.meta.changes!==1)return fail('A murderer role has already been confirmed. Contact the group if this is an error.',409);
   return respond({ok:true});
  }
  if(url.pathname==='/api/judging'&&request.method==='GET'){
   if(game.killer_id!==guest.id)return fail('Only the murderer can access this page.',403);
   const people=await dbAll(env.DB,'SELECT id,accused,motive,clue,primary_done,bonus_done,submitted FROM guests');
   const judgements=await dbAll(env.DB,'SELECT * FROM judgements');
   return respond({locked:people.every(p=>p.submitted===1),judged:!!game.judged,clean:!!game.clean_clue,submissions:people,judgements});
  }
  if(url.pathname==='/api/judging'&&request.method==='POST'){
   if(game.killer_id!==guest.id)return fail('Only the murderer may validate the scores.',403);
   if(game.phase!=='open'||game.judged)return fail('Scoring is closed.',409);
   const all=await dbAll(env.DB,'SELECT id,submitted FROM guests');
   if(all.length!==7||!all.every(p=>p.submitted))return fail('Wait for all seven accusations to be submitted.',409);
   if(!Array.isArray(body.judgements)||body.judgements.length!==7||new Set(body.judgements.map(j=>j.id)).size!==7||body.judgements.some(j=>!IDS.includes(j.id)))return fail('Provide one score validation for all seven guests.');
   const batch=body.judgements.map(j=>env.DB.prepare('INSERT INTO judgements(id,motive_ok,clue_ok,primary_ok,bonus_ok) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET motive_ok=excluded.motive_ok,clue_ok=excluded.clue_ok,primary_ok=excluded.primary_ok,bonus_ok=excluded.bonus_ok').bind(j.id,bool(j.motive_ok&&j.id!==guest.id),bool(j.clue_ok&&j.id!==guest.id),bool(j.primary_ok),bool(j.bonus_ok)));
   batch.push(env.DB.prepare('UPDATE game SET clean_clue=?,judged=1 WHERE id=1 AND judged=0').bind(bool(body.clean)));
   await env.DB.batch(batch);
   return respond({ok:true});
  }
  if(url.pathname==='/api/reveal'&&request.method==='POST'){
   const all=await dbAll(env.DB,'SELECT id,submitted FROM guests');
   if(all.length!==7||!all.every(p=>p.submitted)||!game.killer_id||!game.judged)return fail('Reveal is not ready yet: all seven submissions and the murderer’s scoring are required.',409);
   await env.DB.prepare("UPDATE game SET phase='revealed',revealed_at=datetime('now') WHERE id=1 AND judged=1 AND phase='open'").run();
   return respond(await status(env,guest));
  }
  return fail('Unknown endpoint.',404);
 }catch(e){console.error('Lotus error',e);return fail('The server could not complete that request. Please retry.',500);}
}};
