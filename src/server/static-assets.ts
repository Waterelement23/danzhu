import express from 'express';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { createHash } from 'node:crypto';

/** Build-time compression avoids spending game-server CPU compressing each request. */
export function staticAssets(directory: string) {
  const root = resolve(directory);
  const router = express.Router();
  const hashes = new Map<string, string>();
  router.use(async (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return next();
    let path: string;
    try {
      path = decodeURIComponent(req.path === '/' ? '/index.html' : req.path);
    } catch {
      return next();
    }
    if (!/\.(?:js|css|glb|json|wasm|html)$/.test(path)) return next();
    const file = resolve(root, `.${path}`);
    if (!file.startsWith(root + sep)) return next();
    try {
      const info = await stat(file);
      if (!info.isFile()) return next();
      let immutable = /^\/assets\/.+-[\w-]{8,}\.(?:js|css)$/.test(path);
      if (path.endsWith('.glb') && typeof req.query.v === 'string') {
        let hash = hashes.get(file);
        if (!hash) {
          hash = createHash('sha256')
            .update(await readFile(file))
            .digest('hex')
            .slice(0, 12);
          hashes.set(file, hash);
        }
        immutable = req.query.v === hash;
      }
      res.vary('Accept-Encoding');
      res.setHeader('X-Asset-Bytes', String(info.size));
      const encoding = req.headers.range
        ? false
        : req.acceptsEncodings('br') || req.acceptsEncodings('gzip');
      let selected = file;
      if (encoding) {
        const candidate = `${file}.${encoding === 'br' ? 'br' : 'gz'}`;
        if (
          await stat(candidate).then(
            (s) => s.isFile(),
            () => false,
          )
        ) {
          selected = candidate;
          res.setHeader('Content-Encoding', encoding);
        }
      }
      res.type(extname(file));
      res.sendFile(
        selected.slice(root.length + 1),
        { root, maxAge: immutable ? '1y' : 0, immutable },
        (error) => {
          if (error) next(error);
        },
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') next();
      else next(error);
    }
  });
  router.use(express.static(root));
  return router;
}
