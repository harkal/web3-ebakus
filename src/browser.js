/**
 * Web3 module to add transaction PoW for Ebakus.
 *
 * @author Chris Ziogas <chris@ebakus.com>
 * @date 2018
 */
import '@babel/polyfill'

import Bytes from 'eth-lib/lib/bytes'
import RLP from 'eth-lib/lib/rlp'

import Worker from 'worker-loader?inline&name=[name].[ext]!./web/calculateWorkNonce.worker.js'

import signTransaction, {
  setWeb3Provider as signTransactionSetWeb3Provider,
} from './common/signTransaction'
import { wasmSupported } from './common/utils'

let _benchmarkCallsPerSecond

const benchmarkWorkCallsPerSecond = callback => {
  if (_benchmarkCallsPerSecond && _benchmarkCallsPerSecond > 0) {
    return Promise.resolve(_benchmarkCallsPerSecond)
  }

  let error = false

  callback = callback || (() => {})

  if (!wasmSupported) {
    error = new Error(
      "Wasm is not supported by browser. PoW function can't load."
    )

    callback(error)
    return Promise.reject(error)
  }

  const benchmarkCallsPerSecond = async () => {
    let worker

    try {
      const job = {
        benchmark: true,
      }

      return new Promise(function(resolve) {
        worker = new Worker()

        /**
         * worker can emit the following payloads:
         * 1. { cmd: 'ready' }
         * 2. { cmd: 'finished', callsPerSecond: number }
         */
        worker.onmessage = function onMessage(e) {
          const {
            target: wrk,
            data: { cmd, callsPerSecond },
          } = e

          switch (cmd) {
            case 'ready': {
              worker.postMessage(job)
              break
            }

            case 'finished': {
              wrk.terminate()

              _benchmarkCallsPerSecond = callsPerSecond

              callback(null, callsPerSecond)
              resolve(callsPerSecond)
              break
            }

            default: {
              console.warn('Unknown data from worker', e.data)
            }
          }
        }
      })
    } catch (err) {
      callback(err)
      return Promise.reject(err)
    }
  }

  return Promise.resolve(benchmarkCallsPerSecond())
}

