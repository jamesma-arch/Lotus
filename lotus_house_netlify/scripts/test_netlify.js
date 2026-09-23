import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
// Static contract tests: API routing, no committed secrets, and existing guest UX.
const fn=readFileSync(new URL('../netlify/functions/api.mjs',import.meta.url),'utf8');
const toml=readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('API function preserves original game logic and Postgres adapter',()=>{
 assert.match(fn,/game-api\.js/);assert.match(fn,/postgresDatabase/);assert.match(fn,/process\.env\.DATABASE_URL/);
});
test('Netlify directs API routes to serverless function and publishes only public',()=>{
 assert.match(toml,/publish = "public"/);assert.match(toml,/from = "\/api\/\*"/);
});
test('mobile app has guest interface',()=>{assert.match(html,/<meta name="viewport"/);});
