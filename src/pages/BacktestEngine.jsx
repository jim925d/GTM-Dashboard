import { useState, useCallback, useEffect, useRef } from "react";
import * as XLSX from 'xlsx';

// ─── Math Utilities ───────────────────────────────────────────────────────────
const sigmoid = x => 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const std = arr => {
  if (arr.length < 2) return 1;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map(x => (x - m) ** 2))) || 1;
};
const corr = (xs, ys) => {
  const mx = mean(xs), my = mean(ys);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0));
  return den === 0 ? 0 : num / den;
};

function trainLogistic(X, y, epochs = 200, lr = 0.08) {
  if (!X.length || !X[0].length) return { weights: [], bias: 0 };
  const n = X[0].length;
  let w = new Array(n).fill(0), b = 0;
  for (let e = 0; e < epochs; e++) {
    const dw = new Array(n).fill(0); let db = 0;
    for (let i = 0; i < X.length; i++) {
      const err = sigmoid(dot(w, X[i]) + b) - y[i];
      for (let j = 0; j < n; j++) dw[j] += err * X[i][j];
      db += err;
    }
    w = w.map((v, j) => v - lr * dw[j] / X.length);
    b -= lr * db / X.length;
  }
  return { weights: w, bias: b };
}

const predict = (x, model) => sigmoid(dot(model.weights, x) + model.bias);
const brierScore = (preds, actuals) => mean(preds.map((p, i) => (p - actuals[i]) ** 2));

function auc(preds, actuals) {
  const pos = actuals.filter(a => a === 1).length;
  const neg = actuals.length - pos;
  if (!pos || !neg) return 0.5;
  const sorted = preds.map((p, i) => ({ p, a: actuals[i] })).sort((a, b) => b.p - a.p);
  let tp = 0, fp = 0, ptp = 0, pfp = 0, area = 0;
  for (const { a } of sorted) {
    if (a === 1) tp++; else fp++;
    area += (fp - pfp) * (tp + ptp) / 2;
    ptp = tp; pfp = fp;
  }
  return area / (pos * neg);
}

// ─── Data Processing ──────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const rows = lines.slice(1).map(line => {
    const vals = []; let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    vals.push(cur.trim());
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || '').replace(/^"|"$/g, '')]));
  });
  return { headers, rows };
}

function autoDetect(headers) {
  const map = { outcome: '', product: '', segment: '', deal_value: '', created_date: '', close_date: '' };
  const hints = {
    outcome: ['won', 'outcome', 'win', 'closed', 'result', 'status'],
    product: ['product', 'service', 'type'],
    segment: ['segment', 'industry', 'market', 'vertical'],
    deal_value: ['amount', 'mrr', 'value', 'arr', 'revenue', 'tcv'],
    created_date: ['created', 'open_date', 'start'],
    close_date: ['close', 'closed'],
  };
  for (const [field, hintList] of Object.entries(hints)) {
    const match = headers.find(h => hintList.some(hint => h.toLowerCase().replace(/[_ ]/g, '').includes(hint.replace(/[_ ]/g, ''))));
    if (match) map[field] = match;
  }
  return map;
}

const WON_VALUES = new Set(['won', 'closed won', '1', 'true', 'yes', 'win', 'closed-won', 'closedwon', 'closed']);

function normalizeDeals(rows, mapping) {
  return rows.map((row, i) => {
    const wonRaw = (row[mapping.outcome] || '').toLowerCase().trim();
    const won = WON_VALUES.has(wonRaw) ? 1 : 0;
    const val = parseFloat(String(row[mapping.deal_value] || '0').replace(/[$,]/g, '')) || 0;
    const created = mapping.created_date ? new Date(row[mapping.created_date]) : null;
    const closed = mapping.close_date ? new Date(row[mapping.close_date]) : null;
    const daysOpen = (created && closed && !isNaN(+created) && !isNaN(+closed))
      ? Math.max(0, (+closed - +created) / 86400000) : null;
    const seg = (row[mapping.segment] || 'Unknown').trim();
    return {
      id: i, won,
      product: (row[mapping.product] || 'Unknown').trim(),
      segment: seg,
      mega_vertical: seg,
      deal_value: val, days_open: daysOpen,
    };
  });
}

function computeStats(train) {
  const groupRate = field => {
    const m = {};
    for (const d of train) {
      if (!m[d[field]]) m[d[field]] = { won: 0, n: 0 };
      m[d[field]].won += d.won; m[d[field]].n++;
    }
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.n >= 3 ? v.won / v.n : null]));
  };
  const comboRates = {};
  for (const d of train) {
    const ck = `${d.mega_vertical}|${d.product}`;
    if (!comboRates[ck]) comboRates[ck] = { won: 0, n: 0 };
    comboRates[ck].won += d.won; comboRates[ck].n++;
  }
  const comboR = Object.fromEntries(Object.entries(comboRates).map(([k, v]) => [k, v.n >= 3 ? v.won / v.n : null]));
  const vals = train.map(d => d.deal_value).filter(v => v > 0).sort((a, b) => a - b);
  const days = train.map(d => d.days_open).filter(v => v !== null);
  return {
    overall: mean(train.map(d => d.won)),
    vwr: groupRate('mega_vertical'), pwr: groupRate('product'),
    comboR,
    valsSorted: vals, daysMean: mean(days), daysStd: std(days),
  };
}

