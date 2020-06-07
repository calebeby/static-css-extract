import { Plugin, TransformHook, LoadHook } from 'rollup'
import {
  retrieveCSSFromModule,
  getStylesheet,
  clearCache,
} from './retrieve-css-from-module'

const name = 'rollup-plugin-static-css-extract'

const plugin = (): Plugin => {
  /** All the transform hooks from other plugins */
  const otherTransformHooks: TransformHook[] = []
  /** All the load hooks from other plugins */
  const otherLoadHooks: LoadHook[] = []
  return {
    name,
    options() {
      // TODO: push a plugin to the front with a transform/load, that uses the cached results from prevaling if possible
      return null
    },
    buildStart(inputOptions) {
      // This runs after `options` hooks from all plugins have run
      for (const plugin of inputOptions.plugins || []) {
        if (plugin.name === name) continue
        if (plugin.transform) otherTransformHooks.push(plugin.transform)
        if (plugin.load) otherLoadHooks.push(plugin.load)
      }
    },
    buildEnd() {
      this.emitFile({
        type: 'asset',
        source: getStylesheet(),
        fileName: 'stylesheet.css',
      })
      clearCache()
    },
    async transform(code, id) {
      return await retrieveCSSFromModule(
        this,
        code,
        otherLoadHooks,
        otherTransformHooks,
        id,
      )
    },
  }
}

export default plugin
