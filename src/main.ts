import './style.css';
import * as THREE from 'three';
import { PRESETS } from './presets.js';
import { setupEditor } from './editor.js';
import { runUserCode, validateSpec } from './eval/run.js';
import { createWidgetState } from './widgets/registry.js';
import { syncWidgetUI } from './widgets/ui.js';
import { advanceAnimations } from './widgets/animation.js';
import { computePhi, sumT, isRowStochastic, Issue } from './model/phi.js';
import { generateCloud } from './model/predict.js';
import { effectiveDim } from './model/dims.js';
import { getVertices, project } from './model/projection.js';
import { createScene } from './render/scene.js';
import { setupCamera } from './render/camera.js';
import {
  loadCodeFromURL,
  scheduleSaveCode,
  clearCodeFromURL,
  loadWidgetsFromURL,
} from './url.js';
import type { WidgetDecl } from './widgets/registry.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
const editorWrap = document.getElementById('editor-wrap') as HTMLElement;
const widgetsWrap = document.getElementById('widgets-wrap') as HTMLElement;
const statusBadge = document.getElementById('status-badge') as HTMLElement;
const errorWrap = document.getElementById('error-wrap') as HTMLElement;
const dimBeliefEl = document.getElementById('dim-belief') as HTMLElement;
const dimTokenEl = document.getElementById('dim-token') as HTMLElement;
const labelsBelief = document.getElementById('labels-belief') as HTMLElement;
const labelsToken = document.getElementById('labels-token') as HTMLElement;
const canvasBelief = document.getElementById('canvas-belief') as HTMLCanvasElement;
const canvasToken = document.getElementById('canvas-token') as HTMLCanvasElement;

// ── State ─────────────────────────────────────────────────────────────────────
const widgetState = createWidgetState();
let currentDecls: WidgetDecl[] = [];
let currentSrc = '';
let evalTimer: ReturnType<typeof setTimeout> | null = null;
let lastBeliefVerts: number[][] | null = null;
let lastTokenVerts: number[][] | null = null;
let lastT: number[][][] | null = null;
let lastInitial: number[] | null = null;

// ── Scenes & camera ───────────────────────────────────────────────────────────
const beliefScene = createScene(canvasBelief);
const tokenScene = createScene(canvasToken);
const cam = setupCamera(document.getElementById('viewports') as HTMLElement);

// ── Presets ───────────────────────────────────────────────────────────────────
PRESETS.forEach((preset, idx) => {
  const opt = document.createElement('option');
  opt.value = String(idx);
  opt.textContent = preset.name;
  presetSelect.appendChild(opt);
});

presetSelect.addEventListener('change', () => {
  const preset = PRESETS[Number(presetSelect.value)];
  editor.setValue(preset.code);
  clearCodeFromURL();
});

// ── Editor ────────────────────────────────────────────────────────────────────
const editor = setupEditor(editorWrap, PRESETS[0].code, code => {
  currentSrc = code;
  scheduleEval(200);
  scheduleSaveCode(code, 500);
});
currentSrc = PRESETS[0].code;

// Restore from URL
const urlCode = loadCodeFromURL();
if (urlCode !== null) {
  editor.setValue(urlCode);
  // Deselect preset since we loaded custom code
  presetSelect.value = '';
}

// Restore widget values from URL query params
for (const [k, v] of loadWidgetsFromURL()) {
  const num = Number(v);
  widgetState.values.set(k, isNaN(num) ? v : num);
}

// ── Update pipeline ───────────────────────────────────────────────────────────
function scheduleEval(delayMs: number) {
  if (evalTimer !== null) clearTimeout(evalTimer);
  evalTimer = setTimeout(runUpdate, delayMs);
}

function runUpdate() {
  evalTimer = null;
  const result = runUserCode(currentSrc, widgetState);
  currentDecls = result.decls;

  syncWidgetUI(widgetsWrap, result.decls, widgetState, () => scheduleEval(0));

  if (result.error) {
    showError(result.error);
    return;
  }

  const spec = result.spec!;
  const valErr = validateSpec(spec);
  if (valErr) {
    showError(valErr);
    return;
  }
  clearError();

  const { T, initial } = spec;
  lastT = T;
  lastInitial = initial;

  const { phi, issues } = computePhi(T, initial);

  const { beliefs, tokens, hasNegative } = generateCloud(T, initial, phi);

  let beliefVerts: number[][], tokenVerts: number[][];
  try {
    beliefVerts = getVertices(initial.length);
    tokenVerts = getVertices(T.length);
  } catch (e: any) {
    showError(e.message);
    return;
  }

  lastBeliefVerts = beliefVerts;
  lastTokenVerts = tokenVerts;

  const beliefPts = beliefs.map(b => project(b, beliefVerts) as [number, number, number]);
  const tokenPts = tokens.map(t => project(t, tokenVerts) as [number, number, number]);

  beliefScene.update(beliefPts, beliefVerts);
  tokenScene.update(tokenPts, tokenVerts);

  const db = effectiveDim(beliefPts);
  const dt = effectiveDim(tokenPts);
  dimBeliefEl.textContent = `dim ${db}`;
  dimTokenEl.textContent = `dim ${dt}`;
  if (db > dt) {
    dimBeliefEl.style.background = '#2a3a4a';
    dimBeliefEl.style.color = '#88bbff';
    dimBeliefEl.title = 'Belief dim > token dim — hidden state is not recoverable from next-token predictions';
  } else {
    dimBeliefEl.style.background = '';
    dimBeliefEl.style.color = '';
    dimBeliefEl.title = '';
  }

  updateStatus(T, initial, issues, hasNegative);
  rebuildLabels(beliefVerts, labelsBelief, 's');
  rebuildLabels(tokenVerts, labelsToken, 'o');
}

