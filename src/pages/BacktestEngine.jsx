import { useState, useCallback } from "react";
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

// ─── Chart Colors (hex values for Recharts props) ────────────────────────────
const COLORS = { cyan: '#60a5fa', green: '#34d399', red: '#f87171', yellow: '#fbbf24', orange: '#f0883e', purple: '#a78bfa', blue: '#60a5fa', text: '#e6edf3', textDim: '#8b949e', card: '#161B22', border: '#21262D' };

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

const WON_VALUES = new Set(['won', 'closed won', 'accepted', '5 - accepted', '1', 'true', 'yes', 'win', 'closed-won', 'closedwon', 'closed']);

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

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function BacktestEngine({ onResults, savedResults }) {
  const [step, setStep] = useState(savedResults ? 'results' : 'upload');
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({ outcome: '', product: '', segment: '', deal_value: '', created_date: '', close_date: '' });
  const [trainPct, setTrainPct] = useState(80);
  const [results, setResults] = useState(savedResults || null);
  const [running, setRunning] = useState(false);
  const [drag, setDrag] = useState(false);
  const [sheets, setSheets] = useState(null); // { sheetNames, sheetData } for multi-sheet Excel
  const [wonSheet, setWonSheet] = useState('');
  const [lostSheet, setLostSheet] = useState('');
  const [wonFile, setWonFile] = useState(null); // { name, headers, rows } for two-CSV upload
  const [lostFile, setLostFile] = useState(null);

  // Parse a worksheet rows array into {headers, rows}
  const parseSheetRows = (sheetRows) => {
    if (!sheetRows || sheetRows.length < 2) return { headers: [], rows: [] };
    const headers = sheetRows[0].map(c => String(c ?? '').trim());
    const rows = sheetRows.slice(1).map(r =>
      Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '').trim()]))
    );
    return { headers, rows };
  };

  // Parse CSV text into {headers, rows}
  const parseCsvText = (text) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };
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
  };

  // Handle a file dropped/selected for the two-file flow
  const handleTypedFile = useCallback((file, type) => {
    const reader = new FileReader();
    reader.onload = e => {
      const { headers: h, rows: r } = parseCsvText(e.target.result);
      const parsed = { name: file.name, headers: h, rows: r };
      if (type === 'won') setWonFile(parsed);
      else setLostFile(parsed);
    };
    reader.readAsText(file);
  }, []);

  // Combine two CSV files and proceed to mapping
  // historicals.csv = all won deals (churn is NOT a loss, excluded from loss classification)
  // close_lost.csv = the only source of lost deals
  const handleCombineFiles = useCallback(() => {
    if (!wonFile) return;

    // historicals.csv = all Won deals (churn rows are excluded, not treated as losses)
    // close_lost.csv = the only source of Lost deals
    const combined = [
      ...wonFile.rows.map(r => ({ ...r, _outcome: 'Won' })),
      ...(lostFile ? lostFile.rows.map(r => ({ ...r, _outcome: 'Closed Lost' })) : []),
    ];

    const allHeaders = [...wonFile.headers, '_outcome'];
    setHeaders(allHeaders);
    setRows(combined);
    const detected = autoDetect(allHeaders);
    if (!detected.outcome) detected.outcome = '_outcome';
    setMapping(detected);
    setStep('map');
  }, [wonFile, lostFile]);

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
        if (wins === 0) { setRunning(false); setRunStatus(''); alert('No won deals detected. Check your Outcome column mapping. Recognized values: won, closed won, accepted, 5 - accepted, closed, 1, true, yes, win.'); return; }
        if (losses === 0) { setRunning(false); setRunStatus(''); alert('No lost deals detected. You need both won and lost deals.'); return; }
        setRunStatus(`Found ${wins.toLocaleString()} wins · ${losses.toLocaleString()} losses — training models...`);
        setTimeout(() => {
          try {
            const r = runBacktest(deals, trainPct);
            setResults(r);
            if (onResults) onResults(r);
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
    <div className="max-w-[560px] mx-auto">
      <span className="text-[10px] font-bold tracking-[0.1em] text-revos-text-dim uppercase font-mono mb-2 block">REVOS · BACKTEST ENGINE</span>
      <h2 className="text-[22px] font-bold text-revos-text m-0 mb-1.5 tracking-tight">Upload Deal History</h2>
      <p className="text-[13px] text-revos-text-mid m-0 mb-6">
        Upload <strong className="text-revos-text">historicals.csv</strong> (won deals + churn) and <strong className="text-revos-text">close_lost.csv</strong> — or a single Excel file with both sheets.
      </p>

      {/* Two-file CSV upload */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Won file */}
        <div
          onDragOver={e => { e.preventDefault(); }}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleTypedFile(f, 'won'); }}
          onClick={() => document.getElementById('fi-won').click()}
          className={cn(
            'border-2 border-dashed rounded-xl py-7 px-4 text-center cursor-pointer transition-all duration-200',
            wonFile ? 'border-revos-green/40 bg-revos-green/[0.03]' : 'border-revos-border bg-transparent'
          )}
        >
          <div className="text-[28px] mb-2">{wonFile ? '✓' : '📂'}</div>
          <div className={cn('text-[13px] font-semibold mb-1', wonFile ? 'text-revos-green' : 'text-revos-text')}>
            {wonFile ? wonFile.name : 'Historicals (Won + Churn)'}
          </div>
          {wonFile ? (
            <div className="text-[11px] text-revos-green">{wonFile.rows.length.toLocaleString()} rows</div>
          ) : (
            <div className="text-[11px] text-revos-text-mid">historicals.csv — won deals & churn</div>
          )}
          <input id="fi-won" type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files[0]) handleTypedFile(e.target.files[0], 'won'); }} />
        </div>

        {/* Lost file */}
        <div
          onDragOver={e => { e.preventDefault(); }}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleTypedFile(f, 'lost'); }}
          onClick={() => document.getElementById('fi-lost').click()}
          className={cn(
            'border-2 border-dashed rounded-xl py-7 px-4 text-center cursor-pointer transition-all duration-200',
            lostFile ? 'border-revos-red/40 bg-revos-red/[0.03]' : 'border-revos-border bg-transparent'
          )}
        >
          <div className="text-[28px] mb-2">{lostFile ? '✓' : '📂'}</div>
          <div className={cn('text-[13px] font-semibold mb-1', lostFile ? 'text-revos-red' : 'text-revos-text')}>
            {lostFile ? lostFile.name : 'Closed Lost Deals'}
          </div>
          {lostFile ? (
            <div className="text-[11px] text-revos-red">{lostFile.rows.length.toLocaleString()} rows</div>
          ) : (
            <div className="text-[11px] text-revos-text-mid">close_lost.csv — all closed lost deals</div>
          )}
          <input id="fi-lost" type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files[0]) handleTypedFile(e.target.files[0], 'lost'); }} />
        </div>
      </div>

      {/* Combine button */}
      {wonFile && (
        <button onClick={handleCombineFiles}
          className={cn(
            'w-full text-white border-none rounded-lg px-3 py-3 text-sm font-semibold cursor-pointer mb-4',
            lostFile ? 'bg-revos-purple' : 'bg-revos-yellow/50'
          )}
        >
          {lostFile
            ? `Combine ${wonFile.rows.length.toLocaleString()} historicals + ${lostFile.rows.length.toLocaleString()} close lost → Continue`
            : `Continue with ${wonFile.rows.length.toLocaleString()} historicals only (add close_lost for better results)`}
        </button>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3 my-2 mb-4">
        <div className="flex-1 h-px bg-revos-border" />
        <span className="text-[11px] text-revos-text-dim font-mono">OR UPLOAD A SINGLE FILE</span>
        <div className="flex-1 h-px bg-revos-border" />
      </div>

      {/* Single file upload (Excel or combined CSV) */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => document.getElementById('fi').click()}
        className={cn(
          'border-2 border-dashed rounded-xl py-7 px-4 text-center cursor-pointer transition-all duration-200',
          drag ? 'border-revos-blue bg-revos-blue/[0.03]' : 'border-revos-border bg-transparent'
        )}
      >
        <div className="text-[28px] mb-2">📋</div>
        <div className="text-[13px] text-revos-text mb-1">Single CSV or Excel (.xlsx) with both won & lost</div>
        <div className="text-[11px] text-revos-text-mid">Must have an outcome column, or use separate sheets for won/lost</div>
        <input id="fi" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
      </div>

      <div className="bg-revos-card border border-revos-border rounded-xl p-4 mt-4">
        <span className="text-[10px] font-bold tracking-[0.1em] text-revos-text-dim uppercase font-mono mb-2 block">FIELDS NEEDED IN YOUR DATA</span>
        {[['Outcome', 'Won / Lost per deal — auto-tagged when using two files'], ['Product / Service', 'What was sold'], ['Segment / Vertical', 'Account classification — used as grouping key'], ['Deal Value', 'MRR or TCV — numeric']].map(([f, d]) => (
          <div key={f} className="flex gap-2.5 items-center mb-2">
            <span className="text-revos-green text-xs">✓</span>
            <span className="text-xs text-revos-text font-medium min-w-[140px]">{f}</span>
            <span className="text-xs text-revos-text-mid">{d}</span>
          </div>
        ))}
      </div>

      <div className="bg-revos-yellow/[0.03] border border-revos-yellow/15 rounded-xl p-4 mt-2.5">
        <p className="text-xs text-revos-yellow m-0">
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
      <div className="max-w-[520px] mx-auto">
        <span className="text-[10px] font-bold tracking-[0.1em] text-revos-text-dim uppercase font-mono mb-2 block">STEP 2 OF 4 — EXCEL DETECTED</span>
        <h2 className="text-[22px] font-bold text-revos-text m-0 mb-1 tracking-tight">Assign Your Sheets</h2>
        <p className="text-[13px] text-revos-text-mid m-0 mb-5">
          Found {sheetNames.length} sheets — tell the model which contains won deals and which contains lost deals.
        </p>

        <div className="bg-revos-card border border-revos-border rounded-xl p-4 mb-3.5">
          {[
            { key: 'won', label: 'Won Deals Sheet', color: 'green', val: wonSheet, set: setWonSheet, hint: 'Closed Won, Wins, Won' },
            { key: 'lost', label: 'Lost / Closed Lost Sheet', color: 'red', val: lostSheet, set: setLostSheet, hint: 'Closed Lost, Losses — leave blank if not available' },
          ].map(f => (
            <div key={f.key} className="mb-4">
              <div className="text-xs text-revos-text font-semibold mb-1.5">
                <span className={cn('mr-1.5', f.color === 'green' ? 'text-revos-green' : 'text-revos-red')}>●</span>{f.label}
              </div>
              <div className="flex gap-2 flex-wrap">
                {[...(f.key === 'lost' ? ['— none —'] : []), ...sheetNames].map(name => {
                  const active = f.val === (name === '— none —' ? '' : name);
                  const colorClass = f.color === 'green' ? 'text-revos-green' : 'text-revos-red';
                  return (
                    <button key={name} onClick={() => f.set(name === '— none —' ? '' : name)}
                      className={cn(
                        'rounded-md px-3.5 py-1.5 text-xs cursor-pointer',
                        active
                          ? cn('font-semibold border', colorClass, f.color === 'green' ? 'bg-revos-green/[0.08] border-revos-green/30' : 'bg-revos-red/[0.08] border-revos-red/30')
                          : 'bg-revos-surface border border-revos-border text-revos-text-mid font-normal'
                      )}>
                      {name}
                    </button>
                  );
                })}
              </div>
              {f.val && f.key === 'won' && (
                <div className="text-[11px] text-revos-green mt-1.5">✓ {wonCount.toLocaleString()} rows detected</div>
              )}
              {f.val && f.key === 'lost' && (
                <div className="text-[11px] text-revos-red mt-1.5">✓ {lostCount.toLocaleString()} rows detected</div>
              )}
            </div>
          ))}
        </div>

        {!lostSheet && (
          <div className="bg-revos-yellow/[0.03] border border-revos-yellow/15 rounded-xl p-4 mb-3.5">
            <p className="text-xs text-revos-yellow m-0">
              ⚠ Without lost deals the model has nothing to compare wins against — results will be unreliable. Add your closed lost sheet for a meaningful backtest.
            </p>
          </div>
        )}

        <button onClick={handleCombineSheets} disabled={!wonSheet}
          className={cn(
            'w-full text-black border-none rounded-lg px-3 py-3 text-sm font-semibold',
            wonSheet ? 'bg-revos-purple cursor-pointer' : 'bg-revos-text-dim cursor-not-allowed'
          )}>
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
      <div className="max-w-[580px] mx-auto">
        <span className="text-[10px] font-bold tracking-[0.1em] text-revos-text-dim uppercase font-mono mb-2 block">STEP 2 OF 3</span>
        <h2 className="text-[22px] font-bold text-revos-text m-0 mb-1 tracking-tight">Map Your Columns</h2>
        <p className="text-[13px] text-revos-text-mid m-0 mb-5">{rows.length.toLocaleString()} rows · {headers.length} columns detected · auto-mapped where matched</p>

        <div className="bg-revos-card border border-revos-border rounded-xl p-4 mb-3.5">
          {fields.map(f => (
            <div key={f.key} className="flex items-center gap-3 mb-2.5">
              <div className="min-w-[160px] shrink-0">
                <span className="text-xs text-revos-text font-medium">{f.label} {f.req && <span className="text-revos-red">*</span>}</span>
                <div className="text-[10px] text-revos-text-dim">{f.hint}</div>
              </div>
              <select value={mapping[f.key]} onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))}
                className={cn(
                  'flex-1 bg-revos-surface rounded-md px-2.5 py-1.5 text-xs text-revos-text outline-none cursor-pointer border',
                  mapping[f.key] ? 'border-revos-green/30' : 'border-revos-border'
                )}>
                <option value="">— not mapped —</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
        </div>

        {mapping.outcome && wonSample.length > 0 && (
          <div className="bg-revos-blue/[0.03] border border-revos-blue/[0.12] rounded-xl p-4 mb-3.5">
            <span className="text-[10px] font-bold tracking-[0.1em] text-revos-text-dim uppercase font-mono mb-2 block">OUTCOME VALUES DETECTED — auto-classified</span>
            <div className="flex gap-1.5 flex-wrap">
              {wonSample.map(v => {
                const isWon = WON_VALUES.has(v.toLowerCase().trim());
                return (
                  <span key={v} className={cn(
                    'text-[11px] font-mono rounded px-2 py-0.5 border',
                    isWon ? 'bg-revos-green/[0.08] border-revos-green/25 text-revos-green' : 'bg-revos-red/[0.08] border-revos-red/25 text-revos-red'
                  )}>{v} → {isWon ? 'WON' : 'LOST'}</span>
                );
              })}
            </div>
            <p className="text-[11px] text-revos-text-dim mt-2 mb-0">Won values: won, closed won, accepted, 5 - accepted, 1, true, yes, win — everything else = lost</p>
          </div>
        )}

        <button onClick={() => setStep('configure')} disabled={!canContinue}
          className={cn(
            'w-full text-black border-none rounded-lg px-3 py-3 text-sm font-semibold',
            canContinue ? 'bg-revos-purple cursor-pointer' : 'bg-revos-text-dim cursor-not-allowed'
          )}>
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
      <div className="max-w-[520px] mx-auto">
        <span className="text-[10px] font-bold tracking-[0.1em] text-revos-text-dim uppercase font-mono mb-2 block">STEP 3 OF 3</span>
        <h2 className="text-[22px] font-bold text-revos-text m-0 mb-1 tracking-tight">Configure Backtest</h2>
        <p className="text-[13px] text-revos-text-mid m-0 mb-5">{rows.length.toLocaleString()} deals ready to model</p>

        <div className="bg-revos-card border border-revos-border rounded-xl p-4 mb-3.5">
          <span className="text-[10px] font-bold tracking-[0.1em] text-revos-text-dim uppercase font-mono mb-2 block">TRAIN / TEST SPLIT</span>
          <div className="flex gap-4 items-center mb-1.5">
            <input type="range" min={60} max={90} step={5} value={trainPct} onChange={e => setTrainPct(+e.target.value)} className="flex-1" style={{ accentColor: COLORS.purple }} />
            <span className="font-mono text-revos-purple text-base font-bold min-w-[40px]">{trainPct}%</span>
          </div>
          <div className="flex justify-between text-[11px] text-revos-text-dim">
            <span>Train on {trainCount.toLocaleString()} deals</span>
            <span>Test on {testCount.toLocaleString()} deals</span>
          </div>
        </div>

        <div className="bg-revos-card border border-revos-border rounded-xl p-4 mb-3.5">
          <span className="text-[10px] font-bold tracking-[0.1em] text-revos-text-dim uppercase font-mono mb-2 block">WHAT EACH MODEL DOES</span>
          {[
            { label: 'Option A', color: 'blue', desc: 'Fixed 4 signals, one global logistic regression model', detail: 'Vertical win rate · Product win rate · Deal size percentile · Days open' },
            { label: 'Option B', color: 'green', desc: 'Dynamic 5 signals, separate model per vertical', detail: 'All 4 above + 1 interaction feature (vertical×product) — trained independently for each vertical with enough deals (≥10)' },
          ].map(m => (
            <div key={m.label} className={cn(
              'bg-revos-surface rounded-lg px-3 py-3 mb-2.5 border-l-[3px]',
              m.color === 'blue' ? 'border-l-revos-blue' : 'border-l-revos-green'
            )}>
              <div className="flex gap-2 mb-1">
                <span className={cn('text-xs font-bold font-mono', m.color === 'blue' ? 'text-revos-blue' : 'text-revos-green')}>{m.label}</span>
                <span className="text-xs text-revos-text">{m.desc}</span>
              </div>
              <div className="text-[11px] text-revos-text-dim leading-relaxed">{m.detail}</div>
            </div>
          ))}
        </div>

        <div className="bg-revos-card border border-revos-border rounded-xl p-4 mb-3.5">
          <span className="text-[10px] font-bold tracking-[0.1em] text-revos-text-dim uppercase font-mono mb-2 block">OUTPUT METRICS</span>
          {[
            ['Brier Score', 'Prediction accuracy. Lower = better. 0 = perfect, 0.25 = random coin flip.'],
            ['AUC', 'How well the model ranks wins above losses. 1.0 = perfect, 0.5 = random.'],
            ['Accuracy', '% of deals correctly called as win or loss at the 0.5 threshold.'],
            ['By Mega Vertical', 'All three metrics broken out per vertical — shows where each model wins.'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2.5 mb-2">
              <span className="text-[11px] text-revos-purple font-mono min-w-[110px] shrink-0">{k}</span>
              <span className="text-[11px] text-revos-text-mid leading-relaxed">{v}</span>
            </div>
          ))}
        </div>

        <button onClick={handleRun} disabled={running}
          className={cn(
            'w-full text-black border-none rounded-lg px-3 py-3.5 text-sm font-semibold',
            running ? 'bg-revos-text-dim cursor-not-allowed' : 'bg-revos-purple cursor-pointer'
          )}>
          {running ? '⏳ Running backtest...' : `Run Backtest on ${rows.length.toLocaleString()} Deals →`}
        </button>
        {runStatus && (
          <div className="mt-2.5 px-3.5 py-2.5 bg-revos-purple/[0.06] border border-revos-purple/20 rounded-lg text-xs text-revos-purple font-mono text-center">
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
    const wColor = winner === 'B' ? 'green' : 'blue';
    const maxImportance = Math.max(...featureImportance.map(f => f.importance));

    return (
      <div className="max-w-[720px] mx-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <span className="text-[10px] font-bold tracking-[0.1em] text-revos-text-dim uppercase font-mono mb-2 block">BACKTEST RESULTS</span>
            <h2 className="text-[22px] font-bold text-revos-text m-0 mb-1 tracking-tight">
              Option {winner} wins — {brierImprovement.toFixed(1)}% better Brier score
            </h2>
            <p className="text-[13px] text-revos-text-mid m-0">
              Train: {trainSize.toLocaleString()} · Test: {testSize.toLocaleString()} · Win rate: {(overallWinRate * 100).toFixed(1)}% · Option B used {verticalModelCount} vertical models
            </p>
          </div>
          <button onClick={() => setStep('configure')} className="bg-transparent border border-revos-border rounded-md px-3 py-1.5 text-xs text-revos-text-mid cursor-pointer">← Re-run</button>
        </div>

        {/* Summary */}
        <div className={cn(
          'rounded-xl p-4 mb-4 border-l-4',
          wColor === 'green' ? 'bg-revos-green/[0.03] border border-revos-green/20 border-l-revos-green' : 'bg-revos-blue/[0.03] border border-revos-blue/20 border-l-revos-blue'
        )}>
          <p className="text-[13px] text-revos-text leading-[1.7] m-0">
            <strong className={wColor === 'green' ? 'text-revos-green' : 'text-revos-blue'}>Option {winner} ({winner === 'B' ? 'Dynamic per-vertical model' : 'Fixed global model'})</strong> outperformed on the holdout test set.{' '}
            {winner === 'B'
              ? `Training a separate model per vertical is capturing buying patterns your global model misses. With ${verticalModelCount} vertical-specific models, Option B has enough data per segment to find signal.`
              : `Your win patterns are consistent enough across verticals that the added complexity of per-vertical training doesn't help — and may be overfitting to small vertical sample sizes.`}
          </p>
        </div>

        {/* Metric comparison */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {[
            { label: 'Brier Score', a: A.brier.toFixed(4), b: B.brier.toFixed(4), lowerBetter: true },
            { label: 'AUC', a: (A.auc * 100).toFixed(1) + '%', b: (B.auc * 100).toFixed(1) + '%', lowerBetter: false },
            { label: 'Accuracy', a: (A.acc * 100).toFixed(1) + '%', b: (B.acc * 100).toFixed(1) + '%', lowerBetter: false },
          ].map(m => {
            const aWins = m.lowerBetter ? parseFloat(m.a) <= parseFloat(m.b) : parseFloat(m.a) >= parseFloat(m.b);
            return (
              <div key={m.label} className="bg-revos-card border border-revos-border rounded-xl p-4">
                <span className="text-[10px] font-bold tracking-[0.1em] text-revos-text-dim uppercase font-mono mb-2 block">{m.label}</span>
                <div className="flex gap-1.5">
                  {[{ val: m.a, opt: 'A', colorName: 'blue', wins: aWins }, { val: m.b, opt: 'B', colorName: 'green', wins: !aWins }].map(({ val, opt, colorName, wins }) => (
                    <div key={opt} className={cn(
                      'flex-1 text-center p-2 rounded-md border',
                      wins
                        ? (colorName === 'blue' ? 'bg-revos-blue/[0.06] border-revos-blue/20' : 'bg-revos-green/[0.06] border-revos-green/20')
                        : 'bg-revos-surface border-revos-border'
                    )}>
                      <div className="text-[9px] text-revos-text-dim font-mono mb-0.5 tracking-[0.1em]">OPT {opt}</div>
                      <div className={cn(
                        'text-[17px] font-bold font-mono',
                        wins ? (colorName === 'blue' ? 'text-revos-blue' : 'text-revos-green') : 'text-revos-text-mid'
                      )}>{val}</div>
                      {wins && <div className={cn('text-[9px] font-bold mt-0.5', colorName === 'blue' ? 'text-revos-blue' : 'text-revos-green')}>WINNER</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* By vertical */}
        {byVertical.length > 0 && (
          <div className="bg-revos-card border border-revos-border rounded-xl p-4 mb-4">
            <span className="text-[10px] font-bold tracking-[0.1em] text-revos-text-dim uppercase font-mono mb-2 block">ACCURACY BY MEGA VERTICAL</span>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>{['Vertical', 'Deals', 'Win Rate', 'Brier A', 'Brier B', 'AUC A', 'AUC B', 'Winner'].map(h => (
                    <th key={h} className="text-left px-2 py-1.5 text-[10px] text-revos-text-dim font-mono tracking-wide uppercase border-b border-revos-border">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {byVertical.map(v => (
                    <tr key={v.vertical} className="border-b border-revos-border/[0.12]">
                      <td className="p-2 text-revos-text font-medium">{v.vertical}</td>
                      <td className="p-2 text-revos-text-mid font-mono">{v.count}</td>
                      <td className="p-2 text-revos-text-mid font-mono">{(v.winRate * 100).toFixed(0)}%</td>
                      <td className={cn('p-2 font-mono', v.winner === 'A' ? 'text-revos-blue font-bold' : 'text-revos-text-mid')}>{v.brierA.toFixed(4)}</td>
                      <td className={cn('p-2 font-mono', v.winner === 'B' ? 'text-revos-green font-bold' : 'text-revos-text-mid')}>{v.brierB.toFixed(4)}</td>
                      <td className="p-2 font-mono text-revos-text-mid">{(v.aucA * 100).toFixed(0)}%</td>
                      <td className="p-2 font-mono text-revos-text-mid">{(v.aucB * 100).toFixed(0)}%</td>
                      <td className="p-2">
                        <span className={cn(
                          'text-[10px] font-mono font-bold rounded px-1.5 py-0.5 border',
                          v.winner === 'B'
                            ? 'text-revos-green bg-revos-green/[0.08] border-revos-green/25'
                            : 'text-revos-blue bg-revos-blue/[0.08] border-revos-blue/25'
                        )}>
                          OPT {v.winner}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-revos-text-dim mt-2 mb-0">Lower Brier = more accurate probability prediction for that vertical</p>
          </div>
        )}

        {/* Feature importance */}
        <div className="bg-revos-card border border-revos-border rounded-xl p-4 mb-4">
          <span className="text-[10px] font-bold tracking-[0.1em] text-revos-text-dim uppercase font-mono mb-2 block">FEATURE IMPORTANCE — correlation with win outcome (global)</span>
          <div className="flex flex-col gap-2">
            {featureImportance.map(f => (
              <div key={f.name} className="flex gap-2.5 items-center">
                <span className="text-[11px] text-revos-text-mid min-w-[160px] shrink-0">{f.name}</span>
                <div className="flex-1 h-1 bg-revos-border rounded-sm">
                  <div className="h-full bg-revos-purple rounded-sm opacity-80" style={{ width: `${(f.importance / maxImportance) * 100}%` }} />
                </div>
                <span className="text-[11px] text-revos-purple font-mono min-w-[36px] text-right">{(f.importance * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-revos-text-dim mt-2.5 mb-0">The interaction feature (Vertical×Product) is unique to Option B — its importance here shows how much signal Option A leaves on the table.</p>
        </div>

        {/* Calibration */}
        {calibration.length > 0 && (
          <div className="bg-revos-card border border-revos-border rounded-xl p-4 mb-4">
            <span className="text-[10px] font-bold tracking-[0.1em] text-revos-text-dim uppercase font-mono mb-2 block">CALIBRATION — does predicted % match actual win rate?</span>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>{['Predicted Range', 'Deals', 'Pred A', 'Pred B', 'Actual Win Rate'].map(h => (
                    <th key={h} className="text-left px-2 py-1.5 text-[10px] text-revos-text-dim font-mono tracking-wide uppercase border-b border-revos-border">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {calibration.map(c => {
                    const diffA = Math.abs(c.predA - c.actual);
                    const diffB = Math.abs(c.predB - c.actual);
                    return (
                      <tr key={c.bucket} className="border-b border-revos-border/[0.12]">
                        <td className="px-2 py-[7px] text-revos-text-mid font-mono">{c.bucket}</td>
                        <td className="px-2 py-[7px] text-revos-text-dim font-mono">{c.n}</td>
                        <td className={cn('px-2 py-[7px] font-mono', diffA < diffB ? 'text-revos-blue' : 'text-revos-text-mid')}>{(c.predA * 100).toFixed(0)}%</td>
                        <td className={cn('px-2 py-[7px] font-mono', diffB < diffA ? 'text-revos-green' : 'text-revos-text-mid')}>{(c.predB * 100).toFixed(0)}%</td>
                        <td className="px-2 py-[7px] font-mono text-revos-text font-semibold">{(c.actual * 100).toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-revos-text-dim mt-2 mb-0">A well-calibrated model's predictions in each bucket should match the actual win rate. Closer = better.</p>
          </div>
        )}

        {/* Recommendation */}
        <div className="bg-revos-surface border border-revos-border rounded-xl p-4 mb-4 border-l-[3px] border-l-revos-purple">
          <span className="text-[10px] font-bold tracking-[0.1em] text-revos-text-dim uppercase font-mono mb-2 block">RECOMMENDATION</span>
          <p className="text-[13px] text-revos-text leading-[1.8] m-0">
            {winner === 'B'
              ? `Ship Option B as your primary model. The ${brierImprovement.toFixed(1)}% Brier improvement compounds across your full book of business — that's materially fewer mis-scored deals. For verticals where Option A still wins in the table above, consider a hybrid: use Option B for any vertical with 50+ historical deals, and fall back to Option A elsewhere.`
              : `Use Option A as your primary model. Your verticals share enough buying behavior that a global model outperforms per-vertical training. Revisit Option B as you accumulate more per-vertical deal history — the crossover point is typically when each vertical has 80–100 closed deals.`}
          </p>
        </div>

        <button onClick={() => { setStep('upload'); setResults(null); setRows([]); setHeaders([]); setWonFile(null); setLostFile(null); }}
          className="w-full bg-transparent border border-revos-border rounded-lg px-2.5 py-2.5 text-[13px] text-revos-text-mid cursor-pointer">
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
    setWonFile(null); setLostFile(null);
  };

  return (
    <div className="bg-revos-bg min-h-screen py-7 px-5 font-sans">
      {/* Reset button — always visible except on upload screen */}
      {step !== 'upload' && (
        <button onClick={handleReset} className="fixed top-4 right-4 z-[999] bg-revos-card border border-revos-border rounded-md px-3 py-1.5 text-[11px] text-revos-text-mid cursor-pointer font-mono tracking-wide flex items-center gap-1.5">
          ↺ RESET
        </button>
      )}
      {/* Progress — hide 'sheets' step unless we're on it */}
      <div className="flex justify-center gap-1.5 mb-9">
        {[['upload', '1', 'Upload'], ...(step === 'sheets' ? [['sheets', '2', 'Sheets']] : []), ['map', step === 'sheets' ? '3' : '2', 'Map'], ['configure', step === 'sheets' ? '4' : '3', 'Configure'], ['results', '✓', 'Results']].map(([s, n, label_]) => {
          const idx = STEPS.indexOf(step), thisIdx = STEPS.indexOf(s);
          const done = idx > thisIdx, active = idx === thisIdx;
          return (
            <div key={s} className="flex items-center gap-1.5">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shrink-0',
                active ? 'bg-revos-purple text-black' : done ? 'bg-revos-green text-black' : 'bg-revos-border text-revos-text-dim'
              )}>{done ? '✓' : n}</div>
              <span className={cn('text-[11px]', active ? 'text-revos-text' : 'text-revos-text-dim')}>{label_}</span>
              {s !== 'results' && <span className="text-revos-border text-xs ml-0.5">›</span>}
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
