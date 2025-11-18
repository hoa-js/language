## @hoajs/language

Language middleware for Hoa.

## Installation

```bash
$ npm i @hoajs/language --save
```

## Quick Start

```js
import { Hoa } from 'hoa'
import { every, some } from '@hoajs/language'

const app = new Hoa()

app.use(
  language(
  )
)

export default app
```

## Documentation

The documentation is available on [hoa-js.com](https://hoa-js.com/middleware/language.html)

## Test (100% coverage)

```sh
$ npm test
```

## License

MIT
