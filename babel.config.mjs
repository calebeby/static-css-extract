export default {
  presets: [
    ['@babel/preset-env', { targets: { node: 14 } }],
    '@babel/preset-typescript',
  ],
  plugins: [['const-enum', { transform: 'constObject' }]],
}
