export function calculateProbability(
  T: number[][][],
  initial: number[],
  ws: number[],
  phi?: number[],
): number {
  const n = initial.length;
  const p = phi ?? new Array(n).fill(1);
  let state = [...initial];
  for (const w of ws) {
    const next = new Array(n).fill(0);
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++) next[k] += state[j] * T[w][j][k];
    state = next;
  }
  return state.reduce((s, x, i) => s + x * p[i], 0);
}

export function beliefState(
  T: number[][][],
  initial: number[],
  phi: number[],
  ws: number[],
): number[] {
  const n = initial.length;
  let state = [...initial];
  for (const w of ws) {
    const next = new Array(n).fill(0);
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++) next[k] += state[j] * T[w][j][k];
    state = next;
  }
  const norm = state.reduce((s, x, i) => s + x * phi[i], 0);
  if (Math.abs(norm) < 1e-15) return state;
  return state.map((x) => x / norm);
}

export function tokenPrediction(
  T: number[][][],
  bs: number[],
  phi: number[],
): number[] {
  const n = bs.length;
  return T.map((Tw) => {
    let v = 0;
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++) v += bs[j] * Tw[j][k] * phi[k];
    return v;
  });
}

function depthForObs(nObs: number): number {
  if (nObs <= 2) return 10;
  if (nObs === 3) return 6;
  return 5;
}