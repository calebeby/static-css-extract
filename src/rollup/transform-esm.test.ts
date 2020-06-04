import { init, parse } from 'es-module-lexer'
import { transformESMToCompat } from './executor'

const transform = async (input: string) => {
  await init
  const [imports, exports] = parse(input)
  return transformESMToCompat(input, imports, exports)
}

test('transform direct export', async () => {
  expect(
    await transform(`
  export const foo = 'hi'
  `),
  ).toMatchInlineSnapshot(`
    "main = async () => {
    const _exports = {};

      const foo = 'hi'
      _exports.foo = foo;

    return _exports
    }"
  `)
})

test('transform direct export function', async () => {
  expect(
    await transform(`
  export function foo () {}
  `),
  ).toMatchInlineSnapshot(`
    "main = async () => {
    const _exports = {};

      function foo () {}
      _exports.foo = foo;

    return _exports
    }"
  `)
})

test('transform direct export class', async () => {
  expect(
    await transform(`
  export class foo () {}
  `),
  ).toMatchInlineSnapshot(`
    "main = async () => {
    const _exports = {};

      class foo () {}
      _exports.foo = foo;

    return _exports
    }"
  `)
})

test('transform separated export', async () => {
  expect(
    await transform(`
  const foo = 'hi'
  export {foo}
  `),
  ).toMatchInlineSnapshot(`
    "main = async () => {
    const _exports = {};

      const foo = 'hi'
      
      _exports.foo = foo;

    return _exports
    }"
  `)
})

test('transform renamed separated export', async () => {
  expect(
    await transform(`
  const foo = 'hi'
  export { foo as bar }
  `),
  ).toMatchInlineSnapshot(`
    "main = async () => {
    const _exports = {};

      const foo = 'hi'
      
      _exports.bar = foo;

    return _exports
    }"
  `)
})

test('transform renamed separated export and inlined export', async () => {
  expect(
    await transform(`
  export const foo = 'hi'
  export { foo as bar }
  `),
  ).toMatchInlineSnapshot(`
    "main = async () => {
    const _exports = {};

      const foo = 'hi'
      
      _exports.foo = foo;
    _exports.bar = foo;

    return _exports
    }"
  `)
})