// ── Status badge ──────────────────────────────────────────────────────────────
function updateStatus(
  T: number[][][],
  initial: number[],
  issues: Issue[],
  hasNegative: boolean
) {
  let kind: string;
  let label: string;
  let tip: string;

  if (issues.length > 0) {
    kind = 'ill-posed';
    label = 'ill-posed';
    tip = issues.map(formatIssue).join('; ');
  } else if (hasNegative) {
    kind = 'oom-neg';
    label = 'OOM — negative probs';
    tip = 'Negative probabilities appeared during belief state propagation.';
  } else if (isRowStochastic(sumT(T))) {
    kind = 'hmm';
    label = 'HMM';
    tip = 'T_total is row-stochastic.';
  } else {
    kind = 'oom';
    label = 'OOM';
    tip = 'T_total is not row-stochastic — observable operator model.';
  }

  statusBadge.textContent = label;
  statusBadge.className = `badge badge-${kind}`;
  statusBadge.title = tip;
}

function formatIssue(issue: Issue): string {
  switch (issue.kind) {
    case 'no-unit-eigenvalue':
      return `No unit eigenvalue (closest: ${issue.closest.toFixed(4)})`;
    case 'multiplicity':
      return `Unit eigenvalue has multiplicity ${issue.count}`;
    case 'complex-phi':
      return `phi is complex (max |imag| = ${issue.maxImag.toFixed(4)})`;
    case 'initial-orthogonal-to-phi':
      return 'initial is orthogonal to phi';
  }
}

// ── Error display ─────────────────────────────────────────────────────────────
function showError(msg: string) {
  errorWrap.textContent = msg;
  statusBadge.className = 'badge badge-ill-posed';
  statusBadge.textContent = 'error';
  statusBadge.title = msg;
}

function clearError() {
  errorWrap.textContent = '';
}

// ── Corner labels ─────────────────────────────────────────────────────────────
function rebuildLabels(verts: number[][], container: HTMLElement, prefix: string) {
  container.innerHTML = '';
  verts.forEach((_, i) => {
    const el = document.createElement('div');
    el.className = 'corner-label';
    el.dataset.idx = String(i);
    el.textContent = `${prefix}${i}`;
    container.appendChild(el);
  });
}

function updateLabelPositions(
  verts: number[][] | null,
  container: HTMLElement,
  camera: THREE.Camera
) {
  if (!verts) return;
  const labels = container.querySelectorAll<HTMLElement>('.corner-label');
  const w = container.clientWidth;
  const h = container.clientHeight;
  labels.forEach((el, i) => {
    if (i >= verts.length) return;
    const v = new THREE.Vector3(...(verts[i] as [number, number, number]));
    v.project(camera);
    const x = (v.x + 1) / 2 * w;
    const y = (1 - v.y) / 2 * h;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  });
}

// ── Resize ────────────────────────────────────────────────────────────────────
function handleResize() {
  const bw = canvasBelief.clientWidth, bh = canvasBelief.clientHeight;
  const tw = canvasToken.clientWidth, th = canvasToken.clientHeight;
  beliefScene.resize(bw, bh);
  tokenScene.resize(tw, th);
  cam.setAspect(bw / bh, tw / th);
}

const ro = new ResizeObserver(handleResize);
ro.observe(canvasBelief.parentElement!);
ro.observe(canvasToken.parentElement!);
handleResize();

// ── Render loop ───────────────────────────────────────────────────────────────
let prevTime = performance.now();

function loop(now: number) {
  requestAnimationFrame(loop);

  const dt = Math.min(now - prevTime, 100);
  prevTime = now;

  const animated = advanceAnimations(currentDecls, widgetState, dt);
  if (animated) runUpdate();

  cam.sync();
  beliefScene.render(cam.beliefCam);
  tokenScene.render(cam.tokenCam);

  updateLabelPositions(lastBeliefVerts, labelsBelief, cam.beliefCam);
  updateLabelPositions(lastTokenVerts, labelsToken, cam.tokenCam);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
runUpdate();
requestAnimationFrame(loop);
