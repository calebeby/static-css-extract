import { preprocess, transform } from 'static-css-extract/preprocessor'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

/**
 * @param {string} name
 * @param {string} input
 * @param {string} expected
 */
const transformTest = (name, input, expected) => {
  test(name, async () => {
    const result = transform(input).toString()
    assert.equal(result, expected)
  })
}

transformTest(
  'copy directly',
  `
.foo {
  background: green;
}
`,
  `
.foo {
  background: green;
}
`,
)

transformTest(
  'nested selector preserves order',
  `
.foo {
  background: red;
  & bar {
    background: green
  }
  background: blue;
}
`,
  `
.foo {
  background: red;
}
.foo bar {
  background: green
}
.foo {
  background: blue;
}
`,
)

// transformTest(
//   'multiple nested selectors comma separated',
//   `
// .foo {
//   & bar,
//   & baz {
//     background: green
//   }
// }
// `,
//   `
// .foo bar,
// .foo baz {
//   background: green
// }
// `,
// )

test.run()
