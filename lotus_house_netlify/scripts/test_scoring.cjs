const fs=require('fs'),vm=require('vm'),assert=require('assert');
const s=fs.readFileSync(__dirname+'/../public/app.js','utf8');
const code=s.slice(s.indexOf('function demoCalc(){'),s.indexOf('async function api('));
const ids=['jack','violette','isla','milo','cassandra','clara','finn'];
const names=Object.fromEntries(ids.map(x=>[x,x]));
for(const [votes,expect] of [[0,7],[1,7],[2,5],[3,3],[4,1],[6,1]]){
 const people=Object.fromEntries(ids.map(id=>[id,{id,accused:null}]));
 ids.filter(x=>x!=='jack').slice(0,votes).forEach(id=>{people[id].accused='jack'});
 const demo={people,game:{killer:'jack',clean:true,judgements:ids.map(id=>({id,motive_ok:true,clue_ok:true,primary_ok:true,bonus_ok:true}))}};
 const context={demo,names};vm.createContext(context);vm.runInContext(code+'; globalThis.output=demoCalc();',context);
 const killer=context.output.results.find(r=>r.killer);
 assert.equal(killer.points.survive,expect);
 assert.equal(killer.total,expect+5);
 const successful=context.output.results.find(r=>r.id==='violette');
 if(votes>0)assert.equal(successful.total,12);
 console.log(`Votes against murderer: ${votes} -> survival ${expect}; murderer total ${killer.total}`);
}
console.log('SCORING TESTS PASS');
