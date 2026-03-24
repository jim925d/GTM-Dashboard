/**
 * US geographic coordinate data, map projection, and location resolver.
 * Shared utility — any page that needs US map projection can import from here.
 */

// ── State centroids ─────────────────────────────────────────────────────────

export const STATE_COORDS = {
  'Alabama': { lat: 32.3182, lng: -86.9023 },
  'Alaska': { lat: 64.2008, lng: -152.4937 },
  'Arizona': { lat: 34.0489, lng: -111.0937 },
  'Arkansas': { lat: 34.7465, lng: -92.2896 },
  'California': { lat: 36.7783, lng: -119.4179 },
  'Colorado': { lat: 39.5501, lng: -105.7821 },
  'Connecticut': { lat: 41.6032, lng: -73.0877 },
  'Delaware': { lat: 38.9108, lng: -75.5277 },
  'Florida': { lat: 27.6648, lng: -81.5158 },
  'Georgia': { lat: 32.1656, lng: -83.5085 },
  'Hawaii': { lat: 19.8968, lng: -155.5828 },
  'Idaho': { lat: 44.0682, lng: -114.7420 },
  'Illinois': { lat: 40.6331, lng: -89.3985 },
  'Indiana': { lat: 40.2672, lng: -86.1349 },
  'Iowa': { lat: 41.8780, lng: -93.0977 },
  'Kansas': { lat: 39.0119, lng: -98.4842 },
  'Kentucky': { lat: 37.8393, lng: -84.2700 },
  'Louisiana': { lat: 30.9843, lng: -91.9623 },
  'Maine': { lat: 45.2538, lng: -69.4455 },
  'Maryland': { lat: 39.0458, lng: -76.6413 },
  'Massachusetts': { lat: 42.4072, lng: -71.3824 },
  'Michigan': { lat: 44.3148, lng: -85.6024 },
  'Minnesota': { lat: 46.7296, lng: -94.6859 },
  'Mississippi': { lat: 32.3547, lng: -89.3985 },
  'Missouri': { lat: 37.9643, lng: -91.8318 },
  'Montana': { lat: 46.8797, lng: -110.3626 },
  'Nebraska': { lat: 41.4925, lng: -99.9018 },
  'Nevada': { lat: 38.8026, lng: -116.4194 },
  'New Hampshire': { lat: 43.1939, lng: -71.5724 },
  'New Jersey': { lat: 40.0583, lng: -74.4057 },
  'New Mexico': { lat: 34.5199, lng: -105.8701 },
  'New York': { lat: 42.1657, lng: -74.9481 },
  'North Carolina': { lat: 35.7596, lng: -79.0193 },
  'North Dakota': { lat: 47.5515, lng: -101.0020 },
  'Ohio': { lat: 40.4173, lng: -82.9071 },
  'Oklahoma': { lat: 35.4676, lng: -97.5164 },
  'Oregon': { lat: 43.8041, lng: -120.5542 },
  'Pennsylvania': { lat: 41.2033, lng: -77.1945 },
  'Rhode Island': { lat: 41.5801, lng: -71.4774 },
  'South Carolina': { lat: 33.8361, lng: -81.1637 },
  'South Dakota': { lat: 43.9695, lng: -99.9018 },
  'Tennessee': { lat: 35.5175, lng: -86.5804 },
  'Texas': { lat: 31.9686, lng: -99.9018 },
  'Utah': { lat: 39.3210, lng: -111.0937 },
  'Vermont': { lat: 44.5588, lng: -72.5778 },
  'Virginia': { lat: 37.4316, lng: -78.6569 },
  'Washington': { lat: 47.7511, lng: -120.7401 },
  'West Virginia': { lat: 38.5976, lng: -80.4549 },
  'Wisconsin': { lat: 43.7844, lng: -88.7879 },
  'Wyoming': { lat: 43.0760, lng: -107.2903 },
  'District of Columbia': { lat: 38.9072, lng: -77.0369 },
}

// ── Major city coordinates ──────────────────────────────────────────────────

