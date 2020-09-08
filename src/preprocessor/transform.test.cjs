const { preprocess, transform } = require('static-css-extract/preprocessor')
const { test } = require('uvu')
const assert = require('uvu/assert')

/**
 * @param {string} name
 * @param {string} input
 * @param {string} expected
 */
const transformTest = (name, input, expected) => {
  test(name, async () => {
    const result = transform(input)
    assert.equal(result, expected)
  })
}

transformTest(
  'copy directly',
  `
.foo {
  /*  hi */
  background: green;
  // hehehehehe
}
`,
  `
.foo {
  background: green;
}
`,
)

// transformTest(
//   'nested selector',
//   `
// .foo {
//   & bar {
//     background: green
//   }
// }
// `,
//   `
// .foo bar {
//   background: green
// }
// `,
// )

// transformTest(
//   'at-rule',
//   `
// .foo {
//   @media (screen and min-width: 80px) {
//     & bar {
//       background: green
//     }
//   }
// }
// `,
//   `
// @media (screen and min-width: 80px) {
//   .foo bar {
//     background: green
//   }
// }
// `,
// )

// transformTest(
//   'nested selector preserves order',
//   `
// .foo {
//   background: red;
//   & bar {
//     background: green
//   }
//   background: blue;
// }
// `,
//   `
// .foo {
//   background: red;
// }
// .foo bar {
//   background: green
// }
// .foo {
//   background: blue;
// }
// `,
// )

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
