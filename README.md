# unplugin Farm adapter resolves `importer` against cwd instead of root

With the Farm adapter, `resolveId` receives `importer` resolved against `process.cwd()` rather than the Farm `root`, so it points at a missing file whenever the build runs with `root` set to another directory. The same plugin through the Vite adapter, or Farm run from inside the root, gets the right path. Upstream issue: https://github.com/unjs/unplugin/issues/643.

Versions: unplugin 3.7.0, @farmfe/core 2.0.0, vite 8.3.8 (baseline), Node.js 24.21.0, pnpm 12.9.0, macOS.

## Steps

```sh
pnpm install --frozen-lockfile
pnpm run repro           # Farm, cwd = repo, root = app: build fails
pnpm run repro:official  # Vite, same plugin and layout: build ok
pnpm run repro:cwd-root  # Farm, cwd = root = app: build ok
```

`pnpm run show` and `pnpm run show:official` also print the bundle.

## What happens

Farm passes `importer` to the resolve hook as a module id relative to the Farm `root` (for example `src/nested/entry.js`). The unplugin Farm adapter turns it into an absolute path with `path.resolve(params.importer)`, which resolves against `process.cwd()`, not the root. When the build runs with `root` set to a directory other than the cwd, every `resolveId` hook receives an importer path that does not exist, so a plugin that resolves relative to the importer points at the wrong directory.

The plugin:

```js
export const plugin = createUnplugin(() => ({
  name: 'importer-relative',
  enforce: 'pre',
  resolveId(id, importer) {
    if (!id.startsWith('rel:'))
      return null
    console.log(`[plugin] importer = ${importer}`)
    return resolve(dirname(importer), id.slice(4))
  },
}))
```

`app/src/nested/entry.js` contains `export { msg } from 'rel:./sibling.js'`, and the build runs from the repository root with `root: 'app'`.

Vite (expected), and Farm with cwd == root:

```
root = <repo>/app
[plugin] importer = <repo>/app/src/nested/entry.js
build ok
```

Farm with cwd != root:

```
cwd  = <repo>
root = <repo>/app
[plugin] importer = <repo>/src/nested/entry.js
[ Farm ] Build failed due to following errors:

 Can not load `../src/nested/sibling.js`. Original error:
Some(GenericError("Os { code: 2, kind: NotFound, message: \"No such file or directory\" }")).
```

A bare Farm `resolve` plugin in the same project receives `importer = "src/nested/entry.js"`, so the relative id comes from Farm and the cwd comes from the adapter.

## Analysis

Hypothesis, from reading `src/farm/index.ts` at 5daf6e6 (v3.7.0):

```ts
const importer = params.importer
  ? path.resolve(params.importer)
  : undefined
```

`path.resolve` with one relative argument uses `process.cwd()`. The line was last changed in #633 (f64e930), which fixed the entry case (`undefined` instead of `process.cwd()`); the import case kept `path.resolve`, and its unit test passes an absolute importer (`/abs/importer.js`), whereas Farm passes one relative to the root, so the base directory was never exercised. The same `importer` is passed to `createFarmContext`, so `addWatchFile` probably records the same wrong path (not checked).

A likely fix is to keep the resolved `config.root` (for example from Farm's `configResolved` hook) and use `path.resolve(root, params.importer)`. This was not patched and rebuilt.

## How it was found

An unplugin-based plugin resolves helper modules relative to the importing file. Its Vite build worked, and its Farm build failed only when Farm was started with `root` pointing at a sub-directory of the cwd. No framework is needed to reproduce it.

## Files

- `plugin.js`: the unplugin plugin above.
- `repro.js`: builds `app/` with `root: 'app'` from the repository root. `FARM=1` switches from Vite to Farm; `IN_ROOT=1` changes the cwd to `app/` first.
- `app/src/`: `main.js` imports `nested/entry.js`, which imports `rel:./sibling.js`.
