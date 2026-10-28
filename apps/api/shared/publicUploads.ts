import express, { type RequestHandler } from 'express';
import path from 'node:path';
import { realpath } from 'node:fs/promises';

// Only existing public avatar/subject/media shapes are static. Course originals,
// extracted documents and staging files always use their owner-authorized API.
const PUBLIC_ASSET =
  /^(?:(?:avatars|subjects|media)\/)?[a-z0-9][a-z0-9_.-]*\.(?:png|jpe?g|gif|webp|avif|mp4|webm)$/i;
export function publicUploads(directory: string): RequestHandler {
  const serve = express.static(directory, {
    dotfiles: 'deny',
    index: false,
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
  });
  return async (req, res, next) => {
    try {
      const relative = decodeURIComponent(req.path).replace(/^\//, '');
      if (!PUBLIC_ASSET.test(relative)) return void res.status(404).end();
      const root = await realpath(directory);
      const target = await realpath(path.join(root, relative));
      const actual = path.relative(root, target).split(path.sep).join('/');
      if (!PUBLIC_ASSET.test(actual)) return void res.status(404).end();
      return serve(req, res, next);
    } catch (error) {
      if (error instanceof URIError) return void res.status(404).end();
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
        return next();
      return next(error);
    }
  };
}
