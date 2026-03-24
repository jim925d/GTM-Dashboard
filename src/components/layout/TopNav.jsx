import { useState, useRef, useEffect } from 'react'
import { PAGES, MODELING_PAGES } from '../../lib/constants'
import { cn } from '@/lib/utils'

export default function TopNav({ activePage, onPageChange }) {
  const [modelOpen, setModelOpen] = useState(false)
  const dropRef = useRef(null)

  const isModelingPage = MODELING_PAGES.some(p => p.id === activePage)

  useEffect(() => {
    if (!modelOpen) return
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setModelOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [modelOpen])

  return (
    <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-border bg-revos-surface shrink-0">
      {PAGES.map((p) => (
        <button
          key={p.id}
          onClick={() => onPageChange(p.id)}
          className={cn(
            'flex items-center gap-1 px-3.5 py-1.5 rounded-lg border-none font-sans text-[10px] cursor-pointer transition-all duration-150',
            activePage === p.id
              ? p.id === 'premier'
                ? 'bg-revos-purple/15 text-revos-purple font-semibold shadow-card'
                : 'bg-revos-card text-revos-text font-semibold shadow-card'
              : 'bg-transparent text-revos-text-dim font-normal hover:text-revos-text-mid'
          )}
        >
          <span className="text-[11px]">{p.icon}</span>
          {p.label}
        </button>
      ))}

      <div className="flex-1" />

      <div ref={dropRef} className="relative">
        <button
          onClick={() => setModelOpen(!modelOpen)}
          className={cn(
            'flex items-center gap-1 px-3.5 py-1.5 rounded-lg border-none font-sans text-[10px] cursor-pointer transition-all duration-150',
            isModelingPage
              ? 'bg-revos-card text-revos-text font-semibold shadow-card'
              : 'bg-transparent text-revos-text-dim font-normal hover:text-revos-text-mid'
          )}
        >
          <span className="text-[11px]">🧪</span>
          Modeling
          <span className="text-[8px] ml-0.5">{modelOpen ? '▲' : '▼'}</span>
        </button>
        {modelOpen && (
          <div className="absolute top-full right-0 mt-1 bg-revos-card rounded-lg overflow-hidden z-[100] min-w-[140px] shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
            {MODELING_PAGES.map((p) => (
              <button
                key={p.id}
                onClick={() => { onPageChange(p.id); setModelOpen(false) }}
                className={cn(
                  'flex items-center gap-1.5 w-full px-3 py-2 border-none font-sans text-[10px] cursor-pointer text-left transition-colors',
                  activePage === p.id
                    ? 'bg-revos-card-hover text-revos-text font-semibold'
                    : 'bg-transparent text-revos-text-mid font-normal hover:bg-revos-card-hover'
                )}
              >
                <span className="text-[11px]">{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
