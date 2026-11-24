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
  const reverseLinks = [{}, {}];
  c.document = { getElementById: k => links.get(k), querySelectorAll: () => reverseLinks };
  const switchStart=page.indexOf('// Switching view must retain');
  vm.runInContext(page.slice(switchStart,page.indexOf('</script>',switchStart)),c);
  for(const link of links.values()){ const u=new URL(link.href,c.location.origin); assert.equal(u.searchParams.get('act'),act); assert.equal(u.searchParams.get('from'),'door'); assert.equal(u.searchParams.get('mode'),'painted'); checks+=3; }
  // Feed that retained query to painted's actual boot authorization expression.
  const painted=fs.readFileSync('public/js/painted-vault.js','utf8');
  const line=painted.split('\n').find(x=>x.includes("const act = qs.get('act');"));
  c.qs=new URL(links.get('modeChip').href,c.location.origin).searchParams; c.ROOMS={I:{},II:{},III:{}}; c.opened={}; c.marked=[]; c.markDoor=a=>c.marked.push(a);
  vm.runInContext(line,c); assert.deepEqual(c.marked,[act]); checks++;
  // On the painted URL, BOTH the HUD and gate switch must return to the same earned 3D act.
  c.location.href = links.get('modeChip').href;
  c.location.href = new URL(c.location.href,c.location.origin).href;
  vm.runInContext(page.slice(switchStart,page.indexOf('</script>',switchStart)),c);
  for (const link of reverseLinks) {
    const u = new URL(link.href,c.location.origin);
    assert.equal(u.searchParams.get('act'),act); assert.equal(u.searchParams.get('from'),'door'); assert.equal(u.searchParams.get('mode'),'3d'); checks+=3;
    c.qs=u.searchParams;
    assert.equal(vm.runInContext('earnedArrivalAct()',c),act); checks++;
  }
}
for(const [act,pass,from,gallery] of [['III',null,true,false],['III','/api/reward?act=II&t='+token,true,false],['II','https://elsewhere.test/api/reward?act=II&t='+token,true,false],['II','/api/reward?act=II&t=bad',true,false],['II','/api/reward?act=II&t='+token,false,false],['II','/api/reward?act=II&t='+token,true,true],['G','/api/reward?act=G&t='+token,true,true],['I','/api/reward?act=I&t='+token,true,false]]){
 const c=vm.createContext({URL,qs:new URLSearchParams('act='+act),FROM_DOOR:from,GALLERY:gallery,location:{origin:'https://puzzlesecret.com'},rewardsHeld:()=>pass?{[act]:pass}:{}});vm.runInContext(fn(source,'earnedArrivalAct'),c);assert.equal(vm.runInContext('earnedArrivalAct()',c),null);checks++;
}
assert.match(source, /if \(LOCAL_DEBUG_HOST\) window\.__vault =/); checks++;
const localDebugLine = source.split('\n').find(line => line.startsWith('const LOCAL_DEBUG_HOST ='));
for (const [hostname, expected] of [['localhost',true],['127.0.0.1',true],['[::1]',true],['puzzlesecret.com',false],['puzzlesecret.vercel.app',false],['preview-123.vercel.app',false]]) {
 const c=vm.createContext({location:{hostname},window:{},qs:new URLSearchParams('d2=1&d3=1&open=1&cam=1')});
 vm.runInContext(localDebugLine + source.split('\n').find(x=>x.startsWith('const DEV_HOST =')) + source.split('\n').find(x=>x.startsWith('const devQ =')) + ' if (LOCAL_DEBUG_HOST) window.__vault = {};',c);
 assert.equal('__vault' in c.window,expected);checks++;
 const redirects=[];
 const guard=vm.createContext({URLSearchParams,location:{hostname,search:'?cam=1',replace:v=>redirects.push(v)},localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null,setItem(){}},document:{referrer:''}});
 const guardStart=page.indexOf('<script is:inline>')+'<script is:inline>'.length;
 vm.runInContext(page.slice(guardStart,page.indexOf('</script>',guardStart)),guard);
 assert.equal(redirects.length,expected?0:1);checks++;

 for(const flag of ['d2','d3','open','cam']) { assert.equal(vm.runInContext('devQ('+JSON.stringify(flag)+')',c),expected?'1':null);checks++; }
}
console.log(JSON.stringify({ok:true,checks,entryTo3D:true,paintedSwitch:true,reverseModeSwitch:true,queryAloneDenied:true,earlierRewardsNotGranted:true,network:'not used',words:'synthetic only'}));