export const CITY_COORDS = {
  'New York': { lat: 40.7128, lng: -74.0060 },
  'Los Angeles': { lat: 34.0522, lng: -118.2437 },
  'Chicago': { lat: 41.8781, lng: -87.6298 },
  'Houston': { lat: 29.7604, lng: -95.3698 },
  'Phoenix': { lat: 33.4484, lng: -112.0740 },
  'Philadelphia': { lat: 39.9526, lng: -75.1652 },
  'San Antonio': { lat: 29.4241, lng: -98.4936 },
  'San Diego': { lat: 32.7157, lng: -117.1611 },
  'Dallas': { lat: 32.7767, lng: -96.7970 },
  'San Jose': { lat: 37.3382, lng: -121.8863 },
  'Austin': { lat: 30.2672, lng: -97.7431 },
  'Jacksonville': { lat: 30.3322, lng: -81.6557 },
  'Fort Worth': { lat: 32.7555, lng: -97.3308 },
  'Columbus': { lat: 39.9612, lng: -82.9988 },
  'Charlotte': { lat: 35.2271, lng: -80.8431 },
  'Indianapolis': { lat: 39.7684, lng: -86.1581 },
  'San Francisco': { lat: 37.7749, lng: -122.4194 },
  'Seattle': { lat: 47.6062, lng: -122.3321 },
  'Denver': { lat: 39.7392, lng: -104.9903 },
  'Washington': { lat: 38.9072, lng: -77.0369 },
  'Nashville': { lat: 36.1627, lng: -86.7816 },
  'Oklahoma City': { lat: 35.4676, lng: -97.5164 },
  'El Paso': { lat: 31.7619, lng: -106.4850 },
  'Boston': { lat: 42.3601, lng: -71.0589 },
  'Portland': { lat: 45.5155, lng: -122.6789 },
  'Las Vegas': { lat: 36.1699, lng: -115.1398 },
  'Memphis': { lat: 35.1495, lng: -90.0490 },
  'Louisville': { lat: 38.2527, lng: -85.7585 },
  'Baltimore': { lat: 39.2904, lng: -76.6122 },
  'Milwaukee': { lat: 43.0389, lng: -87.9065 },
  'Albuquerque': { lat: 35.0844, lng: -106.6504 },
  'Tucson': { lat: 32.2226, lng: -110.9747 },
  'Fresno': { lat: 36.7378, lng: -119.7871 },
  'Sacramento': { lat: 38.5816, lng: -121.4944 },
  'Mesa': { lat: 33.4152, lng: -111.8315 },
  'Kansas City': { lat: 39.0997, lng: -94.5786 },
  'Atlanta': { lat: 33.7490, lng: -84.3880 },
  'Omaha': { lat: 41.2565, lng: -95.9345 },
  'Colorado Springs': { lat: 38.8339, lng: -104.8214 },
  'Raleigh': { lat: 35.7796, lng: -78.6382 },
  'Miami': { lat: 25.7617, lng: -80.1918 },
  'Minneapolis': { lat: 44.9778, lng: -93.2650 },
  'Tampa': { lat: 27.9506, lng: -82.4572 },
  'Orlando': { lat: 28.5383, lng: -81.3792 },
  'Detroit': { lat: 42.3314, lng: -83.0458 },
  'St. Louis': { lat: 38.6270, lng: -90.1994 },
  'Pittsburgh': { lat: 40.4406, lng: -79.9959 },
  'Cincinnati': { lat: 39.1031, lng: -84.5120 },
  'Cleveland': { lat: 41.4993, lng: -81.6944 },
  'New Orleans': { lat: 29.9511, lng: -90.0715 },
  'Salt Lake City': { lat: 40.7608, lng: -111.8910 },
  'Richmond': { lat: 37.5407, lng: -77.4360 },
  'Hartford': { lat: 41.7658, lng: -72.6734 },
  'Providence': { lat: 41.8240, lng: -71.4128 },
  'Boise': { lat: 43.6150, lng: -116.2023 },
}

// ── State abbreviation mapping ──────────────────────────────────────────────

export const STATE_ABBREVS = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
}

// Reverse: code → name
const STATE_CODE_TO_NAME = Object.fromEntries(
  Object.entries(STATE_ABBREVS).map(([name, code]) => [code, name])
)

// ── Simplified US outline for SVG border ────────────────────────────────────

