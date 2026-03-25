/**
 * Bridges OutageContext outages to account objects.
 * Matches active outages to accounts by city name or lat/lng proximity (~50km).
 * Returns accounts with `outage_impacted: true` set on matches.
 */
import { useMemo } from 'react'
import { useOutageData } from '../lib/OutageContext'

const KM_THRESHOLD = 50

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function useOutageEnrichedAccounts(accounts) {
  const { activeOutages } = useOutageData()

  return useMemo(() => {
    if (!accounts || accounts.length === 0) return accounts || []
    if (!activeOutages || activeOutages.length === 0) return accounts

    return accounts.map((acct) => {
      const locations = acct.locations || []
      if (locations.length === 0) return acct

      const impacted = activeOutages.some((outage) => {
        const outageCity = (outage.location || '').toLowerCase().trim()

        for (const loc of locations) {
          // City name match
          const locCity = (loc.city || loc.market || loc.name || '').toLowerCase().trim()
          if (outageCity && locCity && locCity.includes(outageCity)) return true

          // Lat/lng proximity match
          if (outage.lat && outage.lng && loc.lat && loc.lng) {
            const dist = haversineKm(
              parseFloat(loc.lat), parseFloat(loc.lng),
              parseFloat(outage.lat), parseFloat(outage.lng)
            )
            if (dist <= KM_THRESHOLD) return true
          }
        }
        return false
      })

      return impacted ? { ...acct, outage_impacted: true } : acct
    })
  }, [accounts, activeOutages])
}
