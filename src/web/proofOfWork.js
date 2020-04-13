/**
 * Proof of work functions for Ebakus (Version for Web).
 *
 * @author Chris Ziogas <chris@ebakus.com>
 * @date 2020
 */

import Bytes from 'eth-lib/lib/bytes'
import RLP from 'eth-lib/lib/rlp'
import { threads as hasThreadsSupport } from 'wasm-feature-detect'

import Worker from 'worker-loader?inline&name=[name].[ext]!./proofOfWork.web.worker.js'

import { isHexStrict } from '../common/utils'

let _benchmarkCallsPerSecond

/*
 * calculateWorkForTransaction is used for running the wanted Proof of Work
 * for the transaction from the Ebakus blockchain
 */
const createCalculateWorkForTransaction = (opts = {}) => {
  const hexToNumber = hex =>
    opts.hexToNumber ? opts.hexToNumber(hex) : parseInt(hex, 16)
  const numberToHex = num =>
    opts.numberToHex ? opts.numberToHex(num) : `0x${num.toString(16)}`

  return async function calculateWorkForTransaction(
    tx,
    targetDifficulty,
    ctrl,
    callback
  ) {
    let error = false

    callback = callback || (() => {})

    if (!(await hasThreadsSupport())) {
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
      let worker, workerReject, error

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
          if (opts.suggestDifficulty) {
            targetDifficulty = await opts.suggestDifficulty(tx.from)
          } else {
            error = new Error(
              'Ebakus calculateWorkForTransaction - opts.suggestDifficulty not provided'
            )
          }
        }

        if (!tx.nonce && !error) {
          if (opts.getTransactionCount) {
            tx.nonce = await opts.getTransactionCount(tx.from)
          } else {
            error = new Error(
              'Ebakus calculateWorkForTransaction - opts.getTransactionCount not provided'
            )
          }
        }

        if (!tx.gas && !error) {
          if (opts.estimateGas) {
            tx.gas = await opts.estimateGas(tx)
          } else {
            error = new Error(
              'Ebakus calculateWorkForTransaction - opts.estimateGas not provided'
            )
          }
        }

        if (error) {
          callback(error)
          return Promise.reject(error)
        }

        // web3.js passes gasPrice as a number, ebakus doesn't need it so it zeroes it
        tx.gasPrice = '0'

        if (opts.inputCallFormatter) {
          tx = opts.inputCallFormatter(tx)
          // tx = web3.extend.formatters.inputCallFormatter(tx)
        }

        const rlpEncoded = RLP.encode([
          Bytes.fromNat(tx.nonce),
          Bytes.fromNat(tx.gas),
          tx.to ? tx.to.toLowerCase() : '',
          Bytes.fromNat(tx.value || '0x'),
          tx.data || '0x',
        ])

        const gas = isHexStrict(tx.gas) ? hexToNumber(tx.gas) : tx.gas

        const job = {
          hash: rlpEncoded,
          targetDifficulty: targetDifficulty * gas,
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
                tx.workNonce = numberToHex(workNonce)
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
}

const benchmarkWorkCallsPerSecond = async callback => {
  if (_benchmarkCallsPerSecond && _benchmarkCallsPerSecond > 0) {
    return Promise.resolve(_benchmarkCallsPerSecond)
  }

  let error = false

  callback = callback || (() => {})

  if (!(await hasThreadsSupport())) {
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

export { createCalculateWorkForTransaction, benchmarkWorkCallsPerSecond }