import { compile, serialize, stringify } from 'stylis'

export const transpileCSS = (className: string, input: string) => {
  const wrappedInput = `.${className} {
    ${input}
  }`
  return serialize(compile(wrappedInput), stringify)
}
