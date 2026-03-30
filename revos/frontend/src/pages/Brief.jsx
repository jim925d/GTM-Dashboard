/**
 * Intelligence Brief Tool
 *
 * Company intelligence brief generator powered by Claude AI.
 * Two output views: Brief View (structured cards) and Raw Text (monospace).
 */

import { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import {
  AlertTriangle, TrendingUp, Target, MessageSquare,
  ChevronDown, ChevronUp, Copy, FileText, Eye, Code,
  Search, Loader2, Check, Zap,
} from 'lucide-react'

// ── Theme ────────────────────────────────────────────────────────
const ACCENT = '#E11D48'
const MONO = "'IBM Plex Mono', 'SF Mono', 'Cascadia Code', monospace"

// ── Brief Prompt Builder ─────────────────────────────────────────
function buildBriefPrompt(companyName) {
  return `You are a world-class sales intelligence analyst. Generate a comprehensive intelligence brief for an Account Executive preparing for an engagement with **${companyName}**.

Use the latest available public information. Structure your output in clean Markdown with ## section headings.

Required sections (use these exact headings):

## Key Signals
List 3-5 of the most actionable signals about this company right now. Each signal should start with an emoji indicator:
- 🚨 for highest-priority / risk signals
- 📈 for strong performance / growth signals
- ⚖️ for legal / regulatory signals
- 🎓 for initiatives / expansion signals
For each signal, lead with a bold one-sentence headline, then explain in 1-2 sentences why it matters for a sales engagement.

## Recommended Play
Provide 3-5 specific, actionable engagement recommendations. Each should be a concrete action the AE can take this week. Frame as imperative actions (e.g., "Lead with AI-first data platform positioning..." not "You could...").

## Conversation Starters
Provide 3-4 natural conversation openers the AE can use. Each should reference specific recent news or data about the company. Put the actual suggested quote in italics.

## Risk Signals
List 2-4 potential landmines or sensitive topics. Frame each as a clear DO or DON'T for the AE.

## Leadership & Organization
Key executives, recent org changes, decision-makers to target. Include titles and relevant context.

## Financial Overview
Latest revenue, growth rate, RPO/backlog, net retention rate, and any other key financial metrics. Include specific numbers.

## Product & Technology
Recent product launches, technology investments, platform direction, R&D focus areas.

## Competitive Landscape
Key competitors, market positioning, recent wins/losses, differentiation.

## Hiring & Growth Signals
Job posting trends, new office openings, team expansions that indicate strategic priorities.

## Regulatory & Legal
Any pending litigation, regulatory developments, compliance requirements.

Be specific and data-driven. Include real numbers, dates, and names where possible. This brief should arm an AE to have a highly informed conversation.`
}

// ── Markdown Section Parser ──────────────────────────────────────
function parseSections(text) {
  if (!text) return []
  const lines = text.split('\n')
  const sections = []
  let current = null

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,2}\s+(.+)/)
    if (headingMatch) {
      if (current) sections.push(current)
      current = { title: headingMatch[1].trim(), lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) sections.push(current)
  return sections
}

function classifySection(title) {
  const t = title.toLowerCase()
  if (t.includes('signal') && !t.includes('risk') && !t.includes('hiring')) return 'signals'
  if (t.includes('recommend') || t.includes('play')) return 'actions'
  if (t.includes('conversation')) return 'conversations'
  if (t.includes('risk') || t.includes('landmine')) return 'risks'
  return 'detail'
}

// ── Inline Markdown Renderer ─────────────────────────────────────
function renderInline(text) {
  const parts = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    // Italic: *text* or _text_
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+?)\*(?!\*)/)
    // Money/percentage: $X.XXB, XX%, etc.
    const moneyMatch = remaining.match(/\$[\d,.]+[BMKbmk]?|\d+\.?\d*%/)

    // Find earliest match
    let earliest = null
    let type = null
    for (const [m, t] of [[boldMatch, 'bold'], [italicMatch, 'italic'], [moneyMatch, 'money']]) {
      if (m && (!earliest || m.index < earliest.index)) {
        earliest = m
        type = t
      }
    }

    if (!earliest) {
      parts.push(<span key={key++}>{remaining}</span>)
      break
    }

    if (earliest.index > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, earliest.index)}</span>)
    }

    if (type === 'bold') {
      parts.push(<strong key={key++} className="text-revos-text font-semibold">{earliest[1]}</strong>)
    } else if (type === 'italic') {
      parts.push(<em key={key++} className="text-revos-text-mid italic">{earliest[1]}</em>)
    } else if (type === 'money') {
      parts.push(<span key={key++} className="font-mono text-revos-text font-semibold" style={{ fontFamily: MONO }}>{earliest[0]}</span>)
    }

    remaining = remaining.slice(earliest.index + earliest[0].length)
  }

  return parts
}

