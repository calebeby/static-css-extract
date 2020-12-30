import { evaluateModule } from './lazy-module-evaluator'

describe('returns exports of a module', () => {
  test('named export', async () => {
    const exports = await evaluateModule(`export const foo = '500'`)
    expect(exports).toEqual({ foo: '500' })
  })
  test('default export', async () => {
    const exports = await evaluateModule(`export default '500'`)
    expect(exports).toEqual({ default: '500' })
  })
  test('named exports in curly brackets', async () => {
    const exports = await evaluateModule(`
      const foo = 'hi'
      const asdf = 'asdf'
      export {foo, asdf as default}
    `)
    expect(exports).toEqual({ foo: 'hi', default: 'asdf' })
  })
  test('multiple exports', async () => {
    const exports = await evaluateModule(`
      export default '500';
      export const foo = () => {}
    `)
    expect(exports).toEqual({ default: '500', foo: expect.any(Function) })
  })
})

describe('error handling', () => {
  test('runtime error in module gets thrown', async () => {
    await expect(evaluateModule(`throw new Error('aaaah')`)).rejects.toThrow(
      'aaaah',
    )
  })
  test('syntax error in module gets thrown', async () => {
    await expect(evaluateModule(`const`)).rejects.toThrow(
      'Unexpected end of input',
    )
  })
})

describe('importing', () => {
  test('', async () => {
    const exports = await evaluateModule(`
      import { foo } from 'some-npm-module'
      ...TODO
    `)
    expect(exports).toEqual({})
  })
})
