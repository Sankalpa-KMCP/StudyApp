// Local test fixture: serve the built Pages artifact without an SPA fallback.
// Missing document paths receive the real 404.html and HTTP 404, as on Pages.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'

const root = resolve('dist')
await readFile(resolve(root, 'index.html')) // Fail immediately if build is missing.
/** @type {Record<string, string>} */
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
    if (!pathname.startsWith('/StudyApp/')) {
      response.writeHead(404); response.end('Outside Pages base path'); return
    }
    const target = resolve(root, pathname.slice('/StudyApp/'.length) || 'index.html')
    if (!target.startsWith(root + sep)) {
      response.writeHead(403); response.end(); return
    }
    let file = target
    let status = 200
    try { if (!(await stat(file)).isFile()) throw new Error('Not a file') }
    catch {
      if (extname(pathname)) { response.writeHead(404); response.end('Missing asset'); return }
      file = resolve(root, '404.html'); status = 404
    }
    response.writeHead(status, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
    response.end(await readFile(file))
  } catch {
    response.writeHead(500); response.end('Production fixture failure')
  }
})
server.listen(4175, '127.0.0.1')
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close())
