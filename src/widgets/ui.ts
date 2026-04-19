import { WidgetDecl, WidgetState } from './registry.js';
import { isPlaying, togglePlay } from './animation.js';

const elements = new Map<string, HTMLElement>();

export function syncWidgetUI(
  container: HTMLElement,
  decls: WidgetDecl[],
  state: WidgetState,
  onChange: () => void
): void {
  const newNames = new Set(decls.map(d => d.name));

  // Remove stale widgets
  for (const [name, el] of elements) {
    if (!newNames.has(name)) {
      el.remove();
      elements.delete(name);
    }
  }

  // Add new widgets; update existing ones in-place (no DOM moves — moving nodes swallows clicks)
  for (const decl of decls) {
    if (!elements.has(decl.name)) {
      const el = buildWidget(decl, state, onChange);
      elements.set(decl.name, el);
      container.appendChild(el);
    } else {
      refreshWidget(elements.get(decl.name)!, decl, state);
    }
  }
}

function buildWidget(
  decl: WidgetDecl,
  state: WidgetState,
  onChange: () => void
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'widget';
  wrap.dataset.name = decl.name;

  const label = document.createElement('label');
  label.textContent = decl.name;
  wrap.appendChild(label);

  if (decl.kind === 'slider') {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(decl.min);
    input.max = String(decl.max);
    input.step = decl.step != null ? String(decl.step) : '0.001';
    input.value = String(state.values.get(decl.name) ?? decl.def);

    const valSpan = document.createElement('span');
    valSpan.className = 'widget-value';
    valSpan.textContent = fmtNum(Number(input.value));

    input.addEventListener('input', () => {
      state.values.set(decl.name, Number(input.value));
      valSpan.textContent = fmtNum(Number(input.value));
      onChange();
    });

    const btn = document.createElement('button');
    btn.className = 'play-btn';
    btn.textContent = isPlaying(decl.name) ? '⏹' : '▶';
    btn.addEventListener('click', () => {
      togglePlay(decl.name);
      btn.textContent = isPlaying(decl.name) ? '⏹' : '▶';
      btn.classList.toggle('playing', isPlaying(decl.name));
    });

    wrap.appendChild(input);
    wrap.appendChild(valSpan);
    wrap.appendChild(btn);

  } else if (decl.kind === 'toggle') {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(state.values.get(decl.name) ?? decl.def);
    input.addEventListener('change', () => {
      state.values.set(decl.name, input.checked);
      onChange();
    });
    wrap.appendChild(input);

  } else if (decl.kind === 'select') {
    const sel = document.createElement('select');
    for (const opt of decl.options ?? []) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      if (opt === (state.values.get(decl.name) ?? decl.def)) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      state.values.set(decl.name, sel.value);
      onChange();
    });
    wrap.appendChild(sel);

  } else if (decl.kind === 'number') {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(state.values.get(decl.name) ?? decl.def);
    input.addEventListener('change', () => {
      state.values.set(decl.name, Number(input.value));
      onChange();
    });
    wrap.appendChild(input);
  }

  return wrap;
}

function refreshWidget(el: HTMLElement, decl: WidgetDecl, state: WidgetState) {
  if (decl.kind === 'slider') {
    const input = el.querySelector<HTMLInputElement>('input[type=range]');
    if (input && document.activeElement !== input) {
      const v = String(state.values.get(decl.name) ?? decl.def);
      input.value = v;
      const valSpan = el.querySelector<HTMLSpanElement>('.widget-value');
      if (valSpan) valSpan.textContent = fmtNum(Number(v));
    }
  }
}

function fmtNum(v: number): string {
  return v.toFixed(3);
}
