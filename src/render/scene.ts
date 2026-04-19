import * as THREE from 'three';

export interface SceneHandle {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  updatePoints(buf: Float32Array, count: number): void;
  updateEdges(verts: number[][]): void;
  render(camera: THREE.Camera): void;
  resize(w: number, h: number): void;
}

export function createScene(canvas: HTMLCanvasElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x111111);

  const scene = new THREE.Scene();

  // Points
  const pointsGeo = new THREE.BufferGeometry();
  const pointsMat = new THREE.PointsMaterial({
    size: 2,
    sizeAttenuation: false,
    color: 0x4488ff,
    transparent: true,
    opacity: 0.5,
  });
  const points = new THREE.Points(pointsGeo, pointsMat);
  scene.add(points);

  // Simplex edges
  const edgesGeo = new THREE.BufferGeometry();
  const edgesMat = new THREE.LineBasicMaterial({ color: 0x444444 });
  const edges = new THREE.LineSegments(edgesGeo, edgesMat);
  scene.add(edges);

  let posAttr: THREE.BufferAttribute | null = null;

  function updatePoints(buf: Float32Array, count: number) {
    if (!posAttr || posAttr.array !== buf) {
      posAttr = new THREE.BufferAttribute(buf, 3);
      pointsGeo.setAttribute('position', posAttr);
    }
    posAttr.needsUpdate = true;
    pointsGeo.setDrawRange(0, count);
    pointsGeo.computeBoundingSphere();
  }

  function updateEdges(verts: number[][]) {
    const edgePos: number[] = [];
    const nv = verts.length;
    for (let i = 0; i < nv; i++)
      for (let j = i + 1; j < nv; j++)
        edgePos.push(...verts[i], ...verts[j]);
    edgesGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(edgePos), 3)
    );
  }

  function render(camera: THREE.Camera) {
    renderer.render(scene, camera);
  }

  function resize(w: number, h: number) {
    renderer.setSize(w, h, false);
  }

  return { scene, renderer, updatePoints, updateEdges, render, resize };
}
