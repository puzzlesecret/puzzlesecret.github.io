/* A single long stone hall behind the landing. Coordinates are local to the
   hall floor. The upstairs camera and floor remain owned by the Gallery. */
export function buildUndercroft(ctx, parent, cx, depth, mats) {
  const { THREE:T, canvasTex, texLoader, M }=ctx;
  const hull=new T.Group();
  hull.position.set(cx,-depth,-1.12); parent.add(hull);
  const targets=[], lamps=[], anchors=new Map(), batches=new Map();
  const pigment=(color)=>new T.MeshStandardMaterial({color,roughness:.88});
  const stoneTex=texLoader.load('/art/tex/cabin-fieldstone.webp');
  stoneTex.colorSpace=T.SRGBColorSpace;
  stoneTex.wrapS=stoneTex.wrapT=T.RepeatWrapping; stoneTex.repeat.set(4,1);
  const stone=new T.MeshStandardMaterial({color:0x9a8e7a,map:stoneTex,roughness:.94});
  const coping=pigment(0x807561), trim=pigment(0x554938), felt=pigment(0x374d46);
  const paper=pigment(0xe6d8af), walnut=mats.woodDark, brass=M.brass, iron=M.iron;
  const matrix=new T.Object3D();
  function block(mat,x,y,z,w,h,d,ry=0,rz=0,rx=0){
    matrix.position.set(x,y,z);matrix.rotation.set(rx,ry,rz,'YXZ');matrix.scale.set(w,h,d);matrix.updateMatrix();
    if(!batches.has(mat))batches.set(mat,[]);
    batches.get(mat).push(matrix.matrix.clone());
  }
  function mesh(geometry,material,x,y,z,ry=0){
    const o=new T.Mesh(geometry,material);o.position.set(x,y,z);o.rotation.y=ry;hull.add(o);return o;
  }
  function plane(map,x,y,z,w,h,ry=0){
    return mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map,roughness:.87}),x,y,z,ry);
  }
  function inscription(words,w=640,h=100){
    return canvasTex(w,h,(g)=>{
      g.fillStyle='#46392a';g.fillRect(0,0,w,h);g.strokeStyle='#b49b65';g.lineWidth=3;g.strokeRect(5,5,w-10,h-10);
      g.fillStyle='#f2deb2';g.font='small-caps '+Math.floor(h*.51)+'px Georgia';g.textAlign='center';g.textBaseline='middle';g.fillText(words,w/2,h/2,w-25);
    });
  }
  const hitMat=new T.MeshBasicMaterial({visible:false});
  function target(id,x,y,z,w,h,d,ax,az){
    const o=mesh(new T.BoxGeometry(w,h,d),hitMat,x,y,z);o.userData.exhibit=id;targets.push(o);
    anchors.set(id,{x:cx+ax,z:-1.12+az,yaw:Math.atan2(ax-x,az-z),pitch:Math.atan2(y-1.6,Math.hypot(ax-x,az-z))});
  }
  const left=-3.65,right=3.65,far=-10.9;
  const ground=mesh(new T.BoxGeometry(7.3,.14,-far),coping,0,-.07,far/2);
  for(const side of [-1,1]){
    block(stone,side*3.69,depth/2,far/2,.14,depth,-far);
    block(stone,side*2.12,depth/2,0,3.07,depth,.17);
    block(trim,side*3.59,.17,far/2,.15,.34,-far);
    for(const z of [-.3,-3.15,-5.95,-8.75,-10.64]){
      block(coping,side*3.52,1.30,z,.23,2.60,.32);
      block(trim,side*3.50,.16,z,.35,.3,.46);
      block(coping,side*3.49,2.60,z,.41,.18,.49);
    }
  }
  block(stone,0,depth/2,far,7.45,depth,.16);
  block(trim,0,depth-.055,far/2,7.4,.11,-far);
  for(const z of [-.3,-3.15,-5.95,-8.75,-10.64]){
    block(walnut,0,depth-.19,z,7.28,.24,.32);
    for(const side of [-1,1])block(walnut,side*3.13,depth-.52,z,1.05,.17,.24,0,side*.58);
  }
  // Flagstones and a narrow, faded woven runner lead toward the register.
  const tiles=[0x695f50,0x756b5b,0x817767,0x706757].map(pigment);
  for(let row=0;row<13;row++)for(let col=0;col<6;col++){
    block(tiles[(row*7+col*3+Math.floor(col/2))%4],left+.61+col*1.215,.008,-.42-row*.837,1.20,.016,.825);
  }
  const runner=pigment(0x663e33);
  block(runner,0,.024,-5.42,1.44,.012,9.55);
  for(const side of [-1,1])for(const offset of [.58,.65])block(trim,side*offset,.034,-5.42,.021,.008,9.48);
  // Framed portraits face the central aisle. Roman numerals are diegetic labels.
  const numerals=['I','II','III','IV','V','VI','VII'];
  const portraits=[[-1,-1.75],[-1,-4.55],[-1,-7.35],[-1,-9.70],[1,-1.75],[1,-4.55],[1,-7.35]];
  portraits.forEach(([side,z],i)=>{
    const ry=-side*Math.PI/2,id='k'+(i+1),x=side*3.52,y=1.68;
    block(walnut,x,y,z,.16,1.40,1.08);
    block(brass,x-side*.086,y,z,.032,1.33,1.01);
    block(trim,x-side*.112,y,z,.027,1.26,.94);
    const art=texLoader.load('/art/keepers/'+id+'.webp');art.colorSpace=T.SRGBColorSpace;
    plane(art,x-side*.13,y,z,.86,1.16,ry);
    plane(inscription(numerals[i],160,60),x-side*.13,.85,z,.32,.12,ry);
    target(id,x-side*.15,y,z,.24,1.62,1.17,side*1.65,z);
  });
  function table(x,z,w,d){
    block(walnut,x,.88,z,w,.12,d);block(trim,x,.74,z,w-.11,.19,d-.11);
    for(const dx of [-1,1])for(const dz of [-1,1])block(walnut,x+dx*(w/2-.11),.37,z+dz*(d/2-.11),.13,.74,.13);
    block(felt,x,.948,z,w-.1,.018,d-.1);
  }
  table(2.52,-9.56,1.92,.91);
  const disc=mesh(new T.CylinderGeometry(.235,.245,.055,48),brass,1.94,.995,-9.58);
  const dialMap=canvasTex(256,256,(g,w,h)=>{
    g.fillStyle='#c6a269';g.fillRect(0,0,w,h);g.translate(w/2,h/2);g.strokeStyle='#58442a';
    for(const r of [48,85,110]){g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.stroke();}
    for(let j=0;j<48;j++){g.rotate(Math.PI/24);g.fillStyle='#4b3a28';g.fillRect(-1,91,2,j%4?8:15);}
    g.rotate(.58);g.beginPath();g.moveTo(0,-86);g.lineTo(13,0);g.lineTo(0,44);g.lineTo(-12,0);g.fill();
  });
  const dial=mesh(new T.CircleGeometry(.229,48),new T.MeshStandardMaterial({map:dialMap}),disc.position.x,1.024,disc.position.z);dial.rotation.x=-Math.PI/2;
  for(let j=0;j<5;j++){const x=2.34+j*.073;block(paper,x,.99,-9.53,.081,.016,.30,0,j%2?.40:-.40);block(trim,x,1.004,-9.49,.012,.008,.12);}
  block(walnut,3.12,1.00,-9.58,.47,.14,.35);
  block(felt,3.12,1.075,-9.58,.39,.014,.27);
  block(walnut,3.12,1.19,-9.76,.47,.29,.045,0,0,-.22);block(brass,3.12,1.00,-9.39,.065,.045,.02);
  for(const [id,x] of [['disc',1.94],['strip',2.51],['box',3.12]])target(id,x,1.04,-9.55,.54,.38,.59,x,-8.58);
  plane(inscription('INSTRUMENTS'),2.52,.76,-9.085,.76,.115);
  table(0,-10.03,1.94,.83);
  block(walnut,0,.981,-10,.82,.055,.56);
  for(const side of [-1,1]){
    block(paper,side*.185,1.02,-10,.36,.039,.50,0,side*-.06);
    for(let n=0;n<6;n++)block(trim,side*.19,1.045,-10.16+n*.059,.26,.004,.005);
  }
  block(brass,.58,.98,-9.99,.018,.021,.36,-.38);
  plane(inscription('THE REGISTER'),0,1.97,far+.095,1.79,.28);
  target('register',0,1.00,-10,1.86,.70,.88,0,-8.72);
  target('stairs',0,1.0,.05,1.12,2.1,.24,0,-1.35);
  // Frosted glass and carved brackets catch light even at phone resolutions.
  const shades=[];
  for(const [i,z] of [-.46,-3.05,-5.86,-8.66,-10.56].entries()){
    const side=i%2?-1:1,x=side*3.31;
    block(iron,side*3.51,2.16,z,.35,.06,.11);
    block(brass,x,2.05,z,.23,.045,.24);
    block(iron,x,2.45,z,.28,.065,.27);
    const glass=new T.MeshStandardMaterial({color:0xe5bd85,emissive:0xffab47,emissiveIntensity:0});
    mesh(new T.CylinderGeometry(.116,.084,.34,8),glass,x,2.25,z);
    for(const dx of [-.084,.084])for(const dz of [-.084,.084])block(iron,x+dx,2.25,z+dz,.014,.37,.014);
    shades.push(glass);
    if(i%2===0){const lamp=new T.PointLight(0xffc989,0,7,2);lamp.position.set(x-side*.28,2.19,z+.15);hull.add(lamp);lamps.push([i,lamp]);}
  }
  for(const [material,transforms] of batches){
    const inst=new T.InstancedMesh(new T.BoxGeometry(1,1,1),material,transforms.length);
    transforms.forEach((matrix,i)=>inst.setMatrixAt(i,matrix));hull.add(inst);
  }
  return {targets,ground,anchors,bounds:{left:cx+left+.45,right:cx+right-.45,near:-1.64,far:-10.06},
    light(seconds,reduced){
      const stage=i=>reduced?1:Math.min(1,Math.max(0,(seconds-.45*i)*2.9));
      shades.forEach((mat,i)=>{mat.emissiveIntensity=2.4*stage(i);});
      lamps.forEach(([i,lamp])=>{lamp.intensity=10*stage(i);});
    }};
}
