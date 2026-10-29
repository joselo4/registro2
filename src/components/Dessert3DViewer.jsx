import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { baseVisual, flavorColor } from '../utils/dessert';
import { syrupColor, toppingKind } from '../utils/toppingKinds';
import './dessert-3d.css';

// Scoop centres per vessel and count, in scene units (x, y, z, radius).
const CONE_LAYOUT = [
  [],
  [[0, 0.5, 0, 0.56]],
  [[0, 0.48, 0, 0.52], [0.02, 1.16, 0.02, 0.47]],
  [[-0.28, 0.6, 0, 0.42], [0.28, 0.6, 0.02, 0.42], [0, 1.18, 0.05, 0.44]],
  [[-0.27, 0.58, 0, 0.4], [0.27, 0.58, 0.02, 0.4], [-0.2, 1.13, 0.04, 0.38], [0.22, 1.13, -0.02, 0.38]],
  [[-0.27, 0.57, 0, 0.39], [0.27, 0.57, 0.02, 0.39], [-0.22, 1.09, 0.04, 0.37], [0.22, 1.09, -0.02, 0.37], [0, 1.58, 0.03, 0.36]],
];
const BOWL_LAYOUT = [
  [],
  [[0, 0.5, 0, 0.6]],
  [[-0.33, 0.48, 0, 0.5], [0.33, 0.48, 0.02, 0.5]],
  [[-0.36, 0.46, 0.05, 0.47], [0.36, 0.46, 0.05, 0.47], [0, 0.96, -0.05, 0.47]],
  [[-0.38, 0.45, 0.12, 0.44], [0.38, 0.45, 0.12, 0.44], [-0.24, 0.9, -0.1, 0.43], [0.24, 0.9, -0.08, 0.43]],
  [[-0.46, 0.44, 0.1, 0.4], [0, 0.46, 0.2, 0.41], [0.46, 0.44, 0.1, 0.4], [-0.2, 0.9, -0.08, 0.4], [0.22, 0.9, -0.06, 0.4]],
];

// Deterministic randomness so a given dessert always looks the same.
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

// Smooth 3D value noise, enough to give cream an uneven, hand-scooped surface.
function makeNoise(random) {
  const table = Array.from({ length: 512 }, () => random());
  const hash = (x, y, z) => table[(((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0) % 512];
  const smooth = t => t * t * (3 - 2 * t);
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
    const lerp = (a, b, t) => a + (b - a) * t;
    const corner = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
    return lerp(
      lerp(lerp(corner(0, 0, 0), corner(1, 0, 0), xf), lerp(corner(0, 1, 0), corner(1, 1, 0), xf), yf),
      lerp(lerp(corner(0, 0, 1), corner(1, 0, 1), xf), lerp(corner(0, 1, 1), corner(1, 1, 1), xf), yf),
      zf,
    ) * 2 - 1;
  };
}

// Waffle cone surface: a lattice of raised squares baked into colour and relief maps.
function waffleMaps(light, dark) {
  const size = 512;
  const color = document.createElement('canvas');
  const relief = document.createElement('canvas');
  color.width = color.height = relief.width = relief.height = size;
  const c = color.getContext('2d');
  const r = relief.getContext('2d');
  c.fillStyle = light; c.fillRect(0, 0, size, size);
  r.fillStyle = '#ffffff'; r.fillRect(0, 0, size, size);
  const cell = 64;
  c.save(); r.save();
  c.translate(size / 2, size / 2); r.translate(size / 2, size / 2);
  c.rotate(Math.PI / 4); r.rotate(Math.PI / 4);
  // Each pocket gets a soft highlight in its middle, the way baked batter catches light.
  for (let x = -size; x < size; x += cell) {
    for (let y = -size; y < size; y += cell) {
      const glow = c.createRadialGradient(x + cell / 2, y + cell / 2, 2, x + cell / 2, y + cell / 2, cell * 0.6);
      glow.addColorStop(0, 'rgba(255,226,170,0.28)');
      glow.addColorStop(1, 'rgba(255,226,170,0)');
      c.fillStyle = glow;
      c.fillRect(x, y, cell, cell);
    }
  }
  c.strokeStyle = dark; c.globalAlpha = 0.55; c.lineWidth = 8; r.strokeStyle = '#3a3a3a'; r.lineWidth = 12;
  for (let i = -size; i <= size; i += cell) {
    c.beginPath(); c.moveTo(i, -size); c.lineTo(i, size); c.stroke();
    c.beginPath(); c.moveTo(-size, i); c.lineTo(size, i); c.stroke();
    r.beginPath(); r.moveTo(i, -size); r.lineTo(i, size); r.stroke();
    r.beginPath(); r.moveTo(-size, i); r.lineTo(size, i); r.stroke();
  }
  c.restore(); r.restore();
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(relief);
  for (const texture of [map, bump]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.5, 1.1);
    texture.anisotropy = 4;
  }
  return { map, bump };
}

