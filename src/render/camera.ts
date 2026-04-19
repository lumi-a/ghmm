import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface CameraRig {
  master: THREE.PerspectiveCamera;
  beliefCam: THREE.PerspectiveCamera;
  tokenCam: THREE.PerspectiveCamera;
  controls: OrbitControls;
  sync(): void;
  setAspect(beliefAspect: number, tokenAspect: number): void;
}

export function setupCamera(domElement: HTMLElement): CameraRig {
  const master = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
  master.position.set(0, 0, 5);

  const beliefCam = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
  const tokenCam = new THREE.PerspectiveCamera(65, 1, 0.01, 100);

  const controls = new OrbitControls(master, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.enableZoom = false; // zoom handled per-viewport via scroll/pinch

  function sync() {
    controls.update();
    beliefCam.quaternion.copy(master.quaternion);
    beliefCam.position.copy(master.position);
    tokenCam.quaternion.copy(master.quaternion);
    tokenCam.position.copy(master.position);
  }

  function setAspect(ba: number, ta: number) {
    beliefCam.aspect = ba;
    beliefCam.updateProjectionMatrix();
    tokenCam.aspect = ta;
    tokenCam.updateProjectionMatrix();
    master.aspect = ba;
    master.updateProjectionMatrix();
  }

  return { master, beliefCam, tokenCam, controls, sync, setAspect };
}
