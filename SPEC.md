# HMM Belief State Visualizer - Implementation Spec

## Context

Port and extend `reference.py` (included in repo) to a static web site. That file contains:

- The GHMM probability math (`calculate_probability`, `predict`) with the convention `T[observation, prev_state, next_state]`.
- Test assertions that verify the algorithm on the z1r and RRXOR processes - **treat these as ground truth** and port them as unit tests.
- The current Mess4 visualization producing a 3D point cloud over a tetrahedron.

Read `reference.py` first.

## Goal

Interactive single-page web app for exploring belief-state geometry of (G)HMMs. Two 3D viewports side by side: belief states (left), next-token predictions (right), sharing camera rotation/translation with independent FOV. Editable code pane on the side. Widget sliders/selects/toggles auto-generated from calls inside the user's code. Deployed as a static site to GitHub Pages.

## Stack

- **Vite + TypeScript**. No framework; vanilla DOM at this scope.
- **Three.js** for 3D rendering.
- **CodeMirror 6** for the editor (`@codemirror/lang-javascript`, basic setup).
- **ml-matrix** for eigendecomposition (or inline a small QR-algorithm impl; matrices are ≤ 4×4).

No other runtime dependencies. No React, no Plotly, no WASM.

## File layout

```
src/
  main.ts              # bootstrap, layout
  editor.ts            # CodeMirror setup, source <-> URL sync
  eval/
    run.ts             # runUserCode: new Function(...), widget registry injection
    np.ts              # minimal numpy-like shim (array, zeros, eye, matmul, dot)
  widgets/
    registry.ts        # widget state store (Map<name, value>)
    ui.ts              # render/bind DOM controls, diff on re-eval
    animation.ts       # rAF loop, oscillate/loop/speed per widget
  model/
    phi.ts             # computePhi + degeneracy checks
    predict.ts         # belief_state(T, initial, phi, ws), token_prediction(...)
    dims.ts            # effective dimensionality via SVD
    projection.ts      # canonical simplex embeddings for n ∈ {2,3,4}
  render/
    scene.ts           # two Three.js scenes, points + simplex edges + labels
    camera.ts          # one OrbitControls on master, mirror to two visible cameras
  url.ts               # query params (widgets) + fragment (gzipped code)
  presets.ts           # starter snippets as strings
index.html
vite.config.ts
flake.nix
.github/workflows/deploy.yml
```

## The code-eval model

User source is evaluated via `new Function(...)` with widget factories injected into scope. Each widget call registers (or re-registers) a widget keyed by `name`, and returns the current value.

```ts
// eval/run.ts
export function runUserCode(src: string, state: WidgetState): ModelSpec {
  const registry: WidgetDecl[] = [];
  const slider = (
    name: string,
    min: number,
    max: number,
    def: number,
    step?: number,
  ) => {
    registry.push({ kind: "slider", name, min, max, def, step });
    return state.values.get(name) ?? def;
  };
  const select = (name: string, options: string[], def?: string) => {
    /* ... */
  };
  const toggle = (name: string, def: boolean) => {
    /* ... */
  };
  const number = (name: string, def: number) => {
    /* ... */
  };

  const fn = new Function(
    "slider",
    "select",
    "toggle",
    "number",
    "np",
    `"use strict"; ${src}
     return (typeof result !== 'undefined') ? result : { T, initial };`,
  );
  const out = fn(slider, select, toggle, number, np);
  syncWidgetUI(registry);
  return out;
}
```

Widget **names are required** and are the identity key. Do not fall back to positional identity - that breaks under conditionals and reorderings.

`np` is a minimal shim: `np.array`, `np.zeros`, `np.ones`, `np.eye`, element-wise arithmetic, matmul, slicing. Goal is that the reference.py matrix construction code ports with minimal edits, not full numpy parity.

## Process interface

User code returns either `{ T, initial }` (implicit via trailing `return { T, initial }` or top-level `T`/`initial` bindings) or a dict with overrides:

```ts
{
  T: number[][][],       // shape [|O|, n_states, n_states]
  initial: number[],     // length n_states
}
```

Validate and error out (inline UI message, keep editor usable) if:

- `T` shape inconsistent with `initial`
- `n_states > 4` → "State count > 4 not supported; reduce in code or project yourself"
- `|O| > 4` → same, for observation space
- Any row of `T_total = sum_w T[w]` has a sum that isn't finite

## phi computation

Algorithm: phi is the right-eigenvector of `T_total = sum_w T[w]` with eigenvalue 1, normalized so that `initial · phi = 1`. Reference: Jaeger (2000), _Observable Operator Models for Discrete Stochastic Time Series_, Neural Computation 12(6).

Why it works: for total probability mass over length-k sequences to equal 1, we need `initial · T_total^k · phi = 1` for all k, which forces `T_total · phi = phi`. For HMMs (`T_total` row-stochastic), `phi = (1,...,1)` drops out for free - this gives a free sanity check.

```ts
export interface PhiResult {
  phi: number[];
  issues: Issue[];
}
type Issue =
  | { kind: "no-unit-eigenvalue"; closest: number }
  | { kind: "multiplicity"; count: number }
  | { kind: "complex-phi"; maxImag: number }
  | { kind: "initial-orthogonal-to-phi" };

export function computePhi(
  T: number[][][],
  initial: number[],
  tol = 1e-9,
): PhiResult {
  const Ttotal = sumOverObservations(T); // sum_w T[w]
  const { real, imag, vectorsReal, vectorsImag } = eig(Ttotal); // general (non-symmetric) eig
  // find eigenvalue closest to 1 (on real axis)
  // extract corresponding eigenvector, report if imag part is non-negligible
  // report multiplicity if more than one eigenvalue is within 1e-4 of 1
  // normalize so initial · phi = 1; report if initial ⊥ phi
  // return phi (real part) and any accumulated issues
}
```

