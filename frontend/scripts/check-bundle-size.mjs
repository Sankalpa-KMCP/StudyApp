import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST_ASSETS = 'dist/assets'
const MAX_MAIN_GZIP_BYTES = 512_000
const MAX_TOTAL_JS_GZIP_BYTES = 1_200_000

const jsFiles = readdirSync(DIST_ASSETS).filter(f => f.endsWith('.js'))
if (jsFiles.length === 0) {
  console.error('No JS chunks found in dist/assets — run npm run build first')
  process.exit(1)
}

let totalGzipBytes = 0
const chunks = []

for (const file of jsFiles.sort()) {
  const raw = readFileSync(join(DIST_ASSETS, file))
  const gzipBytes = gzipSync(raw).length
  totalGzipBytes += gzipBytes
  chunks.push({ file, gzipBytes })
}

const mainChunk = chunks.find(c => /^index-.*\.js$/.test(c.file)) ?? chunks[0]

console.log(`Main chunk: ${mainChunk.file}`)
console.log(`Main gzip size: ${mainChunk.gzipBytes} bytes (limit ${MAX_MAIN_GZIP_BYTES})`)
console.log(`Total JS gzip size: ${totalGzipBytes} bytes across ${chunks.length} chunks (limit ${MAX_TOTAL_JS_GZIP_BYTES})`)

for (const chunk of chunks) {
  console.log(`  ${chunk.file}: ${chunk.gzipBytes} bytes gzip`)
}

let failed = false

if (mainChunk.gzipBytes > MAX_MAIN_GZIP_BYTES) {
  console.error(`Main chunk exceeds gzip budget by ${mainChunk.gzipBytes - MAX_MAIN_GZIP_BYTES} bytes`)
  failed = true
}

if (totalGzipBytes > MAX_TOTAL_JS_GZIP_BYTES) {
  console.error(`Total JS exceeds gzip budget by ${totalGzipBytes - MAX_TOTAL_JS_GZIP_BYTES} bytes`)
  failed = true
}

if (failed) process.exit(1)
