const overlay = document.getElementById('startup');
const progress = document.getElementById('startup-progress') as HTMLProgressElement | null;
const label = document.getElementById('startup-label');
const detail = document.getElementById('startup-detail');
let finished = false;
export function startupStage(text: string, percent?: number) {
  if (!overlay || finished) return;
  if (label) label.textContent = text;
  if (progress) {
    if (percent === undefined) progress.removeAttribute('value');
    else progress.value = Math.max(0, Math.min(100, percent));
  }
}
export function startupError() {
  if (!overlay || finished) return;
  finished = true;
  overlay.dataset.state = 'error';
  if (label) label.textContent = '这次没能走进院子';
  if (detail) detail.textContent = '请检查网络连接，再试一次。';
  document.getElementById('startup-retry')?.removeAttribute('hidden');
  if (progress) progress.hidden = true;
}
export async function startupComplete() {
  if (finished) return;
  // Let the completed scene reach the screen before revealing it.
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  if (finished) return;
  startupStage('院子准备好了', 100);
  const app = document.getElementById('app');
  app?.removeAttribute('inert');
  app?.removeAttribute('aria-hidden');
  document.documentElement.classList.remove('is-loading');
  finished = true;
  if (overlay) {
    overlay.dataset.state = 'ready';
    setTimeout(() => overlay.remove(), 240);
  }
  performance.mark('danzhu-ready');
}
