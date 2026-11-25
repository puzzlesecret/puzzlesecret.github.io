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
  const x0=1.50,x1=2.66,z0=-1.12,z1=1.90,cx=(x0+x1)*0.5,depth=2.54;
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
  let built=false;
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
    for(let n=0;n<treadCount;n++){
      const height=depth-(n+1)*rise+0.13;
      shell(x1-x0,height,run+0.002,dark,cx,-depth-0.13+height/2,z1-(n+0.5)*run);
      shell(x1-x0+0.02,0.06,run+0.025,dark,cx,-(n+1)*rise,z1-(n+0.5)*run);
    }
    const far=-5.64,left=cx-1.67,right=cx+1.67,length=z0-far;
    shell(right-left+0.28,0.12,length+0.15,dark,cx,-depth-0.065,(z0+far)/2);
    for(const x of [left,right])shell(0.14,2.45,length,rock,x,-depth+1.225,(z0+far)/2);
    shell(right-left,2.45,0.14,rock,cx,-depth+1.225,far);
    for(const x of [(left+x0)/2,(right+x1)/2])shell(x0-left,2.45,0.1,rock,x,-depth+1.225,z0);
    shell(right-left,0.1,length,dark,cx,-0.065,(z0+far)/2);
    // Receding dressed stone arches, drawn together as one instanced mesh.
    const keystones = new THREE.InstancedMesh(new THREE.BoxGeometry(0.44,0.21,0.24),dark,33);
    const transform=new THREE.Object3D();let idx=0;
    for(const z of [z0-0.18,-3.48,far+0.12]){
      for(let j=0;j<11;j++){
        const a=(j+0.5)*Math.PI/11;
        transform.position.set(cx+1.57*Math.cos(a),-depth+1.37+0.93*Math.sin(a),z);
        transform.rotation.z=Math.atan2(0.93*Math.cos(a),-1.57*Math.sin(a));
        transform.updateMatrix();keystones.setMatrixAt(idx++,transform.matrix);
      }
      for(const x of [left+0.1,right-0.1])shell(0.22,1.42,0.24,dark,x,-depth+0.71,z);
    }
    room.add(keystones);
    const lamp=new THREE.MeshStandardMaterial({color:0xffd48d,emissive:0xffbb68,emissiveIntensity:1.35});
    for(const [x,y,z] of [[x0-0.01,-0.46,0.65],[left+0.13,-1.22,-3.7],[right-0.13,-1.22,-4.75]]){
      shell(0.12,0.24,0.13,lamp,x,y,z);
      for(const dy of [-0.14,0.14])shell(0.20,0.045,0.20,M.iron,x,y+dy,z);
      const glow=new THREE.PointLight(0xffb567,1.7,3.4,2);glow.position.set(x,y,z);room.add(glow);
    }
    // The open register and a brass pen on the table at the end of the aisle.
    const plateMap=canvasTex(640,200,(g,w,h)=>{
      g.fillStyle='#b99762';g.fillRect(0,0,w,h);g.strokeStyle='#594a35';g.lineWidth=3;
      g.strokeRect(9,9,w-18,h-18);g.strokeRect(16,16,w-32,h-32);
      g.fillStyle='#3a2a19';g.font='italic 49px Georgia,serif';g.textAlign='center';
      g.fillText('For the one who',w/2,83);g.fillText('looked underneath.',w/2,144);
    });
    const plate=new THREE.Mesh(new THREE.PlaneGeometry(1.15,0.36),new THREE.MeshStandardMaterial({map:plateMap,roughness:0.6,metalness:0.12}));
    plate.position.set(cx,-depth+1.48,far+0.075);room.add(plate);
    const dz=far+0.79;
    shell(1.48,0.10,0.68,mats.woodDark,cx,-depth+0.83,dz);
    for(const dx of [-0.61,0.61])for(const dz2 of [-0.23,0.23])shell(0.09,0.83,0.09,mats.woodDark,cx+dx,-depth+0.41,dz+dz2);
    const paper=canvasTex(512,256,(g,w,h)=>{
      g.fillStyle='#e0cd9e';g.fillRect(0,0,w,h);g.strokeStyle='#8d784e';g.lineWidth=1;
      for(const x of [18,274])for(let y=38;y<240;y+=20){g.beginPath();g.moveTo(x,y);g.lineTo(x+214,y);g.stroke();}
      g.fillStyle='#9a865f';g.fillRect(253,0,5,h);
    });
    const bound=shell(0.75,0.065,0.44,mats.woodDark,cx,-depth+0.91,dz);
    const page=new THREE.Mesh(new THREE.PlaneGeometry(0.70,0.40),new THREE.MeshStandardMaterial({map:paper,roughness:0.95}));
    page.rotation.x=-Math.PI/2;page.position.copy(bound.position);page.position.y+=0.034;room.add(page);
    const pen=shell(0.18,0.011,0.013,M.brass,cx+0.48,-depth+0.89,dz+0.10);pen.rotation.y=-0.75;
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
  const top={x:cx,z:z1+0.66,y:1.6};
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
    const angle=Math.atan2(Math.sin(-fromYaw),Math.cos(-fromYaw));
    return animate(1400,t=>{
      panel.rotation.z=-1.43*t;
      pose(start.x+(top.x-start.x)*t,start.z+(top.z-start.z)*t,1.6,fromYaw+angle*t,fromPitch+(-0.72-fromPitch)*t);
    });
  }
  function takeStairs(ascending) {
    below=!ascending;ctx.playCreak();
    return animate(2150,t=>{
      const u=ascending?1-t:t;
      const z=top.z+(-3.12-top.z)*u;
      const onStairs=THREE.MathUtils.clamp((z1-z)/(z1-z0),0,1);
      const pitch=-0.72+0.56*onStairs;
      pose(cx,z,1.6-depth*onStairs,0,pitch);
    });
  }
  function close(){
    if(animation)animation.finish();
    if(opened||below)pose(top.x,top.z,1.6,0,-0.27);
    floor.visible=true;room.visible=false;panel.rotation.z=0;
    stone.position.set(0,0.136,-0.015);stone.rotation.z=0;
    opened=false;below=false;lifted=false;
  }
  return {lift,openStairs,descend:()=>takeStairs(false),returnToRoom:()=>takeStairs(true),close,
    tick(){if(animation)animation.update();}};
}
