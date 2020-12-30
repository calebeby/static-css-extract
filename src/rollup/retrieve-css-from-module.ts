import { ImportSpecifier, init, parse } from 'es-module-lexer'
import MagicString from 'magic-string'
import { LoadHook, TransformHook, TransformPluginContext } from 'rollup'
import vm from 'vm'

/** Used for error messages */
const correctImport =
  'It must be imported as `import {css} from "static-css-extract"`'

const cssExportPrefix = '__STATIC_CSS__'

export const clearCache = () => {}

/**
 * Returns the path to the generated stylesheet for a given js module
 * Example: foo.js -> foo.js.virtual.css
 */
export const getCssFileNameForJSModule = (jsId: string) => {
  return jsId + '.virtual.css'
}

export const retrieveCSSFromModule = async (
  ctx: TransformPluginContext,
  code: string,
  loaders: LoadHook[],
  transformers: TransformHook[],
  id: string,
) => {
  if (!code.includes('static-css-extract')) return null
  await init
  const outputString = new MagicString(code)

  const [imports] = parse(code, id)

  // Index of the import which is import {css} from 'static-css-extract'
  const importToStaticCSSExtractIndex = imports.findIndex((i) => {
    return checkImport(i, code, ctx)
  })

  if (importToStaticCSSExtractIndex === undefined) return null
  const i = imports[importToStaticCSSExtractIndex]
  // Remove the import
  outputString.remove(i.ss, i.se)
  // Remove it from imports array
  imports.splice(importToStaticCSSExtractIndex, 1)
  /* // Update remaining imports indexes */
  /* const lengthOfRemovedImport = i.se - i.ss */

  /* for (const imp of imports) { */
  /*   // If this import ends before the removed one begins, no need to offset */
  /*   if (imp.se < i.ss) continue */
  /*   // Offset by the length of the removed import */
  /*   imp.se -= lengthOfRemovedImport */
  /*   imp.ss -= lengthOfRemovedImport */
  /*   imp.e -= lengthOfRemovedImport */
  /*   imp.s -= lengthOfRemovedImport */
  /*   // dynamic import */
  /*   if (imp.d > -1) imp.d -= lengthOfRemovedImport */
  /* } */

  const cssBlocks = findCSSBlocks(code)
  const cssExportsCode = cssBlocks
    .map((b) => {
      const value = b.hoist ? code.substring(b.start, b.end) : b.name
      return `extracted_css.${b.name} = ${value}`
    })
    .join('\n')

  // clone so that we can make temporary modifications just for evaluation purposes
  const evalString = outputString.clone()

  const importedPieces = new Map<string, Set<string>>()

  for (const imp of imports) {
    // make sure it is static import
    if (imp.d !== -1) continue

    const source = code.substring(imp.s, imp.e)
    const allSpecifiers = code
      .substring(imp.ss + 'import'.length, imp.s)
      .replace(/\s*(?:from)?\s*['"]$/, '')
      .trim()

    const namedSpecifiers = (allSpecifiers.match(/\{(.*)\}/)?.[1] || '')
      .split(',')
      .map((specifier) => specifier.trim())
      .filter(Boolean)
    evalString.remove(imp.ss, imp.se)
  }

  console.log('evaluating:', evalString.toString())

  const entryModule = new vm.SourceTextModule(evalString.toString())
  async function linker(specifier, referencingModule) {
    return new vm.SourceTextModule('export {}')
  }
  await entryModule.link(linker).catch((e) => console.error('linking error', e))
  await entryModule
    .evaluate()
    .catch((e) => console.error('evaluation error', e))

  outputString.prepend(`import '${getCssFileNameForJSModule(id)}';\n`)

  /* cssBlocks.forEach((b, i) => { */
  /*   s.overwrite(b.start, b.end, `block${i}`) */
  /* }) */

  /* return { */
  /*   jsCode: s.toString(), */
  /*   jsMap: s.generateMap({ hires: true }), */
  /*   cssCode: stylesheet, */
  /* } */
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
  /** Whether the css block needs to be hoisted to a new variable in the top scope */
  hoist: boolean
}

let lastStyle = 0
const generateName = () => `style${++lastStyle}`

/**
 * Finds all instances of const foo = css`...`
 */
const findCSSBlocks = (code: string) => {
  const blocks: CSSBlockLocation[] = []
  // https://regexr.com/562j9
  const blockStart = /(?:(?:const|let|var)\s+(\w[\w\d]+)\s*=\s*)?css\s*`/g
  let matches: RegExpMatchArray | null
  while ((matches = blockStart.exec(code)) !== null) {
    const name = matches[1] || generateName() // first capture group
    const start = code.lastIndexOf('css', blockStart.lastIndex)
    const end = walkToEndOfTemplateExpression(code, blockStart.lastIndex) + 1
    const hoist = !matches[1]
    blocks.push({ name, start, end, hoist })
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
