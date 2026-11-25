// One shared mesh for the fieldstone. The recessed backing stops light showing
// between the stones; the opening matches the existing Vault I door.
export function buildBackWall({ THREE, canvasTex, texLoader }, box) {
  const mortar = new THREE.MeshStandardMaterial({ color: 0x61594d, roughness: 1 });
  box(1.85, 3.6, 0.16, mortar, -3.275, 1.8, -4.095);
  box(4.85, 3.6, 0.16, mortar, 1.775, 1.8, -4.095);
  box(1.7, 1.1, 0.16, mortar, -1.5, 3.05, -4.095);

  let seed = 9337;
  const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const grain = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#999488';
    g.fillRect(0, 0, w, h);
  });
  texLoader.load('/art/tex/cabin-fieldstone.webp', loaded => {
    const c = grain.image;
    c.getContext('2d').drawImage(loaded.image, 0, 0, c.width, c.height);
    grain.needsUpdate = true;
    loaded.dispose();
  });
  const positions = [], colors = [], uvs = [], indices = [];
  function block(left, right, bottom, top, proud = 0) {
    const x = (left + right) / 2, y = (bottom + top) / 2;
    const w = (right - left) / 2 - .006, h = (top - bottom) / 2 - .008;
    const chip = () => .025 + random() * .06;
    const edge = [
      [-w + chip(), -h], [w - chip(), -h], [w, -h + chip()], [w, h - chip()],
      [w - chip(), h], [-w + chip(), h], [-w, h - chip()], [-w, -h + chip()]
    ];
    const tone = .61 + random() * .31;
    const warm = .96 + random() * .07;
    const faceZ = -3.965 + random() * .047 + proud;
    const offset = random() * .34;
    function vertex(dx, dy, z, light) {
      positions.push(x + dx, y + dy, z);
      colors.push(tone * warm * light, tone * light, tone / warm * light);
      uvs.push(offset + (dx / w + 1) * .31, .5 + dy / h * .46);
    }
    const start = positions.length / 3;
    for (const [dx, dy] of edge) vertex(dx, dy, -4.019, .65);
    for (const [dx, dy] of edge) {
      const inset = .02 + random() * .027;
      vertex(dx * (1 - inset / w), dy * (1 - inset / h), faceZ + random() * .014, 1);
    }
    vertex(w * (random() - .5) * .34, h * (random() - .5) * .3, faceZ + .023, 1);
    for (let i = 0; i < 8; i++) {
      const next = (i + 1) % 8;
      indices.push(start + i, start + next, start + 8 + next,
        start + i, start + 8 + next, start + 8 + i,
        start + 8 + i, start + 8 + next, start + 16);
    }
  }
  function course(left, right, low, high) {
    let cursor = left;
    while (cursor < right) {
      const width = .43 + random() * .60;
      const end = right - cursor < width + .36 ? right : cursor + width;
      block(cursor, end, low, high);
      cursor = end;
    }
  }
  const heights = [0, .33, .76, 1.12, 1.49, 1.90, 2.20, 2.50, 2.86, 3.22, 3.60];
  for (let i = 1; i < heights.length; i++) {
    const low = heights[i - 1], high = heights[i];
    if (low >= 2.86) {
      course(-4.2, 4.2, low, high);
    } else {
      const left = -2.65 - (i % 2) * .11, right = -.35 + (i % 2) * .11;
      course(-4.2, left, low, high);
      course(right, 4.2, low, high);
      if (low < 2.5) {
        block(left, -2.35, low, high, .049);
        block(-.65, right, low, high, .049);
      } else {
        block(left, right, low, high, .052);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const surface = new THREE.MeshStandardMaterial({ map: grain, vertexColors: true, roughness: .97, flatShading: true });
  const wall = new THREE.Mesh(geometry, surface);
  wall.name = 'Gallery fieldstone back wall';
  return wall;
}
