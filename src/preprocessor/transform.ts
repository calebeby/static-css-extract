import MagicString from 'magic-string'

export const transform = (input: string, selectorPrefix = '') => {
  const parsed = parse(input, 0, [], [])
  console.log(parsed)
}

interface Location {
  startIndex: number
  endIndex: number
}

interface AtRule extends Location {
  text: string
}

interface Selector extends Location {
  text: string
  startIndex: number
}

const enum NodeType {
  BlockNode,
  CommentNode,
  RuleNode,
}

interface Node extends Location {
  type: NodeType
}

interface CommentNode extends Node {
  type: NodeType.CommentNode
}

interface BlockNode extends Node {
  type: NodeType.BlockNode
  atRuleStack: AtRule[]
  selectorStack: Selector[]
  contents: Node[]
}

interface RuleNode extends Node {
  type: NodeType.RuleNode
}

const debug = (input: string, node: Node) => {
  console.log(JSON.stringify(input.substring(node.startIndex, node.endIndex)))
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

/**
 * @param startIndex The character index to start parsing at
 */
const parse = (
  input: string,
  startIndex: number,
  atRuleStack: AtRule[],
  selectorStack: Selector[],
) => {
  let currentCharIndex = startIndex - 1
  const contents: Node[] = []
  /** Finds the character index of the next instance of the character */
  const findNext = (text: string) => {
    let searchIndex = currentCharIndex
    while (searchIndex < input.length) {
      if (text === input.substring(searchIndex, searchIndex + text.length)) {
        // walk past the end of the found string
        return searchIndex
      }
      searchIndex++
    }
  }
  while (currentCharIndex < input.length) {
    currentCharIndex++
    const currentChar = input[currentCharIndex]
    if (currentChar === '/') {
      // Handle comments with "/*    */"
      if (input[currentCharIndex + 1] === '*') {
        currentCharIndex += 2
        const end = findNext('*/')
        if (end === undefined)
          throw createLocationError(
            `Expected to find closing comment (*/) to match`,
            input,
            currentCharIndex - 2,
          )
        const commentNode: CommentNode = {
          type: NodeType.CommentNode,
          startIndex: currentCharIndex,
          endIndex: end + 2,
        }
        contents.push(commentNode)
        currentCharIndex = end + 2 // go past the end of the comment
      }
      // handle comments with "//"
      else if (input[currentCharIndex + 1] === '/') {
        currentCharIndex += 2
        const newLine = findNext('\n')
        const commentEnd = newLine
          ? newLine - 1 // -1 to exclude \n
          : input.length - 1
        const commentNode: CommentNode = {
          type: NodeType.CommentNode,
          startIndex: currentCharIndex,
          endIndex: commentEnd,
        }
        contents.push(commentNode)
        currentCharIndex = commentEnd + 1
      }
      continue
    } else if (/\s/.test(currentChar)) {
      // whitespace, ignore
      continue
    } else if (currentChar === '@') {
      // At-selector
      throw new Error('TODO at selectors')
    } else if (currentChar === '}') {
      // Closing block
      break
    } else {
      // Scan to see if it is either a selector or a property
    }
  }
  const result: BlockNode = {
    contents,
  }

  return result
}
