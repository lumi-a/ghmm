import { tokenPrediction } from './predict.js';
import { project } from './projection.js';

function sample(tp: number[]): number {
  const w = tp.map(x => Math.max(x, 0));
  const total = w.reduce((s, x) => s + x, 0);
  if (total < 1e-12) return Math.floor(Math.random() * tp.length);
  let r = Math.random() * total;
  for (let i = 0; i < tp.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return tp.length - 1;
}

export interface AggregatedCloud {
  positions: Float32Array;
  alphas: Float32Array;
  n: number;
}

export function aggregate(buf: Float32Array, count: number): AggregatedCloud {
  const map = new Map<string, number>(); // key → index in output
  const posArr: number[] = [];
  const cntArr: number[] = [];

  for (let i = 0; i < count; i++) {
    const x = buf[i * 3], y = buf[i * 3 + 1], z = buf[i * 3 + 2];
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    const idx = map.get(key);
    if (idx !== undefined) {
      cntArr[idx]++;
    } else {
      map.set(key, cntArr.length);
      posArr.push(x, y, z);
      cntArr.push(1);
    }
  }

  const n = cntArr.length;
  const maxCnt = Math.max(1, ...cntArr);
  const positions = new Float32Array(posArr);
  const alphas = new Float32Array(n);
  for (let i = 0; i < n; i++)
    alphas[i] = 0.15 + 0.85 * Math.sqrt(cntArr[i] / maxCnt);

  return { positions, alphas, n };
}

export class CloudStreamer {
  readonly beliefBuf: Float32Array;
  readonly tokenBuf: Float32Array;
  count = 0;
  hasNegative = false;

  private writeIdx = 0;
  private T: number[][][] = [];
  private phi: number[] = [];
  private beliefVerts: number[][] = [];
  private tokenVerts: number[][] = [];
  private initialState: number[] = [];
  private curState: number[] = [];
  private wordPos = 0;
  private readonly maxPoints: number;

  constructor(maxPoints = 3000) {
    this.maxPoints = maxPoints;
    this.beliefBuf = new Float32Array(maxPoints * 3);
    this.tokenBuf = new Float32Array(maxPoints * 3);
  }

  get full(): boolean { return this.count >= this.maxPoints; }

  reset(
    T: number[][][],
    initial: number[],
    phi: number[],
    beliefVerts: number[][],
    tokenVerts: number[][]
  ) {
    this.T = T; this.phi = phi;
    this.beliefVerts = beliefVerts; this.tokenVerts = tokenVerts;
    this.count = 0; this.writeIdx = 0; this.hasNegative = false; this.wordPos = 0;
    const norm = initial.reduce((s, x, i) => s + x * phi[i], 0);
    this.initialState = Math.abs(norm) < 1e-15 ? [...initial] : initial.map(x => x / norm);
    this.curState = [...this.initialState];
  }

  tick(budgetMs = 2): boolean {
    if (this.T.length === 0 || this.count >= this.maxPoints) return false;
    const deadline = performance.now() + budgetMs;
    const n = this.curState.length;
    let added = false;

    while (performance.now() < deadline && this.count < this.maxPoints) {
      const tp = tokenPrediction(this.T, this.curState, this.phi);

      if (this.curState.some(x => x < -1e-9) || tp.some(x => x < -1e-9))
        this.hasNegative = true;

      const bPt = project(this.curState, this.beliefVerts);
      const tPt = project(tp, this.tokenVerts);
      const idx = this.writeIdx * 3;
      this.beliefBuf[idx] = bPt[0]; this.beliefBuf[idx + 1] = bPt[1]; this.beliefBuf[idx + 2] = bPt[2];
      this.tokenBuf[idx]  = tPt[0]; this.tokenBuf[idx + 1]  = tPt[1]; this.tokenBuf[idx + 2]  = tPt[2];
      this.writeIdx = (this.writeIdx + 1) % this.maxPoints;
      if (this.count < this.maxPoints) this.count++;
      added = true;

      this.wordPos++;
      if (this.wordPos >= 64) {
        this.curState = [...this.initialState];
        this.wordPos = 0;
      } else {
        const w = sample(tp);
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
    return added;
  }
}
