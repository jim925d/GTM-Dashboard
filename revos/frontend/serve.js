/**
 * RevOS Standalone Server — zero dependencies, just Node.js
 * Usage: node serve.js
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { request as httpsRequest } from 'node:https'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 5173
const distDir = path.resolve(__dirname, 'dist')
let dataDir = path.resolve(__dirname, 'data')

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => resolve(body))
  })
}

function jsonRes(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify(data))
}

function serveJSON(res, filename) {
  const p = path.join(dataDir, filename)
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (!fs.existsSync(p)) { res.end('{}'); return }
  res.end(fs.readFileSync(p, 'utf-8'))
}

function serveStatic(res, urlPath) {
  let filePath = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html') // SPA fallback
  }
  const ext = path.extname(filePath)
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  res.end(fs.readFileSync(filePath))
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const p = url.pathname

  // --- /local-data/data-dir ---
  if (p === '/local-data/data-dir') {
    if (req.method === 'POST') {
      const body = await readBody(req)
      try {
        const { dir } = JSON.parse(body)
        if (!dir) return jsonRes(res, { error: 'Missing dir' }, 400)
        const resolved = path.resolve(dir)
        if (!fs.existsSync(resolved)) return jsonRes(res, { error: `Directory not found: ${resolved}` }, 400)
        dataDir = resolved
        console.log(`[RevOS] Data directory changed to: ${dataDir}`)
        return jsonRes(res, { dataDir, ok: true })
      } catch (e) { return jsonRes(res, { error: e.message }, 400) }
    }
    return jsonRes(res, { dataDir })
  }

  // --- /local-data/manifest ---
  if (p === '/local-data/manifest') {
    try {
      if (!fs.existsSync(dataDir)) return jsonRes(res, { files: [], dataDir })
      let dataFiles = fs.readdirSync(dataDir).filter((f) => f.endsWith('.csv') || f.endsWith('.xlsx') || f.endsWith('.xls'))
      const jsonExcludes = ['locations', 'locations_geocoded', 'historical', 'engagements', 'engagement_2026']
      dataFiles = dataFiles.filter((f) => !jsonExcludes.includes(f.replace(/\.(csv|xlsx|xls)$/, '').toLowerCase()))
      const geocoded = dataFiles.filter((f) => f.includes('_geocoded'))
      const originals = geocoded.map((f) => f.replace('_geocoded', ''))
      dataFiles = dataFiles.filter((f) => !originals.includes(f) || !geocoded.includes(f.replace('.csv', '_geocoded.csv')))
      const files = dataFiles.map((f) => {
        const stat = fs.statSync(path.join(dataDir, f))
        const type = f.endsWith('.xlsx') || f.endsWith('.xls') ? 'xlsx' : 'csv'
        return { name: f.replace('_geocoded', ''), modified: stat.mtimeMs, size: stat.size, realName: f, type }
      })
      return jsonRes(res, { files, dataDir })
    } catch (err) { return jsonRes(res, { files: [], error: err.message }) }
  }

  // --- /local-data/*.json ---
  if (p === '/local-data/locations.json') return serveJSON(res, 'locations.json')
  if (p === '/local-data/historical.json') return serveJSON(res, 'historical.json')
  if (p === '/local-data/engagements.json') return serveJSON(res, 'engagements.json')
  if (p === '/local-data/engagements_2026.json') return serveJSON(res, 'engagements_2026.json')

  // --- /local-data/file?name=xxx.csv or xxx.json ---
  if (p === '/local-data/file') {
    const fileName = url.searchParams.get('name')
    const validExt = fileName && !fileName.includes('..') && (fileName.endsWith('.csv') || fileName.endsWith('.json') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls'))
    if (!validExt) {
      res.writeHead(400); res.end('Invalid file name'); return
    }
    const geocodedPath = fileName.endsWith('.csv') ? path.join(dataDir, fileName.replace('.csv', '_geocoded.csv')) : null
    const filePath = (geocodedPath && fs.existsSync(geocodedPath)) ? geocodedPath : path.join(dataDir, fileName)
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('File not found'); return }
    const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
    const ct = isXlsx ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : fileName.endsWith('.json') ? 'application/json' : 'text/csv; charset=utf-8'
    res.writeHead(200, { 'Content-Type': ct, 'Access-Control-Allow-Origin': '*' })
    res.end(isXlsx ? fs.readFileSync(filePath) : fs.readFileSync(filePath, 'utf-8'))
    return
  }

  // --- /api/analyze (optional Claude proxy) ---
  if (p === '/api/analyze') {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' })
      res.end(); return
    }
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) return jsonRes(res, { error: 'Set ANTHROPIC_API_KEY environment variable to enable AI analysis' }, 400)
    const body = await readBody(req)
    try {
      const { prompt } = JSON.parse(body)
      const payload = JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4096, messages: [{ role: 'user', content: prompt }] })
      const apiReq = httpsRequest({
        hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(payload) },
      }, (apiRes) => {
        let data = ''
        apiRes.on('data', (c) => (data += c))
        apiRes.on('end', () => {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          if (apiRes.statusCode !== 200) { res.writeHead(apiRes.statusCode); res.end(JSON.stringify({ error: `Claude API ${apiRes.statusCode}`, detail: data })); return }
          try {
            const parsed = JSON.parse(data)
            const text = parsed.content?.[0]?.text || ''
            const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/)
            res.end(jsonMatch ? jsonMatch[1].trim() : JSON.stringify({ error: 'No JSON in response', raw: text }))
          } catch (e) { res.end(JSON.stringify({ error: 'Parse error', raw: data })) }
        })
      })
      apiReq.on('error', (e) => jsonRes(res, { error: e.message }, 500))
      apiReq.write(payload)
      apiReq.end()
    } catch (e) { return jsonRes(res, { error: e.message }, 400) }
    return
  }

  // --- Static files ---
  serveStatic(res, p)
})

server.listen(PORT, () => {
  console.log(`\n  [RevOS] Server running at http://localhost:${PORT}`)
  console.log(`  [RevOS] Data directory: ${dataDir}`)
  console.log(`  [RevOS] Press Ctrl+C to stop\n`)
})
