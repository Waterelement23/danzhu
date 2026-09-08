import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
mkdirSync('output/playwright', { recursive: true });
const cli =
  process.platform === 'win32'
    ? 'node_modules/.bin/playwright-cli.cmd'
    : 'node_modules/.bin/playwright-cli';
function run(args) {
  const result = spawnSync(cli, ['-s=marble-smoke', ...args], {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
  });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.status !== 0 || result.error || result.stdout?.includes('### Error'))
    throw result.error || new Error('Browser check failed');
  return result.stdout;
}
try {
  run(['open', 'http://localhost:5173/']);
  run(['resize', '1440', '1080']);
  const caustics = run([
    'run-code',
    readFileSync('scripts/caustics-check.js', 'utf8').trim().replace(/;$/, ''),
  ]);
  if (!/"passed"\s*:\s*true/.test(caustics)) throw new Error('Caustics check failed');
  const layout = run([
    'run-code',
    readFileSync('scripts/layout-check.js', 'utf8').trim().replace(/;$/, ''),
  ]);
  if (!/"passed"\s*:\s*true/.test(layout)) throw new Error('Layout check failed');
  const result = run([
    'run-code',
    readFileSync('scripts/browser-smoke.js', 'utf8').trim().replace(/;$/, ''),
  ]);
  if (!/"passed"\s*:\s*true/.test(result)) throw new Error('No successful browser result received');
  const pointer = run([
    'run-code',
    readFileSync('scripts/pointer-check.js', 'utf8').trim().replace(/;$/, ''),
  ]);
  if (!/"passed"\s*:\s*true/.test(pointer)) throw new Error('Pointer check failed');
  const recovery = run([
    'run-code',
    readFileSync('scripts/reconnect-check.js', 'utf8').trim().replace(/;$/, ''),
  ]);
  if (!/"passed"\s*:\s*true/.test(recovery)) throw new Error('Recovery check failed');
  const guide = run([
    'run-code',
    readFileSync('scripts/serve-guide-check.js', 'utf8').trim().replace(/;$/, ''),
  ]);
  if (!/"passed"\s*:\s*true/.test(guide)) throw new Error('Serve guide check failed');
} finally {
  run(['close']);
}
