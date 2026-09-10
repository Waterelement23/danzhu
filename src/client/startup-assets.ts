import { startupStage } from './startup';

let pending: Promise<ArrayBuffer> | undefined;
export function courtyardUrl() {
  return (
    (document.getElementById('courtyard-preload') as HTMLLinkElement | null)?.href ||
    `${import.meta.env.BASE_URL}models/refined-courtyard.glb`
  );
}
export function courtyardBuffer() {
  if (!pending) pending = downloadCourtyard();
  return pending;
}
export function releaseCourtyardBuffer() {
  pending = undefined;
}
async function downloadCourtyard() {
  performance.mark('danzhu-model-start');
  const response = await fetch(courtyardUrl(), { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Courtyard HTTP ${response.status}`);
  const expected = Number(
    document.getElementById('courtyard-preload')?.dataset.bytes ||
      response.headers.get('X-Asset-Bytes'),
  );
  if (!response.body) return response.arrayBuffer();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    const percent = expected > 0 ? Math.min(100, Math.floor((loaded / expected) * 100)) : undefined;
    startupStage(`正在载入院落${percent === undefined ? '' : ` · ${percent}%`}`, percent);
  }
  const buffer = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  performance.mark('danzhu-model-downloaded');
  startupStage('正在准备场地与光影');
  return buffer.buffer;
}
