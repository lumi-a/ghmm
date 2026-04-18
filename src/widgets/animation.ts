import { WidgetDecl, WidgetState } from './registry.js';

const playing = new Set<string>();

export function isPlaying(name: string): boolean {
  return playing.has(name);
}

export function togglePlay(name: string): void {
  if (playing.has(name)) playing.delete(name);
  else playing.add(name);
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
    const current = Number(state.values.get(decl.name) ?? decl.def);
    let next = current + (dtMs / 1000) * ((max - min) / 5); // full sweep in 5 s
    if (next > max) next = min;
    state.values.set(decl.name, next);
    changed = true;
  }
  return changed;
}
