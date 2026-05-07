import {
  Matrix,
  EigenvalueDecomposition,
  SingularValueDecomposition,
} from "ml-matrix";

export type Issue =
  | { kind: "no-unit-eigenvalue"; closest: number }
  | { kind: "multiplicity"; count: number }
  | { kind: "complex-phi"; maxImag: number }
  | { kind: "initial-orthogonal-to-phi" };

export interface PhiResult {
  phi: number[];
  issues: Issue[];
}

export function sumT(T: number[][][]): number[][] {
  const nObs = T.length;
  const n = T[0].length;
  const out = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let w = 0; w < nObs; w++)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) out[i][j] += T[w][i][j];
  return out;
}

export function computePhi(
  T: number[][][],
  initial: number[],
  tol = 1e-9,
): PhiResult {
  const Ttotal = sumT(T);
  const n = Ttotal.length;
  const issues: Issue[] = [];

  // Eigenvalue analysis for issue detection
  const mat = new Matrix(Ttotal);
  const eig = new EigenvalueDecomposition(mat);
  const real = eig.realEigenvalues;
  const imag = eig.imaginaryEigenvalues;

  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(real[i] - 1, imag[i]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  if (bestDist > 0.01) {
    issues.push({ kind: "no-unit-eigenvalue", closest: real[bestIdx] });
    return { phi: new Array(n).fill(1 / n), issues };
  }

  // Detect complex dominant eigenvalue (no real eigenvalue at 1)
  const maxImag = Math.abs(imag[bestIdx]);
  if (maxImag > 1e-4) {
    issues.push({ kind: "complex-phi", maxImag });
  }

  // Multiplicity check
  const nearOne = real.filter(
    (r, i) => Math.hypot(r - 1, imag[i]) < 1e-4,
  ).length;
  if (nearOne > 1) {
    issues.push({ kind: "multiplicity", count: nearOne });
  }

  // Compute phi via null space of (Ttotal - I) using SVD
  const A = mat.sub(Matrix.eye(n, n));
  const svd = new SingularValueDecomposition(A, { autoTranspose: true });
  const V = svd.rightSingularVectors;
  // Last column of V corresponds to smallest singular value → null space vector
  const phi = Array.from({ length: n }, (_, i) => V.get(i, n - 1));

  // Normalize so initial · phi = 1
  const scale = initial.reduce((s, x, i) => s + x * phi[i], 0);
  if (Math.abs(scale) < 1e-12) {
    issues.push({ kind: "initial-orthogonal-to-phi" });
    return { phi, issues };
  }

  return { phi: phi.map((x) => x / scale), issues };
}

export function isRowStochastic(Ttotal: number[][], tol = 1e-6): boolean {
  const n = Ttotal.length;
  for (let i = 0; i < n; i++) {
    const rowSum = Ttotal[i].reduce((s, x) => s + x, 0);
    if (Math.abs(rowSum - 1) > tol) return false;
    if (Ttotal[i].some((v) => v < -tol || v > 1 + tol)) return false;
  }
  return true;
}
