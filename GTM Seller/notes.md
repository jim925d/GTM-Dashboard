From App.jsx:

State variable: const [mode, setMode] = useState(null) — values are null (landing), 'gtm', 'seller', 'forecast', 'engine', 'backtest', 'locations'

Pages rendered via if-blocks:


if (mode === 'seller') { return <div>...<RepDashboard accounts={...} rawData={...} />...</div> }
if (mode === 'forecast') { return ... }
if (mode === 'engine') { return ... }
if (mode === 'backtest') { return ... }
if (mode === 'locations') { return ... }
Each mode block wraps its page component in a full-screen layout with a header bar + Back button.

Nav: No dedicated nav array — the landing page has hardcoded card blocks that call setMode('seller'), setMode('forecast'), etc.

From RepDashboard.jsx:

Imports from shared:

Badge from ../components/shared/Badge
Stat from ../components/shared/Stat
ProbBar from ../components/shared/ProbBar
Tip from ../components/shared/Tip
chartTheme, $, $k, pc from ../components/shared/ChartTheme
Also imports T, FONT_MONO, FONT_SANS, RADIUS, CARD_SHADOW, STAGE_COLORS, STAGE_WIN_PROB, STAGE_ORDER, stageProb from ../lib/constants
Data loading: Receives data via props — export default function RepDashboard({ accounts, rawData }). Also does direct fetch() calls for signals (/local-data/file?name=revos-signals.json) and AI refresh (/api/engine/refresh-signals).

From vite.config.js:

publicDir is NOT set — it uses the Vite default (public/). No custom public directory configured. The config only sets plugins, server.port (5173), and server.proxy (/api/engine → localhost:8001).