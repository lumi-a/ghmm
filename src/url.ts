function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded);
  return new Uint8Array(bin.length).map((_, i) => bin.charCodeAt(i));
}

export function encodeCode(src: string): string {
  const bytes = new TextEncoder().encode(src);
  return b64urlEncode(bytes);
}

export function decodeCode(encoded: string): string | null {
  try {
    const bytes = b64urlDecode(encoded);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function loadCodeFromURL(): string | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#code=')) return null;
  return decodeCode(hash.slice(6));
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSaveCode(src: string, delayMs = 500): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const encoded = encodeCode(src);
    history.replaceState(null, '', `#code=${encoded}`);
    saveTimer = null;
  }, delayMs);
}

export function clearCodeFromURL(): void {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

export function saveWidgetsToURL(values: Map<string, number | string | boolean>): void {
  const params = new URLSearchParams(window.location.search);
  for (const [k, v] of values) params.set(k, String(v));
  history.replaceState(null, '', '?' + params.toString() + window.location.hash);
}

export function loadWidgetsFromURL(): Map<string, string> {
  const params = new URLSearchParams(window.location.search);
  const out = new Map<string, string>();
  for (const [k, v] of params) out.set(k, v);
  return out;
}
