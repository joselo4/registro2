import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { baseVisual, flavorColor } from '../utils/dessert';
import { syrupColor, toppingKind } from '../utils/toppingKinds';
import './dessert-3d.css';

// Scoop centres per vessel and count, in scene units (x, y, z, radius).
const CONE_LAYOUT = [
  [],
  [[0, 0.62, 0, 0.5]],
  [[0, 0.58, 0, 0.47], [0, 1.25, 0.02, 0.44]],
  [[-0.28, 0.6, 0, 0.42], [0.28, 0.6, 0.02, 0.42], [0, 1.2, 0.05, 0.43]],
  [[-0.27, 0.58, 0, 0.4], [0.27, 0.58, 0.02, 0.4], [-0.2, 1.14, 0.04, 0.38], [0.22, 1.14, -0.02, 0.38]],
  [[-0.27, 0.57, 0, 0.39], [0.27, 0.57, 0.02, 0.39], [-0.22, 1.1, 0.04, 0.37], [0.22, 1.1, -0.02, 0.37], [0, 1.6, 0.03, 0.36]],
];
const BOWL_LAYOUT = [
  [],
  [[0, 0.52, 0, 0.6]],
  [[-0.34, 0.5, 0, 0.5], [0.34, 0.5, 0.02, 0.5]],
  [[-0.36, 0.48, 0.05, 0.47], [0.36, 0.48, 0.05, 0.47], [0, 0.98, -0.05, 0.47]],
  [[-0.38, 0.47, 0.12, 0.44], [0.38, 0.47, 0.12, 0.44], [-0.24, 0.92, -0.1, 0.43], [0.24, 0.92, -0.08, 0.43]],
  [[-0.46, 0.46, 0.1, 0.4], [0, 0.48, 0.2, 0.41], [0.46, 0.46, 0.1, 0.4], [-0.2, 0.92, -0.08, 0.4], [0.22, 0.92, -0.06, 0.4]],
];

// Deterministic noise so a given dessert always looks the same.
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

function waffleTexture(base, dark) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 7;
  for (let i = -256; i < 512; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 256, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i + 256, 0); ctx.lineTo(i, 256); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function stripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f7efe3';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#a4163d';
  for (let x = 0; x < 256; x += 32) ctx.fillRect(x, 0, 12, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildVessel(kind) {
  const group = new THREE.Group();
  if (kind === 'cup-eco') {
    const geometry = new THREE.CylinderGeometry(0.78, 0.55, 1.0, 48, 1, true);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: stripeTexture(), side: THREE.DoubleSide, roughness: 0.8 }));
    mesh.position.y = -0.2;
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.55, 40), new THREE.MeshStandardMaterial({ color: '#efe3d2' }));
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = -0.7;
    group.add(mesh, bottom);
    return { group, layout: BOWL_LAYOUT, lift: 0.05 };
  }
  if (kind === 'waffle-bowl') {
    const points = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      points.push(new THREE.Vector2(0.2 + Math.sin(t * Math.PI / 2) * 0.85 + (t > 0.9 ? (t - 0.9) * 2 : 0), -0.75 + t * 0.95));
    }
    const geometry = new THREE.LatheGeometry(points, 48);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: waffleTexture('#d9a35e', '#a8692e'), side: THREE.DoubleSide, roughness: 0.75 }));
    group.add(mesh);
    return { group, layout: BOWL_LAYOUT, lift: 0 };
  }
  const artisan = kind === 'cone-artisan';
  const geometry = new THREE.ConeGeometry(0.52, 1.9, 48, 1, true);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    map: waffleTexture(artisan ? '#b9783f' : '#e0b06c', artisan ? '#7d4a22' : '#b47b3c'),
    side: THREE.DoubleSide,
    roughness: 0.8,
  }));
  mesh.rotation.x = Math.PI;
  mesh.position.y = -0.55;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.06, 12, 48), new THREE.MeshStandardMaterial({ color: artisan ? '#8c5428' : '#c9904d', roughness: 0.7 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.4;
  group.add(mesh, rim);
  return { group, layout: CONE_LAYOUT, lift: 0 };
}

function buildScoop(flavor, radius, random) {
  const geometry = new THREE.SphereGeometry(radius, 56, 40);
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  const phase = random() * 10;
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const n = vertex.clone().normalize();
    // Soft folds of scooped cream plus a ragged rim near the base.
    const folds = Math.sin(n.x * 9 + phase) * Math.sin(n.z * 8 + phase) * 0.035 + Math.sin(n.y * 13 + phase * 2) * 0.02;
    const rim = n.y < -0.15 ? Math.sin(Math.atan2(n.z, n.x) * 11 + phase) * 0.06 * (-n.y) : 0;
    const flatten = n.y < -0.55 ? 0.85 : 1;
    vertex.copy(n.multiplyScalar(radius * (1 + folds + rim) * flatten));
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(flavorColor(flavor)), roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.6, sheen: 0.4, sheenRoughness: 0.8 });
  return new THREE.Mesh(geometry, material);
}

const TOPPING_COLORS = {
  sprinkles: ['#ff5d8f', '#ffd166', '#06d6a0', '#118ab2', '#ffffff', '#ef476f'],
  cookie: ['#2b1a12', '#3a241a'],
  peanut: ['#c9935a', '#b07a43'],
  gummy: ['#ff4d6d', '#ffbe0b', '#3a86ff', '#8ac926'],
  candy: ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#e9c46a'],
  other: ['#f1e3c6'],
};

