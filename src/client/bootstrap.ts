import { courtyardBuffer } from './startup-assets';
import { startupComplete, startupError } from './startup';

// Start before importing Three.js, map data and the interface. Both downloads overlap.
void courtyardBuffer().catch(() => {});
const deadline = setTimeout(startupError, 120000);
try {
  const game = await import('./main');
  await game.ready;
  clearTimeout(deadline);
  await startupComplete();
} catch (error) {
  clearTimeout(deadline);
  startupError();
  console.error('Game startup failed', error);
}
