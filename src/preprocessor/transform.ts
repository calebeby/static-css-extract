const tokenGroups = [
  /^\s+/, // whitespace
  /^@?[a-zA-Z-][\w-]*/, // ident or at-rule
  /^\w+/, // word
  /^\/\*.*?\*\//, // comment
  /^".*?[^\\]"+/, // string
  /^'.*?[^\\]'+/, // string
]

export const tokenize = (input: string) => {
  const tokens: string[] = []
  let currentToken = ''
  while (input !== '') {
    for (const tokenGroup of tokenGroups) {
      const res = tokenGroup.exec(input)
      if (res) {
        tokens.push(res[0])
        input = input.substring(tokenGroup.lastIndex + res[0].length)
      }
    }

    tokens.push(input[0])
    input = input.substring(1)
  }
  return tokens
}

interface TreeItem {
  type: string
  start: number
}

interface Declaration extends TreeItem {
  type: 'declaration'
}

interface Block extends TreeItem {
  type: 'block'
  contents: (Declaration | AtRule | RuleSet)[]
}

interface AtRule extends TreeItem {
  type: 'at-rule'
  value?: Block
}

interface RuleSet extends TreeItem {
  type: 'ruleset'
}

const BaseMode = 0

export const parse = (input: string) => {
  const tree: TreeItem[] = []
  const tokens = tokenize(input)
  let i = 0,
    len = tokens.length
  let charIndex = 0
  let mode = BaseMode
  while (i < len) {
    const token = tokens[i]
    if (token[0] === '@') {
    }
    charIndex += token.length
    i++
  }
  return tree
}

const createLocationError = (
  message: string,
  input: string,
  location: number,
) => {
  let characterCount = 0
  let codeFrame = ''
  const lines = input.split('\n')
  /** Number of digits that the largest line number will have */
  const lineNumDigits = String(lines.length).length
  const separator = ' | '
  lines.forEach((line, i) => {
    const lineNum = i + 1
    const lineNumPadding = ' '.repeat(lineNumDigits - String(lineNum).length)
    codeFrame += '\n' + lineNum + lineNumPadding + separator + line
    if (
      characterCount <= location &&
      location < characterCount + line.length + 1
    ) {
      // This line must have the error message
      // Add in the line with the error caret
      /** Column on this line which contains the error */
      const errorOffset = location - characterCount
      codeFrame +=
        '\n' + ' '.repeat(lineNumDigits + separator.length + errorOffset) + '^'

      if (characterCount + line.length === location) {
        // This means that the error location was the `\n` between the last line and this one. We add this extra message to be helpful
        codeFrame += ' (\\n character)'
      }
    }
    characterCount += line.length + 1 // +1 is for \n character
  })

  return new Error(`Error: ${message}${codeFrame}\n`)
}
