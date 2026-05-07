import { describe, it, expect } from "vitest";
import { beliefState, calculateProbability } from "./predict.js";

// z1r process from reference.py
const z1r_T = [
  [
    [0, 1, 0],
    [0, 0, 0],
    [0.5, 0, 0],
  ],
  [
    [0, 0, 0],
    [0, 0, 1],
    [0.5, 0, 0],
  ],
];
const z1r_initial = [1 / 3, 1 / 3, 1 / 3];
const z1r_phi = [1, 1, 1]; // HMM - phi = ones

function close(a: number[], b: number[], eps = 1e-10): boolean {
  return a.every((v, i) => Math.abs(v - b[i]) < eps);
}

describe("z1r belief states", () => {
  it("[0] → [1/3, 2/3, 0]", () => {
    expect(
      close(beliefState(z1r_T, z1r_initial, z1r_phi, [0]), [1 / 3, 2 / 3, 0]),
    ).toBe(true);
  });
  it("[1] → [1/3, 0, 2/3]", () => {
    expect(
      close(beliefState(z1r_T, z1r_initial, z1r_phi, [1]), [1 / 3, 0, 2 / 3]),
    ).toBe(true);
  });
  it("[0,0] → [0, 1, 0]", () => {
    expect(
      close(beliefState(z1r_T, z1r_initial, z1r_phi, [0, 0]), [0, 1, 0]),
    ).toBe(true);
  });
  it("[0,1] → [0, 0, 1]", () => {
    expect(
      close(beliefState(z1r_T, z1r_initial, z1r_phi, [0, 1]), [0, 0, 1]),
    ).toBe(true);
  });
  it("[1,0] → [1/2, 1/2, 0]", () => {
    expect(
      close(beliefState(z1r_T, z1r_initial, z1r_phi, [1, 0]), [
        1 / 2,
        1 / 2,
        0,
      ]),
    ).toBe(true);
  });
  it("[1,1] → [1, 0, 0]", () => {
    expect(
      close(beliefState(z1r_T, z1r_initial, z1r_phi, [1, 1]), [1, 0, 0]),
    ).toBe(true);
  });
});

// RRXOR probability tests (fixed p, q for determinism)
describe("RRXOR calculate_probability", () => {
  // Use p = 0.3, q = 0.7 as fixed values
  const p = 0.3,
    q = 0.7;
  const xor_T = [
    [
      [0, 1 - p, 0, 0, 0],
      [0, 0, 0, 1 - q, 0],
      [0, 0, 0, 0, 1 - q],
      [1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    [
      [0, 0, p, 0, 0],
      [0, 0, 0, 0, q],
      [0, 0, 0, q, 0],
      [0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0],
    ],
  ];
  const xor_initial = [1, 0, 0, 0, 0];
  const xor_phi = [1, 1, 1, 1, 1]; // row-stochastic HMM

  for (const a of [0, 1]) {
    for (const b of [0, 1]) {
      const expected = a !== b ? 1 : 0;
      const aProb = a === 1 ? p : 1 - p;
      const bProb = b === 1 ? q : 1 - q;

      it(`P([${a},${b},${expected}]) = ${aProb}*${bProb}`, () => {
        const got = calculateProbability(
          xor_T,
          xor_initial,
          [a, b, expected],
          xor_phi,
        );
        expect(Math.abs(got - aProb * bProb)).toBeLessThan(1e-10);
      });

      it(`P([${a},${b},${1 - expected}]) = 0`, () => {
        const got = calculateProbability(
          xor_T,
          xor_initial,
          [a, b, 1 - expected],
          xor_phi,
        );
        expect(Math.abs(got)).toBeLessThan(1e-10);
      });
    }
  }
});
