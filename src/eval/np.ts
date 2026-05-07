function matmul(A: number[][], B: number[][]): number[][] {
  const m = A.length,
    k = A[0].length,
    n = B[0].length;
  return Array.from({ length: m }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      A[i].reduce((s, _, l) => s + A[i][l] * B[l][j], 0),
    ),
  );
}

function dot(a: any, b: any): any {
  if (typeof a[0] === "number" && typeof b[0] === "number") {
    return (a as number[]).reduce((s, x, i) => s + x * b[i], 0);
  }
  if (typeof a[0] === "number" && Array.isArray(b[0])) {
    const n = (b[0] as number[]).length;
    return Array.from({ length: n }, (_, j) =>
      (a as number[]).reduce((s, x, i) => s + x * (b as number[][])[i][j], 0),
    );
  }
  return matmul(a, b);
}

export const np = {
  array(arr: any): any {
    return arr;
  },

  zeros(shape: number | number[]): any {
    if (typeof shape === "number") return new Array(shape).fill(0);
    const [m, n] = shape;
    return Array.from({ length: m }, () => new Array(n).fill(0));
  },

  ones(n: number): number[] {
    return new Array(n).fill(1);
  },

  eye(n: number): number[][] {
    return Array.from({ length: n }, (_, i) => {
      const row = new Array(n).fill(0);
      row[i] = 1;
      return row;
    });
  },

  matmul,
  dot,
};
