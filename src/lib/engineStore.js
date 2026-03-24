/**
 * engineStore — persist and load engine results as JSON files in the data directory.
 *
 * Files:
 *   backtest-results.json    — backtest engine output
 *   enriched-locations.json  — location intelligence discoveries (keyed by account)
 *   predictions.json         — prediction engine scored deals
 */

export async function saveEngineResult(fileName, data) {
  try {
    const resp = await fetch(`/local-data/file?name=${encodeURIComponent(fileName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!resp.ok) console.warn(`[engineStore] Failed to save ${fileName}: ${resp.status}`)
    return resp.ok
  } catch (e) {
    console.warn(`[engineStore] Save error for ${fileName}:`, e)
    return false
  }
}

export async function loadEngineResult(fileName) {
  try {
    const resp = await fetch(`/local-data/file?name=${encodeURIComponent(fileName)}`)
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

// Convenience wrappers
export const saveBacktest = (data) => saveEngineResult('backtest-results.json', data)
export const loadBacktest = () => loadEngineResult('backtest-results.json')

export const saveLocations = (data) => saveEngineResult('enriched-locations.json', data)
export const loadLocations = () => loadEngineResult('enriched-locations.json')

export const savePredictions = (data) => saveEngineResult('predictions.json', data)
export const loadPredictions = () => loadEngineResult('predictions.json')
