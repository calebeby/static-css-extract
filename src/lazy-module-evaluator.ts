import { init, parse } from 'es-module-lexer'
import MagicString from 'magic-string'
import vm from 'vm'

/**
 * @param input The source code to evaluate
 */
export const evaluateModule = async (
  input: string,
): Promise<Record<string, unknown>> => {
  await init
  const [allImports, allExports] = parse(input)
  const nonDefaultExports = allExports.filter((e) => e !== 'default')
  const str = new MagicString(input)
  let namedExportsStr = ''
  // regular named exports
  let t = /(^|[;\s])export\s+(function|const|class|let|var)\s+([a-zA-Z$_][a-zA-Z$_0-9]*)/g
  let token: RegExpExecArray | null
  while ((token = t.exec(input))) {
    str.overwrite(
      token.index + token[1].length,
      t.lastIndex - token[3].length - 1,
      token[2],
    )
    namedExportsStr += `;__eval__exports.${token[3]} = ${token[3]}`
  }
  // default exports
  t = /(^|[;\s])export\s+default\s/g
  while ((token = t.exec(input))) {
    str.overwrite(
      token.index + token[1].length,
      t.lastIndex,
      '__eval__exports.default =',
    )
  }
  // named exports in curly brackets
  t = /(^|[;\s])export\s+{([^}]*)}/g
  while ((token = t.exec(input))) {
    let replacement = ';'
    token[2].split(',').forEach((specifier) => {
      const [local, exported = local]: string[] = specifier
        .split(/\sas\s/)
        .map((part) => part.trim())
      replacement += `__eval__exports.${exported} = ${local};`
    })
    str.overwrite(token!.index + token![1].length, t.lastIndex, replacement)
  }
  str.append(namedExportsStr)
  /* console.log('code before eval is', JSON.stringify(str.toString())) */
  const script = new vm.Script(str.toString())
  const context = vm.createContext({ __eval__exports: {} })
  script.runInContext(context)
  return context.__eval__exports
}
