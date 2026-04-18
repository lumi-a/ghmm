import { WidgetDecl, WidgetState } from './registry.js';

const playing = new Set<string>();
const directions = new Map<string, 1 | -1>();

export function isPlaying(name: string): boolean {
  return playing.has(name);
}

export function togglePlay(name: string): void {
  if (playing.has(name)) {
    playing.delete(name);
    directions.delete(name);
  } else {
    playing.add(name);
  }
}

export function stopAll(): void {
  playing.clear();
}

export function advanceAnimations(
  decls: WidgetDecl[],
  state: WidgetState,
  dtMs: number
): boolean {
  let changed = false;
  for (const decl of decls) {
    if (decl.kind !== 'slider' || !playing.has(decl.name)) continue;
    const min = decl.min!;
    const max = decl.max!;
    const dir = directions.get(decl.name) ?? 1;
    const current = Number(state.values.get(decl.name) ?? decl.def);
    let next = current + dir * (dtMs / 1000) * ((max - min) / 5);
    if (next >= max) { next = max; directions.set(decl.name, -1); }
    else if (next <= min) { next = min; directions.set(decl.name, 1); }
    state.values.set(decl.name, next);
    changed = true;
  }
  return changed;
}
