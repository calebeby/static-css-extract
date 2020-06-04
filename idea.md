```js
import { foo } from 'bar'
export const s = foo('hi')
```

```js
const main = async () => {
  const {foo} = await _import('bar')
  const s = foo('hi')

  _exports.s = s
  return _exports
}
```
