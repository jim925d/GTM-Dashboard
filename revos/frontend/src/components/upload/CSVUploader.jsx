import { useState, useRef, useCallback } from 'react'
import { T } from '../../lib/constants'
import Badge from '../shared/Badge'

const TAB_TYPES = [
  { key: 'auto', label: 'Auto-Detect', desc: 'Upload any CSV — we detect the table type' },
  { key: 'registry', label: 'Registry', desc: 'Account registry — upload first for name resolution', highlight: true },
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
      if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
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
    <div className="mb-3">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="px-3 py-1.5 rounded-md border border-revos-border bg-revos-card text-revos-text-mid font-mono text-[10px] cursor-pointer flex items-center gap-1.5 w-full justify-between"
      >
        <span>
          {expanded ? '▾' : '▸'} UPLOAD DATA
          {loadedCounts.length > 0 && (
            <span className="text-revos-green ml-2">
              ({loadedCounts.join(' · ')})
            </span>
          )}
        </span>
        <Badge color={T.green} size="sm">LOCAL ONLY</Badge>
      </button>

      {expanded && (
        <div className="mt-2 p-3 bg-revos-card rounded-lg border border-revos-border">
          {/* Privacy notice */}
          <div
            className="px-2.5 py-2 rounded-md mb-2.5 font-mono text-[9px]"
            style={{
              background: `${T.green}08`,
              border: `1px solid ${T.green}22`,
              color: T.green,
            }}
          >
            YOUR DATA NEVER LEAVES YOUR COMPUTER. Files are read by your browser and stored in memory only. Nothing is uploaded to any server. Close the tab = data is gone.
          </div>

          {/* Tab type selector */}
          <div className="flex gap-1 mb-2.5 flex-wrap">
            {TAB_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setSelectedTab(t.key)}
                className="px-2.5 py-1 rounded font-mono text-[9px] cursor-pointer"
                style={{
                  border: `1px solid ${selectedTab === t.key ? T.cyan + '50' : T.border}`,
                  background: selectedTab === t.key ? T.cardHover : 'transparent',
                  color: selectedTab === t.key ? T.text : T.textDim,
                }}
                title={t.desc}
              >
                {t.label}
                {rawData && rawData[t.key]?.length > 0 && (
                  <span className="text-revos-green ml-1">({rawData[t.key].length})</span>
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
            className="p-4 rounded-lg cursor-pointer text-center transition-all duration-200"
            style={{
              border: `2px dashed ${isDragging ? T.cyan : T.border}`,
              background: isDragging ? `${T.cyan}08` : T.surface,
            }}
          >
            <div className="font-mono text-[11px] text-revos-text-mid mb-1">
              Drop CSV here or click to select
            </div>
            <div className="font-mono text-[9px] text-revos-text-dim">
              {selectedTab === 'auto'
                ? 'Auto-detects: Funnel, Close Lost, Customers, Quotes, Services, Locations'
                : `Loading as: ${TAB_TYPES.find((t) => t.key === selectedTab)?.desc}`}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => { handleFile(e.target.files[0]); e.target.value = '' }}
            />
          </div>

          {/* Status */}
          {status && (
            <div
              className="mt-2 px-3 py-2 rounded-md font-mono text-[10px]"
              style={{
                background: status.type === 'error' ? `${T.red}18` : status.type === 'success' ? `${T.green}18` : `${T.cyan}18`,
                color: status.type === 'error' ? T.red : status.type === 'success' ? T.green : T.cyan,
                border: `1px solid ${status.type === 'error' ? T.red : status.type === 'success' ? T.green : T.cyan}30`,
              }}
            >
              {status.message}
            </div>
          )}

          {/* Clear button */}
          {loadedCounts.length > 0 && (
            <button
              onClick={() => { onClear(); setStatus(null) }}
              className="mt-2 px-2.5 py-1 rounded bg-transparent font-mono text-[9px] cursor-pointer"
              style={{
                border: `1px solid ${T.red}30`,
                color: T.red,
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
