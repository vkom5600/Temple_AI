// A small QR code generator for the sign-up link (P4 "Printable QR code").
// Byte mode, error correction level M, versions 1–10 (up to 213 characters),
// which is plenty for a web address. Follows the QR Code standard (ISO/IEC 18004)
// in the same shape as Project Nayuki's reference implementation (MIT).

const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26] // level M
const NUM_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5] // level M
const FORMAT_M = 0 // level M's two format bits

const rawModules = (ver: number) => {
  let result = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2
    result -= (25 * numAlign - 10) * numAlign - 55
    if (ver >= 7) result -= 36
  }
  return result
}
const dataCodewords = (ver: number) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver]

// Reed–Solomon over GF(2^8) with the polynomial 0x11D
const gfMul = (x: number, y: number) => {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z & 0xff
}
const rsDivisor = (degree: number) => {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root)
      if (j + 1 < result.length) result[j] ^= result[j + 1]
    }
    root = gfMul(root, 0x02)
  }
  return result
}
const rsRemainder = (data: number[], divisor: number[]) => {
  const result = divisor.map(() => 0)
  for (const b of data) {
    const factor = b ^ (result.shift() as number)
    result.push(0)
    divisor.forEach((coef, i) => { result[i] ^= gfMul(coef, factor) })
  }
  return result
}

/** The QR code for `text` as a square grid of booleans (true = dark). */
export function qrMatrix(text: string): boolean[][] {
  const bytes = [...new TextEncoder().encode(text)]
  let ver = 1
  for (; ver <= 10; ver++) {
    const countBits = ver <= 9 ? 8 : 16
    if (4 + countBits + bytes.length * 8 <= dataCodewords(ver) * 8) break
  }
  if (ver > 10) throw new Error('Text too long for a QR code here')

  // Data bits: byte mode, length, bytes, terminator, padding
  const bits: number[] = []
  const put = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1) }
  put(0b0100, 4)
  put(bytes.length, ver <= 9 ? 8 : 16)
  bytes.forEach((b) => put(b, 8))
  const capacity = dataCodewords(ver) * 8
  put(0, Math.min(4, capacity - bits.length))
  put(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) put(pad, 8)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0))

  // Split into blocks, add error correction, interleave
  const numBlocks = NUM_BLOCKS[ver]
  const eccLen = ECC_PER_BLOCK[ver]
  const raw = Math.floor(rawModules(ver) / 8)
  const numShort = numBlocks - (raw % numBlocks)
  const shortLen = Math.floor(raw / numBlocks)
  const divisor = rsDivisor(eccLen)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1))
    k += dat.length
    const ecc = rsRemainder(dat, divisor)
    if (i < numShort) dat.push(0)
    blocks.push(dat.concat(ecc))
  }
  const codewords: number[] = []
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => { if (i !== shortLen - eccLen || j >= numShort) codewords.push(block[i]) })
  }

  // The grid and its fixed patterns
  const size = ver * 4 + 17
  const dark = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const setFixed = (x: number, y: number, on: boolean) => { dark[y][x] = on; fixed[y][x] = true }

  for (let i = 0; i < size; i++) { setFixed(6, i, i % 2 === 0); setFixed(i, 6, i % 2 === 0) }
  const finder = (x: number, y: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy))
      const xx = x + dx, yy = y + dy
      if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFixed(xx, yy, dist !== 2 && dist !== 4)
    }
  }
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4)

  const align: number[] = []
  if (ver > 1) {
    const numAlign = Math.floor(ver / 7) + 2
    const step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2
    align.push(6)
    for (let pos = size - 7; align.length < numAlign; pos -= step) align.splice(1, 0, pos)
  }
  align.forEach((ay, i) => align.forEach((ax, j) => {
    const corner = (i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)
    if (corner) return
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFixed(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
  }))

  const drawFormat = (mask: number) => {
    const d = (FORMAT_M << 3) | mask
    let rem = d
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const f = ((d << 10) | rem) ^ 0x5412
    const bit = (i: number) => ((f >>> i) & 1) !== 0
    for (let i = 0; i <= 5; i++) setFixed(8, i, bit(i))
    setFixed(8, 7, bit(6)); setFixed(8, 8, bit(7)); setFixed(7, 8, bit(8))
    for (let i = 9; i < 15; i++) setFixed(14 - i, 8, bit(i))
    for (let i = 0; i < 8; i++) setFixed(size - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i++) setFixed(8, size - 15 + i, bit(i))
    setFixed(8, size - 8, true)
  }
  drawFormat(0) // reserve the format area before placing data

  if (ver >= 7) {
    let rem = ver
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const v = (ver << 12) | rem
    for (let i = 0; i < 18; i++) {
      const on = ((v >>> i) & 1) !== 0
      const a = size - 11 + (i % 3), b = Math.floor(i / 3)
      setFixed(a, b, on); setFixed(b, a, on)
    }
  }

  // Data in the zigzag
  let i = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j
      const upward = ((right + 1) & 2) === 0
      const y = upward ? size - 1 - vert : vert
      if (!fixed[y][x] && i < codewords.length * 8) {
        dark[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0
        i++
      }
    }
  }

  // Pick the mask with the lowest penalty
  const masks = [
    (x: number, y: number) => (x + y) % 2 === 0,
    (_x: number, y: number) => y % 2 === 0,
    (x: number) => x % 3 === 0,
    (x: number, y: number) => (x + y) % 3 === 0,
    (x: number, y: number) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x: number, y: number) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x: number, y: number) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x: number, y: number) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ]
  const applyMask = (m: number) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y][x] && masks[m](x, y)) dark[y][x] = !dark[y][x]
  }
  const penalty = () => {
    let p = 0
    for (let a = 0; a < size; a++) {
      let runRow = 1, runCol = 1
      for (let b = 1; b < size; b++) {
        if (dark[a][b] === dark[a][b - 1]) { runRow++; if (runRow === 5) p += 3; else if (runRow > 5) p++ } else runRow = 1
        if (dark[b][a] === dark[b - 1][a]) { runCol++; if (runCol === 5) p += 3; else if (runCol > 5) p++ } else runCol = 1
      }
    }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const c = dark[y][x]
      if (c === dark[y][x + 1] && c === dark[y + 1][x] && c === dark[y + 1][x + 1]) p += 3
    }
    const total = dark.reduce((n, row) => n + row.filter(Boolean).length, 0)
    p += Math.floor(Math.abs(total * 20 - size * size * 10) / (size * size)) * 10
    return p
  }
  let best = 0, bestScore = Infinity
  for (let m = 0; m < 8; m++) {
    applyMask(m); drawFormat(m)
    const score = penalty()
    if (score < bestScore) { bestScore = score; best = m }
    applyMask(m) // undo (XOR)
  }
  applyMask(best); drawFormat(best)
  return dark
}

/** The QR code as an SVG path ("d"), with a 4-module quiet zone. Returns the total size too. */
export function qrPath(text: string): { d: string; size: number } {
  const m = qrMatrix(text)
  let d = ''
  m.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + 4},${y + 4}h1v1h-1z` }))
  return { d, size: m.length + 8 }
}

/** A PNG of the QR code for printing, as a data URL. */
export function qrPng(text: string, scale = 12): string {
  const m = qrMatrix(text)
  const size = (m.length + 8) * scale
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#000'
  m.forEach((row, y) => row.forEach((on, x) => { if (on) ctx.fillRect((x + 4) * scale, (y + 4) * scale, scale, scale) }))
  return canvas.toDataURL('image/png')
}
