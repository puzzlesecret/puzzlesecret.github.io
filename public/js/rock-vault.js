(() => {
  'use strict';
  let dialog, panel, hooks, previousFocus, triggerStage, busy = false, visit = 0;
  let hour, minute, downstairs, record, waitingForLatch = false;
  let dock, station = 'landing', roomFocus;
  const stations = {
    landing: {name:'The stair landing', items:[]},
    west: {name:'West portrait wall', items:['k1','k2','k3','k4']},
    east: {name:'East portrait wall', items:['k5','k6','k7']},
    bench: {name:'The workbench', items:['disc','strip','box']},
    desk: {name:'The writing desk', items:['register']}
  };
  const node = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text != null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  function button(text, fn, primary = false) {
    const b = node('button', text, primary ? 'rk-primary' : 'rk-button');
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }
  async function api(body) {
    const options = {credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(14000)};
    if (body) {
      const headers = {'Content-Type':'application/json'};
      if (body.action === 'set') {
        try {
          const gift = JSON.parse(localStorage.getItem('ps_rewards_v1') || '{}').G;
          const url = new URL(gift, location.origin);
          if (url.origin === location.origin && url.pathname === '/api/reward') headers['x-gallery-pass'] = url.searchParams.get('t') || '';
        } catch { /* A missing pass is reported by the service. */ }
      }
      Object.assign(options, {method:'POST', headers, body:JSON.stringify(body)});
    }
    const r = await fetch('/api/rock', options);
    const j = await r.json();
    return {...j, status:r.status};
  }
  function page(stage, eyebrow, title, intro) {
    triggerStage = stage;
    dialog.dataset.stage = stage;
    panel.replaceChildren();
    dialog.scrollTop = 0;
    const h = node('h2', title);
    h.id = 'rk-heading'; h.tabIndex = -1;
    panel.append(node('p', eyebrow, 'rk-eyebrow'), h);
    if (intro) panel.append(node('p', intro, 'rk-copy'));
    h.focus({preventScroll:true});
  }
  function status() {
    const p = node('p', '', 'rk-status'); p.setAttribute('role','status'); panel.append(p); return p;
  }
  function actions(...buttons) {
    const row = node('div', null, 'rk-actions'); row.append(...buttons); panel.append(row);
  }
  async function transition(fn) {
    if (!fn) return;
    dialog.classList.add('rk-moving');
    let timer;
    try { await Promise.race([Promise.resolve(fn()),new Promise(resolve => {timer = setTimeout(resolve,4500);})]); }
    finally {clearTimeout(timer);dialog.classList.remove('rk-moving');}
  }
  function leave() {
    if (busy && !waitingForLatch) return;
    waitingForLatch = false;
    if (downstairs) { roam(); return; }
    visit++;
    dialog.close();
    hooks.close?.();
    if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
    else document.querySelector('.gallery-cabin__rock, #gList')?.focus({preventScroll:true});
  }
  async function ascend() {
    if (busy) return;
    busy = true;
    try { await transition(hooks.returnToGallery || hooks.returnToRoom); }
    finally {
      downstairs = false;
      document.body.classList.remove('rk-downstairs');
      dock?.remove(); dock = null; busy = false; leave();
    }
  }
  function stone() {
    page('stone','The Keeper’s shelf','The Rock','A smooth grey stone sits in a hollow worn to fit it. There is just room to get your fingers underneath.');
    actions(button('Lift The Rock', async () => {
      if (busy) return;
      busy = true;
      try {
        const statusRequest = api().catch(() => ({}));
        await transition(hooks.lift);
        record = await statusRequest;
        if (record.solved) { await transition(hooks.unlock || hooks.openStairs); stairs(); }
        else dial();
      } finally { busy = false; }
    },true),button('Leave it here', leave));
  }
  const pad = n => String(n).padStart(2,'0');
  function face() {
    const f = node('div',null,'rk-face');
    f.setAttribute('aria-hidden','true');
    for(let i=1;i<=12;i++){
      const n = node('span',String(i),'rk-numeral');
      const a=i*Math.PI/6;
      n.style.left=(50+39*Math.sin(a))+'%'; n.style.top=(50-39*Math.cos(a))+'%';f.append(n);
    }
    const h=node('i',null,'rk-hand rk-short'), m=node('i',null,'rk-hand rk-long');
    f.append(h,m,node('i',null,'rk-pin'));
    return {element:f,draw(){h.style.transform='rotate('+(hour%12*30+minute*.5)+'deg)';m.style.transform='rotate('+(minute*6)+'deg)';}};
  }
  function dial() {
    page('dial','Beneath The Rock','The brass dial','Set the hands to the time you found in The Kettle’s Encore on page 117.');
    const clock = face(), controls=node('div',null,'rk-controls'), time=node('output');
    time.setAttribute('aria-label','Dial time');
    function sync(){
      clock.draw();
      time.textContent=hour+':'+pad(minute);
      hours.value=String(hour);
      minutes.value=String(minute);
    }
    function select(label,start,end,current,onChange,format) {
      const wrap=node('label',label), input=node('select');
      input.setAttribute('aria-label',label);
      for(let i=start;i<=end;i++) input.add(new Option(format(i),String(i)));
      input.value=String(current);
      input.addEventListener('change',()=>{onChange(Number(input.value));sync();});
      wrap.append(input);controls.append(wrap);return input;
    }
    const hours=select('Hour hand',1,12,hour,v=>{hour=v;},String);
    const minutes=select('Minute hand',0,59,minute,v=>{minute=v;},pad);
    let drag=null;
    const point=e=>{
      const r=clock.element.getBoundingClientRect();
      return {x:(e.clientX-r.left)/r.width-.5,y:(e.clientY-r.top)/r.height-.5};
    };
    clock.element.addEventListener('pointerdown',e=>{
      if(busy || drag || e.button!==0)return;
      const {x,y}=point(e);
      const tipDistance=(deg,length)=>{
        const angle=deg*Math.PI/180;
        return Math.hypot(x-length*Math.sin(angle),y+length*Math.cos(angle));
      };
      const short=tipDistance(hour%12*30+minute*.5,.20),long=tipDistance(minute*6,.32);
      if(Math.min(short,long)>.19)return;
      drag={id:e.pointerId,hand:short<=long?'hour':'minute'};
      clock.element.setPointerCapture(e.pointerId);
    });
    clock.element.addEventListener('pointermove',e=>{
      if(!drag || drag.id!==e.pointerId || busy)return;
      const {x,y}=point(e);
      if(Math.hypot(x,y)<.1)return;
      const turn=(Math.atan2(x,-y)/(Math.PI*2)+1)%1;
      if(drag.hand==='hour')hour=((Math.round(turn*12-minute/60)+12)%12)||12;
      else minute=Math.round(turn*60)%60;
      sync();
    });
    clock.element.addEventListener('lostpointercapture',()=>{drag=null;});
    sync();
    const instrument=node('div',null,'rk-instrument');instrument.append(clock.element,time);
    panel.append(instrument,node('p','Drag a hand, or choose its value below.','rk-dial-help'),controls);
    const msg=status(), set=button('Set the dial',async()=>{
      if(busy)return;
      const currentVisit=visit;
      busy=true;waitingForLatch=true;set.disabled=true;controls.inert=true;msg.textContent='Listening for the latch…';
      try {
        const j=await api({action:'set',hour,minute});
        if (currentVisit!==visit) return;
        waitingForLatch=false;
        if(j.ok){
          earnedPlate=j.bookplate; record=j;
          await transition(hooks.unlock || hooks.openStairs);
          stairs();
        } else if(j.reason==='no_gallery') {
          msg.textContent='Use your Gift Edition cover word at the front door to renew entry. ';
          const front=node('a','Go to the front door');front.href='/';msg.append(front);
        }
        else if(j.status===429) msg.textContent='Let the dial rest'+(j.retryAfter?' for '+Math.ceil(j.retryAfter/60)+' min':' a little')+' before trying again.';
        else if(j.status>=500) msg.textContent='The latch is out of reach. Please try again shortly.';
        else if(j.reason==='wrong_time') msg.textContent='The latch stays shut. Check the two hands against your crossword.';
        else msg.textContent='The clock could not check that setting. Reload the Gallery and try again.';
      } catch {msg.textContent='The connection slipped. Your hands are still set. Try again.';}
      finally{if(currentVisit===visit){waitingForLatch=false;busy=false;set.disabled=false;controls.inert=false;}}
    },true);
    actions(set,button('Back to the Gallery',leave));
  }
  function stairs() {
    page('stairs','Beneath the Gallery','The floor gives way','Stone steps disappear below the floorboards. Far below, a wick catches.');
    actions(button('Descend the stairs',async()=>{
      if(busy)return;
      busy=true;
      try {
        await transition(hooks.descend); downstairs=true; station='landing'; roomFocus=null;
        document.body.classList.add('rk-downstairs'); roam();
      }
      finally{busy=false;}
    },true),button('Stay in the Gallery',leave));
  }
  let earnedPlate;
  function prize() {
    const a=node('a');
    let localUrl;
    if(record?.solved === false && earnedPlate)
      localUrl=URL.createObjectURL(new Blob([earnedPlate],{type:'image/svg+xml'}));
    a.href=localUrl || '/api/rock?bookplate=1'; a.download='keepers-bookplate.svg';
    document.body.append(a);a.click();a.remove();
    if(localUrl)setTimeout(()=>URL.revokeObjectURL(localUrl),60000);
  }
  function entry(id) {
    const catalog = window.PSCellarCatalog;
    return catalog?.keepers.find(item=>item.id===id) || catalog?.objects.find(item=>item.id===id);
  }
  function roomSheet() {
    if (!dialog.open) {
      roomFocus=document.activeElement;
      dialog.showModal();
      if(dock) dock.hidden=true;
    }
  }
  function roam(focusControls=true) {
    triggerStage='room';
    if(dialog.open) dialog.close();
    if(!dock){
      dock=node('section',null,'rk-dock');
      dock.setAttribute('aria-label','Underground room controls');
      document.body.append(dock);
    }
    dock.hidden=false;
    const oldControl=(focusControls===false ? document.activeElement : roomFocus)?.dataset?.control;
    dock.replaceChildren();
    const heading=node('h2',stations[station].name);
    const note=node('p', hooks.painted ? 'Choose a place to explore.' : 'Tap the floor to walk. Drag to look around, or use the room guide.');
    const controls=node('div',null,'rk-dock-actions');
    const guideButton=button('Room guide',guide); guideButton.dataset.control='guide';
    controls.append(guideButton);
    for(const id of stations[station].items){
      const label=id==='register'?'Open the register':entry(id)?.name;
      if(!label) continue;
      const b=button(label,()=>inspect(id)); b.dataset.control=id; controls.append(b);
    }
    if(station==='landing'){
      const up=button('Climb the stairs',askExit); up.dataset.control='stairs'; controls.append(up);
    }
    dock.append(heading,note,controls);
    if(focusControls!==false || oldControl) {
      (Array.from(controls.children).find(b=>b.dataset.control===oldControl)||guideButton).focus({preventScroll:true});
    }
  }
  function setStation(id) {
    if(!downstairs || busy || dialog.open || !Object.hasOwn(stations,id) || station===id) return;
    station=id; roam(false);
  }
  function guide() {
    if(!downstairs || busy) return;
    roomSheet(); page('guide','Beneath The Rock','Room guide','Where would you like to walk?');
    const paths=node('div',null,'rk-paths');
    for(const [id,place] of Object.entries(stations)){
      paths.append(button(place.name,async()=>{
        if(busy) return;
        busy=true;
        try {await transition(()=>hooks.walkTo?.(id)); station=id; roam();}
        finally {busy=false;}
      }));
    }
    panel.append(paths); actions(button('Keep exploring',roam));
  }
  function askExit() {
    if(!downstairs || busy) return;
    roomSheet(); page('exit','The stair landing','Return to the Gallery?','The stairwell will be here when you come back.');
    actions(button('Climb the stairs',ascend,true),button('Stay downstairs',roam));
  }
  function inspect(id) {
    if(!downstairs || busy) return;
    if(id==='stairs') {askExit();return;}
    const place=Object.keys(stations).find(key=>stations[key].items.includes(id));
    if(!place) return;
    station=place;
    roomSheet();
    if(id==='register') {vault();return;}
    const item=entry(id);
    if(!item) {roam();return;}
    const portrait=Boolean(item.story);
    function show(reverse=false){
      page('inspect',portrait?'The portrait wall':'From the workbench',item.name);
      const art=node('img',null,'rk-inspect-art');
      art.src=reverse?item.reverseImage:item.image; art.alt=reverse?item.reverseAlt:item.alt;
      panel.append(art);
      if(portrait) panel.append(node('p',item.trade+' · '+item.place,'rk-caption'));
      panel.append(node('p',portrait?item.story:(reverse?item.back:item.front),'rk-copy'));
      const back=button(portrait?'Step back':'Put it back',roam);
      if(portrait) actions(back);
      else {
        const turn=id==='box' ? (reverse?'Close the case':'Open the case') : (reverse?'Turn it back':'Turn it over');
        actions(button(turn,()=>show(!reverse),true),back);
      }
    }
    show();
  }
  function vault() {
    page('vault','The writing desk','The visitors’ register','“I wondered who would think to lift it.” A bookplate lies beside the register. Take it for a book of your own.');
    actions(button('Save my bookplate',prize,true));
    const box=node('section',null,'rk-register');box.setAttribute('aria-label','Solver register');panel.append(box);
    actions(button('Close the register',roam));
    const here=visit;
    const live=()=>dialog.open && here===visit && triggerStage==='vault' && box.isConnected;
    function draw(j,justSigned=false) {
      box.replaceChildren(node('h3','The register'));
      if(j.solved===false){
        box.append(node('p','This browser did not keep the completion cookie. You can save the blank bookplate now. Allow first-party cookies on this site to sign or return later.'));
        return;
      }
      if(Array.isArray(j.marks) && j.marks.length) box.append(node('p','Recent initials · '+j.marks.join(' · '),'rk-marks'));
      if(j.signed){
        const confirmation=node('p','Signed '+(j.initials||'here')+'. Save your bookplate above to keep a copy with your initials.');
        confirmation.tabIndex=-1; box.append(confirmation);
        if(justSigned) confirmation.focus();
        return;
      }
      const form=node('form'),label=node('label','Leave your initials (2–3 letters)'),input=node('input');
      input.maxLength=3;input.pattern='[A-Za-z]{2,3}';input.required=true;input.autocomplete='off';input.autocapitalize='characters';input.spellcheck=false;
      label.append(input);const sign=button('Sign the register',()=>{});sign.type='submit';
      const msg=node('p','','rk-status');msg.setAttribute('role','status');
      form.append(label,sign);box.append(node('p','Your signature stays in this browser for up to a year. Save the signed bookplate to keep it.'),form,msg);
      form.addEventListener('submit',async e=>{
        e.preventDefault();if(sign.disabled)return;
        const initials=input.value.toUpperCase();sign.disabled=true;input.disabled=true;msg.textContent='Adding your mark…';
        try{
          const reply=await api({action:'sign',initials});
          if(!live())return;
          if(reply.ok){record={...record,...reply,signed:true,initials:reply.initials||initials};draw(record,true);}
          else if(reply.reason==='bad_initials') msg.textContent='Please choose a different set of two or three letters.';
          else if(reply.status===429) msg.textContent='Please wait a little before signing again.';
          else if(reply.status===403) msg.textContent='Reopen The Rock and set the dial again to sign.';
          else msg.textContent='The register could not save your mark. Please try again.';
        }catch{if(live())msg.textContent='The register is out of reach. Try again when you are connected.';}
        finally{sign.disabled=false;input.disabled=false;}
      });
    }
    box.append(node('p','Opening the register…'));
    api().then(j=>{if(live()){if(j.ok)record=j;draw(record || {});}}).catch(()=>{if(live())draw(record || {});});
  }
  function open(callbacks={}) {
    if(dialog?.open || downstairs)return;
    if(!dialog){
      dialog=node('dialog',null,'rk-dialog');dialog.setAttribute('aria-labelledby','rk-heading');
      panel=node('div',null,'rk-panel');dialog.append(panel);document.body.append(dialog);
      dialog.addEventListener('cancel',e=>{e.preventDefault();leave();});
      // The walker also listens for keys on the document.
      dialog.addEventListener('keydown',e=>e.stopPropagation());
      dialog.addEventListener('keyup',e=>e.stopPropagation());
    }
    visit++;previousFocus=document.activeElement;hooks=callbacks;hour=12;minute=0;downstairs=false;record={};busy=false;
    dialog.showModal();stone();
  }
  window.PSRock=Object.freeze({open,inspect,askExit,setStation,dismiss:leave,canWalk:()=>!!downstairs && !busy && !dialog?.open,isOpen:()=>!!dialog?.open});
})();
