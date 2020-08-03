import { createHash } from 'crypto'
import { transform } from './transform'

export const preprocess = (originalCSS: string) => {
  const className =
    '_' + createHash('sha512').update(originalCSS).digest('hex').slice(0, 7)
  const selector = `.${className}`
  const wrappedCSS = `${selector} {
  ${originalCSS}
}`
  const outputCSS = transform(wrappedCSS)

  return { className, outputCSS: outputCSS.toString() }
}

export { transform }
