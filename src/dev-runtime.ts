import { getClassName } from './get-class-name'
import { transpileCSS } from './transpile-css'

let sheet: Text | null = null

// based on https://github.com/cristianbote/goober/blob/master/src/core/get-sheet.js
const getSheet = () => {
  if (sheet) return sheet
  const s = document.head.appendChild(document.createElement('style'))
  s.innerHTML = ' '
  return (sheet = s.firstChild as Text)
}

/** Class names that are already applied */
const appliedStyles = new Set<string>()

/** Development-only css template tag */
export const css = (
  strings: TemplateStringsArray,
  ...values: (string | number)[]
) => {
  const input = [...values, ''].reduce(
    (builtString: string, value, i) => builtString + strings[i] + value,
    '',
  )
  const className = getClassName(input)
  if (appliedStyles.has(className)) return className
  appliedStyles.add(className)
  getSheet().data += transpileCSS(className, input)
  return className
}
