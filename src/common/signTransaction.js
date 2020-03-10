import Account from 'eth-lib/lib/account'
import Bytes from 'eth-lib/lib/bytes'
import Hash from 'eth-lib/lib/hash'
import Nat from 'eth-lib/lib/nat'
import RLP from 'eth-lib/lib/rlp'

let web3

const isNot = value => typeof value === 'undefined' || value === null

const trimLeadingZero = hex => {
  while (hex && hex.startsWith('0x0')) {
    hex = `0x${hex.slice(3)}`
  }
  return hex
}

const makeEven = hex => {
  if (hex.length % 2 === 1) {
    hex = hex.replace('0x', '0x0')
  }
  return hex
}

const setWeb3Provider = provider => {
  web3 = provider
}

/**
 * Signs a transaction object with the given privateKey
 *
 * @method signTransaction
 *
 * @param {Object} tx
 * @param {String} privateKey
 * @param {Function} callback
 *
 * @callback callback callback(error, result)
 * @returns {Promise<Object>}
 */
const signTransaction = async (tx, privateKey, callback) => {
  let error = false
  let result

  callback = callback || (() => {})

  if (!tx) {
    error = new Error('No transaction object given!')

    callback(error)
    return Promise.reject(error)
  }

  // web3.js passes gasPrice as a number, ebakus doesn't need it so it zeroes it
  tx.gasPrice = '0'

  function signed(tx) {
    if (tx.nonce < 0 || tx.gas < 0 || tx.workNonce < 0 || tx.chainId < 0) {
      error = new Error('Nonce, gas, workNonce or chainId is lower than 0')
    }

    if (error) {
      callback(error)
      return Promise.reject(error)
    }

    try {
      const transaction = web3.extend.formatters.inputCallFormatter(tx)
      transaction.to = transaction.to || '0x'
      transaction.data = transaction.data || '0x'
      transaction.value = transaction.value || '0x'
      transaction.chainId = web3.utils.numberToHex(transaction.chainId)

      const rlpEncoded = RLP.encode([
        Bytes.fromNat(transaction.nonce),
        Bytes.fromNat(transaction.workNonce || '0x'),
        Bytes.fromNat(transaction.gas),
        transaction.to.toLowerCase(),
        Bytes.fromNat(transaction.value),
        transaction.data,
        Bytes.fromNat(transaction.chainId || '0x1'),
        '0x',
        '0x',
      ])

      const hash = Hash.keccak256(rlpEncoded)

      const signature = Account.makeSigner(
        Nat.toNumber(transaction.chainId || '0x1') * 2 + 35
      )(Hash.keccak256(rlpEncoded), privateKey)

      const rawTx = RLP.decode(rlpEncoded)
        .slice(0, 6)
        .concat(Account.decodeSignature(signature))

      rawTx[6] = makeEven(trimLeadingZero(rawTx[6]))
      rawTx[7] = makeEven(trimLeadingZero(rawTx[7]))
      rawTx[8] = makeEven(trimLeadingZero(rawTx[8]))

      const rawTransaction = RLP.encode(rawTx)

      const values = RLP.decode(rawTransaction)
      result = {
        messageHash: hash,
        v: trimLeadingZero(values[6]),
        r: trimLeadingZero(values[7]),
        s: trimLeadingZero(values[8]),
        rawTransaction,
      }
    } catch (error) {
      callback(error)
      return Promise.reject(error)
    }

    callback(null, result)

    return result
  }

  // Resolve immediately if nonce, gas, workNonce and chainId are provided
  if (
    tx.nonce !== undefined &&
    tx.gas !== undefined &&
    tx.workNonce !== undefined &&
    tx.chainId !== undefined
  ) {
    return Promise.resolve(signed(tx))
  }

  const from = web3.eth.accounts.privateKeyToAccount(privateKey).address

  // Otherwise, get the missing info from the Ebakus Node
  return Promise.all([
    isNot(tx.nonce) ? web3.eth.getTransactionCount(from) : tx.nonce,
    isNot(tx.gas) ? web3.eth.estimateGas(tx) : tx.gas,
    isNot(tx.workNonce)
      ? web3.eth.calculateWorkForTransaction({ ...tx, from })
      : tx,
    isNot(tx.chainId) ? web3.eth.getChainId() : tx.chainId,
  ]).then(([nonce, gas, { workNonce }, chainId]) => {
    if (isNot(nonce) || isNot(gas) || isNot(workNonce) || isNot(chainId)) {
      throw new Error(
        `One of the values 'nonce=${nonce}', 'gas=${gas}', 'workNonce=${workNonce}' or 'chainId=${chainId}' couldn't be fetched`
      )
    }
    return signed({
      ...tx,
      nonce,
      gas,
      workNonce,
      chainId,
    })
  })
}

export default signTransaction
export { setWeb3Provider }
