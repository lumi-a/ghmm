export interface Preset {
  name: string;
  code: string;
}

export const PRESETS: Preset[] = [
  {
    name: 'z1r',
    code: `\
// z1r process — 3 states, binary observations
// Belief cloud: dim 2. Token cloud: dim 1. Gap = 1.
const T = np.array([
  [[0, 1, 0], [0, 0, 0], [0.5, 0, 0]],
  [[0, 0, 0], [0, 0, 1], [0.5, 0, 0]],
]);
const initial = np.array([1/3, 1/3, 1/3]);
`,
  },
  {
    name: 'Mess4',
    code: `\
// Mess4 — 4 states, 4 observations
// Both dims ≤ 3 and equal in generic regime.
const x = slider('x', 0, 1, 0.15);
const a = slider('a', 0, 1, 0.2);
const b = (1 - a) / 2;
const y = 1 - 2 * x;
const ay = a*y, bx = b*x, by = b*y, ax = a*x;

const T = np.array([
  [[ay, bx, bx, bx], [ax, by, bx, bx], [ax, bx, by, bx], [ax, bx, bx, by]],
  [[by, ax, bx, bx], [bx, ay, bx, bx], [bx, ax, by, bx], [bx, ax, bx, by]],
  [[by, bx, ax, bx], [bx, by, ax, bx], [bx, bx, ay, bx], [bx, bx, ax, by]],
  [[by, bx, bx, ax], [bx, by, bx, ax], [bx, bx, by, ax], [bx, bx, bx, ay]],
]);
const initial = np.array([0.25, 0.25, 0.25, 0.25]);
`,
  },
];
