let benchmarkWorkCallsPerSecond
if (process.env.TARGET === 'web') {
  benchmarkWorkCallsPerSecond = require('../web/proofOfWork')
    .benchmarkWorkCallsPerSecond
} else {
  benchmarkWorkCallsPerSecond = require('../node/proofOfWork')
    .benchmarkWorkCallsPerSecond
}

const estimatePoWTime = async function(
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

export default estimatePoWTime
