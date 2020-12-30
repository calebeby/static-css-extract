/** based on https://github.com/cristianbote/goober/blob/master/src/core/to-hash.js */
export const getClassName = (code: string, prefix?: string) =>
  (prefix ? prefix + '-' : '_') +
  code
    .split('')
    .reduce((out, i) => (101 * out + i.charCodeAt(0)) >>> 0, 11)
    .toString(16)