// ── Signal Color Logic ───────────────────────────────────────────
function getSignalColor(text) {
  const t = text.toLowerCase()
  if (t.includes('🚨') || t.includes('highest priority') || t.includes('critical')) return '#EF4444'
  if (t.includes('📈') || t.includes('strong') || t.includes('growth') || t.includes('performance')) return '#10B981'
  if (t.includes('⚖️') || t.includes('legal') || t.includes('regulatory')) return '#F59E0B'
  if (t.includes('🎓') || t.includes('initiative') || t.includes('expansion')) return '#2563EB'
  // Fallback: check for risk-related words
  if (t.includes('risk') || t.includes('decline') || t.includes('loss') || t.includes('warn')) return '#EF4444'
  if (t.includes('revenue') || t.includes('profit') || t.includes('beat')) return '#10B981'
  return '#8b949e'
}

// ── Copy Button ──────────────────────────────────────────────────
function CopyBtn({ text, label = 'Copy', className }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [text])
  return (
    <button
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all cursor-pointer border',
        copied
          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
          : 'bg-white/5 border-white/10 text-revos-text-dim hover:bg-white/10 hover:text-revos-text',
        className
      )}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : label}
    </button>
  )
}

// ── Collapsible Section ──────────────────────────────────────────
function CollapsibleDetail({ title, content }) {
  const [open, setOpen] = useState(false)
  const preview = content.slice(0, 2).join('\n')

  return (
    <Card className="bg-[#111827] border-[#21262D]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 bg-transparent border-none cursor-pointer text-left"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {open
            ? <ChevronUp className="w-4 h-4 text-revos-text-dim shrink-0" />
            : <ChevronDown className="w-4 h-4 text-revos-text-dim shrink-0" />
          }
          <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: ACCENT }}>
            {title}
          </span>
        </div>
        {!open && (
          <span className="text-[10px] text-revos-text-dim ml-4 truncate max-w-[50%]">
            {preview.replace(/^[-•]\s*/, '').replace(/\*\*/g, '').slice(0, 60)}...
          </span>
        )}
      </button>
      {!open && (
        <div className="px-4 pb-3 -mt-1">
          {content.slice(0, 2).map((line, i) => (
            <p key={i} className="text-[11px] text-revos-text-dim leading-relaxed m-0">
              {renderInline(line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, ''))}
            </p>
          ))}
        </div>
      )}
      {open && (
        <div className="px-4 pb-4 space-y-1.5">
          {content.map((line, i) => {
            const trimmed = line.trim()
            if (!trimmed) return null
            const isBullet = /^[-•]/.test(trimmed)
            const isNumbered = /^\d+\./.test(trimmed)
            const cleaned = trimmed.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '')
            return (
              <div key={i} className={cn('text-[11px] leading-relaxed', isBullet || isNumbered ? 'flex gap-2' : '')}>
                {isBullet && <span className="text-revos-text-dim shrink-0 mt-px">•</span>}
                {isNumbered && <span className="text-revos-text-dim shrink-0 mt-px font-mono" style={{ fontFamily: MONO }}>{trimmed.match(/^\d+/)[0]}.</span>}
                <span className="text-revos-text-mid">{renderInline(cleaned)}</span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ── Key Signals Card ─────────────────────────────────────────────
function KeySignalsCard({ lines }) {
  // Group lines into individual signals (split on emoji or bold starts)
  const signals = []
  let current = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const isBullet = /^[-•]/.test(trimmed)
    const cleaned = trimmed.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '')

    if (isBullet || /^[🚨📈⚖️🎓]/.test(cleaned) || (!current && cleaned)) {
      if (current) signals.push(current)
      current = { text: cleaned, extra: [] }
    } else if (current) {
      current.extra.push(cleaned)
    }
  }
  if (current) signals.push(current)

  return (
    <Card className="bg-[#111827] border-[#21262D] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#21262D] flex items-center gap-2">
        <Zap className="w-4 h-4" style={{ color: ACCENT }} />
        <span className="text-xs font-bold tracking-wider uppercase" style={{ color: ACCENT }}>Key Signals</span>
      </div>
      <div className="divide-y divide-[#21262D]">
        {signals.map((sig, i) => {
          const color = getSignalColor(sig.text)
          // Extract headline (first bold segment or first sentence)
          const boldMatch = sig.text.match(/\*\*(.+?)\*\*/)
          const headline = boldMatch ? boldMatch[1] : sig.text.split(/[.!]/).filter(Boolean)[0]
          const description = boldMatch
            ? sig.text.replace(/\*\*(.+?)\*\*/, '').trim().replace(/^[-:]\s*/, '')
            : sig.text.slice(headline.length).replace(/^[.!]\s*/, '')
          const fullDesc = [description, ...sig.extra].filter(Boolean).join(' ')

          return (
            <div key={i} className="flex" style={{ borderLeft: `3px solid ${color}` }}>
              <div className="flex-1 p-3 pl-4">
                <div className="text-[12px] font-semibold text-revos-text leading-snug mb-0.5">
                  {renderInline(headline || sig.text)}
                </div>
                {fullDesc && (
                  <div className="text-[11px] text-revos-text-dim leading-relaxed">
                    {renderInline(fullDesc)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Actions Card ─────────────────────────────────────────────────
function ActionsCard({ lines }) {
  const actions = lines
    .map(l => l.trim())
    .filter(l => l && l !== '---')
    .map(l => l.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, ''))
    .filter(Boolean)

  return (
    <Card className="bg-[#111827] border-[#21262D] overflow-hidden" style={{ background: 'rgba(225,29,72,0.03)' }}>
      <div className="px-4 py-3 border-b border-[#21262D] flex items-center gap-2">
        <Target className="w-4 h-4" style={{ color: ACCENT }} />
        <span className="text-xs font-bold tracking-wider uppercase" style={{ color: ACCENT }}>Your Play</span>
      </div>
      <CardContent className="p-4 space-y-2">
        {actions.map((action, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-4 h-4 rounded border border-[#374151] bg-[#0B0F19] shrink-0 mt-0.5 flex items-center justify-center">
              <span className="text-[8px] text-revos-text-dim">{i + 1}</span>
            </div>
            <div className="text-[11px] text-revos-text-mid leading-relaxed flex-1">
              {renderInline(action)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ── Conversation Starters Card ───────────────────────────────────
function ConversationsCard({ lines }) {
  const starters = []
  let current = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const isBullet = /^[-•]/.test(trimmed) || /^\d+\./.test(trimmed)
    const cleaned = trimmed.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '')

    if (isBullet || (!current && cleaned)) {
      if (current) starters.push(current)
      current = cleaned
    } else if (current) {
      current += ' ' + cleaned
    }
  }
  if (current) starters.push(current)

  return (
    <Card className="bg-[#111827] border-[#21262D] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#21262D] flex items-center gap-2">
        <MessageSquare className="w-4 h-4" style={{ color: ACCENT }} />
        <span className="text-xs font-bold tracking-wider uppercase" style={{ color: ACCENT }}>Conversation Starters</span>
      </div>
      <CardContent className="p-4 space-y-2">
        {starters.map((starter, i) => (
          <div key={i} className="flex items-start gap-2 group">
            <div className="flex-1 p-3 rounded-lg bg-[#0B0F19] border border-[#21262D]">
              <div className="text-[11px] text-revos-text-mid leading-relaxed">
                {renderInline(starter)}
              </div>
            </div>
            <CopyBtn
              text={starter.replace(/\*\*/g, '').replace(/\*/g, '')}
              label=""
              className="mt-2 opacity-50 group-hover:opacity-100 transition-opacity"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ── Risks Card ───────────────────────────────────────────────────
function RisksCard({ lines }) {
  const risks = lines
    .map(l => l.trim())
    .filter(l => l)
    .map(l => l.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, ''))
    .filter(Boolean)

  return (
    <Card className="bg-[#111827] border-[#21262D] overflow-hidden border-l-2 border-l-amber-500/50">
      <div className="px-4 py-3 border-b border-[#21262D] flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-bold tracking-wider uppercase text-amber-400">Risk Signals & Landmines</span>
      </div>
      <CardContent className="p-4 space-y-2">
        {risks.map((risk, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-amber-400 shrink-0 mt-px text-[11px]">•</span>
            <div className="text-[11px] text-revos-text-mid leading-relaxed">
              {renderInline(risk)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ── Financial Metrics Grid ───────────────────────────────────────
function FinancialGrid({ lines }) {
  // Try to extract key metrics from text
  const metrics = []
  const text = lines.join(' ')

  const revMatch = text.match(/[Rr]evenue[:\s]*(\$[\d,.]+[BMKbmk]?)/)
  if (revMatch) metrics.push({ label: 'Revenue', value: revMatch[1] })

  const growthMatch = text.match(/[Gg]rowth[:\s]*([\+\-]?\d+\.?\d*%)/i)
  if (growthMatch) metrics.push({ label: 'Growth', value: growthMatch[1] })

  const rpoMatch = text.match(/RPO[:\s]*(\$[\d,.]+[BMKbmk]?)/i)
  if (rpoMatch) metrics.push({ label: 'RPO', value: rpoMatch[1] })

  const nrrMatch = text.match(/(?:NRR|[Nn]et\s*[Rr]etention)[:\s]*([\d,.]+%)/i)
  if (nrrMatch) metrics.push({ label: 'NRR', value: nrrMatch[1] })

  const epsMatch = text.match(/EPS[:\s]*(\$[\d,.]+)/i)
  if (epsMatch) metrics.push({ label: 'EPS', value: epsMatch[1] })

  const marginMatch = text.match(/[Mm]argin[:\s]*([\d,.]+%)/i)
  if (marginMatch) metrics.push({ label: 'Margin', value: marginMatch[1] })

  if (metrics.length === 0) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
      {metrics.map((m, i) => (
        <div key={i} className="p-2.5 rounded-lg bg-[#0B0F19] border border-[#21262D] text-center">
          <div className="text-[9px] text-revos-text-dim uppercase tracking-wider mb-1">{m.label}</div>
          <div className="text-sm font-bold font-mono text-revos-text" style={{ fontFamily: MONO }}>{m.value}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main Brief Page Component ────────────────────────────────────
export default function Brief() {
  const [companyName, setCompanyName] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('brief') // 'brief' | 'raw'
  const [generatedCompany, setGeneratedCompany] = useState('')
  const [generatedAt, setGeneratedAt] = useState(null)
  const inputRef = useRef(null)

  const handleGenerate = useCallback(async () => {
    const name = companyName.trim()
    if (!name) return
    setLoading(true)
    setError('')
    setOutput('')

    try {
      const prompt = buildBriefPrompt(name)
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || `Request failed (${res.status})`)
      }

      // The /api/analyze endpoint tries to extract JSON, but our brief is markdown.
      // Try parsing as JSON first (in case the proxy wrapped it), otherwise use raw text.
      const data = await res.text()
      let text = data
      try {
        const json = JSON.parse(data)
        // If it parsed and has a 'raw' field, that's our markdown
        if (json.raw) text = json.raw
        else if (json.error) throw new Error(json.error)
        else if (typeof json === 'string') text = json
        // If it's an object without raw/error, stringify it back (shouldn't happen)
        else text = data
      } catch {
        // Not JSON, use raw text directly — this is actually what we want for markdown
      }

      setOutput(text)
      setGeneratedCompany(name)
      setGeneratedAt(new Date())
    } catch (err) {
      setError(err.message || 'Failed to generate brief')
    } finally {
      setLoading(false)
    }
  }, [companyName])

  const handleCopyAll = useCallback(() => {
    if (output) navigator.clipboard.writeText(output)
  }, [output])

  const handleExport = useCallback(() => {
    if (!output) return
    const blob = new Blob([output], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${generatedCompany.replace(/\s+/g, '_')}_Brief_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [output, generatedCompany])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) handleGenerate()
  }

  // Parse sections for Brief View
  const sections = parseSections(output)
  const signalSections = sections.filter(s => classifySection(s.title) === 'signals')
  const actionSections = sections.filter(s => classifySection(s.title) === 'actions')
  const conversationSections = sections.filter(s => classifySection(s.title) === 'conversations')
  const riskSections = sections.filter(s => classifySection(s.title) === 'risks')
  const detailSections = sections.filter(s => classifySection(s.title) === 'detail')

  // Check if financial section exists for metrics grid
  const financialSection = detailSections.find(s => s.title.toLowerCase().includes('financial'))

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* ── Input Form ── */}
      <Card className="bg-[#111827] border-[#21262D]">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-revos-text-dim" />
            <span className="text-xs font-semibold tracking-wider uppercase text-revos-text-dim">Intelligence Brief Generator</span>
          </div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter company name (e.g., Snowflake, Salesforce, Datadog...)"
              className="flex-1 h-10 px-3 rounded-md bg-[#0B0F19] border border-[#21262D] text-sm text-revos-text placeholder:text-revos-text-dim/50 focus:outline-none focus:border-[#374151] font-sans"
              disabled={loading}
            />
            <Button
              onClick={handleGenerate}
              disabled={loading || !companyName.trim()}
              className="h-10 px-5 font-semibold text-xs"
              style={{ background: ACCENT }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  Generate Brief
                </>
              )}
            </Button>
          </div>
          {error && (
            <div className="mt-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Loading State ── */}
      {loading && (
        <Card className="bg-[#111827] border-[#21262D]">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: ACCENT }} />
            <div className="text-sm font-semibold text-revos-text mb-1">Generating Intelligence Brief</div>
            <div className="text-xs text-revos-text-dim">Researching {companyName}...</div>
          </CardContent>
        </Card>
      )}

      {/* ── Output ── */}
      {output && !loading && (
        <div className="space-y-3">
          {/* Output Header */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="text-lg font-bold text-revos-text m-0 tracking-tight uppercase truncate">
                {generatedCompany} Intelligence Brief
              </h2>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] shrink-0">
                <Zap className="w-2.5 h-2.5 mr-0.5" />
                Live Data
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {/* View Toggle */}
              <div className="flex rounded-md border border-[#21262D] overflow-hidden">
                <button
                  onClick={() => setViewMode('brief')}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium border-none cursor-pointer transition-all',
                    viewMode === 'brief'
                      ? 'bg-white/10 text-revos-text'
                      : 'bg-transparent text-revos-text-dim hover:text-revos-text'
                  )}
                >
                  <Eye className="w-3 h-3" />
                  Brief View
                </button>
                <button
                  onClick={() => setViewMode('raw')}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium border-none cursor-pointer transition-all border-l border-l-[#21262D]',
                    viewMode === 'raw'
                      ? 'bg-white/10 text-revos-text'
                      : 'bg-transparent text-revos-text-dim hover:text-revos-text'
                  )}
                >
                  <Code className="w-3 h-3" />
                  Raw Text
                </button>
              </div>
              <CopyBtn text={output} label="Copy All" />
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-white/5 border border-white/10 text-revos-text-dim hover:bg-white/10 hover:text-revos-text cursor-pointer transition-all"
              >
                <FileText className="w-3 h-3" />
                Export .txt
              </button>
            </div>
          </div>

          {/* Date line */}
          {generatedAt && (
            <div className="text-[10px] text-revos-text-dim -mt-1">
              Generated {generatedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at {generatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </div>
          )}

          {/* ── Brief View ── */}
          {viewMode === 'brief' && (
            <div className="space-y-3">
              {/* Key Signals — always first */}
              {signalSections.map((s, i) => (
                <KeySignalsCard key={`sig-${i}`} lines={s.lines} />
              ))}

              {/* Recommended Play — second */}
              {actionSections.map((s, i) => (
                <ActionsCard key={`act-${i}`} lines={s.lines} />
              ))}

              {/* Conversation Starters */}
              {conversationSections.map((s, i) => (
                <ConversationsCard key={`conv-${i}`} lines={s.lines} />
              ))}

              {/* Risk Signals */}
              {riskSections.map((s, i) => (
                <RisksCard key={`risk-${i}`} lines={s.lines} />
              ))}

              {/* Detail sections (collapsible) */}
              {detailSections.map((s, i) => (
                <div key={`det-${i}`}>
                  {/* Financial metrics grid for financial sections */}
                  {s.title.toLowerCase().includes('financial') && (
                    <FinancialGrid lines={s.lines} />
                  )}
                  <CollapsibleDetail title={s.title} content={s.lines.filter(l => l.trim())} />
                </div>
              ))}
            </div>
          )}

          {/* ── Raw Text View ── */}
          {viewMode === 'raw' && (
            <Card className="bg-[#111827] border-[#21262D]">
              <CardContent className="p-0">
                <pre
                  className="p-5 m-0 text-[11px] leading-relaxed text-revos-text-dim overflow-x-auto"
                  style={{
                    fontFamily: MONO,
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                  }}
                >
                  {output}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
