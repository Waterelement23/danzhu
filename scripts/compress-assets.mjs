import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, gzip, constants } from 'node:zlib';
const br = promisify(brotliCompress),
  gz = promisify(gzip);
async function compress(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await compress(path);
      continue;
    }
    if (!/\.(js|css|html|glb|json|wasm)$/.test(entry.name)) continue;
    const raw = await readFile(path);
    if (raw.length < 512) continue;
    const compressed = await br(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 8 } });
    const zipped = await gz(raw, { level: 9 });
    if (compressed.length < raw.length) await writeFile(`${path}.br`, compressed);
    if (zipped.length < raw.length) await writeFile(`${path}.gz`, zipped);
    console.log(`${path}: ${raw.length} → br ${compressed.length}, gzip ${zipped.length} bytes`);
  }
}
await compress('dist/client');
