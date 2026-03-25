/**
 * Demo/fallback outage data for offline mode or before first API fetch.
 * Follows the same OutageRecord shape used by the engine.
 */

export const DEMO_OUTAGES = [
  {
    id: 'demo-1', source: 'cloudflare', provider: 'Comcast/Xfinity',
    location: 'Chicago', severity: 'high', status: 'active',
    description: 'Widespread connectivity loss across metro area — multiple POPs reporting packet loss >40%',
    startDate: new Date(Date.now() - 3600000).toISOString(),
    endDate: null, lat: 41.8781, lng: -87.6298,
  },
  {
    id: 'demo-2', source: 'ioda', provider: 'AT&T',
    location: 'Dallas', severity: 'medium', status: 'active',
    description: 'Intermittent service disruptions — BGP route flapping detected',
    startDate: new Date(Date.now() - 7200000).toISOString(),
    endDate: null, lat: 32.7767, lng: -96.7970,
  },
  {
    id: 'demo-3', source: 'both', provider: 'Spectrum',
    location: 'Orlando', severity: 'low', status: 'active',
    description: 'DNS resolution delays affecting residential customers',
    startDate: new Date(Date.now() - 14400000).toISOString(),
    endDate: null, lat: 28.5383, lng: -81.3792,
  },
  {
    id: 'demo-4', source: 'cloudflare', provider: 'Verizon',
    location: 'Boston', severity: 'high', status: 'resolved',
    description: 'Fiber cut affecting business district — emergency splice completed',
    startDate: new Date(Date.now() - 86400000 * 2).toISOString(),
    endDate: new Date(Date.now() - 86400000).toISOString(),
    lat: 42.3601, lng: -71.0589,
  },
  {
    id: 'demo-5', source: 'ioda', provider: 'T-Mobile',
    location: 'Denver', severity: 'medium', status: 'resolved',
    description: '5G home internet degradation — tower maintenance completed',
    startDate: new Date(Date.now() - 86400000 * 3).toISOString(),
    endDate: new Date(Date.now() - 86400000 * 2).toISOString(),
    lat: 39.7392, lng: -104.9903,
  },
  {
    id: 'demo-6', source: 'cloudflare', provider: 'CenturyLink/Lumen',
    location: 'Phoenix', severity: 'medium', status: 'active',
    description: 'Enterprise circuit degradation — latency spikes on backbone links',
    startDate: new Date(Date.now() - 5400000).toISOString(),
    endDate: null, lat: 33.4484, lng: -112.0740,
  },
  {
    id: 'demo-7', source: 'ioda', provider: 'Cox',
    location: 'Atlanta', severity: 'low', status: 'active',
    description: 'Minor packet loss on DOCSIS upstream channels',
    startDate: new Date(Date.now() - 10800000).toISOString(),
    endDate: null, lat: 33.7490, lng: -84.3880,
  },
  {
    id: 'demo-8', source: 'both', provider: 'Frontier',
    location: 'Tampa', severity: 'high', status: 'resolved',
    description: 'Major fiber backbone outage — storm damage repaired',
    startDate: new Date(Date.now() - 86400000 * 5).toISOString(),
    endDate: new Date(Date.now() - 86400000 * 4).toISOString(),
    lat: 27.9506, lng: -82.4572,
  },
  {
    id: 'demo-9', source: 'cloudflare', provider: 'Windstream',
    location: 'Kansas City', severity: 'low', status: 'resolved',
    description: 'Brief routing anomaly — converged within 45 minutes',
    startDate: new Date(Date.now() - 86400000 * 7).toISOString(),
    endDate: new Date(Date.now() - 86400000 * 7 + 2700000).toISOString(),
    lat: 39.0997, lng: -94.5786,
  },
  {
    id: 'demo-10', source: 'ioda', provider: 'Charter/Spectrum',
    location: 'Los Angeles', severity: 'medium', status: 'active',
    description: 'IODA BGP signal anomaly — reduced prefix visibility',
    startDate: new Date(Date.now() - 1800000).toISOString(),
    endDate: null, lat: 34.0522, lng: -118.2437,
  },
]
