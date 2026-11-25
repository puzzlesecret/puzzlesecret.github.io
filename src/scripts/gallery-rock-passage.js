import { buildUndercroft } from './undercroft-room.js';
/* The shelf and its concealed stair share the Gallery's world coordinates. The ordinary
   floor keeps its original walk target. Only during the visit do we reveal its cutout. */
export function buildRockPassage(ctx, mats) {
  const { THREE, scene, box, canvasTex, floor, player, M } = ctx;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shelf = new THREE.Group();
  shelf.name = 'The Rock on its shelf';
  shelf.position.set(1.75, 1.13, 3.76);
  scene.add(shelf);
  const block = (w,h,d,mat,x,y,z,parent) => box(w,h,d,mat,x,y,z,0,parent);
  block(0.74,0.08,0.43,mats.woodDark,0,0,0,shelf);
  for (const x of [-0.23,0.23]) block(0.05,0.19,0.28,M.iron,x,-0.11,0.04,shelf);
  const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.23, 1), new THREE.MeshStandardMaterial({
    color: 0x726e62, roughness: 0.94, flatShading: true,
    map: ctx.texLoader.load('/art/tex/cabin-fieldstone.webp')
  }));
  stone.position.set(0,0.136,-0.015); stone.scale.set(1.17,0.51,0.82); stone.rotation.y=0.4;
  shelf.add(stone);
  const dialTex = canvasTex(256,256,(g,w,h)=>{
    g.fillStyle='#a98b50';g.fillRect(0,0,w,h);
    g.translate(w/2,h/2);
    for (const radius of [115,108,83]) {
      g.beginPath();g.arc(0,0,radius,0,2*Math.PI);g.strokeStyle='#56452b';g.lineWidth=3;g.stroke();
    }
    for(let n=0;n<60;n++){
      g.save();g.rotate(n*Math.PI/30);g.fillStyle='#3d3325';g.fillRect(-1,-103,n%5?2:4,n%5?5:11);g.restore();
    }
    g.strokeStyle='#292822';g.lineWidth=7;g.lineCap='round';
    g.beginPath();g.moveTo(-39,-26);g.lineTo(0,0);g.lineTo(56,-56);g.stroke();
  });
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.156,40),new THREE.MeshStandardMaterial({map:dialTex,roughness:0.52}));
  dial.rotation.x=-Math.PI/2;dial.position.set(0,0.042,-0.015);shelf.add(dial);
  const x0=1.50,x1=2.66,z0=-1.12,z1=1.90,cx=(x0+x1)*0.5,depth=3.18;
  const room=new THREE.Group();room.name='Vault below the Gallery';room.visible=false;scene.add(room);
  const panel=new THREE.Group();panel.name='Concealed floor hatch';panel.position.set(x1,0,0);room.add(panel);
  // UVs in the same frame as the original uninterrupted 8.4 metre floor.
  function boards(left,right,far,near,parent,offset=0) {
    const geo=new THREE.PlaneGeometry(right-left,near-far);
    const uv=geo.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(left+uv.getX(i)*(right-left)+4.2)/8.4,(4.2-near+uv.getY(i)*(near-far))/8.4);
    const part=new THREE.Mesh(geo,mats.boards);part.rotation.x=-Math.PI/2;
    part.position.set((left+right)/2-offset,0,(far+near)/2);parent.add(part);
  }
  let built=false, hall;
  function revealGeometry() {
    if(built)return;
    built=true;
    boards(-4.2,x0,-4.2,4.2,room);boards(x1,4.2,-4.2,4.2,room);
    boards(x0,x1,-4.2,z0,room);boards(x0,x1,z1,4.2,room);
    boards(x0,x1,z0,z1,panel,x1);
    block(x1-x0,0.085,z1-z0,mats.woodDark,-(x1-x0)/2,-0.045,(z0+z1)/2,panel);
    for(const z of [z0+0.28,z1-0.28])block(x1-x0-0.06,0.05,0.085,M.iron,-(x1-x0)/2,-0.11,z,panel);
    const surface=ctx.texLoader.load('/art/tex/stone_wall.webp');
    surface.colorSpace=THREE.SRGBColorSpace;surface.wrapS=surface.wrapT=THREE.RepeatWrapping;
    const rock=new THREE.MeshStandardMaterial({color:0x968b7d,roughness:1,map:surface});
    const grain=ctx.texLoader.load('/art/tex/cabin-fieldstone.webp');
    grain.colorSpace=THREE.SRGBColorSpace;
    const dark=new THREE.MeshStandardMaterial({color:0xaa9b86,map:grain,roughness:0.95});
    const shell=(w,h,d,mat,x,y,z)=>block(w,h,d,mat,x,y,z,room);
    for(const x of [x0-0.10,x1+0.10])shell(0.2,depth,z1-z0,rock,x,-depth/2,(z0+z1)/2);
    const stairLight=new THREE.PointLight(0xffdaa2,6.5,5.0,2);
    stairLight.position.set(cx,0.23,0.12);room.add(stairLight);
    const deskLight=new THREE.PointLight(0xffe5ba,5.0,4,2);
    deskLight.position.set(cx,-0.62,-4.35);room.add(deskLight);
    const treadCount=13, run=(z1-z0)/treadCount, rise=depth/treadCount;
    const seams=new THREE.InstancedMesh(new THREE.BoxGeometry(x1-x0-0.025,0.014,0.026),M.iron,treadCount);
    const seamPose=new THREE.Matrix4();
    for(let n=0;n<treadCount;n++){
      const height=depth-(n+1)*rise+0.13;
      shell(x1-x0,height,run+0.002,dark,cx,-depth-0.13+height/2,z1-(n+0.5)*run);
      shell(x1-x0+0.02,0.06,run+0.025,dark,cx,-(n+1)*rise,z1-(n+0.5)*run);
      seamPose.makeTranslation(cx,-(n+1)*rise+0.032,z1-(n+1)*run+0.018);
      seams.setMatrixAt(n,seamPose);
    }
    room.add(seams);
    hall=buildUndercroft(ctx, room, cx, depth, mats);
    hall.light(0,false);
  }

  // Each hook resolves once its movement is visible. The dialog can then offer the next action.
  let animation=null, lifted=false, opened=false, below=false;
  function animate(milliseconds, paint) {
    if(animation)animation.finish();
    return new Promise(resolve=>{
      const start=performance.now();
      function finish(){paint(1);animation=null;resolve();}
      if(reduced){finish();return;}
      animation={finish,update(){
        const t=Math.min(1,(performance.now()-start)/milliseconds);
        if(t>=1){finish();return;}
        paint(t*t*(3-2*t));
      }};
    });
  }
  function pose(x,z,y,yaw,pitch) {
    player.pos.set(x,0,z);player.target.copy(player.pos);ctx.setEye(y);ctx.setView(yaw,pitch);
  }
  const top={x:x0-0.18,z:z1+0.02,y:1.6,yaw:-0.52,pitch:-1.07};
  function lift(){
    if(lifted)return;
    lifted=true;ctx.playThud();
    return animate(650,t=>{
      stone.position.set(-0.235*t,0.136+0.14*Math.sin(Math.PI*t),-0.015);
      stone.rotation.z=0.48*t;
    });
  }
  function openStairs(){
    if(opened)return;
    opened=true;revealGeometry();floor.visible=false;room.visible=true;ctx.playCreak();
    const start=player.pos.clone(),[fromYaw,fromPitch]=ctx.getView();
    const angle=Math.atan2(Math.sin(top.yaw-fromYaw),Math.cos(top.yaw-fromYaw));
    return animate(1400,t=>{
      panel.rotation.z=-1.43*t;
      pose(start.x+(top.x-start.x)*t,start.z+(top.z-start.z)*t,1.6,fromYaw+angle*t,fromPitch+(top.pitch-fromPitch)*t);
    });
  }
  const bottomZ=-3.12, bottomPitch=-0.21, landingZ=z1+0.64;
  function eyeOnStairs(z) {
    return 1.6-depth*THREE.MathUtils.clamp((z1-z)/(z1-z0),0,1);
  }
  let litAt=null, nearby=null;
  function descend() {
    below=true;nearby=null;litAt=performance.now()+1000;ctx.playCreak();
    return animate(2350,t=>{
      // Step squarely onto the first tread before starting down.
      const turn=Math.min(1,t/0.17);
      const walk=Math.max(0,(t-0.17)/0.83);
      const z=top.z+(bottomZ-top.z)*walk;
      const pitch=top.pitch+(bottomPitch-top.pitch)*Math.min(1,walk*1.42);
      pose(top.x+(cx-top.x)*turn,z,eyeOnStairs(z),top.yaw*(1-turn),pitch);
    });
  }
  let backOnLanding=false;
  async function returnToRoom() {
    ctx.playCreak();
    // Turn away from the register before climbing. Keeping the landing in view
    // also lets the reader see the underside of the raised hatch on the way out.
    player.target.copy(player.pos);
    const start=player.pos.clone(),[fromYaw,fromPitch]=ctx.getView();
    const angle=Math.atan2(Math.sin(Math.PI-fromYaw),Math.cos(Math.PI-fromYaw));
    await animate(1000,t=>pose(start.x+(cx-start.x)*t,start.z+(bottomZ-start.z)*t,eyeOnStairs(bottomZ),
      fromYaw+angle*t,fromPitch+(0.12-fromPitch)*t));
    await animate(2400,t=>{
      const z=bottomZ+(landingZ-bottomZ)*t;
      const pitch=0.12+0.21*Math.sin(Math.PI*t)-0.25*t;
      pose(cx,z,eyeOnStairs(z),Math.PI-0.24*t,pitch);
    });
    below=false;backOnLanding=true;
  }
  function close(){
    if(animation)animation.finish();
    if((opened||below)&&!backOnLanding)pose(cx,landingZ,1.6,0,-0.27);
    floor.visible=true;room.visible=false;panel.rotation.z=0;
    stone.position.set(0,0.136,-0.015);stone.rotation.z=0;
    opened=false;below=false;lifted=false;backOnLanding=false;
  }
  const {canvas,camera}=ctx;
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let gesture=null;
  const canWalk=()=>below && !animation && !!window.PSRock?.canWalk?.();
  function bounded(x,z){
    const b=hall.bounds;
    return [THREE.MathUtils.clamp(x,b.left,b.right),THREE.MathUtils.clamp(z,b.far,b.near)];
  }
  function destination(x,z){
    const [bx,bz]=bounded(x,z);
    player.target.set(bx,0,bz);
  }
  function focusItem(id){
    const anchor=hall?.anchors.get(id);
    if(!below || !anchor)return;
    const [x,z]=bounded(anchor.x,anchor.z);
    const start=player.pos.clone(),[yaw,pitch]=ctx.getView();
    const dy=Math.atan2(Math.sin(anchor.yaw-yaw),Math.cos(anchor.yaw-yaw));
    return animate(650,t=>pose(start.x+(x-start.x)*t,start.z+(z-start.z)*t,1.6-depth,
        yaw+dy*t,pitch+(anchor.pitch-pitch)*t));
  }
  const zones={west:'k2',east:'k6',bench:'strip',desk:'register',landing:'stairs'};
  function walkTo(id){return focusItem(zones[id] || id);}
  // Compare each wall at all of its portraits, so a reader at the far end
  // of a wall is still offered the right set of people to inspect.
  const stationItems={
    landing:['stairs'],west:['k1','k2','k3','k4'],east:['k5','k6','k7'],
    bench:['disc','strip','box'],desk:['register']
  };
  let lastX=NaN,lastZ=NaN;
  function updateStation(){
    if(!canWalk()){lastX=NaN;return;}
    const {x,z}=player.pos;
    if (Math.abs(x-lastX)+Math.abs(z-lastZ)<.045)return;
    lastX=x;lastZ=z;
    let closest=null, distance=Infinity;
    for(const [station,ids] of Object.entries(stationItems)){
      for(const id of ids){
        const a=hall.anchors.get(id);
        const d=Math.hypot(x-a.x,z-a.z)-(station===nearby?.16:0);
        if(d<distance){closest=station;distance=d;}
      }
    }
    nearby=closest;
    window.PSRock.setStation?.(closest);
  }
  function pointAt(event){
    const r=canvas.getBoundingClientRect();
    pointer.set((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2);
    ray.setFromCamera(pointer,camera);
    return ray.intersectObjects([...hall.targets,hall.ground],false)[0];
  }
  canvas.addEventListener('pointerdown',event=>{
    if(!below)return;
    event.stopImmediatePropagation();
    if(!canWalk() || !event.isPrimary || event.button!==0)return;
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,view:ctx.getView(),drag:false};
    canvas.setPointerCapture(event.pointerId);
  },true);
  canvas.addEventListener('pointermove',event=>{
    if(!below)return;
    event.stopImmediatePropagation();
    if(!gesture || gesture.id!==event.pointerId || !canWalk())return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(Math.hypot(dx,dy)>6)gesture.drag=true;
    if(gesture.drag)ctx.setView(gesture.view[0]-dx*.005,
      THREE.MathUtils.clamp(gesture.view[1]-dy*.004,-1.05,.84));
  },true);
  canvas.addEventListener('pointercancel',()=>{gesture=null;},true);
  canvas.addEventListener('pointerup',event=>{
    if(!below)return;
    event.stopImmediatePropagation();
    if(!gesture || event.pointerId!==gesture.id)return;
    const tapped=!gesture.drag && canWalk();gesture=null;
    if(!tapped)return;
    const hit=pointAt(event);
    if(!hit)return;
    const id=hit.object.userData.exhibit;
    if(!id){destination(hit.point.x,hit.point.z);return;}
    player.target.copy(player.pos);
    if(id==='stairs')window.PSRock.askExit();
    else {focusItem(id);window.PSRock.inspect(id);}
  },true);
  window.addEventListener('keydown',event=>{
    if(!below || !canWalk() || event.altKey || event.metaKey || event.ctrlKey)return;
    const key=event.key.toLowerCase(),[yaw,pitch]=ctx.getView();
    if(!['w','s','a','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key))return;
    event.stopImmediatePropagation();event.preventDefault();
    if(['a','arrowleft','d','arrowright'].includes(key)){
      ctx.setView(yaw+(['a','arrowleft'].includes(key)?.18:-.18),pitch);return;
    }
    const step=['w','arrowup'].includes(key)?.78:-.65;
    destination(player.target.x-Math.sin(yaw)*step,player.target.z-Math.cos(yaw)*step);
  },true);
  return {lift,openStairs,descend,returnToRoom,walkTo,focusItem,close,
    get below(){return below;},
    tick(){
      if(animation)animation.update();
      if(below && litAt!==null){hall.light((performance.now()-litAt)/1000,reduced);updateStation();}
    }};
}
