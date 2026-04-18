import { Matrix, SingularValueDecomposition } from 'ml-matrix';

export function effectiveDim(points: [number, number, number][]): number {
  if (points.length < 2) return 0;

  const n = points.length;
  const mean = [0, 0, 0];
  for (const p of points) {
    mean[0] += p[0]; mean[1] += p[1]; mean[2] += p[2];
  }
  mean[0] /= n; mean[1] /= n; mean[2] /= n;

  const centered = points.map(p => [p[0] - mean[0], p[1] - mean[1], p[2] - mean[2]]);
  const mat = new Matrix(centered);
  const svd = new SingularValueDecomposition(mat, { autoTranspose: true });
  const sigmas = svd.diagonal;
  const maxSigma = Math.max(...sigmas);
  if (maxSigma < 1e-12) return 0;
  return sigmas.filter(s => s > 1e-6 * maxSigma).length;
}
