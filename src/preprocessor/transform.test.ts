import { parse, tokenize } from './transform'

test('tokenize', () => {
  const input = '  \t  \n foo-bar: -*asd$ /* : asdf " */ "asdf \' \\" " '
  expect(tokenize(input)).toEqual([
    '  \t  \n ',
    'foo-bar',
    ':',
    ' ',
    '-',
    '*',
    'asd',
    '$',
    ' ',
    '/* : asdf " */',
    ' ',
    '"asdf \' \\" "',
    ' ',
  ])
})

test('parse rules', () => {
  expect(
    parse(
      ` /* hi */ background-color: rgba(0,0,0); /* hi */ color: /* hi2 */ \ngreen `,
    ),
  ).toEqual([
    { type: 'declaration', data: 'background-color: rgba(0,0,0)', start: 1 },
    { type: 'declaration', data: 'color:\ngreen ', start: 41 },
  ])
})

test.only('at rules', () => {
  expect(
    parse(`
@media (screen and min-width: '28px') {
  background: green;
}
  `),
  ).toEqual([{ type: 'at-rule', values }])
})

test.skip('test', () => {
  console.log(
    parse(`
.foo {
  background: red;
  color: green;

  @asdf {
    background: red;
  }
}
`),
  )
})
