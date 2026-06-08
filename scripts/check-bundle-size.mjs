import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST_ASSETS = 'dist/assets'
const MAX_GZIP_BYTES = 512_000

const files = readdirSync(DIST_ASSETS).filter(f => /^index-.*\.js$/.test(f))
if (files.length === 0) {
  console.error('No main index chunk found in dist/assets — run npm run build first')
  process.exit(1)
}

const mainChunk = files.sort().at(-1)
const raw = readFileSync(join(DIST_ASSETS, mainChunk))
const gzipBytes = gzipSync(raw).length

console.log(`Main chunk: ${mainChunk}`)
console.log(`Gzip size: ${gzipBytes} bytes (limit ${MAX_GZIP_BYTES})`)

if (gzipBytes > MAX_GZIP_BYTES) {
  console.error(`Bundle exceeds gzip budget by ${gzipBytes - MAX_GZIP_BYTES} bytes`)
  process.exit(1)
}
