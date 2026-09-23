import pg from 'pg';
import {webcrypto} from 'node:crypto';
import worker from '../../src/game-api.js';
import {postgresDatabase} from '../../src/pg-adapter.js';

if (!globalThis.crypto) globalThis.crypto=webcrypto;
let pool, database, schemaReady;
const schema="CREATE TABLE IF NOT EXISTS game (\n  id INTEGER PRIMARY KEY CHECK (id = 1),\n  phase TEXT NOT NULL DEFAULT 'open',\n  killer_id TEXT DEFAULT NULL,\n  clean_clue INTEGER NOT NULL DEFAULT 0,\n  judged INTEGER NOT NULL DEFAULT 0,\n  revealed_at TIMESTAMPTZ DEFAULT NULL\n);\nCREATE TABLE IF NOT EXISTS guests (\n  id TEXT PRIMARY KEY,\n  pin_hash TEXT NOT NULL,\n  accused TEXT,\n  motive TEXT DEFAULT '',\n  clue TEXT DEFAULT '',\n  primary_done INTEGER NOT NULL DEFAULT 0,\n  bonus_done INTEGER NOT NULL DEFAULT 0,\n  submitted INTEGER NOT NULL DEFAULT 0\n);\nCREATE TABLE IF NOT EXISTS judgements (\n  id TEXT PRIMARY KEY,\n  motive_ok INTEGER NOT NULL DEFAULT 0,\n  clue_ok INTEGER NOT NULL DEFAULT 0,\n  primary_ok INTEGER NOT NULL DEFAULT 0,\n  bonus_ok INTEGER NOT NULL DEFAULT 0\n);\n";
const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
function error(message,status){return new Response(JSON.stringify({error:message}),{status,headers:JSON_HEADERS});}
async function connect(){
  // Set DATABASE_URL under Netlify Environment variables, in Functions scope.
  const url=process.env.DATABASE_URL;
  if(!url) throw new Error('DATABASE_URL is missing. Connect a PostgreSQL database and configure its URL for Functions.');
  if(!pool){
    pool=new pg.Pool({connectionString:url,max:2,connectionTimeoutMillis:8000,idleTimeoutMillis:10000});
    database=postgresDatabase(pool);
  }
  if(!schemaReady){
    schemaReady=pool.query(schema).catch(err=>{schemaReady=null;throw err;});
  }
  await schemaReady;
  return database;
}

export default async function handler(request){
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/')) return error('Unknown API route.',404);
  if(!['GET','POST'].includes(request.method))return error('Method not allowed.',405);
  if(!process.env.PIN_PEPPER || process.env.PIN_PEPPER.length<16 || !process.env.SETUP_SECRET){
    return error('Game configuration incomplete: SETUP_SECRET and PIN_PEPPER are required.',503);
  }
  try{
    const DB=await connect();
    const response=await worker.fetch(request,{DB,SETUP_SECRET:process.env.SETUP_SECRET,PIN_PEPPER:process.env.PIN_PEPPER});
    return response;
  }catch(err){
    console.error('Lotus House Netlify API failure',err);
    return error('Unable to reach the shared game database. Check the Netlify environment and database connection.',503);
  }
}
