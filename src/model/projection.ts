const VERTICES: Record<number, number[][]> = {
  2: [
    [-1, 0, 0],
    [1, 0, 0],
  ],
  3: [
    [0, 1, 0],
    [-Math.sqrt(3) / 2, -0.5, 0],
    [Math.sqrt(3) / 2, -0.5, 0],
  ],
  4: [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ],
};

export function getVertices(n: number): number[][] {
  if (n < 2 || n > 4)
    throw new Error(`n=${n} not supported for simplex projection`);
  return VERTICES[n];
}

export function project(
  belief: number[],
  verts: number[][],
): [number, number, number] {
  let x = 0,
    y = 0,
    z = 0;
  for (let i = 0; i < belief.length; i++) {
    x += belief[i] * verts[i][0];
    y += belief[i] * verts[i][1];
    z += belief[i] * verts[i][2];
  }
  return [x, y, z];
}
