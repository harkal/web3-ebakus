const isHexStrict = hex =>
  (typeof hex === 'string' || typeof hex === 'number') &&
  /^(-)?0x[0-9a-f]*$/i.test(hex)

const hex2uint8 = (buffer, s, byteOffset) => {
  let result = new Uint8Array(buffer, byteOffset, s.length / 2)
  for (let i = 0; i < s.length / 2; i++) {
    result[i] = parseInt(s.substr(2 * i, 2), 16)
  }
  return result
}

export { isHexStrict, hex2uint8 }
