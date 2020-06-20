import { LoadHook, TransformHook, TransformPluginContext } from 'rollup'
import vm from 'vm'
import { ImportSpecifier, parse } from 'es-module-lexer'
import MagicString from 'magic-string'
import * as fs from 'fs'
import { promisify } from 'util'
const readFile = promisify(fs.readFile)

interface Resolved {
  absolutePath: string
  useCJS: boolean
}

const resolve = async (
  importPath: string,
  parentId: string,
  ctx: TransformPluginContext,
): Promise<Resolved> => {
  if (importPath === 'static-css-extract')
    return { absolutePath: 'static-css-extract', useCJS: false }
  try {
    const absolutePath = require.resolve(importPath, { paths: [importPath] })
    if (absolutePath.match(/node_modules/))
      return { absolutePath, useCJS: true }
  } catch {}
  const result = await ctx.resolve(importPath, parentId)
  if (!result) ctx.error(`Could not resolve ${importPath} from ${parentId}`)
  const useCJS = result.external
  return { absolutePath: result.id, useCJS }
}

/** Map of absolute module paths to promises to their evaluated results */
const moduleCache = new Map<string, Promise<Record<string, unknown>>>()

export const clearCache = () => {
  moduleCache.clear()
}

const transpileAndEvaluate = async (
  absolutePath: string,
  loaders: LoadHook[],
  transformers: TransformHook[],
  ctx: TransformPluginContext,
) => {
  const cached = moduleCache.get(absolutePath)
  if (cached) return await cached
  const uncachedTranspileAndEvaluate = async () => {
    if (absolutePath === 'static-css-extract')
      return { css: taggedTemplateNoop }
    // @ts-expect-error
    let loaded: string = null
    for (const loader of loaders) {
      const result = await loader.call(ctx, absolutePath)
      if (result !== null && result !== undefined) {
        loaded = typeof result === 'string' ? result : result.code
        break
      }
    }
    if (loaded === null) loaded = await readFile(absolutePath, 'utf8')
    let transformed = loaded
    for (const transformer of transformers) {
      const result = await transformer.call(ctx, transformed, absolutePath)
      if (result !== null && result !== undefined) {
        transformed = typeof result === 'string' ? result : result.code
      }
    }
    const [imports] = parse(transformed, absolutePath)
    const esmShimmed = transformESMToCompat(transformed, imports)
    return await executeCode(
      absolutePath,
      ctx,
      esmShimmed,
      loaders,
      transformers,
    )
  }

  const promise = uncachedTranspileAndEvaluate()
  moduleCache.set(absolutePath, promise)
  return promise
}

function _interopRequireWildcard(obj: any) {
  if (obj && obj.__esModule) return obj
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function'))
    return { default: obj }
  return obj
}

function _interopRequireDefault(obj: any) {
  return obj && obj.__esModule ? obj : { default: obj }
}

/**
 * Runs the given code string. Code cannot use imports, must be shimmed. Returns the exports
 */
export const executeCode = async (
  id: string,
  ctx: TransformPluginContext,
  code: string,
  loaders: LoadHook[],
  transformers: TransformHook[],
  scriptContext: Record<string, unknown> = {},
) => {
  const script = new vm.Script(code)
  const global: Record<string, unknown> = {
    setInterval: () => {},
    localStorage: { getItem: () => {}, setItem: () => {} },
    addEventListener() {},
    removeEventListener() {},
  }
  global.self = global
  global.window = global
  const newContext = {
    _importNamespace: async (source: string) => {
      const resolved = await resolve(source, id, ctx)
      if (resolved.useCJS)
        return _interopRequireWildcard(require(resolved.absolutePath))

      return await transpileAndEvaluate(
        resolved.absolutePath,
        loaders,
        transformers,
        ctx,
      )
    },
    _importDefault: async (source: string) => {
      const resolved = await resolve(source, id, ctx)
      if (resolved.useCJS)
        return _interopRequireDefault(require(resolved.absolutePath))
      return (
        await transpileAndEvaluate(
          resolved.absolutePath,
          loaders,
          transformers,
          ctx,
        )
      ).default
    },
    _importNamed: async (source: string) => {
      const resolved = await resolve(source, id, ctx)
      if (resolved.useCJS) return require(resolved.absolutePath)
      return await transpileAndEvaluate(
        resolved.absolutePath,
        loaders,
        transformers,
        ctx,
      )
    },
    main: async () => ({} as Record<string, unknown>), // this will get overridden
    ...global,
    ...scriptContext,
  }
  vm.createContext(newContext)
  try {
    script.runInNewContext(newContext)
    return await newContext.main()
  } catch (e) {
    console.error(`Error occured while evaluating ${id}:`)
    console.error(e)
    console.error('Source:')
    console.error(code)
    ctx.error(e)
  }
}