## Degeneracy UI

Small status badge in a corner of the viz. Four states:

- **green "HMM"** - no structural issues; `T_total` row-stochastic (all row sums within `1e-6` of 1, all entries between 0 and 1)
- **blue "OOM"** - no structural issues; `T_total` not row-stochastic
- **amber "OOM - negative probs"** - during point-cloud generation, some belief state or predicted probability dropped below `-1e-9`
- **red "ill-posed"** - any issue returned by `computePhi`

Hover shows a tooltip with specifics. No modals, no blocking.

The amber detection runs during cloud generation: when walking sequences, watch for negative components. Don't bail out - keep rendering the cloud including whatever degenerate points fall out.

## Projection

Hard error for `n > 4` or `|O| > 4`. For the supported cases, embed the `(n-1)`-simplex as a regular simplex in 3D:

- `n = 2`: segment `[(-1,0,0), (1,0,0)]`
- `n = 3`: equilateral triangle in `z = 0`
- `n = 4`: tetrahedron using the matrix from `reference.py`:
  ```
  [[ 1,  1,  1],
   [ 1, -1, -1],
   [-1,  1, -1],
   [-1, -1,  1]]
  ```

Project `belief_state @ vertices` to get the 3D position. Same logic for the token cloud with `|O|` replacing `n`.

Label simplex corners with state indices (belief cloud) and observation indices (token cloud) as HTML overlays positioned via projected screen coordinates.

## Effective dimensionality

Center each cloud (subtract mean), SVD, count singular values above `1e-6 * sigma_max`. Display per-viewport as a small badge: e.g. `dim 2`.

When `dim_belief > dim_token`, annotate or highlight - this is the conceptually interesting regime (belief is not recoverable from next-token predictions, i.e. the process genuinely uses hidden state).

Recompute effective dim on every re-eval. It's cheap and it's fine if the number flickers as sliders move.

## Rendering

Two adjacent 3D viewports, side by side. Headers: "Belief states" / "Next-token predictions".

**Camera sharing**: one `OrbitControls` instance attached to a hidden "master" `PerspectiveCamera`. Each frame, copy `master.quaternion` and `master.position` to both visible cameras. Each visible camera has its own `fov` (slider or fixed difference) → independent zoom while rotation/translation stay locked. Always share, even when effective dims differ - seeing the token cloud edge-on _is_ the signal that dim is smaller.

**Points**: `THREE.Points` with `BufferGeometry`, size ~2px, opacity ~0.5, uniform color to start. Leave a hook for color-by-observation-history later.

**Simplex edges**: `THREE.LineSegments`, grey, thin. Draw all pairs of vertex edges.

**Corner labels**: HTML overlays, absolutely positioned using `vector.project(camera)` → screen coords per frame.

## Widgets

Two kinds:

- `slider(name, min, max, default?)` - continuous, use min if default is not given
- `toggle(name, default?)` - checkbox, use false if default is not given

Each `slider` has a small ▶ button next to it. Clicking toggles animation. Single `requestAnimationFrame` loop advances all playing widgets, writes new values into the state store, and triggers the re-render path. While widgets are animating, code edits should still work - debounce code re-eval (~200ms) so typing isn't laggy.

## URL state

**Fragment** for code: `#code=<base64url>`. Only populated when the editor contents diverge from the selected preset. Use `CompressionStream('brotli')` (built into modern browsers) on the UTF-8 source, then base64url-encode the bytes. Fragment lives client-side only and has generous length limits.

Debounce URL writes (~500ms) to avoid history spam. Prefer `history.replaceState` over `pushState` so sliders don't pollute back-button history.

## Presets

Dropdown above the editor. Selecting replaces editor contents. Presets are strings of code - no "builtin vs custom" split. Ship at minimum:

- **z1r**: 3 states, binary obs. `predict_z1r` from `reference.py`. Initial uniform over 3 states. No sliders; shows a belief cloud of dim 2 and a token cloud of dim 1 (gap = 1).
- **RRXOR**: 5 states, binary obs. `xor_T` from `reference.py`. Two sliders `p = slider('p', 0, 1, 0.5)`, `q = slider('q', 0, 1, 0.5)`. Big dim gap.
- **Mess4**: 4 states, 4 obs. `mess4_T` from `reference.py`. Two sliders `x = slider('x', 0, 1, 0.15)`, `a = slider('a', 0, 1, 0.2)`. Both dims ≤ 3 (equal in generic regime).

Each preset is a self-contained snippet of user code - the same kind of code the user would write themselves.

## Build and deploy

GitHub Actions workflow, triggered on push to `main`:

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push: { branches: [main] }
  workflow_dispatch: {}
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - id: deployment
        uses: actions/deploy-pages@v4
```

In `vite.config.ts`, set `base: '/<repo-name>/'` so asset URLs resolve correctly on Pages.

## Out of scope

- `n > 4` state counts (error out)
- Dynamic PCA-based projection
- Coloring by observation history
- PNG / video export
- Multiple simultaneous presets / side-by-side diff