// Fine grain for the cream: tiny pits and ridges that catch the light.
function creamBump(random) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const value = 150 + random() * 70;
    image.data.set([value, value, value, 255], i * 4);
  }
  ctx.putImageData(image, 0, 0);
  ctx.filter = 'blur(1.5px)';
  ctx.drawImage(canvas, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  return texture;
}

function stripeMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f6efe6'; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#e9b8c6'; ctx.fillRect(0, 70, 512, 26);
  ctx.fillStyle = '#a4163d'; ctx.fillRect(0, 78, 512, 10);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

function contactShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(60,25,30,0.45)');
  gradient.addColorStop(0.55, 'rgba(60,25,30,0.16)');
  gradient.addColorStop(1, 'rgba(60,25,30,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function buildVessel(kind) {
  const group = new THREE.Group();
  if (kind === 'cup-eco') {
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.56, 1.0, 64, 1, true),
      new THREE.MeshPhysicalMaterial({ map: stripeMap(), roughness: 0.55, sheen: 0.3, side: THREE.DoubleSide }),
    );
    wall.position.y = -0.2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.025, 10, 64), new THREE.MeshStandardMaterial({ color: '#f9f2ea', roughness: 0.5 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.3;
    group.add(wall, rim);
    return { group, layout: BOWL_LAYOUT, lift: 0.05, bottom: -0.7 };
  }
  if (kind === 'waffle-bowl') {
    const points = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const flare = Math.sin(t * Math.PI / 2);
      // Fluted edge: the rim waves like a pressed waffle bowl.
      points.push(new THREE.Vector2(0.18 + flare * 0.9, -0.75 + t * 0.98));
    }
    const geometry = new THREE.LatheGeometry(points, 96);
    const position = geometry.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i);
      const angle = Math.atan2(v.z, v.x);
      const height = (v.y + 0.75) / 0.98;
      v.y += Math.sin(angle * 9) * 0.06 * Math.pow(height, 3);
      position.setXYZ(i, v.x, v.y, v.z);
    }
    geometry.computeVertexNormals();
    const { map, bump } = waffleMaps('#dba664', '#9c5f27');
    group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1, roughness: 0.78, side: THREE.DoubleSide })));
    return { group, layout: BOWL_LAYOUT, lift: 0, bottom: -0.75 };
  }
  const artisan = kind === 'cone-artisan';
  const { map, bump } = waffleMaps(artisan ? '#a8652c' : '#d49a4c', artisan ? '#5c2f10' : '#8d5220');
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.53, 1.95, 64, 8, true),
    new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.1, roughness: 0.8, side: THREE.DoubleSide }),
  );
  cone.rotation.x = Math.PI;
  cone.position.y = -0.57;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.53, 0.045, 12, 64),
    new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.5, roughness: 0.8 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.4;
  group.add(cone, rim);
  return { group, layout: CONE_LAYOUT, lift: 0, bottom: -1.55 };
}

function buildScoop(flavor, radius, random, noise, grain) {
  const geometry = new THREE.SphereGeometry(radius, 96, 72);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const base = new THREE.Color(flavorColor(flavor));
  const light = base.clone().lerp(new THREE.Color('#fff8ef'), 0.15);
  const deep = base.clone().multiplyScalar(0.86);
  const v = new THREE.Vector3();
  const offset = random() * 50;
  const swirl = random() * Math.PI * 2;
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const n = v.clone().normalize();
    const angle = Math.atan2(n.z, n.x);
    // Broad lumps, the curl of the scoop and fine roughness, layered.
    const lumps = noise(n.x * 2.2 + offset, n.y * 2.2, n.z * 2.2) * 0.07;
    const curl = Math.sin(angle * 2 + n.y * 5 + swirl) * 0.035 * Math.max(0, n.y + 0.2);
    const fine = noise(n.x * 9 + offset, n.y * 9, n.z * 9) * 0.018;
    // The ragged collar where the scoop was pressed off the spoon.
    const collar = n.y < 0.05 && n.y > -0.6 ? (0.55 + 0.45 * Math.sin(angle * 11 + offset + noise(n.x * 4, n.y * 4, n.z * 4) * 2)) * 0.13 * Math.sin(((0.05 - n.y) / 0.65) * Math.PI) : 0;
    const flatten = n.y < -0.5 ? 0.78 + (n.y + 1) * 0.44 : 1;
    const scale = radius * (1 + lumps + curl + fine + collar) * flatten;
    position.setXYZ(i, n.x * scale, n.y * scale, n.z * scale);
    const shade = THREE.MathUtils.clamp(0.62 + lumps * 2.5 + collar * 1.5, 0, 1);
    const tone = deep.clone().lerp(light, shade);
    colors.set([tone.r, tone.g, tone.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.5,
    bumpMap: grain,
    bumpScale: 0.8,
    clearcoat: 0.25,
    clearcoatRoughness: 0.5,
    sheen: 0.35,
    sheenRoughness: 0.6,
    sheenColor: light,
  });
  return new THREE.Mesh(geometry, material);
}

