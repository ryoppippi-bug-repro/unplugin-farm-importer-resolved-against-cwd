import { dirname, resolve } from 'node:path'
import { createUnplugin } from 'unplugin'

// Resolves `rel:./x.js` relative to the importing module, like any plugin that
// needs the importer's directory.
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