const ebakus = web3 => {
  if (!web3) {
    throw new Error('No web3 object provided to web3-ebakus!')
  }

  /*
   * calculateWorkForTransaction is used for running the wanted Proof of Work
   * for the transaction from the Ebakus blockchain
   */
  web3.eth.calculateWorkForTransaction = function calculateWorkForTransaction(
    tx,
    targetDifficulty,
    ctrl,
    callback
  ) {
    const _this = this
    let error = false

    callback = callback || (() => {})

    if (!wasmSupported) {
      error = new Error(
        "Wasm is not supported by browser. PoW function can't load."
      )

      callback(error)
      return Promise.reject(error)
    }

    if (!tx) {
      error = new Error('No transaction object given!')

      callback(error)
      return Promise.reject(error)
    }

    const calculatePowNonce = async tx => {
      let currentWorkNonce = 0
      let isRunning = false
      let worker, workerReject

      // allow the user to check status of the worker
      if (ctrl !== null && typeof ctrl === 'object') {
        ctrl.isRunning = () => isRunning
        ctrl.getCurrentWorkNonce = () => currentWorkNonce
        ctrl.kill = () => {
          isRunning = false
          currentWorkNonce = 0

          worker && worker.terminate()
          workerReject && workerReject('Worker terminated by user')
        }
      }

      try {
        if (!targetDifficulty) {
          targetDifficulty = await web3.eth.suggestDifficulty(tx.from)
        }

        if (!tx.nonce) {
          tx.nonce = await web3.eth.getTransactionCount(tx.from)
        }

        if (!tx.gas) {
          tx.gas = await web3.eth.estimateGas(tx)
        }

        // web3.js passes gasPrice as a number, ebakus doesn't need it so it zeroes it
        tx.gasPrice = '0'

        tx = web3.extend.formatters.inputCallFormatter(tx)

        const rlpEncoded = RLP.encode([
          Bytes.fromNat(tx.nonce),
          Bytes.fromNat(tx.gas),
          tx.to ? tx.to.toLowerCase() : '',
          Bytes.fromNat(tx.value || '0x'),
          tx.data || '0x',
        ])

        const job = {
          hash: rlpEncoded,
          targetDifficulty: targetDifficulty * web3.utils.hexToNumber(tx.gas),
        }

        return new Promise(function(resolve, reject) {
          worker = new Worker()
          workerReject = reject

          /**
           * worker can emit the following payloads:
           * 1. { cmd: 'ready' }
           * 2. { cmd: 'current', workNonce: number }
           * 3. { cmd: 'finished', workNonce: number }
           */
          worker.onmessage = function onMessage(e) {
            const {
              target: wrk,
              data: { cmd, workNonce },
            } = e

            switch (cmd) {
              case 'ready': {
                isRunning = true
                worker.postMessage(job)
                break
              }

              case 'current': {
                currentWorkNonce = workNonce
                break
              }

              case 'finished': {
                tx.workNonce = web3.utils.numberToHex(workNonce)
                currentWorkNonce = tx.workNonce

                isRunning = false
                wrk.terminate()

                callback(null, tx)
                resolve(tx)
                break
              }

              default: {
                console.warn('Unknown data from worker', e.data)
              }
            }
          }
        })
      } catch (err) {
        callback(err)
        return Promise.reject(err)
      }
    }

    return Promise.resolve(calculatePowNonce(tx))
  }

  web3.eth.estimatePoWTime = async function estimatePoWTime(
    targetDifficulty = 2,
    gas = 21000,
    callback
  ) {
    if (!callback) {
      var args = Array.prototype.slice.call(arguments)
      if (typeof args[args.length - 1] === 'function') {
        callback = args.pop()
      }
    }

    callback = callback || (() => {})

    try {
      const benchmarkCallsPerSecond = await benchmarkWorkCallsPerSecond()

      let bits = Math.log2(targetDifficulty * gas)
      bits = Math.ceil(bits)

      const estimatedTimeInSeconds = Number(
        (((bits / benchmarkCallsPerSecond) * 10000) % 60).toFixed(2)
      )

      callback(null, estimatedTimeInSeconds)
      return Promise.resolve(estimatedTimeInSeconds)
    } catch (err) {
      callback(err)
      return Promise.reject(err)
    }
  }

  // extend web3 eth methods
  web3.eth.extend({
    methods: [
      {
        name: 'suggestDifficulty',
        call: 'eth_suggestDifficulty',
        params: 1,
        inputFormatter: [web3.utils.toChecksumAddress],
        outputFormatter: web3.utils.toFloat,
      },
      {
        name: 'getAbiForAddress',
        call: 'eth_getAbiForAddress',
        params: 1,
        inputFormatter: [web3.utils.inputAddressFormatter],
      },
    ],
  })

  // keep ref to web3 original method
  const superAddAccountFunctions =
    web3.eth.accounts.__proto__._addAccountFunctions

  // extend web3 accounts methods
  web3.eth.accounts.__proto__._addAccountFunctions = function(account) {
    const _this = this

    account = superAddAccountFunctions.call(_this, account)

    account.signTransaction = (tx, callback) => {
      return signTransaction(tx, account.privateKey, callback)
    }
    account.calculateWorkForTransaction = web3.eth.calculateWorkForTransaction

    return account
  }

  web3.eth.accounts.signTransaction = function(tx, privateKey, callback) {
    return signTransaction(tx, privateKey, callback)
  }

  signTransactionSetWeb3Provider(web3)

  // add ebakus db methods to web3
  web3.extend({
    property: 'db',
    methods: [
      {
        name: 'get',
        call: 'db_get',
        params: 5,
        inputFormatter: [
          web3.utils.inputAddressFormatter,
          null,
          null,
          null,
          web3.utils.inputBlockNumberFormatter,
        ],
      },
      {
        name: 'select',
        call: 'db_select',
        params: 5,
        inputFormatter: [
          web3.utils.inputAddressFormatter,
          null,
          null,
          null,
          web3.utils.inputBlockNumberFormatter,
        ],
      },
      {
        name: 'next',
        call: 'db_next',
        params: 1,
        inputFormatter: [null],
      },
      {
        name: 'releaseIterator',
        call: 'db_releaseIterator',
        params: 1,
        inputFormatter: [null],
      },
    ],
  })

  return web3
}

export default ebakus
