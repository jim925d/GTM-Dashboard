import { useState, useRef, useCallback } from 'react'
import { FONT_MONO, T } from '../../lib/constants'
import Badge from '../shared/Badge'

const TAB_TYPES = [
  { key: 'auto', label: 'Auto-Detect', desc: 'Upload any CSV — we detect the table type' },
  { key: 'customers', label: 'Customers', desc: 'Account master data (vertical, rep, tier)' },
  { key: 'funnel', label: 'Funnel', desc: 'Active pipeline deals' },
  { key: 'close_lost', label: 'Close Lost', desc: 'Deals pursued but lost' },
  { key: 'quotes', label: 'Quotes', desc: 'Proposals sent' },
  { key: 'services', label: 'Services', desc: 'Active + disconnected installed base' },
  { key: 'locations', label: 'Locations', desc: 'Customer sites' },
]

export default function CSVUploader({ onUpload, onUploadMulti, onClear, rawData }) {
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState(null)
  const [selectedTab, setSelectedTab] = useState('auto')
  const [expanded, setExpanded] = useState(false)
  const fileRef = useRef(null)

  const handleFile = useCallback(
    async (file) => {
      if (!file) return
      setStatus({ type: 'loading', message: `Processing ${file.name}...` })
      try {
        const result = await onUpload(file, selectedTab)
        setStatus({
          type: 'success',
          message: `Loaded ${result.accounts_count} accounts · ${Object.entries(result.records_ingested).map(([k, v]) => `${v} ${k}`).join(', ')} · Data stays in your browser only`,
        })
      } catch (err) {
        setStatus({ type: 'error', message: err.message })
      }
    },
    [onUpload, selectedTab]
  )

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  // Count loaded records
  const loadedCounts = rawData
    ? Object.entries(rawData).filter(([, v]) => v.length > 0).map(([k, v]) => `${v.length} ${k}`)
    : []

  return (
    <div style={{ marginBottom: '12px' }}>
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '6px 12px',
          borderRadius: '6px',
          border: `1px solid ${T.border}`,
          background: T.card,
          color: T.textMid,
          fontFamily: FONT_MONO,
          fontSize: '10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          justifyContent: 'space-between',
        }}
      >
        <span>
          {expanded ? '▾' : '▸'} UPLOAD DATA
          {loadedCounts.length > 0 && (
            <span style={{ color: T.green, marginLeft: '8px' }}>
              ({loadedCounts.join(' · ')})
            </span>
          )}
        </span>
        <Badge color={T.green} size="sm">LOCAL ONLY</Badge>
      </button>

      {expanded && (
        <div style={{ marginTop: '8px', padding: '12px', background: T.card, borderRadius: '8px', border: `1px solid ${T.border}` }}>
          {/* Privacy notice */}
          <div style={{
            padding: '8px 10px',
            background: `${T.green}08`,
            border: `1px solid ${T.green}22`,
            borderRadius: '6px',
            marginBottom: '10px',
            fontFamily: FONT_MONO,
            fontSize: '9px',
            color: T.green,
          }}>
            YOUR DATA NEVER LEAVES YOUR COMPUTER. Files are read by your browser and stored in memory only. Nothing is uploaded to any server. Close the tab = data is gone.
          </div>

          {/* Tab type selector */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {TAB_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setSelectedTab(t.key)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: `1px solid ${selectedTab === t.key ? T.cyan + '50' : T.border}`,
                  background: selectedTab === t.key ? T.cardHover : 'transparent',
                  color: selectedTab === t.key ? T.text : T.textDim,
                  fontFamily: FONT_MONO,
                  fontSize: '9px',
                  cursor: 'pointer',
                }}
                title={t.desc}
              >
                {t.label}
                {rawData && rawData[t.key]?.length > 0 && (
                  <span style={{ color: T.green, marginLeft: '4px' }}>({rawData[t.key].length})</span>
                )}
              </button>
            ))}
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              padding: '16px',
              border: `2px dashed ${isDragging ? T.cyan : T.border}`,
              borderRadius: '8px',
              background: isDragging ? `${T.cyan}08` : T.surface,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: T.textMid, marginBottom: '4px' }}>
              Drop CSV here or click to select
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: T.textDim }}>
              {selectedTab === 'auto'
                ? 'Auto-detects: Funnel, Close Lost, Customers, Quotes, Services, Locations'
                : `Loading as: ${TAB_TYPES.find((t) => t.key === selectedTab)?.desc}`}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              style={{ display: 'none' }}
              onChange={(e) => { handleFile(e.target.files[0]); e.target.value = '' }}
            />
          </div>

          {/* Status */}
          {status && (
            <div style={{
              marginTop: '8px',
              padding: '8px 12px',
              borderRadius: '6px',
              fontFamily: FONT_MONO,
              fontSize: '10px',
              background: status.type === 'error' ? `${T.red}18` : status.type === 'success' ? `${T.green}18` : `${T.cyan}18`,
              color: status.type === 'error' ? T.red : status.type === 'success' ? T.green : T.cyan,
              border: `1px solid ${status.type === 'error' ? T.red : status.type === 'success' ? T.green : T.cyan}30`,
            }}>
              {status.message}
            </div>
          )}

          {/* Clear button */}
          {loadedCounts.length > 0 && (
            <button
              onClick={() => { onClear(); setStatus(null) }}
              style={{
                marginTop: '8px',
                padding: '4px 10px',
                borderRadius: '4px',
                border: `1px solid ${T.red}30`,
                background: 'transparent',
                color: T.red,
                fontFamily: FONT_MONO,
                fontSize: '9px',
                cursor: 'pointer',
              }}
            >
              Clear all data & return to demo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
