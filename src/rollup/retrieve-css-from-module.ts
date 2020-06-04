import { init, parse, ImportSpecifier } from 'es-module-lexer'
import MagicString from 'magic-string'
import {
  TransformPluginContext,
  TransformResult,
  LoadHook,
  TransformHook,
} from 'rollup'
import { executeCode, transformESMToCompat } from './executor'

/** Used for error messages */
const correctImport =
  'It must be imported as `import {css} from "static-css-extract"`'

const cssExportPrefix = '__STATIC_CSS__'

export const retrieveCSSFromModule = async (
  ctx: TransformPluginContext,
  code: string,
  loaders: LoadHook[],
  transformers: TransformHook[],
  id: string,
): Promise<TransformResult> => {
  if (!code.includes('static-css-extract')) return null
  const label = `static-css-extract for ${id}`
  console.time(label)
  await init
  const s = new MagicString(code)

  const [imports] = parse(code, id)

  // Index of the import which is import {css} from 'static-css-extract'
  const importToStaticCSSExtractIndex = imports.findIndex((i) => {
    return checkImport(i, code, ctx)
  })
  if (importToStaticCSSExtractIndex === undefined) return null
  const i = imports[importToStaticCSSExtractIndex]
  // Remove the import
  s.remove(i.ss, i.se)
  // Remove it from imports array
  imports.splice(importToStaticCSSExtractIndex, 1)
  // Update remaining imports indexes
  const lengthOfRemovedImport = i.se - i.ss
  for (const imp of imports) {
    // If this import ends before the removed one begins, no need to offset
    if (imp.se < i.ss) continue
    // Offset by the length of the removed import
    imp.se -= lengthOfRemovedImport
    imp.ss -= lengthOfRemovedImport
    imp.e -= lengthOfRemovedImport
    imp.s -= lengthOfRemovedImport
  }
  const cssBlocks = findCSSBlocks(code)
  const cssExportsCode = cssBlocks
    .map((b) => `_exports.${cssExportPrefix}${b.name} = ${b.name};`)
    .join('\n')
  const esmCompat = transformESMToCompat(s.toString(), imports, cssExportsCode)
  const css = await executeAndRetrieveCSS(
    id,
    ctx,
    esmCompat,
    loaders,
    transformers,
  )
  let stylesheet = ''
  cssBlocks.forEach(({ name, start, end }) => {
    const result = css[name]
    if (result === undefined)
      ctx.error('Could not statically evaluate css string', start)
    try {
      s.overwrite(start, end, JSON.stringify(result))
    } catch (e) {
      console.log(e)
      console.log(id)
      console.log({ name, start, end })
      console.log(s.toString())
      throw e
    }
    stylesheet += result + '\n'
  })

  console.timeEnd(label)
  return { code: s.toString(), map: s.generateMap({ hires: true }) }
}

interface CSSBlockLocation {
  /** Name of css block variable */
  name: string
  /**
   * ```
   *const foo = css`...`
   *            ^
   * ```
   */
  start: number
  /**
   * ```
   *const foo = css`...`
   *                   ^
   * ```
   */
  end: number
}

/**
 * Finds all instances of const foo = css`...`
 */
const findCSSBlocks = (code: string) => {
  const blocks: CSSBlockLocation[] = []
  // https://regexr.com/558nl
  const blockStart = /const\s+(\w[\w\d]+)\s*=\s*css\s*`/g
  let matches: RegExpMatchArray | null
  while ((matches = blockStart.exec(code)) !== null) {
    const name = matches[1] // first capture group
    const start = code.lastIndexOf('css', blockStart.lastIndex)
    const end = walkToEndOfTemplateExpression(code, blockStart.lastIndex) + 1
    blocks.push({ name, start, end })
  }
  return blocks
}

/**
 * Walks till it reaches the closing \`
 * This has bugs if an expression in the template literal has its own
 * template literals or comments with \`
 */
const walkToEndOfTemplateExpression = (
  code: string,
  /** Character index after the opening ` */
  startIndex: number,
) => {
  // -1 starts it at the first character after the opening `, because of the ++
  let i = startIndex - 1
  while (++i < code.length) {
    if (code[i] === '`' && code[i - 1] !== '\\') {
      return i
    }
  }
  return code.length - 1
}

const executeAndRetrieveCSS = async (
  id: string,
  ctx: TransformPluginContext,
  code: string,
  loaders: LoadHook[],
  transformers: TransformHook[],
) => {
  const moduleExports = await executeCode(
    id,
    ctx,
    code,
    loaders,
    transformers,
    { css: taggedTemplateNoop },
  )

  return Object.fromEntries(
    Object.entries(moduleExports)
      .filter(
        ([key, value]) =>
          key.startsWith(cssExportPrefix) && typeof value === 'string',
      )
      .map(
        ([key, value]) =>
          [key.replace(cssExportPrefix, ''), value] as [string, string],
      ),
  )
}

/**
 * Checks that an import is a correct import: import {css} from "static-css-extract"
 * Returns true if it is correct. Returns false if it imports from somewhere else
 * Throws if the import is from "static-css-extract" but it imports the wrong thing or in the wrong way
 */
const checkImport = (
  i: ImportSpecifier,
  code: string,
  ctx: TransformPluginContext,
) => {
  const importSource = code.substring(i.s, i.e)
  if (importSource !== 'static-css-extract') return false
  const entireImport = code.substring(i.ss, i.se)
  // Make sure it is not a namespace import
  if (entireImport.includes('*')) {
    const err = new Error(
      `Cannot use namespace import for static-css-extract. ${correctImport}`,
    )
    const errorPosition = i.ss + entireImport.indexOf('*')
    ctx.error(err, errorPosition)
  }
  const fullSpecifiers = entireImport
    .substring('import'.length, entireImport.lastIndexOf('from'))
    .trim()
  // Make sure it is not a default import
  if (!fullSpecifiers.includes('{')) {
    const err = new Error(
      `Cannot use default import for static-css-extract. ${correctImport}`,
    )
    const errorPosition = i.ss + entireImport.indexOf(fullSpecifiers)
    ctx.error(err, errorPosition)
  }
  // Trim off the {}
  const namedSpecifiers = fullSpecifiers.slice(1, -1).trim()
  /** ['foo', 'as', 'bar'] in error case, ['css'] in correct case */
  const words = namedSpecifiers.split(/\s+/g)
  // Make sure it is importing `css`
  if (words[0] !== 'css') {
    const err = new Error(
      `Cannot import ${words[0]} from static-css-extract. ${correctImport}`,
    )
    const errorPosition = i.ss + entireImport.indexOf(namedSpecifiers)
    ctx.error(err, errorPosition)
  }
  // Make sure it is not a renamed import: {foo as bar}
  if (words.length !== 1) {
    const err = new Error(
      `Cannot rename import for static-css-extract. ${correctImport}`,
    )
    const errorPosition =
      i.ss +
      entireImport.indexOf(namedSpecifiers) +
      namedSpecifiers.lastIndexOf(words[1]) // "as"
    ctx.error(err, errorPosition)
  }

  return true
}

function taggedTemplateNoop(strings: string[], ...keys: string[]) {
  const lastIndex = strings.length - 1
  return (
    strings.slice(0, lastIndex).reduce((p, s, i) => p + s + keys[i], '') +
    strings[lastIndex]
  )
}
