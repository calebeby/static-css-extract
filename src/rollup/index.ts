import { Plugin, TransformHook, LoadHook, SourceDescription } from 'rollup'
import {
  retrieveCSSFromModule,
  clearCache,
  getCssFileNameForJSModule,
} from './retrieve-css-from-module'

const name = 'rollup-plugin-static-css-extract'

const plugin = (): Plugin => {
  /** All the transform hooks from other plugins */
  const otherTransformHooks: TransformHook[] = []
  /** All the load hooks from other plugins */
  const otherLoadHooks: LoadHook[] = []
  /** Map of module ids to generated CSS text/map */
  const virtualStylesheetMap = new Map<string, SourceDescription>()
  return {
    name,
    options() {
      // TODO: push a plugin to the front with a transform/load, that uses the cached results from prevaling if possible
      return null
    },
    buildStart(inputOptions) {
      // This runs after `options` hooks from all plugins have run
      for (const plugin of inputOptions.plugins || []) {
        if (plugin.name === name) continue // ignore current plugin
        if (plugin.transform) otherTransformHooks.push(plugin.transform)
        if (plugin.load) otherLoadHooks.push(plugin.load)
      }
    },
    buildEnd() {
      console.log(virtualStylesheetMap)
      virtualStylesheetMap.clear()
      clearCache()
    },
    resolveId(id) {
      if (virtualStylesheetMap.has(id)) return id
    },
    load(id) {
      return virtualStylesheetMap.get(id) || null
    },
    async transform(code, id) {
      console.log('transform', id)
      const result = await retrieveCSSFromModule(
        this,
        code,
        otherLoadHooks,
        otherTransformHooks,
        id,
      )

      if (!result) return null

      virtualStylesheetMap.set(getCssFileNameForJSModule(id), result.css)

      return result.js
    },
  }
}

export default plugin