export const US_OUTLINE = [
  [48.99, -125.02], [48.99, -123.01], [48.22, -122.76], [48.38, -122.51],
  [47.98, -122.38], [47.53, -122.40], [46.28, -124.06], [46.27, -123.95],
  [45.57, -124.05], [44.57, -124.20], [43.34, -124.40], [42.01, -124.23],
  [41.99, -124.21], [40.44, -124.41], [39.32, -123.82], [38.91, -123.73],
  [38.36, -123.07], [37.78, -122.51], [37.18, -122.40], [36.96, -122.03],
  [36.57, -121.94], [35.79, -121.38], [35.14, -120.66], [34.45, -120.47],
  [34.05, -119.88], [33.94, -118.83], [33.47, -118.17], [33.02, -117.63],
  [32.54, -117.12], [32.54, -114.72], [32.74, -114.50], [31.33, -111.07],
  [31.33, -108.21], [31.78, -108.21], [31.78, -106.53], [31.39, -106.01],
  [29.77, -104.40], [29.52, -103.17], [28.97, -102.73], [28.96, -101.40],
  [27.83, -99.09], [26.45, -98.58], [25.97, -97.15], [26.35, -96.77],
  [27.29, -97.02], [27.80, -96.57], [28.09, -96.69], [28.59, -96.18],
  [28.74, -95.50], [29.26, -94.71], [29.36, -94.04], [29.69, -93.24],
  [29.98, -91.09], [29.18, -89.49], [29.38, -88.62], [30.21, -88.02],
  [30.22, -87.63], [30.28, -86.02], [30.23, -85.02], [29.60, -85.00],
  [30.15, -84.00], [30.10, -82.03], [30.36, -81.76], [30.75, -81.44],
  [31.00, -81.18], [31.42, -80.85], [32.03, -80.78], [32.49, -80.37],
  [33.16, -79.18], [33.85, -78.55], [34.32, -77.77], [34.72, -77.11],
  [35.19, -75.77], [35.27, -75.53], [35.86, -75.47], [36.55, -75.87],
  [37.16, -75.93], [37.89, -75.24], [38.03, -75.04], [38.45, -75.06],
  [38.79, -75.19], [39.72, -75.55], [40.48, -74.05], [40.67, -73.72],
  [40.95, -73.61], [41.19, -72.08], [41.26, -70.08], [42.01, -70.05],
  [41.81, -69.97], [41.67, -69.95], [42.10, -70.67], [42.58, -70.63],
  [42.87, -70.82], [43.07, -70.70], [43.37, -70.56], [43.72, -70.18],
  [43.83, -69.78], [44.28, -68.84], [44.42, -68.06], [44.66, -67.57],
  [44.78, -66.95], [44.88, -66.95], [45.31, -67.14], [47.06, -67.79],
  [47.27, -68.26], [47.36, -68.83], [47.20, -69.06], [47.45, -69.24],
  [47.18, -70.01], [46.69, -70.05], [45.99, -71.10], [45.01, -71.50],
  [45.01, -73.35], [45.00, -74.00], [44.99, -76.50], [43.67, -76.18],
  [43.65, -78.69], [43.27, -79.07], [43.04, -78.87], [42.96, -78.92],
  [42.77, -79.76], [42.52, -80.52], [41.68, -83.11], [41.72, -84.39],
  [41.76, -84.81], [46.54, -84.89], [46.49, -84.56], [46.86, -84.79],
  [47.00, -84.65], [47.28, -84.98], [47.57, -85.61], [47.76, -86.62],
  [47.62, -86.97], [48.01, -87.26], [47.73, -87.95], [48.06, -88.16],
  [48.18, -88.57], [47.42, -89.77], [46.81, -90.79], [46.86, -92.17],
  [48.83, -89.49], [48.99, -95.16], [49.00, -97.23], [49.00, -104.05],
  [49.00, -110.00], [49.00, -116.05], [49.00, -117.03], [48.99, -122.76],
  [48.99, -125.02],
]

// ── Map projection (Albers-like simple projection for US) ───────────────────

export function projectToMap(lat, lng, width, height) {
  const x = ((lng + 130) / 65) * width * 0.95 + width * 0.02
  const y = ((52 - lat) / 28) * height * 0.85 + height * 0.05
  return {
    x: Math.max(0, Math.min(width, x)),
    y: Math.max(0, Math.min(height, y)),
  }
}

// ── Resolve a location string to lat/lng ────────────────────────────────────

export function resolveCoordinates(location, locationCode) {
  if (!location) return null
  const loc = location.trim()

  // Exact city match
  if (CITY_COORDS[loc]) return CITY_COORDS[loc]
  // Exact state match
  if (STATE_COORDS[loc]) return STATE_COORDS[loc]

  // Location code (e.g. "US-CO" or "region/US-CO")
  if (locationCode) {
    const code = locationCode.replace('US-', '').replace('region/', '').replace('US/', '')
    const name = STATE_CODE_TO_NAME[code]
    if (name && STATE_COORDS[name]) return STATE_COORDS[name]
  }

  // Fuzzy: location string contains a known city or state name
  const lower = loc.toLowerCase()
  for (const [name, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(name.toLowerCase())) return coords
  }
  for (const [name, coords] of Object.entries(STATE_COORDS)) {
    if (lower.includes(name.toLowerCase())) return coords
  }

  // US center fallback
  return { lat: 39.8283, lng: -98.5795 }
}
