import "./style.css";
import * as THREE from "three";
import { PRESETS } from "./presets.js";
import { setupEditor } from "./editor.js";
import { runUserCode, validateSpec } from "./eval/run.js";
import { createWidgetState } from "./widgets/registry.js";
import { syncWidgetUI } from "./widgets/ui.js";
import { advanceAnimations } from "./widgets/animation.js";
import { computePhi, sumT, isRowStochastic, Issue } from "./model/phi.js";
import { effectiveDim } from "./model/dims.js";
import { getVertices } from "./model/projection.js";
import { CloudStreamer, densityAlphas } from "./model/stream.js";
import { createScene } from "./render/scene.js";
import { setupCamera } from "./render/camera.js";
import type { WidgetDecl } from "./widgets/registry.js";

// ── WebGL2 check ──────────────────────────────────────────────────────────────
if (!document.createElement("canvas").getContext("webgl2")) {
  document.body.innerHTML = `<div style="position:fixed;inset:0;display:grid;place-items:center;background:#111;color:#ddd;font:14px monospace;text-align:center;padding:2rem">
    <div>
      <p>This app requires WebGL2, which is not available in your browser.</p>
      <p style="margin-top:1rem;color:#888">Try Chrome, Firefox 51+, or Safari 15+.</p>
    </div>
  </div>`;
  throw new Error("WebGL2 not available");
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const presetSelect = document.getElementById(
  "preset-select",
) as HTMLSelectElement;
const editorWrap = document.getElementById("editor-wrap") as HTMLElement;
const widgetsWrap = document.getElementById("widgets-wrap") as HTMLElement;
const statusBadge = document.getElementById("status-badge") as HTMLElement;
const tooltip = document.getElementById("badge-tooltip") as HTMLElement;
const errorWrap = document.getElementById("error-wrap") as HTMLElement;
const dimBeliefEl = document.getElementById("dim-belief") as HTMLElement;
const dimTokenEl = document.getElementById("dim-token") as HTMLElement;
const canvasBelief = document.getElementById(
  "canvas-belief",
) as HTMLCanvasElement;
const canvasToken = document.getElementById(
  "canvas-token",
) as HTMLCanvasElement;

// ── State ─────────────────────────────────────────────────────────────────────
const widgetState = createWidgetState();
let currentDecls: WidgetDecl[] = [];
let currentSrc = "";
let evalTimer: ReturnType<typeof setTimeout> | null = null;

// ── Scenes, camera, streamer ──────────────────────────────────────────────────
const beliefScene = createScene(canvasBelief);
const tokenScene = createScene(canvasToken);
const cam = setupCamera(document.getElementById("viewports") as HTMLElement);
const streamer = new CloudStreamer(65535);

// ── Per-viewport FOV (scroll wheel / pinch) ───────────────────────────────────
function addViewportFov(bodyEl: HTMLElement, camera: THREE.PerspectiveCamera) {
  bodyEl.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      camera.fov = Math.max(0.01, Math.min(170, camera.fov * Math.exp(e.deltaY * 0.002)));
      camera.updateProjectionMatrix();
    },
    { passive: false },
  );

  let lastDist = 0;
  bodyEl.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 2)
        lastDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
    },
    { passive: true },
  );
  bodyEl.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      e.stopPropagation();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (lastDist > 0) {
        camera.fov = Math.max(1, Math.min(170,camera.fov * (lastDist / d)));
        camera.updateProjectionMatrix();
      }
      lastDist = d;
    },
    { passive: false },
  );
  bodyEl.addEventListener("touchend", () => {
    lastDist = 0;
  });
}

addViewportFov(
  document.querySelector("#vp-belief .vp-body") as HTMLElement,
  cam.beliefCam,
);
addViewportFov(
  document.querySelector("#vp-token  .vp-body") as HTMLElement,
  cam.tokenCam,
);

// ── Presets ───────────────────────────────────────────────────────────────────
PRESETS.forEach((preset, idx) => {
  const opt = document.createElement("option");
  opt.value = String(idx);
  opt.textContent = preset.name;
  presetSelect.appendChild(opt);
});

presetSelect.addEventListener("change", () => {
  const preset = PRESETS[Number(presetSelect.value)];
  editor.setValue(preset.code);
});

