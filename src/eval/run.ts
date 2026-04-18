import { np } from './np.js';
import { WidgetDecl, WidgetState } from '../widgets/registry.js';

export interface ModelSpec {
  T: number[][][];
  initial: number[];
}

export interface EvalResult {
  spec?: ModelSpec;
  error?: string;
  decls: WidgetDecl[];
}

export function runUserCode(src: string, state: WidgetState): EvalResult {
  const decls: WidgetDecl[] = [];

  const slider = (name: string, min: number, max: number, def: number, step?: number) => {
    decls.push({ kind: 'slider', name, min, max, def, step });
    return Number(state.values.get(name) ?? def);
  };

  const select = (name: string, options: string[], def?: string) => {
    const d = def ?? options[0];
    decls.push({ kind: 'select', name, options, def: d });
    return String(state.values.get(name) ?? d);
  };

  const toggle = (name: string, def = false) => {
    decls.push({ kind: 'toggle', name, def });
    return Boolean(state.values.get(name) ?? def);
  };

  const number = (name: string, def: number) => {
    decls.push({ kind: 'number', name, def });
    return Number(state.values.get(name) ?? def);
  };

  try {
    const fn = new Function(
      'slider', 'select', 'toggle', 'number', 'np',
      `"use strict";\n${src}\nreturn (typeof result !== 'undefined') ? result : { T, initial };`
    );
    const out = fn(slider, select, toggle, number, np);
    return { spec: out as ModelSpec, decls };
  } catch (e: any) {
    return { error: String(e?.message ?? e), decls };
  }
}

export function validateSpec(spec: ModelSpec): string | null {
  const { T, initial } = spec ?? {};
  if (!Array.isArray(T) || !Array.isArray(initial)) {
    return 'Code must produce T (3D array) and initial (1D array).';
  }
  const nObs = T.length;
  const nStates = initial.length;
  if (nObs > 4) return `Observation count ${nObs} > 4 not supported; reduce in code or project yourself.`;
  if (nStates > 4) return `State count ${nStates} > 4 not supported; reduce in code or project yourself.`;
  if (nObs < 1 || nStates < 2) return 'Need at least 1 observation and 2 states.';
  for (let w = 0; w < nObs; w++) {
    if (!Array.isArray(T[w]) || T[w].length !== nStates) {
      return `T[${w}] must have ${nStates} rows.`;
    }
    for (let i = 0; i < nStates; i++) {
      if (!Array.isArray(T[w][i]) || T[w][i].length !== nStates) {
        return `T[${w}][${i}] must have ${nStates} columns.`;
      }
    }
  }
  // Check T_total row sums finite
  const n = nStates;
  for (let i = 0; i < n; i++) {
    let rowSum = 0;
    for (let w = 0; w < nObs; w++) {
      for (let j = 0; j < n; j++) rowSum += T[w][i][j];
    }
    if (!isFinite(rowSum)) return `Row ${i} of T_total is not finite.`;
  }
  return null;
}
