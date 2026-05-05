import * as THREE from 'three';

export interface SceneHandle {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  updatePoints(positions: Float32Array, alphas: Float32Array, n: number): void;
  updateEdges(verts: number[][]): void;
  render(camera: THREE.Camera): void;
  resize(w: number, h: number): void;
}

const VERT = `
in float aAlpha;
out float vAlpha;
void main() {
  vAlpha = aAlpha;
  gl_PointSize = 2.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
in float vAlpha;
out vec4 fragColor;
void main() {
  fragColor = vec4(0.267, 0.533, 1.0, vAlpha);
}
`;

export function createScene(canvas: HTMLCanvasElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x111111);

  const scene = new THREE.Scene();

  // Points with per-vertex alpha via ShaderMaterial
  const pointsGeo = new THREE.BufferGeometry();
  const pointsMat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    glslVersion: THREE.GLSL3,
  });
  const points = new THREE.Points(pointsGeo, pointsMat);
  scene.add(points);

  // Simplex edges
  const edgesGeo = new THREE.BufferGeometry();
  const edgesMat = new THREE.LineBasicMaterial({ color: 0x444444 });
  const edges = new THREE.LineSegments(edgesGeo, edgesMat);
  scene.add(edges);

  let posAttr: THREE.BufferAttribute | null = null;
  let alphaAttr: THREE.BufferAttribute | null = null;

  function updatePoints(positions: Float32Array, alphas: Float32Array, n: number) {
    if (!posAttr || posAttr.array !== positions) {
      posAttr = new THREE.BufferAttribute(positions, 3);
      pointsGeo.setAttribute('position', posAttr);
    }
    if (!alphaAttr || alphaAttr.array !== alphas) {
      alphaAttr = new THREE.BufferAttribute(alphas, 1);
      pointsGeo.setAttribute('aAlpha', alphaAttr);
    }
    posAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    pointsGeo.setDrawRange(0, n);
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
