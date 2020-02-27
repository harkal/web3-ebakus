# web3-ebakus

Extend Web3 functionality for [Ebakus](https://ebakus.com) blockchain.

## Installation

### Node.js

```bash
npm install --save web3-ebakus
```

### In the Browser

Load it from CDN:

```html
<script src="https://unpkg.com/web3-ebakus" />
```

or build running the following from the root folder of the repository:

```bash
npm run-script build
```

Then include `lib/web3-ebakus.browser.min.js` in your html file.
This will expose the `Web3Ebakus` object on the window object.

## Requirements

- Web3 ^1.2.0

## Usage

```js
import Web3Ebakus from 'web3-ebakus'
import Web3 from 'web3'

const web3 = Web3Ebakus(new Web3())
```

You can also have a look at the [example page](example/index.html).

## Methods

### web3.eth.suggestDifficulty(accountAddress)

The `suggestDifficulty` queries the node for the suggested target difficulty needed for the PoW in order for a transaction to enter a block taking into account current congestion levels and address stake. The difficulty will be used in `calculateWorkForTransaction`.

```js
web3.eth
  .suggestDifficulty(accountAddress)
  .then(difficulty => console.log(difficulty))
```

### web3.eth.calculateWorkForTransaction(transaction, targetDifficulty, ctrlWorkForTransactionState, callback)

The `calculateWorkForTransaction` calculates the PoW needed for a transaction to enter a block by a block producer.

```js
const tx = {
  /* transaction object */
}
web3.eth.calculateWorkForTransaction(tx, /* targetDifficulty */ 1).then(tx => {
  /* do something with tx */
})
```

> is also available for `Account` objects, which is useful for chaining

The `ctrlWorkForTransactionState` and `callback` parameters are optional.

- `ctrlWorkForTransactionState`: this is an object that will be populated with some useful methods when passed.

  - `isRunning()`: state of worker
  - `getCurrentWorkNonce()`: returns the current workNonce while worker is running
  - `kill()`: kills the worker

  Example:

  ```js
  let ctrl = {}

  // log worker state every 500ms
  const logger = setInterval(() => {
    console.log('isRunning', ctrl.isRunning())
    console.log('getCurrentWorkNonce', ctrl.getCurrentWorkNonce())

    // stop logging once worker finished
    if (!ctrl.isRunning()) {
      clearInterval(logger)
    }
  }, 500)

  // kill worker after 3seconds
  // setTimeout(() => {
  //   ctrl.kill();
  // }, 3000);

  web3.eth.calculateWorkForTransaction(transaction, 1, ctrl).then(tx => {
    /* do something with tx */
  })
  ```

- `callback`: you can read more [here](https://web3js.readthedocs.io/en/1.0/callbacks-promises-events.html)

### web3.eth.estimatePoWTime(targetDifficulty, gas, callback)

The `estimatePoWTime` estimates how much time the current hardware will take for doing PoW based on target difficulty and transaction gas.

```js
web3.eth.suggestDifficulty(accountAddress).then(difficulty => {
  web3.eth
    .estimatePoWTime(difficulty, /* gas */ 100000)
    .then(powTimeInSeconds => console.log(powTimeInSeconds))
})
```

- `targetDifficulty`: this is the target difficulty to achieve so as transaction gets produced. (default = 2)
- `gas`: this is the transaction gas. (default = 21000)
- `callback`: you can read more [here](https://web3js.readthedocs.io/en/1.0/callbacks-promises-events.html)

### web3.db.select(contractAddress, tableName, whereCondition, orderByColumn, blockNumber)

The `db.select` allows performing selects with conditions ordered by column name.

- `contractAddress`: contract address that created the DB tables
- `tableName`: table name
- `whereClause`: where condition for finding an entry
  Supported conditions are "<", ">", "=", "==", "<=", ">=", "!=", "LIKE"
  Example use case: Phone = "555-1111"
  Id >= 3
- `orderClause`: order clause for sorting the results using "ASC" or "DESC"
  Example use case: Phone DESC
- `blockNumber`: block number to read from EbakusDB state. You can use `latest` string for fetching from latest block.

```js
web3.db.select(contractAddress, tableName, whereCondition, orderByColumn, blockNumber)
  .then(iterator =>
    web3.db.next(iter).then(entry => console.log(entry)
  )
```

### web3.db.next(iter)

The `db.next` returns the next result of the select performed through `web3.db.select()`.

### web3.db.releaseIterator(iter)

The `db.releaseIterator` should be called once, if not all iterator entries has been read using `db.next`, in order the iterator taken from `db.select` to be released.

### web3.db.get(contractAddress, tableName, whereCondition, orderByColumn, blockNumber)

The `db.get` allows fetching a single item. Check for its params at `web3.db.select()`.

```js
web3.db
  .get(contractAddress, tableName, whereCondition, orderByColumn, blockNumber)
  .then(entry => console.log(entry))
```