function buildToppings(toppings, scoops, random) {
  const group = new THREE.Group();
  if (!scoops.length) return group;
  for (const topping of toppings) {
    const kind = toppingKind(topping);
    const colors = TOPPING_COLORS[kind] || TOPPING_COLORS.other;
    const count = kind === 'sprinkles' ? 70 : kind === 'cookie' ? 14 : 18;
    for (let i = 0; i < count; i++) {
      const scoop = scoops[Math.floor(random() * scoops.length)];
      const [sx, sy, sz, r] = scoop;
      const theta = random() * Math.PI * 2;
      const phi = random() * 1.15;
      const normal = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
      let geometry;
      if (kind === 'sprinkles') geometry = new THREE.CapsuleGeometry(0.018, 0.07, 3, 6);
      else if (kind === 'cookie') geometry = new THREE.BoxGeometry(0.11, 0.05, 0.09);
      else if (kind === 'peanut') geometry = new THREE.DodecahedronGeometry(0.045);
      else geometry = new THREE.SphereGeometry(kind === 'candy' ? 0.05 : 0.055, 12, 10);
      const material = new THREE.MeshStandardMaterial({
        color: colors[Math.floor(random() * colors.length)],
        roughness: kind === 'candy' ? 0.25 : 0.6,
        transparent: kind === 'gummy',
        opacity: kind === 'gummy' ? 0.85 : 1,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(sx, sy, sz).addScaledVector(normal, r * 1.01);
      mesh.lookAt(mesh.position.clone().add(normal));
      mesh.rotateZ(random() * Math.PI);
      if (kind === 'sprinkles') mesh.rotateX(Math.PI / 2);
      group.add(mesh);
    }
  }
  return group;
}

function buildSyrup(syrup, scoops) {
  if (!syrup || !scoops.length) return null;
  const top = scoops.reduce((best, scoop) => (scoop[1] > best[1] ? scoop : best), scoops[0]);
  const [x, y, z, r] = top;
  const points = [];
  for (let i = 0; i <= 80; i++) {
    const t = (i / 80) * Math.PI * 4;
    const height = 0.55 - (i / 80) * 0.7;
    const ring = Math.sqrt(Math.max(0.05, 1 - height * height)) * r * 1.02;
    points.push(new THREE.Vector3(x + Math.cos(t) * ring, y + height * r + Math.sin(t * 3) * 0.03, z + Math.sin(t) * ring));
  }
  const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 160, 0.035, 8, false);
  return new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({ color: syrupColor(syrup), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }));
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
 * vertical swipes still scroll the page.
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
    element.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    scene.add(new THREE.HemisphereLight('#fff6ee', '#a77a64', 1.25));
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(2.5, 4, 3);
    const rimLight = new THREE.DirectionalLight('#ffd6e2', 1.1);
    rimLight.position.set(-3, 2, -2);
    scene.add(key, rimLight);

    const random = seeded(signature.split('').reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 2147483647, 7) || 7);
    const model = new THREE.Group();
    const vessel = buildVessel(baseVisual(base).key);
    model.add(vessel.group);
    const placed = (vessel.layout[Math.min(scoops.length, 5)] || []).map(([x, y, z, r]) => [x, y + vessel.lift, z, r]);
    placed.forEach(([x, y, z, r], index) => {
      const scoop = buildScoop(scoops[index], r, random);
      scoop.position.set(x, y, z);
      scoop.rotation.y = random() * Math.PI;
      model.add(scoop);
    });
    model.add(buildToppings(toppings, placed, random));
    const sauce = buildSyrup(syrup, placed);
    if (sauce) model.add(sauce);
    scene.add(model);

    // Frame the whole dessert.
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(center);
    const distance = (Math.max(size.y, size.x) / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.35;
    camera.position.set(0, size.y * 0.12, distance);
    camera.lookAt(0, 0, 0);

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let angle = -0.4;
    let velocity = reduceMotion ? 0 : 0.004;
    let dragging = null;
    let frame = 0;

    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();

    const render = () => {
      if (!dragging) {
        angle += velocity;
        velocity += ((reduceMotion ? 0 : 0.004) - velocity) * 0.02;
      }
      model.rotation.y = angle;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    const canvas = renderer.domElement;
    const down = (event) => { dragging = { x: event.clientX, angle, last: event.clientX, time: performance.now() }; canvas.setPointerCapture?.(event.pointerId); };
    const move = (event) => {
      if (!dragging) return;
      angle = dragging.angle + (event.clientX - dragging.x) * 0.012;
      const now = performance.now();
      velocity = ((event.clientX - dragging.last) * 0.012) / Math.max(16, now - dragging.time) * 16;
      dragging.last = event.clientX;
      dragging.time = now;
    };
    const up = () => { dragging = null; };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('lostpointercapture', up);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('lostpointercapture', up);
      scene.traverse(object => {
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => { material?.map?.dispose?.(); material?.dispose?.(); });
      });
      renderer.dispose();
      canvas.remove();
    };
  // The signature captures every visual input; rebuilding on it avoids stale models.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (failed) return <p className="dessert-3d-fallback">Tu teléfono no puede mostrar la vista 3D. Te mostramos la foto.</p>;
  return <div ref={host} className="dessert-3d" role="img" aria-label={`Vista 3D: ${scoops.map(s => s?.name).filter(Boolean).join(', ') || 'helado'} en ${base?.name || 'envase'}. Desliza para girarlo.`} />;
}
