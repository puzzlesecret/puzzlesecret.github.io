import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root=process.cwd();
const production=JSON.parse(fs.readFileSync(path.join(root,'../output/gift/private/production.json'),'utf8'));
let salt='';
for(const name of ['.env','.env.local','.env.production','.env.production.local']){
 const f=path.join(root,name);if(!fs.existsSync(f))continue;
 const m=fs.readFileSync(f,'utf8').match(/^VAULT_SALT\s*=\s*(.*)$/m);
 if(m)salt=m[1].trim().replace(/^['"]|['"]$/g,'');
}
assert(salt,'Local application salt missing');process.env.VAULT_SALT=salt;
let source=fs.readFileSync('src/pages/api/unlock.js','utf8');
source=source.replace("import { entryContext } from '../../lib/entry-context.js';",`import { entryContext } from ${JSON.stringify(pathToFileURL(path.join(root,'src/lib/entry-context.js')).href)};`);
source=source.replace("import { GIFT_HASHES } from '../../lib/gift-unlocks.js';",fs.readFileSync('src/lib/gift-unlocks.js','utf8').replace('export const','const'));
source=source.replace(/import \{ notify, solverTag, place, isBot, quietPlace \} from [^;]+;/,"const notify=async()=>{globalThis.__giftTestNotifications++;}; const solverTag=()=> 'local-test'; const place=()=> 'local'; const isBot=()=>true; const quietPlace=()=>true;");
source=source.replace(/import \{ rewardUrl \} from [^;]+;/,"const rewardUrl=(act)=>'/mock-reward/'+act;");
source=source.replace(/import\.meta\.env\./g,'process.env.');
globalThis.__giftTestNotifications=0;
const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Network forbidden in local Gift tests');};
const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
let localRequest=0;
const post=async(word,at='gift-book')=>{
 const r=await api.POST({request:new Request('http://localhost/api/unlock',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({word,at,vid:'test'})}),clientAddress:'local-test-'+(++localRequest)});
 return {status:r.status,data:await r.json()};
};
let checks=0;
for(let i=0;i<3;i++)for(const route of ['gift-book','door','3d','painted','entry-hub']){
 const r=await post(production.meta.book_words_private[i],route);assert(r.data.ok);assert.equal(r.data.act,['I','II','III'][i]);assert.equal(r.data.edition,'gift');assert.equal(r.data.hidden,false);assert(!r.data.guest);checks++;
}
const cover=await post(production.meta.cover_guest_word_private,'gift-cover');assert(cover.data.ok);assert.equal(cover.data.act,'I');assert.equal(cover.data.edition,'gift-cover');assert.equal(cover.data.guest,'outlet');assert.equal(cover.data.hidden,false);checks++;
const rejected=await post(production.meta.book_words_private[2],'gift-cover');assert.equal(rejected.data.ok,false);checks++;
const original=JSON.parse(fs.readFileSync(path.join(root,'../scripts/sudoku_v1_dataset.json'),'utf8'));
for(let i=0;i<3;i++)for(const route of ['door','3d','painted']){const prior=await post(original.meta.passphrase_words[i],route);assert(prior.data.ok);assert.equal(prior.data.act,['I','II','III'][i]);assert.equal(prior.data.edition,undefined);checks++;}
const wrong=await post('ZZZZZZ','gift-cover');assert.equal(wrong.data.ok,false);checks++;
assert.equal(globalThis.__giftTestNotifications,25);
const answers=JSON.parse(fs.readFileSync('src/data/gift-solutions.json','utf8'));assert.equal(answers.solutions.length,79);assert.equal(new Set(answers.solutions.map(x=>x.id)).size,79);checks++;
const expected=[...production.puzzles,...production.extras,production.cover];answers.solutions.forEach((a,i)=>assert.deepEqual(a.solution,expected[i].solution));checks++;
const exposed=fs.readFileSync('src/data/gift-solutions.json','utf8');assert(!/book_words|guest_word|mapping|marks|columns/.test(exposed));checks++;
for(const word of [...production.meta.book_words_private,production.meta.cover_guest_word_private]){
 for(const file of ['public/js/gift-entry.js','src/pages/gift/index.astro','src/pages/gift/solutions.astro','src/data/gift-solutions.json','src/lib/gift-unlocks.js'])assert(!fs.readFileSync(file,'utf8').toUpperCase().includes(word.toUpperCase()));
}
checks++;globalThis.fetch=originalFetch;
const hashFile=(file)=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(hashFile('public/gift/Gift-Edition-Solutions.pdf'),hashFile('../output/gift/kdp/Gift-Edition-Solutions.pdf'),'Staged answer download must match the final print edition PDF');checks++;
console.log(JSON.stringify({ok:true,checks,api_cases:27,public_solutions:79,notifications:'mocked',network:'blocked',plaintext_words_in_gift_client_sources:false}));
