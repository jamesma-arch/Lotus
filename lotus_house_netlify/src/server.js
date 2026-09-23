import http from 'node:http';
import {readFile,access} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {webcrypto} from 'node:crypto';
import pg from 'pg';
import worker from './game-api.js';
import {postgresDatabase} from './pg-adapter.js';

// Original Cloudflare game logic uses Web Request/Response and crypto.subtle.
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const port=Number(process.env.PORT||10000);
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
if(!process.env.PIN_PEPPER||process.env.PIN_PEPPER.length<16)throw new Error('PIN_PEPPER must contain at least 16 characters');
if(!process.env.SETUP_SECRET)throw new Error('SETUP_SECRET is required');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:12000});
const DB=postgresDatabase(pool);
const schema=readFileSync(path.resolve(root,'../schema.pg.sql'),'utf8');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
function reply(res,status,text,type='text/plain; charset=utf-8'){
  res.writeHead(status,{'content-type':type,'x-content-type-options':'nosniff','cache-control':'no-store'});
  res.end(text);
}
async function serveStatic(url){
  let pathname;
  try {pathname=decodeURIComponent(url.pathname);}catch{return new Response('Invalid path',{status:400});}
  if(pathname==='/'||pathname==='') pathname='/index.html';
  const candidate=path.resolve(root,'.'+pathname);
  if(candidate!==root&&!candidate.startsWith(root+path.sep))return new Response('Forbidden',{status:403});
  try{
    const bytes=await readFile(candidate);
    return new Response(bytes,{status:200,headers:{'content-type':mime[path.extname(candidate)]||'application/octet-stream','x-content-type-options':'nosniff'}});
  }catch{return new Response('Not found',{status:404});}
}
const env={DB,SETUP_SECRET:process.env.SETUP_SECRET,PIN_PEPPER:process.env.PIN_PEPPER,ASSETS:{fetch:async req=>serveStatic(new URL(req.url))}};
// Per-client limit for PIN guesses; configure trusted proxies if using another hosting provider.
const attempts=new Map();
function limited(req,pathname){
  if(!pathname.startsWith('/api/')||pathname==='/api/health')return false;
  const key=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').toString().split(',')[0].trim();
  const now=Date.now(),record=attempts.get(key);
  if(!record||now-record.time>10*60*1000){attempts.set(key,{time:now,count:1});return false;}
  record.count++;
  return record.count>300;
}
async function start(){
  await pool.query(schema); // Safe, idempotent schema creation. Never resets a game.
  const server=http.createServer(async(req,res)=>{
    try{
      const origin=`http://localhost:${port}`;
      const url=new URL(req.url||'/',origin);
      if(limited(req,url.pathname))return reply(res,429,JSON.stringify({error:'Please wait before trying again.'}),'application/json');
      if(!['GET','HEAD','POST'].includes(req.method))return reply(res,405,'Method not allowed');
      let body;
      if(req.method==='POST'){
        const chunks=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>16384)return reply(res,413,'Request too large');chunks.push(chunk);}
        body=Buffer.concat(chunks);
      }
      const headers=new Headers();
      for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);
      const webreq=new Request(url.toString(),{method:req.method,headers,body:body?.length?body:undefined, ...(body?.length?{duplex:'half'}:{})});
      const response=await worker.fetch(webreq,env);
      const data=Buffer.from(await response.arrayBuffer());
      const responseHeaders={};response.headers.forEach((value,key)=>{responseHeaders[key]=value;});
      res.writeHead(response.status,responseHeaders);
      res.end(req.method==='HEAD'?undefined:data);
    }catch(error){console.error('Request failed',error);if(!res.headersSent)reply(res,500,JSON.stringify({error:'The server could not complete your request.'}),'application/json');}
  });
  server.listen(port,'0.0.0.0',()=>console.log(`Lotus House server listening on ${port}`));
  process.on('SIGTERM',()=>server.close(()=>pool.end()));
}
start().catch(err=>{console.error('Lotus startup failure:',err);process.exit(1);});