const TOPPING_COLORS = {
  sprinkles: ['#ff5d8f', '#ffd166', '#06d6a0', '#3a86ff', '#ffffff', '#ef476f'],
  cookie: ['#2b1a12', '#3a241a', '#f2ead8'],
  peanut: ['#c9935a', '#b07a43'],
  gummy: ['#ff4d6d', '#ffbe0b', '#3a86ff', '#8ac926'],
  candy: ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#e9c46a'],
  other: ['#f1e3c6'],
};

function buildToppings(toppings, scoops, random) {
  const group = new THREE.Group();
  if (!scoops.length) return group;
  const shared = {
    sprinkles: new THREE.CapsuleGeometry(0.014, 0.06, 3, 8),
    cookie: new THREE.DodecahedronGeometry(0.05, 0),
    peanut: new THREE.DodecahedronGeometry(0.035, 1),
    candy: new THREE.SphereGeometry(0.045, 16, 12),
    gummy: new THREE.SphereGeometry(0.05, 16, 12),
    other: new THREE.SphereGeometry(0.035, 10, 8),
  };
  for (const topping of toppings) {
    const kind = toppingKind(topping);
    const colors = TOPPING_COLORS[kind] || TOPPING_COLORS.other;
    const count = kind === 'sprinkles' ? 90 : kind === 'cookie' ? 16 : 20;
    for (let i = 0; i < count; i++) {
      const [sx, sy, sz, r] = scoops[Math.floor(random() * scoops.length)];
      const theta = random() * Math.PI * 2;
      const phi = random() * 1.1;
      const normal = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
      const material = new THREE.MeshPhysicalMaterial({
        color: colors[Math.floor(random() * colors.length)],
        roughness: kind === 'candy' ? 0.15 : kind === 'gummy' ? 0.2 : 0.65,
        clearcoat: kind === 'candy' || kind === 'gummy' ? 1 : 0,
        transmission: kind === 'gummy' ? 0.4 : 0,
        thickness: kind === 'gummy' ? 0.05 : 0,
      });
      const mesh = new THREE.Mesh(shared[kind] || shared.other, material);
      // Half sunk into the cream, as toppings settle.
      mesh.position.set(sx, sy, sz).addScaledVector(normal, r * 0.985);
      mesh.lookAt(mesh.position.clone().add(normal));
      mesh.rotateZ(random() * Math.PI);
      if (kind === 'sprinkles') mesh.rotateX(Math.PI / 2);
      if (kind === 'candy') mesh.scale.set(1, 0.55, 1);
      group.add(mesh);
    }
  }
  return group;
}

function buildSyrup(syrup, scoops, random) {
  if (!syrup || !scoops.length) return null;
  const group = new THREE.Group();
  const material = new THREE.MeshPhysicalMaterial({ color: syrupColor(syrup), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const top = scoops.reduce((best, scoop) => (scoop[1] > best[1] ? scoop : best), scoops[0]);
  const [x, y, z, r] = top;
  const ring = [];
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const height = 0.45 + Math.sin(t * 3) * 0.08;
    const radius = Math.sqrt(1 - height * height) * r * 1.01;
    ring.push(new THREE.Vector3(x + Math.cos(t) * radius, y + height * r, z + Math.sin(t) * radius));
  }
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring, true), 192, 0.04, 10, true), material));
  // A few drips running down the sides.
  for (let d = 0; d < 6; d++) {
    const t = random() * Math.PI * 2;
    const points = [];
    for (let k = 0; k <= 8; k++) {
      const h = 0.45 - k * (0.08 + random() * 0.02);
      const rr = Math.sqrt(Math.max(0, 1 - h * h)) * r * 1.01;
      points.push(new THREE.Vector3(x + Math.cos(t) * rr, y + h * r, z + Math.sin(t) * rr));
    }
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.032 - d * 0.002, 8, false), material));
    const end = points.at(-1);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), material);
    bead.position.copy(end);
    group.add(bead);
  }
  return group;
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

/**
 * Interactive 3D model of the dessert being built. Drag sideways to turn it;
 * vertical swipes still scroll the page. It only draws while visible and moving.
 */
