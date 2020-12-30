import babel from '@rollup/plugin-babel'
import nodeResolve from '@rollup/plugin-node-resolve'

/** @type {import('rollup').RollupOptions} */
const options = {
  input: { index: './src/index', rollup: './src/rollup' },
  plugins: [
    babel({ babelHelpers: 'bundled', extensions: ['.js', '.ts'] }),
    nodeResolve({ extensions: ['.js', '.mjs', '.ts'] }),
  ],
  output: [
    {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: '[name].cjs',
      exports: 'named',
    },
    { dir: 'dist', format: 'esm', entryFileNames: '[name].mjs' },
  ],
}

export default options
