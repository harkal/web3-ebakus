/**
 * Web3 subprovider for Ebakus.
 *
 * @author Chris Ziogas <chris@ebakus.com>
 * @date 2020
 */

import { inherits } from 'util'
import Subprovider from 'web3-provider-engine/subproviders/subprovider'

import Web3Ebakus from './index'

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

CalculateWorkNonce.prototype.handleRequest = async function(
  payload,
  next,
  end
) {
  switch (payload.method) {
    case 'eth_sendTransaction':
    case 'eth_signTransaction':
      const txParams = payload.params[0]

      if (!txParams.workNonce) {
        try {
          const txWithPoW = await this.web3.eth.calculateWorkForTransaction(
            txParams,
            this.defaultTargetDifficulty,
            null
          )

          const workNonce = txWithPoW.workNonce

          // mutate the params
          payload.params[0].workNonce = workNonce

          // hack as most existing libraries don't know how to use/pass over workNonce
          payload.params[0].gasPrice = workNonce
        } catch (err) {
          end(err)
          return
        }
      }

      next()
      return

    // TODO: better handle of racing conditions in truffle migrate
    //   we have to examine where the racing condition occurs
    case 'eth_getTransactionReceipt':
      setTimeout(() => {
        next()
      }, 2000)
      return

    default:
      next()
      return
  }
}
