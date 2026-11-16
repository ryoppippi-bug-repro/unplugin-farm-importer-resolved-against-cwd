import { resolve } from 'node:path'
import { plugin } from './plugin.js'

// The project root is ./app; the process cwd is the repo root unless IN_ROOT=1.
const root = resolve('app')
const outDir = resolve('out')
if (process.env.IN_ROOT)
  process.chdir(root)
console.log(`cwd  = ${process.cwd()}\nroot = ${root}`)

if (process.env.FARM) {
  const { build } = await import('@farmfe/core')
  await build({
    root,
    plugins: [plugin.farm()],
    compilation: {
      input: { index: './src/main.js' },
      output: { path: resolve(outDir, 'farm'), targetEnv: 'node' },
      minify: false,
      presetEnv: false,
      persistentCache: false,
    },
  })
}
else {
  const { build } = await import('vite')
  await build({
    root,
    logLevel: 'warn',
    plugins: [plugin.vite()],
    build: {
      outDir: resolve(outDir, 'vite'),
      emptyOutDir: true,
      minify: false,
      lib: { entry: 'src/main.js', formats: ['es'], fileName: 'index' },
    },
  })
}
console.log('build ok')
