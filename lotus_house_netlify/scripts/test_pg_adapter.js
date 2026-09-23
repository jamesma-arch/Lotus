import {test} from 'node:test';
import assert from 'node:assert/strict';
import {postgresDatabase} from '../src/pg-adapter.js';

test('placeholder conversion, query results and changes',async()=>{
 const calls=[];
 const mock={query:async(sql,args)=>{calls.push([sql,args]);return {rows:[{id:'jack'}],rowCount:1};}};
 const db=postgresDatabase(mock);
 assert.deepEqual(await db.prepare('SELECT * FROM guests WHERE id=?').bind('jack').first(),{id:'jack'});
 assert.equal(calls[0][0],'SELECT * FROM guests WHERE id=$1');
 assert.deepEqual(calls[0][1],['jack']);
 assert.deepEqual((await db.prepare('SELECT * FROM guests').all()).results,[{id:'jack'}]);
 assert.equal((await db.prepare("UPDATE game SET revealed_at=datetime('now') WHERE id=?").bind(1).run()).meta.changes,1);
 assert.match(calls.at(-1)[0],/NOW\(\)/);
});
test('transaction rollback on failed batch',async()=>{
 const calls=[];
 const client={query:async(sql,args)=>{calls.push(sql);if(sql==='FAIL')throw Error('fail');return {rows:[],rowCount:1};},release:()=>calls.push('RELEASE')};
 const db=postgresDatabase({connect:async()=>client,query:client.query});
 await assert.rejects(db.batch([db.prepare('INSERT INTO guests VALUES(?)').bind('jack'),db.prepare('FAIL')]),/fail/);
 assert.deepEqual(calls,['BEGIN','INSERT INTO guests VALUES($1)','FAIL','ROLLBACK','RELEASE']);
});
