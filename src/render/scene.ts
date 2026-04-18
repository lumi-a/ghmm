import * as THREE from 'three';

export interface SceneHandle {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  update(pts: [number, number, number][], verts: number[][]): void;
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

  function update(pts: [number, number, number][], verts: number[][]) {
    // Update point cloud
    const pos = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) {
      pos[i * 3] = pts[i][0];
      pos[i * 3 + 1] = pts[i][1];
      pos[i * 3 + 2] = pts[i][2];
    }
    pointsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pointsGeo.computeBoundingSphere();

    // Update simplex edges (all pairs)
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

  return { scene, renderer, update, render, resize };
}