export const transformESMToCompat = (
  code: string,
  imports: ImportSpecifier[],
  addCodeBeforeEnd = '',
) => {
  // Makes string operations easier, we aren't actually using the source maps
  const out = new MagicString(code)
  // Largely taken from https://gist.github.com/developit/96de429483bb98927c7cd27c773b0fff
  for (const imp of imports) {
    const source = JSON.stringify(code.substring(imp.s, imp.e))
    const specifiers = code
      .substring(imp.ss + 6, imp.s - 1)
      .replace(/\s*from\s*/g, '')
    const importFunction = specifiers.match(/\*\s*as/)
      ? 'await _importNamespace'
      : specifiers.match(/{/)
      ? 'await _importNamed'
      : 'await _importDefault'
    const transformedSpecifiers = specifiers
      .replace(/\*\s*as/, '') // change * as foo to foo
      .replace(/\sas\s/g, ':') // change {foo as bar} to {foo:bar}
      // https://regexr.com/562ed
      .replace(/(.*),\s*{(.*)}/, '{$2, default:$1}') // change Foo, {foo: bar} to {default: foo}
    const newRequire = `const ${transformedSpecifiers} = ${importFunction}(${source})`
    out.overwrite(imp.ss, imp.se, newRequire)
  }
  const t = /(^|[;\s(])export\s+(function|const|let|var|class)\s+([A-Za-z_$][0-9A-Za-z_$]*)/g
  let token
  while ((token = t.exec(code))) {
    const [, whitespace, declarator, name] = token
    out.overwrite(
      token.index + whitespace.length,
      t.lastIndex - name.length,
      declarator + ' ',
    )
    out.append(`_exports.${name} = ${name};\n`)
  }
  const t2 = /(^|[;\s(])export\s+default\s+/g
  while ((token = t2.exec(code))) {
    out.overwrite(
      token.index + token[1].length,
      t2.lastIndex,
      '_exports.default=',
    )
  }
  // export {foo, asdf as a1}
  const t3 = /(^|[;\s(])export\s+{([^}]*)}/g
  while ((token = t3.exec(code))) {
    out.remove(token.index + token[1].length, t3.lastIndex)
    const inner = token[2]
    inner.split(',').forEach((exportedVal) => {
      /** `foo` or `asdf as a1` */
      const trimmed = exportedVal.trim()
      const [l, r = l] = trimmed.split(/\s+as\s+/)
      out.append(`_exports.${r} = ${l};\n`)
    })
  }
  // const main = async () => {
  //   const _exports = {}
  //   const {foo} = await _import('bar')
  //   const s = foo('hi')
  //   _exports.s = s
  //   return _exports
  // }
  out.prepend('main = async () => {\nconst _exports = {};\n')
  out.append(addCodeBeforeEnd)
  out.append('\nreturn _exports\n}')
  return out.toString()
}

function taggedTemplateNoop(strings: string[], ...keys: string[]) {
  const lastIndex = strings.length - 1
  return (
    strings.slice(0, lastIndex).reduce((p, s, i) => p + s + keys[i], '') +
    strings[lastIndex]
  )
}
