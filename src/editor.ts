import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';

const darkTheme = EditorView.theme(
  {
    '&': { background: '#111', color: '#ddd', height: '100%' },
    '.cm-scroller': { overflow: 'auto' },
    '.cm-gutters': { background: '#1a1a1a', borderRight: '1px solid #333', color: '#555' },
    '.cm-activeLineGutter': { background: '#1e1e1e' },
    '.cm-activeLine': { background: '#1e1e1e' },
    '.cm-cursor': { borderLeftColor: '#4488ff' },
    '.cm-selectionBackground': { background: '#2a4a6a !important' },
  },
  { dark: true }
);

export interface EditorHandle {
  view: EditorView;
  setValue(code: string): void;
}

export function setupEditor(
  container: HTMLElement,
  initialCode: string,
  onChange: (code: string) => void
): EditorHandle {
  const view = new EditorView({
    doc: initialCode,
    extensions: [
      basicSetup,
      javascript(),
      darkTheme,
      EditorView.updateListener.of(update => {
        if (update.docChanged) onChange(view.state.doc.toString());
      }),
    ],
    parent: container,
  });

  function setValue(code: string) {
    if (view.state.doc.toString() === code) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: code },
    });
  }

  return { view, setValue };
}
