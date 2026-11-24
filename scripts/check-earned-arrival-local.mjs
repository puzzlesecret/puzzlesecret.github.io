// Synthetic entry-to-room regression: no secrets, environment files or network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('src/scripts/vault3d.js', 'utf8');
const entry = fs.readFileSync('public/js/book-entry.js', 'utf8');
const page = fs.readFileSync('src/pages/vault.astro', 'utf8');
function fn(text, name) {
  const start = text.indexOf('function ' + name + '(');
  assert(start >= 0, name + ' exists');
  let open = text.indexOf('{', start), depth = 1, i = open + 1;
  for (; depth && i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}') depth--; }
  return text.slice(start, i);
}
let checks = 0;
const token = 'a'.repeat(40);
for (const act of ['II', 'III']) {
  const memory = new Map(), session = new Map();
  const storage = m => ({ getItem: k => m.get(k) ?? null, setItem: (k,v) => m.set(k,v), removeItem: k => m.delete(k) });
  const c = vm.createContext({ URL, localStorage: storage(memory), sessionStorage: storage(session), window: {}, location: { origin: 'https://puzzlesecret.com' }, timers: [], openedRewards: [], setTimeout: f => c.timers.push(f) });
  vm.runInContext(`var ROOM_ROUTES={v1:{volumeId:'v1',destination:'/vault',acts:['I','II','III','G']}};` + fn(entry,'keep') + fn(entry,'safeDestination'), c);
  c.response = { ok: true, act, rewardUrl: '/api/reward?act=' + act + '&t=' + token };
  const destination = vm.runInContext('keep(response); safeDestination(response)', c);
  assert.equal(destination, '/vault?from=door&act=' + act); checks++;
  c.qs = new URL(destination, c.location.origin).searchParams;
  vm.runInContext(`var FROM_DOOR=true,GALLERY=false; function rewardsHeld(){return JSON.parse(localStorage.getItem('ps_rewards_v1')||'{}');}` + fn(source,'earnedArrivalAct') + `var ARRIVAL_ACT=earnedArrivalAct(); var hinge={rotation:{}},doorAmt=0,doorOpened=false,door2Open=false,door3Open=false,door2={rotation:{},userData:{kind:'door2'}},door3={rotation:{},userData:{kind:'door3'}},DOORS={door2:{inside:{x:0,z:-8.9}},door3:{inside:{x:0,z:-21}}},player={pos:{set(x,y,z){this.x=x;this.y=y;this.z=z;}},target:{copy(p){this.x=p.x;this.z=p.z;}}},yaw=1,pitch=1; function openReward(a){openedRewards.push(a);}` + fn(source,'restoreEarnedArrival') + 'restoreEarnedArrival();', c);
  assert.equal(c.ARRIVAL_ACT, act); assert.equal(c.door2Open,true); assert.equal(c.door3Open,act==='III'); assert.equal(c.player.pos.z,act==='II'?-8.9:-21); assert.equal(c.player.target.z,c.player.pos.z); c.timers.forEach(f=>f()); assert.deepEqual(c.openedRewards,[act]); checks+=6;
  assert.equal(memory.has('ps_vaults_v1'),false); assert.equal(Object.keys(JSON.parse(memory.get('ps_rewards_v1'))).length,1); checks+=2;
  // Actual inline view switch must carry the same earned destination into painted boot.
  const links = new Map(['modeChip','gate2d'].map(k=>[k,{}])); c.location.href = c.location.origin + destination;
  c.document = { getElementById: k => links.get(k) };
  const switchStart=page.indexOf('// Switching view must retain');
  vm.runInContext(page.slice(switchStart,page.indexOf('</script>',switchStart)),c);
  for(const link of links.values()){ const u=new URL(link.href,c.location.origin); assert.equal(u.searchParams.get('act'),act); assert.equal(u.searchParams.get('from'),'door'); assert.equal(u.searchParams.get('mode'),'painted'); checks+=3; }
  // Feed that retained query to painted's actual boot authorization expression.
  const painted=fs.readFileSync('public/js/painted-vault.js','utf8');
  const line=painted.split('\n').find(x=>x.includes("const act = qs.get('act');"));
  c.qs=new URL(links.get('modeChip').href,c.location.origin).searchParams; c.ROOMS={I:{},II:{},III:{}}; c.opened={}; c.marked=[]; c.markDoor=a=>c.marked.push(a);
  vm.runInContext(line,c); assert.deepEqual(c.marked,[act]); checks++;
}
for(const [act,pass,from,gallery] of [['III',null,true,false],['III','/api/reward?act=II&t='+token,true,false],['II','https://elsewhere.test/api/reward?act=II&t='+token,true,false],['II','/api/reward?act=II&t=bad',true,false],['II','/api/reward?act=II&t='+token,false,false],['II','/api/reward?act=II&t='+token,true,true],['G','/api/reward?act=G&t='+token,true,true],['I','/api/reward?act=I&t='+token,true,false]]){
 const c=vm.createContext({URL,qs:new URLSearchParams('act='+act),FROM_DOOR:from,GALLERY:gallery,location:{origin:'https://puzzlesecret.com'},rewardsHeld:()=>pass?{[act]:pass}:{}});vm.runInContext(fn(source,'earnedArrivalAct'),c);assert.equal(vm.runInContext('earnedArrivalAct()',c),null);checks++;
}
assert.match(source, /if \(DEV_HOST\) window\.__vault =/); checks++;
console.log(JSON.stringify({ok:true,checks,entryTo3D:true,paintedSwitch:true,queryAloneDenied:true,earlierRewardsNotGranted:true,network:'not used',words:'synthetic only'}));
