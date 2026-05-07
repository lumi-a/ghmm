export interface Preset {
  name: string;
  code: string;
}

export const PRESETS: Preset[] = [
  {
    name: "z1r",
    code: `\
// Zero-One-Random - 3 states, 2 obs
const T = np.array([
  [[0, 1, 0], [0, 0, 0], [0.5, 0, 0]],
  [[0, 0, 0], [0, 0, 1], [0.5, 0, 0]],
]);
const initial = np.array([1/3, 1/3, 1/3]);
`,
  },
  {
    name: "No Consecutive Ones",
    code: `\
// No Consecutive Ones - 2 states, 2 obs
// HMM. After emitting 1, must emit 0 next.
const p = slider('p', 0, 1, 0.5);
const q = 1 - p;
const T = np.array([
  [[q, 0], [1, 0]],
  [[0, p], [0, 0]],
]);
const initial = np.array([2/3, 1/3]);
`,
  },
  {
    name: "Even Ones",
    code: `\
// Even Ones - 2 states, 2 obs
// HMM. Emits 1 only in pairs
const p = slider('p', 0, 1, 0.5);
const q = 1 - p;
const T = np.array([
  [[q, 0], [0, 0]],
  [[0, p], [1, 0]],
]);
const initial = np.array([2/3, 1/3]);
`,
  },
  {
    name: "SNS",
    code: `\
// Simple Nonunifilar Source - 2 states, 2 obs
const p = slider('p', 0, 1, 0.5);
const q = slider('q', 0, 1, 0.5);
const T = np.array([
  [[1-p, p ], [0,   1-q]],
  [[0,   0 ], [q,   0  ]],
]);
const initial = np.array([q/(p+q), p/(p+q)]);
`,
  },
  {
    name: "Mess3",
    code: `\
// Mess3 - 3 states, 3 obs
const x = slider('x', 0, 0.5, 0.15);
const a = slider('a', 0, 1, 0.2);
const b = (1 - a) / 2;
const y = 1 - 2 * x;
const ay = a*y, bx = b*x, by = b*y, ax = a*x;
const T = np.array([
  [[ay, bx, bx], [ax, by, bx], [ax, bx, by]],
  [[by, ax, bx], [bx, ay, bx], [bx, ax, by]],
  [[by, bx, ax], [bx, by, ax], [bx, bx, ay]],
]);
const initial = np.array([1/3, 1/3, 1/3]);
`,
  },
  {
    name: "Mess4",
    code: `\
// Mess4 - 4 states, 4 obs
const x = slider('x', 0, 1/3, 0.15);
const a = slider('a', 0, 1, 0.2);
const b = (1 - a) / 3;
const y = 1 - 3 * x;
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
  {
    name: "Tom Quantum",
    code: `\
// Tom Quantum - 3 states, 4 obs
// GHMM. Quantum measurement model
// T_total is not row-stochastic in general.
const alpha = slider('α', 0.1, 2, 1);
const beta  = slider('β', 0.1, 2, 0.5);
const g = 1 / (4 * (alpha*alpha + beta*beta));
const c = 0.25;
const m = (alpha*alpha - beta*beta) * g;
const f = 2 * alpha * beta * g;
const T = np.array([
  [[c,  0,  f], [0, m, 0], [ f, 0, c]],
  [[c,  0, -f], [0, m, 0], [-f, 0, c]],
  [[c,  f,  0], [f, c, 0], [ 0, 0, m]],
  [[c, -f,  0], [-f, c, 0], [0, 0, m]],
]);
const initial = np.array([1/3, 1/3, 1/3]);
`,
  },
  {
    name: "Fanizza",
    code: `\
// Fanizza - 4 states, 2 obs
// GHMM. Quantum-inspired process with rotation in state space.
const alpha = slider('α', 0.1, 3.14, 1.0);
const lamb  = slider('λ', 0.01, 0.99, 0.5);
const ca = Math.cos(alpha), sa = Math.sin(alpha);
const denom = 1 - 2*lamb*ca + lamb*lamb;
const ala = (1 - lamb*ca + lamb*sa) / denom;
const bla = (1 - lamb*ca - lamb*sa) / denom;
const pi0 = [
  1 - (2/(1-lamb) - ala - bla)/4,
  1/(2*(1-lamb)),
  -ala/4,
  -bla/4,
];
const w = [
  1,
  1 - lamb,
  1 + lamb*(sa - ca),
  1 - lamb*(sa + ca),
];
// da = outer(w, pi0)
const da = [
  [w[0]*pi0[0], w[0]*pi0[1], w[0]*pi0[2], w[0]*pi0[3]],
  [w[1]*pi0[0], w[1]*pi0[1], w[1]*pi0[2], w[1]*pi0[3]],
  [w[2]*pi0[0], w[2]*pi0[1], w[2]*pi0[2], w[2]*pi0[3]],
  [w[3]*pi0[0], w[3]*pi0[1], w[3]*pi0[2], w[3]*pi0[3]],
];
const db = [
  [0,    0,         0,          0       ],
  [0,    lamb,      0,          0       ],
  [0,    0,         lamb*ca,   -lamb*sa ],
  [0,    0,         lamb*sa,    lamb*ca ],
];
const T = np.array([da, db]);
const initial = np.array([0.25, 0.25, 0.25, 0.25]);
`,
  },
];
