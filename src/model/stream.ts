import { tokenPrediction } from "./predict.js";
import { project } from "./projection.js";

function sample(tp: number[]): number {
  const w = tp.map((x) => Math.max(x, 0));
  const total = w.reduce((s, x) => s + x, 0);
  if (total < 1e-12) return Math.floor(Math.random() * tp.length);
  let r = Math.random() * total;
  for (let i = 0; i < tp.length; i++) {
    r -= w[i];
    if (r <= 0) return i;
  }
  return tp.length - 1;
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
  private wordLen = 50;
  private readonly maxPoints: number;

  constructor(maxPoints = 65535) {
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
  ) {
    const wordLen = 64;
    this.T = T;
    this.phi = phi;
    this.beliefVerts = beliefVerts;
    this.tokenVerts = tokenVerts;
    this.wordLen = Math.max(1, wordLen);
    this.count = 0;
    this.writeIdx = 0;
    this.hasNegative = false;

    // Normalize initial so initial · phi = 1
    const norm = initial.reduce((s, x, i) => s + x * phi[i], 0);
    this.initialState =
      Math.abs(norm) < 1e-15 ? [...initial] : initial.map((x) => x / norm);
    this.curState = [...this.initialState];
    this.wordPos = 0;
  }

  get full(): boolean {
    return this.count >= this.maxPoints;
  }

  tick(maxPerTick = 50): boolean {
    if (this.T.length === 0 || this.count >= this.maxPoints) return false;
    const n = this.curState.length;
    let added = false;
    let generated = 0;

    while (generated < maxPerTick && this.count < this.maxPoints) {
      generated++;
      const tp = tokenPrediction(this.T, this.curState, this.phi);

      if (this.curState.some((x) => x < -1e-9) || tp.some((x) => x < -1e-9))
        this.hasNegative = true;

      const bPt = project(this.curState, this.beliefVerts);
      const tPt = project(tp, this.tokenVerts);

      const idx = this.writeIdx * 3;
      this.beliefBuf[idx] = bPt[0];
      this.beliefBuf[idx + 1] = bPt[1];
      this.beliefBuf[idx + 2] = bPt[2];
      this.tokenBuf[idx] = tPt[0];
      this.tokenBuf[idx + 1] = tPt[1];
      this.tokenBuf[idx + 2] = tPt[2];

      this.writeIdx = (this.writeIdx + 1) % this.maxPoints;
      if (this.count < this.maxPoints) this.count++;
      added = true;

      // Advance one step
      this.wordPos++;
      if (this.wordPos >= this.wordLen) {
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
          // degenerate: restart word
          this.curState = [...this.initialState];
          this.wordPos = 0;
        } else {
          this.curState = next.map((x) => x / norm);
        }
      }
    }

    return added;
  }
}