export default function Dessert3DViewer({ base, scoops = [], toppings = [], syrup = null }) {
  const host = useRef(null);
  const [failed, setFailed] = useState(false);
  const signature = JSON.stringify({ b: base?.id || base?.name, s: scoops.map(s => s?.id || s?.name), t: toppings.map(t => t?.id || t?.name), y: syrup?.id || syrup?.name });

  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    if (!supportsWebGL()) { setFailed(true); return undefined; }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setFailed(true);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    element.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;
    scene.environmentIntensity = 0.55;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const key = new THREE.DirectionalLight('#fff3e6', 1.6);
    key.position.set(2.5, 4, 3);
    const rimLight = new THREE.DirectionalLight('#ffd9e4', 0.9);
    rimLight.position.set(-3, 2.5, -2.5);
    scene.add(key, rimLight, new THREE.AmbientLight('#ffffff', 0.15));

    const random = seeded(signature.split('').reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 2147483647, 7) || 7);
    const noise = makeNoise(random);
    const grain = creamBump(random);
    const model = new THREE.Group();
    const vessel = buildVessel(baseVisual(base).key);
    model.add(vessel.group);
    const placed = (vessel.layout[Math.min(scoops.length, 5)] || []).map(([x, y, z, r]) => [x, y + vessel.lift, z, r]);
    placed.forEach(([x, y, z, r], index) => {
      const scoop = buildScoop(scoops[index], r, random, noise, grain);
      scoop.position.set(x, y, z);
      scoop.rotation.y = random() * Math.PI * 2;
      model.add(scoop);
    });
    model.add(buildToppings(toppings, placed, random));
    const sauce = buildSyrup(syrup, placed, random);
    if (sauce) model.add(sauce);

    const shadow = contactShadow();
    shadow.position.y = vessel.bottom - 0.02;
    shadow.scale.setScalar(kindShadowScale(baseVisual(base).key));
    model.add(shadow);
    scene.add(model);

    // Frame the whole dessert from slightly above, like a product photo.
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(center);
    const distance = (Math.max(size.y, size.x) / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.25;
    camera.position.set(0, distance * 0.22, distance);
    camera.lookAt(0, -size.y * 0.02, 0);

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let angle = -0.5;
    let velocity = reduceMotion ? 0 : 0.006;
    let spinUntil = reduceMotion ? 0 : performance.now() + 7000;
    let dragging = null;
    let frame = 0;
    let visible = true;

    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      draw();
    };

    const draw = () => {
      model.rotation.y = angle;
      renderer.render(scene, camera);
    };

    // Draws only while something moves; idle and off-screen the GPU rests.
    const tick = () => {
      frame = 0;
      const now = performance.now();
      if (!dragging) {
        if (now < spinUntil) velocity += (0.006 - velocity) * 0.05;
        else velocity *= 0.94;
        angle += velocity;
      }
      draw();
      if (visible && (dragging || Math.abs(velocity) > 0.0004 || now < spinUntil)) frame = requestAnimationFrame(tick);
    };
    const wake = () => { if (!frame && visible) frame = requestAnimationFrame(tick); };

    const observer = new ResizeObserver(resize);
    observer.observe(element);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); });
    intersection.observe(element);
    resize();
    wake();

    const canvas = renderer.domElement;
    const down = (event) => { dragging = { x: event.clientX, angle, last: event.clientX, time: performance.now() }; canvas.setPointerCapture?.(event.pointerId); wake(); };
    const move = (event) => {
      if (!dragging) return;
      angle = dragging.angle + (event.clientX - dragging.x) * 0.012;
      const now = performance.now();
      velocity = ((event.clientX - dragging.last) * 0.012) / Math.max(16, now - dragging.time) * 16;
      dragging.last = event.clientX;
      dragging.time = now;
    };
    const up = () => { dragging = null; spinUntil = 0; wake(); };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('lostpointercapture', up);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('lostpointercapture', up);
      const disposed = new Set();
      scene.traverse(object => {
        if (object.geometry && !disposed.has(object.geometry)) { disposed.add(object.geometry); object.geometry.dispose(); }
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => {
          if (!material || disposed.has(material)) return;
          disposed.add(material);
          for (const slot of ['map', 'bumpMap']) material[slot]?.dispose?.();
          material.dispose();
        });
      });
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    };
  // The signature captures every visual input; rebuilding on it avoids stale models.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (failed) return <p className="dessert-3d-fallback">Tu teléfono no puede mostrar la vista 3D. Te mostramos la foto.</p>;
  return <div ref={host} className="dessert-3d" role="img" aria-label={`Vista 3D: ${scoops.map(s => s?.name).filter(Boolean).join(', ') || 'helado'} en ${base?.name || 'envase'}. Desliza para girarlo.`} />;
}

function kindShadowScale(kind) {
  return kind === 'waffle-bowl' ? 2.4 : kind === 'cup-eco' ? 2 : 0.9;
}
