import { Matrix, SingularValueDecomposition } from "ml-matrix";

export function effectiveDim(buf: Float32Array, count: number): number {
  if (count < 2) return 0;

  let mx = 0,
    my = 0,
    mz = 0;
  for (let i = 0; i < count; i++) {
    mx += buf[i * 3];
    my += buf[i * 3 + 1];
    mz += buf[i * 3 + 2];
  }
  mx /= count;
  my /= count;
  mz /= count;

  const rows: number[][] = new Array(count);
  for (let i = 0; i < count; i++)
    rows[i] = [buf[i * 3] - mx, buf[i * 3 + 1] - my, buf[i * 3 + 2] - mz];

  const svd = new SingularValueDecomposition(new Matrix(rows), {
    autoTranspose: true,
  });
  const sigmas = svd.diagonal;
  const maxSigma = Math.max(...sigmas);
  if (maxSigma < 1e-12) return 0;
  return sigmas.filter((s) => s > 1e-6 * maxSigma).length;
}
