/**
 * Web3 subprovider for Ebakus.
 *
 * @author Chris Ziogas <chris@ebakus.com>
 * @date 2020
 */
import '@babel/polyfill'

import { inherits } from 'util'
import Subprovider from 'web3-provider-engine/subproviders/subprovider'

let Web3Ebakus
if (process.env.TARGET === 'web') {
  Web3Ebakus = require('./browser').default
} else {
  Web3Ebakus = require('./index').default
}

const defaultOptions = {
  defaultTargetDifficulty: null,
}

inherits(CalculateWorkNonce, Subprovider)

export default function CalculateWorkNonce(opts) {
  const { web3, defaultTargetDifficulty } = {
    ...defaultOptions,
    ...opts,
  }

  this.web3 = new Web3Ebakus(web3)
  this.defaultTargetDifficulty = defaultTargetDifficulty
}

CalculateWorkNonce.prototype.handleRequest = function(payload, next, end) {
  const { method } = payload
  if (method === 'eth_signTransaction' || method === 'eth_sendTransaction') {
    const txParams = payload.params[0]

    if (!txParams.workNonce) {
      this.web3.eth
        .calculateWorkForTransaction(
          txParams,
          this.defaultTargetDifficulty,
          null
        )
        .then(tx => {
          // hack as most existing libraries don't know how to use/pass over workNonce
          tx.gasPrice = tx.workNonce
          next(null, tx)
        })
        .catch(err => end(err))
      return
    }
  }
  next()
}