// ── Editor ────────────────────────────────────────────────────────────────────
const defaultPresetIdx = PRESETS.findIndex(p => p.name === "Mess4");
const defaultPreset = PRESETS[defaultPresetIdx < 0 ? 0 : defaultPresetIdx];
presetSelect.value = String(defaultPresetIdx);
const editor = setupEditor(editorWrap, defaultPreset.code, (code) => {
  currentSrc = code;
  scheduleEval(200);
});
currentSrc = defaultPreset.code;

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
  const { phi, issues } = computePhi(T, initial);

  let beliefVerts: number[][], tokenVerts: number[][];
  try {
    beliefVerts = getVertices(initial.length);
    tokenVerts = getVertices(T.length);
  } catch (e: any) {
    showError(e.message);
    return;
  }


  beliefScene.updateEdges(beliefVerts);
  tokenScene.updateEdges(tokenVerts);

  streamer.reset(T, initial, phi, beliefVerts, tokenVerts);
  streamer.tick();

  beliefScene.updatePoints(
    streamer.beliefBuf,
    densityAlphas(streamer.beliefBuf, streamer.count),
    streamer.count,
  );
  tokenScene.updatePoints(
    streamer.tokenBuf,
    densityAlphas(streamer.tokenBuf, streamer.count),
    streamer.count,
  );

  updateStatus(T, initial, issues, streamer.hasNegative);
  updateDimBadges(
    effectiveDim(streamer.beliefBuf, streamer.count),
    effectiveDim(streamer.tokenBuf, streamer.count),
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function updateStatus(
  T: number[][][],
  initial: number[],
  issues: Issue[],
  hasNegative: boolean,
) {
  let kind: string, label: string, tip: string;

  if (issues.length > 0) {
    kind = "ill-posed";
    label = "ill-posed";
    tip = issues.map(formatIssue).join("; ");
  } else if (hasNegative) {
    kind = "oom-neg";
    label = "OOM — negative probs";
    tip = "Negative probabilities detected during belief state propagation.";
  } else if (isRowStochastic(sumT(T))) {
    kind = "hmm";
    label = "HMM";
    tip = "T_total is row-stochastic.";
  } else {
    kind = "oom";
    label = "OOM";
    tip = "T_total is not row-stochastic — observable operator model.";
  }

  statusBadge.textContent = label;
  statusBadge.className = `badge badge-${kind}`;
  tooltip.textContent = tip;
}

function formatIssue(issue: Issue): string {
  switch (issue.kind) {
    case "no-unit-eigenvalue":
      return `No unit eigenvalue (closest: ${issue.closest.toFixed(4)})`;
    case "multiplicity":
      return `Unit eigenvalue multiplicity ${issue.count}`;
    case "complex-phi":
      return `phi is complex (max |imag| = ${issue.maxImag.toFixed(4)})`;
    case "initial-orthogonal-to-phi":
      return "initial ⊥ phi";
  }
}

function showError(msg: string) {
  errorWrap.textContent = msg;
  statusBadge.className = "badge badge-ill-posed";
  statusBadge.textContent = "error";
  tooltip.textContent = msg;
}
function clearError() {
  errorWrap.textContent = "";
}

// ── Dim badges ────────────────────────────────────────────────────────────────
function updateDimBadges(db: number, dt: number) {
  dimBeliefEl.textContent = `dim ${db}`;
  dimTokenEl.textContent = `dim ${dt}`;
  const gap = db > dt;
  dimBeliefEl.style.background = gap ? "#2a3a4a" : "";
  dimBeliefEl.style.color = gap ? "#88bbff" : "";
  dimBeliefEl.title = gap
    ? "Belief dim > token dim — hidden state not recoverable from next-token predictions"
    : "";
}

// ── Resize ────────────────────────────────────────────────────────────────────
function handleResize() {
  const bw = canvasBelief.clientWidth,
    bh = canvasBelief.clientHeight;
  const tw = canvasToken.clientWidth,
    th = canvasToken.clientHeight;
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

}

// ── Boot ──────────────────────────────────────────────────────────────────────
runUpdate();
requestAnimationFrame(loop);
