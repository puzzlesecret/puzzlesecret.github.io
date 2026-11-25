(() => {
  'use strict';
  let dialog, panel, hooks, previousFocus, triggerStage, busy = false, visit = 0;
  let hour, minute, downstairs, record;
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
    if (busy) return;
    if (downstairs) { ascend(); return; }
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
    finally { downstairs = false; busy = false; leave(); }
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
      busy=true;set.disabled=true;controls.inert=true;msg.textContent='Listening for the latch…';
      try {
        const j=await api({action:'set',hour,minute});
        if(j.ok){
          await transition(hooks.unlock || hooks.openStairs);
          stairs();
        } else if(j.reason==='no_gallery') {
          msg.textContent='Use your Gift Edition cover word at the front door to renew entry. ';
          const front=node('a','Go to the front door');front.href='/';msg.append(front);
        }
        else if(j.status===429) msg.textContent='Let the dial rest'+(j.retryAfter?' for '+Math.ceil(j.retryAfter/60)+' min':' a little')+' before trying again.';
        else if(j.status>=500) msg.textContent='The latch is out of reach. Please try again shortly.';
        else msg.textContent='The latch stays shut. Check the two hands against your crossword.';
      } catch {msg.textContent='The connection slipped. Your hands are still set. Try again.';}
      finally{busy=false;set.disabled=false;controls.inert=false;}
    },true);
    actions(set,button('Back to the Gallery',leave));
  }
  function stairs() {
    page('stairs','Beneath the Gallery','The floor gives way','A section of floor swings up. Stone steps lead down into a small room. Something brass catches the light at the foot of the stairs.');
    actions(button('Descend the stairs',async()=>{
      if(busy)return;
      busy=true;
      try {await transition(hooks.descend);downstairs=true;vault();}
      finally{busy=false;}
    },true),button('Stay in the Gallery',leave));
  }
  function prize() {
    // Printable bookplate with a hand-drawn escutcheon, an open book and descending steps.
    const initials = /^[A-Z]{2,3}$/.test(record?.initials) && record?.signed ? record.initials : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 500" width="720" height="500">
    <rect width="720" height="500" fill="#f4e9cf"/><g fill="none" stroke="#705338"><rect x="17" y="17" width="686" height="466" rx="8" stroke-width="3"/><rect x="25" y="25" width="670" height="450" rx="4"/>
    <path d="M315 77Q360 69 405 77V122Q405 148 360 168Q315 148 315 122Z" stroke-width="3"/>
    <path d="M329 104h15v11h15v11h15v11h16M332 94q15-7 28 0 13-7 28 0v10q-14-6-28 0-14-6-28 0zM360 94v10" stroke-width="2"/>
    <path d="M80 200h160m240 0h160M135 325h450M175 397h370"/></g>
    <g text-anchor="middle" fill="#403121" font-family="Georgia,serif"><text x="360" y="204" font-size="18" letter-spacing="4">EX LIBRIS</text>
    <text x="360" y="266" font-size="44">Beneath The Rock</text><text x="360" y="304" font-size="19" font-style="italic">I found the room beneath the Keeper’s floor.</text>
    <text x="360" y="365" font-size="16" letter-spacing="2">FROM THE LIBRARY OF</text><text x="360" y="390" font-size="22">${initials}</text><text x="360" y="451" font-size="15">PuzzleSecret · The Keeper’s Gallery</text></g></svg>`;
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    const a=node('a');a.href=url;a.download='keepers-bookplate.svg';document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  function vault() {
    page('vault','The room below','The Keeper’s little vault','“I wondered who would think to lift it.” A bookplate lies beside the register. Take it for a book of your own.');
    actions(button('Save my bookplate',prize,true));
    const box=node('section',null,'rk-register');box.setAttribute('aria-label','Solver register');panel.append(box);
    actions(button('Return to the Gallery',ascend));
    const here=visit;
    const live=()=>dialog.open && here===visit && triggerStage==='vault' && box.isConnected;
    function draw(j) {
      box.replaceChildren(node('h3','The register'));
      if(Array.isArray(j.marks) && j.marks.length) box.append(node('p','Recent initials · '+j.marks.join(' · '),'rk-marks'));
      if(j.signed){box.append(node('p','Signed '+(j.initials||'here')+'. Save your bookplate above to keep a copy with your initials.'));return;}
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
          if(reply.ok){record={...record,...reply,signed:true,initials:reply.initials||initials};draw(record);}
          else if(reply.reason==='bad_initials') msg.textContent='Please choose a different set of two or three letters.';
          else if(reply.status===429) msg.textContent='Please wait a little before signing again.';
          else if(reply.status===403) msg.textContent='Reopen The Rock and set the dial again to sign.';
          else msg.textContent='The register could not save your mark. Please try again.';
        }catch{if(live())msg.textContent='The register is out of reach. Try again when you are connected.';}
        finally{sign.disabled=false;input.disabled=false;}
      });
    }
    box.append(node('p','Opening the register…'));
    api().then(j=>{if(live()){record=j;draw(record);}}).catch(()=>{if(live())draw(record || {});});
  }
  function open(callbacks={}) {
    if(dialog?.open)return;
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
  window.PSRock=Object.freeze({open,isOpen:()=>!!dialog?.open});
})();
