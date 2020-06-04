import esbuild from 'rollup-plugin-esbuild'
import nodeResolve from '@rollup/plugin-node-resolve'

export default {
  input: ['./src/rollup'],
  plugins: [
    esbuild({ target: 'es2019' }),
    nodeResolve({ extensions: ['.js', '.mjs', '.ts'] }),
  ],
  output: [
    { file: 'dist/rollup.cjs', format: 'cjs' },
    { file: 'dist/rollup.mjs', format: 'esm' },
  ],
  external: [
    'astring',
    'vm',
    'magic-string',
    'path',
    'es-module-lexer',
    'fs',
    'util',
  ],
}
