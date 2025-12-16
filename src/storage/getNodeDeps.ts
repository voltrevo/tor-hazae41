import type path from 'path';

export type NodeDeps = {
  fs: typeof import('fs/promises');
  os: typeof import('os');
  path: path.PlatformPath;
};

let nodeDepsPromise: Promise<NodeDeps> | undefined = undefined;

export async function getNodeDeps() {
  if (!nodeDepsPromise) {
    nodeDepsPromise = (async () => {
      const [fs, os, path] = await Promise.all([
        import('node:fs/promises').then(m => m.default),
        import('node:os').then(m => m.default),
        import('node:path').then(m => m.default),
      ]);

      return { fs, os, path };
    })();
  }

  return await nodeDepsPromise;
}
