import MagicString from 'magic-string'

export const transform = (input: string, currentSelector = '') => {
  const s = new MagicString(input)
  transformBlock(input, s, 0, currentSelector)
  return s
}

/**
 * Transforms a css range like this:
 * background: green;
 * foo: bar;
 * & foo {
 *
 * }
 */
const transformBlock = (
  input: string,
  s: MagicString,
  startIndex: number,
  currentSelector: string,
) => {
  // selecting either a selector or a }
  // explanation of ([^{};]+[^{};\s]+)  :  Want it to not capture trailing whitespace, so that group must end with at least one non-whitespace
  const re = /(?:(})|(^|[{};\s])(\s*)([^{};]+[^{};\s]+)\s*{)/g
  // TODO: Handle media queries
  re.lastIndex = startIndex
  let match
  let endIndex = input.length
  while ((match = re.exec(input))) {
    const [, blockEnd, prevEnd, whitespace, originalSelector] = match
    if (blockEnd) {
      endIndex = re.lastIndex
      break
    }
    const whitespaceStart = match.index + prevEnd.length
    const selectorStart = whitespaceStart + whitespace.length
    const selectorEnd = selectorStart + originalSelector.length
    const selector = originalSelector.replace(/&/g, currentSelector)
    s.overwrite(selectorStart, selectorEnd, selector)
    // Transform the block inside there
    const endOfInner = transformBlock(input, s, re.lastIndex, selector)
    s.remove(whitespaceStart, selectorStart)
    s.prependRight(selectorStart, '\n')
    s.move(selectorStart, endOfInner, input.length + 1)
    // jump to after the end of the last block
    re.lastIndex = endOfInner
  }

  return endIndex
}