function extractFeatures(d, s, interactions = false) {
  const ov = s.overall;
  const vwr = s.vwr[d.mega_vertical] ?? ov;
  const pwr = s.pwr[d.product] ?? ov;
  const szp = s.valsSorted.length ? s.valsSorted.findIndex(v => v >= d.deal_value) / s.valsSorted.length : 0.5;
  const dn = d.days_open !== null ? Math.max(0, Math.min(1, 1 - (d.days_open - s.daysMean) / (s.daysStd * 3 + 1))) : 0.5;
  const base = [vwr, pwr, szp < 0 ? 1 : szp, dn];
  if (!interactions) return base;
  const cwr = s.comboR[`${d.mega_vertical}|${d.product}`] ?? ov;
  return [...base, cwr];
}

// ─── Backtest Engine ──────────────────────────────────────────────────────────
function runBacktest(deals, trainPct) {
  const shuffled = [...deals].sort(() => Math.random() - 0.5);
  const splitAt = Math.floor(shuffled.length * trainPct / 100);
  const train = shuffled.slice(0, splitAt);
  const test = shuffled.slice(splitAt);
  const s = computeStats(train);
  const trainY = train.map(d => d.won);

  // Option A: 6 fixed features, one global model
  const modelA = trainLogistic(train.map(d => extractFeatures(d, s, false)), trainY);
  const predsA = test.map(d => predict(extractFeatures(d, s, false), modelA));

  // Option B: 8 features, per-vertical models with global fallback
  const verticals = [...new Set(train.map(d => d.mega_vertical))];
  const vertModels = {};
  for (const v of verticals) {
    const vd = train.filter(d => d.mega_vertical === v);
    if (vd.length >= 10)
      vertModels[v] = trainLogistic(vd.map(d => extractFeatures(d, s, true)), vd.map(d => d.won));
  }
  const globalB = trainLogistic(train.map(d => extractFeatures(d, s, true)), trainY);
  const predsB = test.map(d => {
    const x = extractFeatures(d, s, true);
    return predict(x, vertModels[d.mega_vertical] || globalB);
  });

  const actuals = test.map(d => d.won);

  // Per-vertical breakdown
  const uniqueVerts = [...new Set(test.map(d => d.mega_vertical))];
  const byVertical = uniqueVerts.map(v => {
    const idxs = test.map((d, i) => d.mega_vertical === v ? i : -1).filter(i => i >= 0);
    if (idxs.length < 5) return null;
    const va = idxs.map(i => actuals[i]);
    const pa = idxs.map(i => predsA[i]);
    const pb = idxs.map(i => predsB[i]);
    const ba = brierScore(pa, va), bb = brierScore(pb, va);
    return { vertical: v, count: idxs.length, winRate: mean(va), brierA: ba, brierB: bb, aucA: auc(pa, va), aucB: auc(pb, va), winner: bb < ba ? 'B' : 'A' };
  }).filter(Boolean).sort((a, b) => b.count - a.count);

  // Feature importances for Option B (global corr)
  const featureNames = ['Vertical Win Rate', 'Product Win Rate', 'Deal Size', 'Days Open', 'Vertical×Product'];
  const allX = train.map(d => extractFeatures(d, s, true));
  const featureImportance = featureNames.map((name, i) => ({
    name,
    importance: Math.abs(corr(allX.map(x => x[i]), trainY)),
  })).sort((a, b) => b.importance - a.importance);

  // Calibration (how well predicted % matches actual %)
  const calibration = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map(b => {
    const idxs = predsA.map((p, i) => (p < b && p >= b - 0.1) ? i : -1).filter(i => i >= 0);
    if (idxs.length < 2) return null;
    return { bucket: `${Math.round((b - 0.1) * 100)}–${Math.round(b * 100)}%`, predA: mean(idxs.map(i => predsA[i])), predB: mean(idxs.map(i => predsB[i])), actual: mean(idxs.map(i => actuals[i])), n: idxs.length };
  }).filter(Boolean);

  return {
    trainSize: train.length, testSize: test.length, overallWinRate: s.overall,
    A: { brier: brierScore(predsA, actuals), auc: auc(predsA, actuals), acc: mean(predsA.map((p, i) => (p >= 0.5 ? 1 : 0) === actuals[i] ? 1 : 0)) },
    B: { brier: brierScore(predsB, actuals), auc: auc(predsB, actuals), acc: mean(predsB.map((p, i) => (p >= 0.5 ? 1 : 0) === actuals[i] ? 1 : 0)) },
    byVertical, featureImportance, calibration,
    verticalModelCount: Object.keys(vertModels).length,
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const C = {
  bg: '#06080F', card: '#161B22', deep: '#0D1117', border: '#21262D',
  text: '#F0F6FC', muted: '#6B7280', dim: '#4B5563',
  blue: '#3B82F6', green: '#10B981', amber: '#F59E0B',
  purple: '#A855F7', red: '#EF4444',
  mono: 'SF Mono, Consolas, monospace',
};
const card = (extra = {}) => ({ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '16px', ...extra });
const lbl = () => ({ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', color: C.dim, textTransform: 'uppercase', fontFamily: C.mono, marginBottom: '8px', display: 'block' });

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function BacktestEngine() {
  const [step, setStep] = useState('upload');
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({ outcome: '', product: '', segment: '', deal_value: '', created_date: '', close_date: '' });
  const [trainPct, setTrainPct] = useState(80);
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [drag, setDrag] = useState(false);
  const [sheets, setSheets] = useState(null); // { sheetNames, sheetData } for multi-sheet Excel
  const [wonSheet, setWonSheet] = useState('');
  const [lostSheet, setLostSheet] = useState('');

  // Parse a worksheet rows array into {headers, rows}
  const parseSheetRows = (sheetRows) => {
    if (!sheetRows || sheetRows.length < 2) return { headers: [], rows: [] };
    const headers = sheetRows[0].map(c => String(c ?? '').trim());
    const rows = sheetRows.slice(1).map(r =>
      Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '').trim()]))
    );
    return { headers, rows };
  };

  const handleFile = useCallback((file) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const reader = new FileReader();
    reader.onload = async e => {
      if (isExcel) {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        if (wb.SheetNames.length === 1) {
          // Single sheet — treat normally
          const ws = wb.Sheets[wb.SheetNames[0]];
          const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          const { headers: h, rows: r } = parseSheetRows(sheetRows);
          setHeaders(h); setRows(r);
          setMapping(autoDetect(h));
          setStep('map');
        } else {
          // Multiple sheets — let user assign won/lost
          const sheetData = {};
          for (const name of wb.SheetNames) {
            const ws = wb.Sheets[name];
            sheetData[name] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          }
          setSheets({ sheetNames: wb.SheetNames, sheetData });
          // Auto-guess won/lost sheet by name
          const wonGuess = wb.SheetNames.find(n => /won|win|closed.won/i.test(n)) || wb.SheetNames[0];
          const lostGuess = wb.SheetNames.find(n => /lost|loss|closed.lost/i.test(n)) || wb.SheetNames[1] || '';
          setWonSheet(wonGuess);
          setLostSheet(lostGuess);
          setStep('sheets');
        }
      } else {
        // CSV
        const text = e.target.result;
        const lines = text.trim().split('\n').filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
        const csvRows = lines.slice(1).map(line => {
          const vals = []; let cur = '', inQ = false;
          for (const ch of line) {
            if (ch === '"') inQ = !inQ;
            else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
            else cur += ch;
          }
          vals.push(cur.trim());
          return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || '').replace(/^"|"$/g, '')]));
        });
        setHeaders(headers); setRows(csvRows);
        setMapping(autoDetect(headers));
        setStep('map');
      }
    };
    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  }, []);

  const handleCombineSheets = useCallback(() => {
    if (!sheets || !wonSheet) return;
    const wonRows = sheets.sheetData[wonSheet] || [];
    const lostRows = lostSheet ? (sheets.sheetData[lostSheet] || []) : [];
    const { headers: wh, rows: wr } = parseSheetRows(wonRows);
    const { rows: lr } = parseSheetRows(lostRows);
    // Inject _outcome column so the model knows which is which
    const combined = [
      ...wr.map(r => ({ ...r, _outcome: 'Won' })),
      ...lr.map(r => ({ ...r, _outcome: 'Closed Lost' })),
    ];
    const allHeaders = lostSheet ? [...wh, '_outcome'] : wh;
    setHeaders(allHeaders);
    setRows(combined);
    const detected = autoDetect(allHeaders);
    // If no outcome column detected, point to our injected one
    if (!detected.outcome) detected.outcome = '_outcome';
    setMapping(detected);
    setStep('map');
  }, [sheets, wonSheet, lostSheet]);

  const [runStatus, setRunStatus] = useState('');

  const handleRun = useCallback(() => {
    setRunning(true);
    setRunStatus('Normalizing deals...');
    // Use nested timeouts to yield to UI between heavy steps
    setTimeout(() => {
      try {
        const deals = normalizeDeals(rows, mapping);
        const wins = deals.filter(d => d.won === 1).length;
        const losses = deals.filter(d => d.won === 0).length;
        if (deals.length < 50) { setRunning(false); setRunStatus(''); alert('Need at least 50 deals.'); return; }
        if (wins === 0) { setRunning(false); setRunStatus(''); alert('No won deals detected. Check your Outcome column mapping. Recognized values: won, closed won, closed, 1, true, yes, win.'); return; }
        if (losses === 0) { setRunning(false); setRunStatus(''); alert('No lost deals detected. You need both won and lost deals.'); return; }
        setRunStatus(`Found ${wins.toLocaleString()} wins · ${losses.toLocaleString()} losses — training models...`);
        setTimeout(() => {
          try {
            const r = runBacktest(deals, trainPct);
            setResults(r);
            setRunStatus('');
            setRunning(false);
            setStep('results');
          } catch (err) {
            setRunning(false);
            setRunStatus('');
            alert('Error during backtest: ' + err.message);
          }
        }, 120);
      } catch (err) {
        setRunning(false);
        setRunStatus('');
        alert('Error: ' + err.message);
      }
    }, 80);
  }, [rows, mapping, trainPct]);

  const STEPS = ['upload', 'sheets', 'map', 'configure', 'results'];

  // ── Upload ──────────────────────────────────────────────────────────────────
  const Upload = () => (
    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
      <span style={lbl()}>REVOS · BACKTEST ENGINE</span>
      <h2 style={{ fontSize: '22px', fontWeight: '700', color: C.text, margin: '0 0 6px', letterSpacing: '-0.03em' }}>Upload Deal History</h2>
      <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 24px' }}>CSV of closed won/lost deals. 1,000+ recommended — you have enough to make this meaningful.</p>

      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => document.getElementById('fi').click()}
        style={{ border: `2px dashed ${drag ? C.blue : C.border}`, borderRadius: '12px', padding: '48px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', background: drag ? `${C.blue}08` : 'transparent' }}
      >
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>📂</div>
        <div style={{ fontSize: '14px', color: C.text, marginBottom: '4px' }}>Drop CSV or Excel file (.xlsx) or click to browse</div>
        <div style={{ fontSize: '12px', color: C.muted }}>Supports .csv and .xlsx with multiple sheets</div>
        <input id="fi" type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
      </div>

      <div style={{ ...card({ marginTop: '16px' }) }}>
        <span style={lbl()}>FIELDS NEEDED IN YOUR DATA</span>
        {[['Outcome', 'Won / Lost per deal — any format'], ['Product / Service', 'What was sold'], ['Segment / Vertical', 'Account classification — used as grouping key'], ['Deal Value', 'MRR or TCV — numeric']].map(([f, d]) => (
          <div key={f} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: C.green, fontSize: '12px' }}>✓</span>
            <span style={{ fontSize: '12px', color: C.text, fontWeight: '500', minWidth: '140px' }}>{f}</span>
            <span style={{ fontSize: '12px', color: C.muted }}>{d}</span>
          </div>
        ))}
      </div>

      <div style={{ ...card({ marginTop: '10px', background: `${C.amber}08`, border: `1px solid ${C.amber}25` }) }}>
        <p style={{ fontSize: '12px', color: C.amber, margin: 0 }}>
          💡 <strong>Segment / Vertical</strong> is the primary grouping key — Option B trains a separate model per segment. The more consistent your segment labels, the better the per-vertical models perform.
        </p>
      </div>
    </div>
  );

  // ── Sheets ──────────────────────────────────────────────────────────────────
  const Sheets = () => {
    if (!sheets) return null;
    const { sheetNames, sheetData } = sheets;
    const wonCount = wonSheet ? (sheetData[wonSheet]?.length - 1 || 0) : 0;
    const lostCount = lostSheet ? (sheetData[lostSheet]?.length - 1 || 0) : 0;
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <span style={lbl()}>STEP 2 OF 4 — EXCEL DETECTED</span>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: C.text, margin: '0 0 4px', letterSpacing: '-0.03em' }}>Assign Your Sheets</h2>
        <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 20px' }}>
          Found {sheetNames.length} sheets — tell the model which contains won deals and which contains lost deals.
        </p>

        <div style={card({ marginBottom: '14px' })}>
          {[
            { key: 'won', label: 'Won Deals Sheet', color: C.green, val: wonSheet, set: setWonSheet, hint: 'Closed Won, Wins, Won' },
            { key: 'lost', label: 'Lost / Closed Lost Sheet', color: C.red, val: lostSheet, set: setLostSheet, hint: 'Closed Lost, Losses — leave blank if not available' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: C.text, fontWeight: '600', marginBottom: '6px' }}>
                <span style={{ color: f.color, marginRight: '6px' }}>●</span>{f.label}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[...(f.key === 'lost' ? ['— none —'] : []), ...sheetNames].map(name => {
                  const active = f.val === (name === '— none —' ? '' : name);
                  return (
                    <button key={name} onClick={() => f.set(name === '— none —' ? '' : name)}
                      style={{ background: active ? `${f.color}15` : C.deep, border: `1px solid ${active ? f.color + '50' : C.border}`, borderRadius: '6px', padding: '6px 14px', fontSize: '12px', color: active ? f.color : C.muted, cursor: 'pointer', fontWeight: active ? '600' : '400' }}>
                      {name}
                    </button>
                  );
                })}
              </div>
              {f.val && f.key === 'won' && (
                <div style={{ fontSize: '11px', color: C.green, marginTop: '6px' }}>✓ {wonCount.toLocaleString()} rows detected</div>
              )}
              {f.val && f.key === 'lost' && (
                <div style={{ fontSize: '11px', color: C.red, marginTop: '6px' }}>✓ {lostCount.toLocaleString()} rows detected</div>
              )}
            </div>
          ))}
        </div>

        {!lostSheet && (
          <div style={{ ...card({ marginBottom: '14px', background: `${C.amber}08`, border: `1px solid ${C.amber}25` }) }}>
            <p style={{ fontSize: '12px', color: C.amber, margin: 0 }}>
              ⚠ Without lost deals the model has nothing to compare wins against — results will be unreliable. Add your closed lost sheet for a meaningful backtest.
            </p>
          </div>
        )}

        <button onClick={handleCombineSheets} disabled={!wonSheet}
          style={{ width: '100%', background: wonSheet ? C.purple : C.dim, color: '#000', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: '600', cursor: wonSheet ? 'pointer' : 'not-allowed' }}>
          Combine Sheets & Continue →
        </button>
      </div>
    );
  };

  // ── Map ─────────────────────────────────────────────────────────────────────
  const Map = () => {
    const wonSample = [...new Set(rows.slice(0, 100).map(r => (r[mapping.outcome] || '').trim()))].filter(Boolean).slice(0, 8);
    const fields = [
      { key: 'outcome', label: 'Outcome (Won/Lost)', req: true, hint: '"Won", "Closed Won", "1"' },
      { key: 'product', label: 'Product / Service', req: true, hint: 'What was sold' },
      { key: 'segment', label: 'Segment / Vertical', req: true, hint: 'Account segment or vertical — used as the grouping key' },
      { key: 'deal_value', label: 'Deal Value', req: true, hint: 'MRR or TCV, numeric' },
      { key: 'created_date', label: 'Created Date', req: false, hint: 'For days-to-close signal' },
      { key: 'close_date', label: 'Close Date', req: false, hint: 'For days-to-close signal' },
    ];
    const canContinue = ['outcome', 'product', 'segment', 'deal_value'].every(k => mapping[k]);

    return (
      <div style={{ maxWidth: '580px', margin: '0 auto' }}>
        <span style={lbl()}>STEP 2 OF 3</span>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: C.text, margin: '0 0 4px', letterSpacing: '-0.03em' }}>Map Your Columns</h2>
        <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 20px' }}>{rows.length.toLocaleString()} rows · {headers.length} columns detected · auto-mapped where matched</p>

        <div style={card({ marginBottom: '14px' })}>
          {fields.map(f => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <div style={{ minWidth: '160px', flexShrink: 0 }}>
                <span style={{ fontSize: '12px', color: C.text, fontWeight: '500' }}>{f.label} {f.req && <span style={{ color: C.red }}>*</span>}</span>
                <div style={{ fontSize: '10px', color: C.dim }}>{f.hint}</div>
              </div>
              <select value={mapping[f.key]} onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))}
                style={{ flex: 1, background: '#0D1117', border: `1px solid ${mapping[f.key] ? C.green + '50' : C.border}`, borderRadius: '6px', padding: '6px 10px', fontSize: '12px', color: C.text, outline: 'none', cursor: 'pointer' }}>
                <option value="">— not mapped —</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
        </div>

        {mapping.outcome && wonSample.length > 0 && (
          <div style={card({ marginBottom: '14px', background: `${C.blue}08`, border: `1px solid ${C.blue}20` })}>
            <span style={lbl()}>OUTCOME VALUES DETECTED — auto-classified</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {wonSample.map(v => {
                const isWon = WON_VALUES.has(v.toLowerCase().trim());
                return <span key={v} style={{ fontSize: '11px', fontFamily: C.mono, background: isWon ? `${C.green}15` : `${C.red}15`, border: `1px solid ${isWon ? C.green : C.red}40`, color: isWon ? C.green : C.red, borderRadius: '4px', padding: '2px 8px' }}>{v} → {isWon ? 'WON' : 'LOST'}</span>;
              })}
            </div>
            <p style={{ fontSize: '11px', color: C.dim, margin: '8px 0 0' }}>Won values: won, closed won, 1, true, yes, win — everything else = lost</p>
          </div>
        )}

        <button onClick={() => setStep('configure')} disabled={!canContinue}
          style={{ width: '100%', background: canContinue ? C.purple : C.dim, color: '#000', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: '600', cursor: canContinue ? 'pointer' : 'not-allowed' }}>
          Continue to Configure →
        </button>
      </div>
    );
  };

  // ── Configure ───────────────────────────────────────────────────────────────
  const Configure = () => {
    const trainCount = Math.floor(rows.length * trainPct / 100);
    const testCount = rows.length - trainCount;
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <span style={lbl()}>STEP 3 OF 3</span>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: C.text, margin: '0 0 4px', letterSpacing: '-0.03em' }}>Configure Backtest</h2>
        <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 20px' }}>{rows.length.toLocaleString()} deals ready to model</p>

        <div style={card({ marginBottom: '14px' })}>
          <span style={lbl()}>TRAIN / TEST SPLIT</span>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '6px' }}>
            <input type="range" min={60} max={90} step={5} value={trainPct} onChange={e => setTrainPct(+e.target.value)} style={{ flex: 1, accentColor: C.purple }} />
            <span style={{ fontFamily: C.mono, color: C.purple, fontSize: '16px', fontWeight: '700', minWidth: '40px' }}>{trainPct}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: C.dim }}>
            <span>Train on {trainCount.toLocaleString()} deals</span>
            <span>Test on {testCount.toLocaleString()} deals</span>
          </div>
        </div>

        <div style={card({ marginBottom: '14px' })}>
          <span style={lbl()}>WHAT EACH MODEL DOES</span>
          {[
            { label: 'Option A', color: C.blue, desc: 'Fixed 4 signals, one global logistic regression model', detail: 'Vertical win rate · Product win rate · Deal size percentile · Days open' },
            { label: 'Option B', color: C.green, desc: 'Dynamic 5 signals, separate model per vertical', detail: 'All 4 above + 1 interaction feature (vertical×product) — trained independently for each vertical with enough deals (≥10)' },
          ].map(m => (
            <div key={m.label} style={{ background: C.deep, borderRadius: '8px', padding: '12px', marginBottom: '10px', borderLeft: `3px solid ${m.color}` }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: m.color, fontFamily: C.mono }}>{m.label}</span>
                <span style={{ fontSize: '12px', color: C.text }}>{m.desc}</span>
              </div>
              <div style={{ fontSize: '11px', color: C.dim, lineHeight: '1.5' }}>{m.detail}</div>
            </div>
          ))}
        </div>

        <div style={card({ marginBottom: '14px' })}>
          <span style={lbl()}>OUTPUT METRICS</span>
          {[
            ['Brier Score', 'Prediction accuracy. Lower = better. 0 = perfect, 0.25 = random coin flip.'],
            ['AUC', 'How well the model ranks wins above losses. 1.0 = perfect, 0.5 = random.'],
            ['Accuracy', '% of deals correctly called as win or loss at the 0.5 threshold.'],
            ['By Mega Vertical', 'All three metrics broken out per vertical — shows where each model wins.'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: C.purple, fontFamily: C.mono, minWidth: '110px', flexShrink: 0 }}>{k}</span>
              <span style={{ fontSize: '11px', color: C.muted, lineHeight: '1.5' }}>{v}</span>
            </div>
          ))}
        </div>

        <button onClick={handleRun} disabled={running}
          style={{ width: '100%', background: running ? C.dim : C.purple, color: '#000', border: 'none', borderRadius: '8px', padding: '13px', fontSize: '14px', fontWeight: '600', cursor: running ? 'not-allowed' : 'pointer' }}>
          {running ? '⏳ Running backtest...' : `Run Backtest on ${rows.length.toLocaleString()} Deals →`}
        </button>
        {runStatus && (
          <div style={{ marginTop: '10px', padding: '10px 14px', background: `${C.purple}10`, border: `1px solid ${C.purple}30`, borderRadius: '8px', fontSize: '12px', color: C.purple, fontFamily: C.mono, textAlign: 'center' }}>
            {runStatus}
          </div>
        )}
      </div>
    );
  };

  // ── Results ─────────────────────────────────────────────────────────────────
  const Results = () => {
    if (!results) return null;
    const { A, B, byVertical, featureImportance, calibration, trainSize, testSize, overallWinRate, verticalModelCount } = results;
    const winner = B.brier < A.brier ? 'B' : 'A';
    const brierImprovement = Math.abs((A.brier - B.brier) / A.brier * 100);
    const wColor = winner === 'B' ? C.green : C.blue;
    const maxImportance = Math.max(...featureImportance.map(f => f.importance));

    return (
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <span style={lbl()}>BACKTEST RESULTS</span>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: C.text, margin: '0 0 4px', letterSpacing: '-0.03em' }}>
              Option {winner} wins — {brierImprovement.toFixed(1)}% better Brier score
            </h2>
            <p style={{ fontSize: '13px', color: C.muted, margin: 0 }}>
              Train: {trainSize.toLocaleString()} · Test: {testSize.toLocaleString()} · Win rate: {(overallWinRate * 100).toFixed(1)}% · Option B used {verticalModelCount} vertical models
            </p>
          </div>
          <button onClick={() => setStep('configure')} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '6px 12px', fontSize: '12px', color: C.muted, cursor: 'pointer' }}>← Re-run</button>
        </div>

        {/* Summary */}
        <div style={{ ...card({ marginBottom: '16px', borderLeft: `4px solid ${wColor}`, background: `${wColor}08`, border: `1px solid ${wColor}30` }) }}>
          <p style={{ fontSize: '13px', color: C.text, lineHeight: '1.7', margin: 0 }}>
            <strong style={{ color: wColor }}>Option {winner} ({winner === 'B' ? 'Dynamic per-vertical model' : 'Fixed global model'})</strong> outperformed on the holdout test set.{' '}
            {winner === 'B'
              ? `Training a separate model per vertical is capturing buying patterns your global model misses. With ${verticalModelCount} vertical-specific models, Option B has enough data per segment to find signal.`
              : `Your win patterns are consistent enough across verticals that the added complexity of per-vertical training doesn't help — and may be overfitting to small vertical sample sizes.`}
          </p>
        </div>

        {/* Metric comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          {[
            { label: 'Brier Score', a: A.brier.toFixed(4), b: B.brier.toFixed(4), lowerBetter: true },
            { label: 'AUC', a: (A.auc * 100).toFixed(1) + '%', b: (B.auc * 100).toFixed(1) + '%', lowerBetter: false },
            { label: 'Accuracy', a: (A.acc * 100).toFixed(1) + '%', b: (B.acc * 100).toFixed(1) + '%', lowerBetter: false },
          ].map(m => {
            const aWins = m.lowerBetter ? parseFloat(m.a) <= parseFloat(m.b) : parseFloat(m.a) >= parseFloat(m.b);
            return (
              <div key={m.label} style={card()}>
                <span style={lbl()}>{m.label}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[{ val: m.a, opt: 'A', color: C.blue, wins: aWins }, { val: m.b, opt: 'B', color: C.green, wins: !aWins }].map(({ val, opt, color, wins }) => (
                    <div key={opt} style={{ flex: 1, textAlign: 'center', padding: '8px', background: wins ? `${color}10` : C.deep, borderRadius: '6px', border: `1px solid ${wins ? color + '30' : C.border}` }}>
                      <div style={{ fontSize: '9px', color: C.dim, fontFamily: C.mono, marginBottom: '3px', letterSpacing: '0.1em' }}>OPT {opt}</div>
                      <div style={{ fontSize: '17px', fontWeight: '700', fontFamily: C.mono, color: wins ? color : C.muted }}>{val}</div>
                      {wins && <div style={{ fontSize: '9px', color, fontWeight: '700', marginTop: '2px' }}>WINNER</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* By vertical */}
        {byVertical.length > 0 && (
          <div style={card({ marginBottom: '16px' })}>
            <span style={lbl()}>ACCURACY BY MEGA VERTICAL</span>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>{['Vertical', 'Deals', 'Win Rate', 'Brier A', 'Brier B', 'AUC A', 'AUC B', 'Winner'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: '10px', color: C.dim, fontFamily: C.mono, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {byVertical.map(v => (
                    <tr key={v.vertical} style={{ borderBottom: `1px solid ${C.border}20` }}>
                      <td style={{ padding: '8px', color: C.text, fontWeight: '500' }}>{v.vertical}</td>
                      <td style={{ padding: '8px', color: C.muted, fontFamily: C.mono }}>{v.count}</td>
                      <td style={{ padding: '8px', color: C.muted, fontFamily: C.mono }}>{(v.winRate * 100).toFixed(0)}%</td>
                      <td style={{ padding: '8px', fontFamily: C.mono, color: v.winner === 'A' ? C.blue : C.muted, fontWeight: v.winner === 'A' ? '700' : '400' }}>{v.brierA.toFixed(4)}</td>
                      <td style={{ padding: '8px', fontFamily: C.mono, color: v.winner === 'B' ? C.green : C.muted, fontWeight: v.winner === 'B' ? '700' : '400' }}>{v.brierB.toFixed(4)}</td>
                      <td style={{ padding: '8px', fontFamily: C.mono, color: C.muted }}>{(v.aucA * 100).toFixed(0)}%</td>
                      <td style={{ padding: '8px', fontFamily: C.mono, color: C.muted }}>{(v.aucB * 100).toFixed(0)}%</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ fontSize: '10px', fontFamily: C.mono, fontWeight: '700', color: v.winner === 'B' ? C.green : C.blue, background: v.winner === 'B' ? `${C.green}15` : `${C.blue}15`, border: `1px solid ${v.winner === 'B' ? C.green : C.blue}40`, borderRadius: '4px', padding: '2px 6px' }}>
                          OPT {v.winner}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: '11px', color: C.dim, margin: '8px 0 0' }}>Lower Brier = more accurate probability prediction for that vertical</p>
          </div>
        )}

        {/* Feature importance */}
        <div style={card({ marginBottom: '16px' })}>
          <span style={lbl()}>FEATURE IMPORTANCE — correlation with win outcome (global)</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {featureImportance.map(f => (
              <div key={f.name} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: C.muted, minWidth: '160px', flexShrink: 0 }}>{f.name}</span>
                <div style={{ flex: 1, height: '4px', background: C.border, borderRadius: '2px' }}>
                  <div style={{ width: `${(f.importance / maxImportance) * 100}%`, height: '100%', background: C.purple, borderRadius: '2px', opacity: 0.8 }} />
                </div>
                <span style={{ fontSize: '11px', color: C.purple, fontFamily: C.mono, minWidth: '36px', textAlign: 'right' }}>{(f.importance * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '11px', color: C.dim, margin: '10px 0 0' }}>The two interaction features (Vertical×Product, Rep×Vertical) are unique to Option B — their importance here shows how much signal Option A leaves on the table.</p>
        </div>

        {/* Calibration */}
        {calibration.length > 0 && (
          <div style={card({ marginBottom: '16px' })}>
            <span style={lbl()}>CALIBRATION — does predicted % match actual win rate?</span>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>{['Predicted Range', 'Deals', 'Pred A', 'Pred B', 'Actual Win Rate'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: '10px', color: C.dim, fontFamily: C.mono, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {calibration.map(c => {
                    const diffA = Math.abs(c.predA - c.actual);
                    const diffB = Math.abs(c.predB - c.actual);
                    return (
                      <tr key={c.bucket} style={{ borderBottom: `1px solid ${C.border}20` }}>
                        <td style={{ padding: '7px 8px', color: C.muted, fontFamily: C.mono }}>{c.bucket}</td>
                        <td style={{ padding: '7px 8px', color: C.dim, fontFamily: C.mono }}>{c.n}</td>
                        <td style={{ padding: '7px 8px', fontFamily: C.mono, color: diffA < diffB ? C.blue : C.muted }}>{(c.predA * 100).toFixed(0)}%</td>
                        <td style={{ padding: '7px 8px', fontFamily: C.mono, color: diffB < diffA ? C.green : C.muted }}>{(c.predB * 100).toFixed(0)}%</td>
                        <td style={{ padding: '7px 8px', fontFamily: C.mono, color: C.text, fontWeight: '600' }}>{(c.actual * 100).toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: '11px', color: C.dim, margin: '8px 0 0' }}>A well-calibrated model's predictions in each bucket should match the actual win rate. Closer = better.</p>
          </div>
        )}

        {/* Recommendation */}
        <div style={{ ...card({ marginBottom: '16px', background: C.deep, borderLeft: `3px solid ${C.purple}` }) }}>
          <span style={lbl()}>RECOMMENDATION</span>
          <p style={{ fontSize: '13px', color: C.text, lineHeight: '1.8', margin: 0 }}>
            {winner === 'B'
              ? `Ship Option B as your primary model. The ${brierImprovement.toFixed(1)}% Brier improvement compounds across your full book of business — that's materially fewer mis-scored deals. For verticals where Option A still wins in the table above, consider a hybrid: use Option B for any vertical with 50+ historical deals, and fall back to Option A elsewhere.`
              : `Use Option A as your primary model. Your verticals share enough buying behavior that a global model outperforms per-vertical training. Revisit Option B as you accumulate more per-vertical deal history — the crossover point is typically when each vertical has 80–100 closed deals.`}
          </p>
        </div>

        <button onClick={() => { setStep('upload'); setResults(null); setRows([]); setHeaders([]); }}
          style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px', fontSize: '13px', color: C.muted, cursor: 'pointer' }}>
          ← Start over with new data
        </button>
      </div>
    );
  };

  const handleReset = () => {
    setStep('upload'); setRows([]); setHeaders([]);
    setMapping({ outcome: '', product: '', segment: '', deal_value: '', created_date: '', close_date: '' });
    setResults(null); setRunning(false); setDrag(false);
    setSheets(null); setWonSheet(''); setLostSheet('');
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '28px 20px', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      {/* Reset button — always visible except on upload screen */}
      {step !== 'upload' && (
        <button onClick={handleReset} style={{
          position: 'fixed', top: '16px', right: '16px', zIndex: 999,
          background: C.card, border: `1px solid ${C.border}`, borderRadius: '6px',
          padding: '6px 12px', fontSize: '11px', color: C.muted,
          cursor: 'pointer', fontFamily: C.mono, letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          ↺ RESET
        </button>
      )}
      {/* Progress — hide 'sheets' step unless we're on it */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '36px' }}>
        {[['upload', '1', 'Upload'], ...(step === 'sheets' ? [['sheets', '2', 'Sheets']] : []), ['map', step === 'sheets' ? '3' : '2', 'Map'], ['configure', step === 'sheets' ? '4' : '3', 'Configure'], ['results', '✓', 'Results']].map(([s, n, label_]) => {
          const idx = STEPS.indexOf(step), thisIdx = STEPS.indexOf(s);
          const done = idx > thisIdx, active = idx === thisIdx;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', fontFamily: C.mono, background: active ? C.purple : done ? C.green : C.border, color: active || done ? '#000' : C.dim, flexShrink: 0 }}>{done ? '✓' : n}</div>
              <span style={{ fontSize: '11px', color: active ? C.text : C.dim }}>{label_}</span>
              {s !== 'results' && <span style={{ color: C.border, fontSize: '12px', marginLeft: '2px' }}>›</span>}
            </div>
          );
        })}
      </div>

      {step === 'upload' && <Upload />}
      {step === 'sheets' && <Sheets />}
      {step === 'map' && <Map />}
      {step === 'configure' && <Configure />}
      {step === 'results' && <Results />}
    </div>
  );
}
