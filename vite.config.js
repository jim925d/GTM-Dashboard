import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { request as httpsRequest } from 'https'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Plugin: serves CSV files from the local data/ folder and watches for changes
function localDataPlugin() {
  let dataDir = path.resolve(__dirname, 'data')

  return {
    name: 'revos-local-data',
    configureServer(server) {
      // GET /local-data/data-dir — returns current data directory path
      server.middlewares.use('/local-data/data-dir', (req, res) => {
        if (req.method === 'POST') {
          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', () => {
            try {
              const { dir } = JSON.parse(body)
              if (!dir) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Missing dir' }))
                return
              }
              const resolved = path.resolve(dir)
              if (!fs.existsSync(resolved)) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: `Directory not found: ${resolved}` }))
                return
              }
              dataDir = resolved
              console.log(`[RevOS] Data directory changed to: ${dataDir}`)
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ dataDir, ok: true }))
            } catch (e) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: e.message }))
            }
          })
          return
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ dataDir }))
      })

      // GET /local-data/manifest — returns list of CSV files + last modified timestamps
      server.middlewares.use('/local-data/manifest', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        try {
          if (!fs.existsSync(dataDir)) {
            res.end(JSON.stringify({ files: [], dataDir }))
            return
          }
          let csvFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv'))
          // Exclude files that have pre-built JSON equivalents
          const jsonExcludes = ['locations', 'locations_geocoded', 'historical', 'engagements', 'engagement_2026']
          csvFiles = csvFiles.filter(f => !jsonExcludes.includes(f.replace('.csv', '').toLowerCase()))
          // If a _geocoded variant exists, use it instead of the original
          const geocoded = csvFiles.filter(f => f.includes('_geocoded'))
          const originals = geocoded.map(f => f.replace('_geocoded', ''))
          csvFiles = csvFiles.filter(f => !originals.includes(f) || !geocoded.includes(f.replace('.csv', '_geocoded.csv')))
          // Rename geocoded files in manifest so the app sees them as the original name
          const files = csvFiles.map(f => {
              const stat = fs.statSync(path.join(dataDir, f))
              return { name: f.replace('_geocoded', ''), modified: stat.mtimeMs, size: stat.size, realName: f }
            })
          res.end(JSON.stringify({ files, dataDir }))
        } catch (err) {
          res.end(JSON.stringify({ files: [], error: err.message }))
        }
      })

      // GET /local-data/locations.json — pre-built location data
      server.middlewares.use('/local-data/locations.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        const jsonPath = path.join(dataDir, 'locations.json')
        if (!fs.existsSync(jsonPath)) {
          res.end('{}')
          return
        }
        res.end(fs.readFileSync(jsonPath, 'utf-8'))
      })

      // GET /local-data/historical.json — pre-built historical deal data
      server.middlewares.use('/local-data/historical.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        const jsonPath = path.join(dataDir, 'historical.json')
        if (!fs.existsSync(jsonPath)) {
          res.end('{}')
          return
        }
        res.end(fs.readFileSync(jsonPath, 'utf-8'))
      })

      // GET /local-data/engagements.json — pre-built 2025 engagement data
      server.middlewares.use('/local-data/engagements.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        const jsonPath = path.join(dataDir, 'engagements.json')
        if (!fs.existsSync(jsonPath)) {
          res.end('{}')
          return
        }
        res.end(fs.readFileSync(jsonPath, 'utf-8'))
      })

      // GET /local-data/engagements_2026.json — 2026 YTD engagement data
      server.middlewares.use('/local-data/engagements_2026.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        const jsonPath = path.join(dataDir, 'engagements_2026.json')
        if (!fs.existsSync(jsonPath)) {
          res.end('{}')
          return
        }
        res.end(fs.readFileSync(jsonPath, 'utf-8'))
      })

      // GET/POST /local-data/file?name=xxx — read or write files in data dir
      server.middlewares.use('/local-data/file', (req, res) => {
        const url = new URL(req.url, 'http://localhost')
        const fileName = url.searchParams.get('name')
        res.setHeader('Access-Control-Allow-Origin', '*')

        if (!fileName || fileName.includes('..') || !(fileName.endsWith('.csv') || fileName.endsWith('.json'))) {
          res.statusCode = 400
          res.end('Invalid file name')
          return
        }

        // POST — save file to data directory
        if (req.method === 'POST') {
          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', () => {
            try {
              const filePath = path.join(dataDir, fileName)
              fs.writeFileSync(filePath, body, 'utf-8')
              console.log(`[RevOS] Saved ${fileName} (${body.length} bytes)`)
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true, file: fileName }))
            } catch (e) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: e.message }))
            }
          })
          return
        }

        // GET — read file from data directory
        // Check for geocoded variant first
        const geocodedName = fileName.replace('.csv', '_geocoded.csv')
        const geocodedPath = path.join(dataDir, geocodedName)
        const filePath = fs.existsSync(geocodedPath) ? geocodedPath : path.join(dataDir, fileName)
        if (!fs.existsSync(filePath)) {
          res.statusCode = 404
          res.end('File not found')
          return
        }

        const ct = fileName.endsWith('.json') ? 'application/json' : 'text/csv; charset=utf-8'
        res.setHeader('Content-Type', ct)
        res.end(fs.readFileSync(filePath, 'utf-8'))
      })
    },
  }
}

// Plugin: proxies POST /api/analyze to Claude API for account strategy analysis
function analyzePlugin() {
  const env = loadEnv('development', process.cwd(), '')
  const apiKey = env.VITE_ANTHROPIC_API_KEY

  return {
    name: 'revos-analyze',
    configureServer(server) {
      server.middlewares.use('/api/analyze', (req, res) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('POST only')
          return
        }
        if (!apiKey || apiKey === 'your-api-key-here') {
          res.setHeader('Content-Type', 'application/json')
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Set VITE_ANTHROPIC_API_KEY in .env.local' }))
          return
        }

        let body = ''
        req.on('data', chunk => body += chunk)
        req.on('end', () => {
          try {
            const { prompt } = JSON.parse(body)

            const payload = JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4096,
              messages: [{ role: 'user', content: prompt }],
            })

            const options = {
              hostname: 'api.anthropic.com',
              path: '/v1/messages',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Length': Buffer.byteLength(payload),
              },
            }

            const apiReq = httpsRequest(options, (apiRes) => {
              let data = ''
              apiRes.on('data', chunk => data += chunk)
              apiRes.on('end', () => {
                res.setHeader('Content-Type', 'application/json')
                res.setHeader('Access-Control-Allow-Origin', '*')
                if (apiRes.statusCode !== 200) {
                  res.statusCode = apiRes.statusCode
                  res.end(JSON.stringify({ error: `Claude API ${apiRes.statusCode}`, detail: data }))
                  return
                }
                try {
                  const parsed = JSON.parse(data)
                  const text = parsed.content?.[0]?.text || ''
                  // Extract JSON from response (may be wrapped in ```json blocks)
                  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/)
                  if (jsonMatch) {
                    res.end(jsonMatch[1].trim())
                  } else {
                    res.end(JSON.stringify({ error: 'No JSON in response', raw: text }))
                  }
                } catch (e) {
                  res.end(JSON.stringify({ error: 'Parse error', raw: data }))
                }
              })
            })
            apiReq.on('error', (e) => {
              res.statusCode = 500
              res.end(JSON.stringify({ error: e.message }))
            })
            apiReq.write(payload)
            apiReq.end()
          } catch (e) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: e.message }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localDataPlugin(), analyzePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/engine': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
