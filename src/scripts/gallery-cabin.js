import { buildBackWall } from './gallery-stone-wall.js';

/* The Gallery shares the study's painted surfaces. Log grain follows the length of
   each timber. Rectangular cuts preserve the original door and window reveals. */
export function buildCabin(ctx, B) {
  const { THREE, scene, M, canvasTex } = ctx;
  const standard = (options) => new THREE.MeshStandardMaterial(options);
  // The study's fallback floor is flagstone. Keep our own wood fallback while
  // its painted boards load, including when a visitor opens the room offline.
  const grain = canvasTex(512, 256, (g,w,h) => {
    g.fillStyle='#a78360'; g.fillRect(0,0,w,h);
    let seed=381;
    const random=()=>((seed=seed*16807%2147483647)/2147483647);
    for(let i=0;i<680;i++){
      const y=random()*h, x=random()*w, length=12+random()*w;
      g.strokeStyle=i%3?'rgba(74,49,35,.16)':'rgba(236,210,158,.30)';
      g.lineWidth=0.4+random()*1.1; g.beginPath();
      for(let k=0;k<=12;k++){
        const xx=x+length*k/12, dy=2.4*Math.sin(xx*0.017+y*.05)+1.6*Math.sin(xx*.031+y);
        if(k===0)g.moveTo(xx,y+dy); else g.lineTo(xx,y+dy);
      }
      g.stroke();
    }
    for(const [x,y] of [[88,74],[302,182],[417,45]]){
      g.strokeStyle='rgba(70,42,28,.42)';
      for(let i=1;i<7;i++){g.beginPath();g.ellipse(x,y,i*4,i*0.92,0,0,2*Math.PI);g.stroke();}
    }
  });
  const boards = canvasTex(512,512,(g,w,h)=>{
    for(let i=0;i<8;i++){
      const bw=w/8;
      g.save();g.translate(i*bw,0);g.rotate(Math.PI/2);
      g.drawImage(grain.image,(i*13)%110,(i*19)%120,390,76,0,-bw,h,bw);g.restore();
      g.fillStyle='rgba(54,39,28,.45)'; g.fillRect(i*bw,0,1.4,h);g.fillRect(i*bw,((i*179)%480)+12,bw,1.2);
    }
  },1.7,1.7);
  ctx.texLoader.load('/art/tex/study_floor.webp', t => {
    const c = boards.image;
    c.getContext('2d').drawImage(t.image, 0, 0, c.width, c.height);
    boards.needsUpdate = true;
    t.dispose();
  });
  boards.anisotropy=8; grain.anisotropy=8;
  const ceiling = standard({map:boards,color:0xa49484,roughness:0.92});
  const trim = standard({map:grain,color:0xc3a98b,roughness:0.85});
  const shell = standard({ color: 0x443328, roughness: 1 });
  const cloth = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#b8b3a1'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < w; k += 4) {
      g.fillStyle = k % 16 ? '#a9a696' : '#908d80'; g.fillRect(k, 0, 1, h);
      g.fillStyle = 'rgba(246,239,214,.48)'; g.fillRect(0, k, w, 1);
    }
  }, 2, 2);
  const mats = {
    trim, plaster: shell, boards: standard({map:boards,color:0xb5a38d,roughness:0.88}), ceil: ceiling,
    wood: trim, woodDark: trim.clone(),
    fabric: standard({ map: cloth, color: 0x777e70, roughness: 1 }),
    fabric2: standard({ map: cloth, color: 0x93998a, roughness: 1 })
  };
  mats.boards.bumpScale = 0.007;
  mats.woodDark.color.set(0xa58c77);
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 8.5), ceiling);
  roof.rotation.x = Math.PI / 2; roof.position.y = 3.6; scene.add(roof);

  // Each eight-sided hewn face has a different hue and a different slice of a
  // painted plank. All wall courses share one geometry and one draw call.
  const positions = [], colors = [], uvs = [], indices = [];
  let seed = 21;
  const rand = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
  const tint = new THREE.Color();
  const map = grain.clone(); map.repeat.set(1, 1); map.needsUpdate = true;
  const logMaterial = standard({ map, color:0xb3a08f, roughness: 0.97, vertexColors: true, side: THREE.DoubleSide });
  function section(axis, side, center, from, to, bottom, top) {
    const alongX = axis === 'x', len = to - from;
    const mid = (from + to) / 2, midY = (bottom + top) / 2;
    B(alongX ? len : 0.10, top - bottom, alongX ? 0.10 : len, shell,
      alongX ? mid : center - side * 0.065, midY, alongX ? center - side * 0.065 : mid);
    const step = 0.285, shift = alongX ? 0 : step / 2;
    for (let row = -1; row < 16; row++) {
      const low = Math.max(bottom, shift + row * step);
      const high = Math.min(top, shift + (row + 1) * step);
      if (high <= low + 0.001) continue;
      const tone = 0.89 + rand() * 0.15;
      tint.setRGB(tone, tone * 0.94, tone * 0.89);
      const startU = (Math.floor(rand() * 8) + 0.13) / 8;
      const startV = rand(), phase = rand() * 8;
      const pieces = Math.max(1, Math.ceil(len / 0.85));
      const base = positions.length / 3;
      const profile = [-0.035, 0.022, 0.064, 0.077, 0.064, 0.027, -0.025];
      const heights = [0.012, 0.08, 0.24, 0.52, 0.77, 0.91, 0.99];
      for (let k = 0; k <= pieces; k++) {
        const u = k / pieces, along = from + len * u;
        const warp = 0.007 * Math.sin(along * 1.8 + phase);
        for (let j = 0; j < profile.length; j++) {
          const across = center + side * (profile[j] + warp);
          positions.push(alongX ? along : across, low + (high - low) * heights[j], alongX ? across : along);
          uvs.push(startV + len * u * 0.37, startU + heights[j] * 0.38);
          colors.push(tint.r, tint.g, tint.b);
          if (k && j) {
            const i = base + k * 7 + j;
            // Wind every face toward the room so directional light wraps around logs.
            if (alongX === (side > 0)) indices.push(i - 8, i - 1, i, i - 8, i, i - 7);
            else indices.push(i - 8, i, i - 1, i - 8, i - 7, i);
          }
        }
      }
    }
  }
  section('z', 1, -4.09, -4.22, 4.18, 0, 3.6);
  scene.add(buildBackWall(ctx, B));
  // The stove hearth retains its original masonry finish.
  const stoneMap = canvasTex(512,512,(g,w,h)=>{
    g.fillStyle='#6f6a60';g.fillRect(0,0,w,h);
    for(let row=0;row<4;row++){
      for(let col=-1;col<3;col++){
        const x=col*256+(row%2)*128, y=row*128;
        const shade=99+12*Math.cos(row*3+col);
        g.fillStyle='rgb('+shade+','+(shade-4)+','+(shade-10)+')';
        g.fillRect(x+3,y+3,250,122);
      }
    }
  },4.8,3.6);
  ctx.texLoader.load('/art/tex/stone_wall.webp',t=>{
    const c=stoneMap.image;
    const g=c.getContext('2d');
    g.drawImage(t.image,0,0,c.width,c.height);g.fillStyle='rgba(157,146,124,.26)';g.fillRect(0,0,c.width,c.height);
    stoneMap.needsUpdate=true; t.dispose();
  });
  stoneMap.anisotropy=8;
  const stone=standard({map:stoneMap,roughness:0.98});
  const masonry = (w,h,d,x,y,z) => {const m=B(w,h,d,M.wall,x,y,z);m.material=stone;return m;};
  const south = (a,b,low=0) => section('x',-1,4.01,a,b,low,3.6);
  south(-4.2,-3.6); south(-3.6,-2.6,2.4); south(-2.6,-1.2); south(-1.2,1.2,3.2); south(1.2,4.2);
  const east = (a,b,low=0,top=3.6) => section('z',-1,4.09,a,b,low,top);
  east(-4.18,-1.3); east(-1.3,0.3,0,0.9); east(-1.3,0.3,2.9); east(0.3,4.18);
  section('z',1,-4.1,4.08,5.72,0,2.6);
  section('z',-1,-2.2,4.08,5.72,0,2.6);
  section('x',-1,5.72,-4.16,-2.16,0,2.6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2));
  geo.setIndex(indices); geo.computeVertexNormals();
  const walls = new THREE.Mesh(geo, logMaterial); walls.name = 'Hewn cabin walls'; scene.add(walls);
  for (const z of [-3.15,-1.58,0,1.58,3.15]) {
    B(8.18,0.22,0.2,trim,0,3.45,z);
    for (const x of [-3.89,3.89]) {
      const brace = B(0.5,0.13,0.17,trim,x,3.24,z);
      brace.rotation.z = x < 0 ? 0.67 : -0.67;
    }
  }
  for (const x of [-4.01,4.01]) B(0.14,0.15,8.15,trim,x,3.35,0);
  masonry(1.64,0.016,0.38,-1.5,0.008,-3.79);
  masonry(1.55,0.13,1.32,3.15,0.013,3.29);
  masonry(1.64,2.02,0.26,3.1,1.0,3.85);
  masonry(0.23,2.02,1.18,3.88,1.0,3.35);
  masonry(1.68,0.095,0.33,3.1,2.035,3.84);
  // A shielded oil light above the cabinet introduces the same brass and amber
  // light that lead into the study. Its bracket actually meets the log.
  B(0.12,0.23,0.09,M.iron,0.55,2.05,-3.91);
  B(0.05,0.05,0.28,M.iron,0.55,1.98,-3.8);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.115,14,12),standard({
    color:0xf4d5a0, emissive:0xffb165, emissiveIntensity:0.65, roughness:0.55
  }));
  globe.scale.set(0.83,1.22,0.83); globe.position.set(0.55,2.15,-3.69); scene.add(globe);
  for (const y of [2.02,2.29]) B(0.19,0.045,0.18,M.iron,0.55,y,-3.69);
  const lamp = new THREE.PointLight(0xffc58b,4.1,5.5,2);
  lamp.position.set(0.55,2.16,-3.31); scene.add(lamp);
  // These rooms run with shadow maps disabled. Soft contact under the furniture
  // anchors it to the boards; keep the transparent planes below the rugs and clues.
  const shade = canvasTex(64,64,(g,w,h) => {
    const grad = g.createRadialGradient(w/2,h/2,3,w/2,h/2,w/2);
    grad.addColorStop(0,'rgba(36,23,16,.48)'); grad.addColorStop(0.6,'rgba(36,23,16,.27)');
    grad.addColorStop(1,'rgba(36,23,16,0)'); g.fillStyle=grad; g.fillRect(0,0,w,h);
  });
  const shadeMat = new THREE.MeshBasicMaterial({ map:shade, transparent:true, depthWrite:false });
  for (const [x,z,w,d] of [[0.79,0.3,1.38,2.95],[-1.85,0.2,0.88,0.8],[0.78,-1.42,0.7,0.68],[3.15,3.15,1.95,1.68],[2.5,-3.72,2.35,0.82]]) {
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(w,d),shadeMat);
    contact.rotation.x=-Math.PI/2; contact.position.set(x,0.0015,z); scene.add(contact);
  }
  return mats;
}
