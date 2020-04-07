/**
 * Web3 module to add transaction PoW for Ebakus.
 *
 * @author Chris Ziogas <chris@ebakus.com>
 * @date 2018
 */
import '@babel/polyfill'

import signTransaction, {
  setWeb3Provider as signTransactionSetWeb3Provider,
} from './common/signTransaction'

import estimatePoWTime from './common/estimatePoWTime'

let createCalculateWorkForTransaction
if (process.env.TARGET === 'web') {
  createCalculateWorkForTransaction = require('./web/proofOfWork')
    .createCalculateWorkForTransaction
} else {
  createCalculateWorkForTransaction = require('./node/proofOfWork')
    .createCalculateWorkForTransaction
}

const ebakus = web3 => {
  if (!web3) {
    throw new Error('No web3 object provided to web3-ebakus!')
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
      {
        name: 'getStaked',
        call: 'eth_getStaked',
        params: 2,
        inputFormatter: [
          web3.utils.inputAddressFormatter,
          web3.utils.inputBlockNumberFormatter,
        ],
      },
    ],
  })

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

  const calculateWorkForTransaction = createCalculateWorkForTransaction({
    suggestDifficulty: web3.eth.suggestDifficulty,
    getTransactionCount: web3.eth.getTransactionCount,
    estimateGas: web3.eth.estimateGas,
    hexToNumber: web3.utils.hexToNumber,
    numberToHex: web3.utils.numberToHex,
    inputCallFormatter: web3.extend.formatters.inputCallFormatter,
  })

  web3.eth.calculateWorkForTransaction = calculateWorkForTransaction

  web3.eth.estimatePoWTime = estimatePoWTime

  // keep ref to web3 original function
  const superAddAccountFunctions =
    web3.eth.accounts.__proto__._addAccountFunctions

  // extend web3 accounts functions
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

  return web3
}

export default ebakus
