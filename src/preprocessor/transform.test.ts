import { transform } from './transform'
import { preprocess } from '.'

test('transform', async () => {
  const input = `
.foo {
  background: green;
  &.bar {
    color: rgba(0, 0, 0, 0);
    background-image: url("");

    & .baz {
      foo: bar;

      foo & {
        const: hi
      }
    }

    & asdfasdfasdfasdf {
      green: true
    }
  }
  &.foo2 {
    color2: rgba(0, 0, 0, 0);
  }
  color: red;
}
`

  const result = transform(input).toString()

  expect(result).toMatchInlineSnapshot(`
    "

    foo .foo.bar .baz {
            const: hi
          }
    .foo.bar .baz {
          foo: bar;
        }
    .foo.bar asdfasdfasdfasdf {
          green: true
        }
    .foo.bar {
        color: rgba(0, 0, 0, 0);
        background-image: url(\\"\\");

      }
    .foo.foo2 {
        color2: rgba(0, 0, 0, 0);
      }
    .foo {
      background: green;

      color: red;
    }"
  `)
})

test('transform multiple selectors comma separated', async () => {
  const input = `
.foo {
  & bar,
  & baz {
    background: green
  }
}
`

  const result = transform(input).toString()

  expect(result).toMatchInlineSnapshot(`
    "

    .foo bar,
      .foo baz {
        background: green
      }
    .foo {

    }"
  `)
})

test('wraps outer', async () => {
  const input = `
  background: green;
  &:hover {
    background: red;
  }
`

  const result = preprocess(input)

  expect(result).toMatchInlineSnapshot(`
    Object {
      "className": "_53439eb",
      "outputCSS": "
    ._53439eb:hover {
        background: red;
      }
    ._53439eb {
      
      background: green;

    }",
    }
  `)
})
