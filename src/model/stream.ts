import { tokenPrediction } from './predict.js';
import { project } from './projection.js';

// Mulberry32 seeded PRNG - deterministic, fast, good quality for simulation.
function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSample(rand: () => number) {
  return function sample(tp: number[]): number {
    const w = tp.map(x => Math.max(x, 0));
    const total = w.reduce((s, x) => s + x, 0);
    if (total < 1e-12) return Math.floor(rand() * tp.length);
    let r = rand() * total;
    for (let i = 0; i < tp.length; i++) { r -= w[i]; if (r <= 0) return i; }
    return tp.length - 1;
  };
}

// Returns one alpha per raw point based on visit frequency at that position.
// Dense positions get higher alpha; all raw points are rendered.
export function densityAlphas(buf: Float32Array, count: number): Float32Array {
  const cntMap = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const key = `${buf[i*3].toFixed(4)},${buf[i*3+1].toFixed(4)},${buf[i*3+2].toFixed(4)}`;
    cntMap.set(key, (cntMap.get(key) ?? 0) + 1);
  }
  const maxCnt = Math.max(1, ...cntMap.values());
  const alphas = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const key = `${buf[i*3].toFixed(4)},${buf[i*3+1].toFixed(4)},${buf[i*3+2].toFixed(4)}`;
    alphas[i] = 0.15 + 0.85 * Math.sqrt(cntMap.get(key) / maxCnt);
  }
  return alphas;
}

export class CloudStreamer {
  readonly beliefBuf: Float32Array;
  readonly tokenBuf: Float32Array;
  count = 0;
  hasNegative = false;

  private T: number[][][] = [];
  private phi: number[] = [];
  private beliefVerts: number[][] = [];
  private tokenVerts: number[][] = [];
  private initialState: number[] = [];
  private curState: number[] = [];
  private wordPos = 0;
  private trajLen = 0;
  private rand: () => number = () => 0;
  private sample: (tp: number[]) => number = () => 0;
  private readonly maxPoints: number;

  constructor(maxPoints = 8192) {
    this.maxPoints = maxPoints;
    this.beliefBuf = new Float32Array(maxPoints * 3);
    this.tokenBuf = new Float32Array(maxPoints * 3);
  }

  reset(
    T: number[][][],
    initial: number[],
    phi: number[],
    beliefVerts: number[][],
    tokenVerts: number[][],
    seed = 42
  ) {
    this.T = T; this.phi = phi;
    this.beliefVerts = beliefVerts; this.tokenVerts = tokenVerts;
    this.count = 0; this.hasNegative = false; this.wordPos = 0;
    this.rand = makePrng(seed);
    this.sample = makeSample(this.rand);
    const norm = initial.reduce((s, x, i) => s + x * phi[i], 0);
    this.initialState = Math.abs(norm) < 1e-15 ? [...initial] : initial.map(x => x / norm);
    this.curState = [...this.initialState];
    this.trajLen = this.newTrajLen();
  }

  private newTrajLen(): number {
    return 16 + Math.floor(this.rand() * 17); // uniform in [16, 32]
  }

  tick(): void {
    if (this.T.length === 0 || this.count >= this.maxPoints) return;
    const n = this.curState.length;

    while (this.count < this.maxPoints) {
      const tp = tokenPrediction(this.T, this.curState, this.phi);

      if (this.curState.some(x => x < -1e-9) || tp.some(x => x < -1e-9))
        this.hasNegative = true;

      const bPt = project(this.curState, this.beliefVerts);
      const tPt = project(tp, this.tokenVerts);
      const idx = this.count * 3;
      this.beliefBuf[idx] = bPt[0]; this.beliefBuf[idx + 1] = bPt[1]; this.beliefBuf[idx + 2] = bPt[2];
      this.tokenBuf[idx]  = tPt[0]; this.tokenBuf[idx + 1]  = tPt[1]; this.tokenBuf[idx + 2]  = tPt[2];
      this.count++;

      this.wordPos++;
      if (this.wordPos >= 64) {
        this.curState = [...this.initialState];
        this.wordPos = 0;
      } else {
        const w = this.sample(tp);
        const next = new Array(n).fill(0);
        for (let j = 0; j < n; j++)
          for (let k = 0; k < n; k++)
            next[k] += this.curState[j] * this.T[w][j][k];
        const norm = next.reduce((s, x, i) => s + x * this.phi[i], 0);
        if (Math.abs(norm) < 1e-15) {
          this.curState = [...this.initialState]; this.wordPos = 0;
        } else {
          this.curState = next.map(x => x / norm);
        }
      }
    }
  }
}
