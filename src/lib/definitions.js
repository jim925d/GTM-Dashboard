/**
 * Hover-tooltip definitions for every metric, section, and label in RevOS.
 * Keys are uppercase label text (matching what appears in the UI).
 */

export const DEFS = {
  // ── Priority page ──
  'PRIORITY FILTERS': 'Toggle filters to narrow the priority list. Multiple filters combine (AND logic) — only accounts matching ALL active filters are shown.',
  'PRIORITY RANKING': 'Accounts ranked by composite priority score (0-100). Score factors: active deals, engagement recency, open needs, win probability, on-net presence, ARR size, and risk level.',
  'ACCOUNTS': 'Number of accounts matching current filters out of total in the filtered set.',
  'TOTAL PIPELINE': 'Sum of monthly pipeline MRR across all accounts in the current filtered view.',
  'GONE DARK': 'Accounts with no engagement activity in 60+ days. High churn risk.',
  'HIGH PROBABILITY': 'Accounts with at least one deal where the Bayesian model predicts >60% win probability.',

  // ── Overview stats ──
  'TOTAL ARR': 'Annual Recurring Revenue from the Total BRR field in customers.csv. Represents the customer\'s current contracted annual spend.',
  'PIPELINE': 'Sum of MRR across all active (open) deals in the sales funnel. Count shows number of open opportunities.',
  'WIN RATE': 'Historical win rate = Won / (Won + Lost). Calculated from all closed deals (funnel + close_lost). W/L shows raw counts.',
  'LOST MRR': 'Total Monthly Recurring Revenue lost from closed-lost deals. Includes competitive losses and no-decisions.',
  'NRR': 'Net Revenue Retention = (Current MRR + Expansion - Contraction - Churn) / Starting MRR. ≥100% means account is growing; <90% is high risk.',
  'RISK': 'Composite risk score (0-100) derived from: days silent, loss count, disconnects, downgrades, NRR, stalled velocity, and rep churn. Higher = more at-risk.',

  // ── Overview sections ──
  'PIPELINE BY STAGE': 'Active pipeline deals grouped by sales stage (Discover → Design → Propose → Negotiate). Bar height shows relative MRR by stage.',
  'RISK SIGNALS': 'Automated flags based on account health thresholds: silence >90d, losses >2, disconnects, downgrades, stalled velocity, rep turnover, low NRR.',
  'ENGAGEMENT TIMELINE': 'Rolling engagement feed with email subjects, calls, meetings, and demos. Bar chart shows monthly volume. Color-coded by type: green=call, blue=email, purple=meeting, pink=demo.',
  'PRODUCT MIX': 'Revenue distribution across product groups from installed services. Shows MRR per product and percentage of total account revenue.',
  'TOTAL': 'Total number of engagement activities (calls, emails, meetings, demos, social touches, texts, notes) across 2025 + 2026 YTD.',
  'CONTACTS': 'Number of unique customer contacts engaged. Higher count = better multi-threading and lower single-point-of-failure risk.',
  'LAST ACTIVE': 'Date of the most recent engagement activity with this account.',

  // ── Predictions ──
  'PREDICTION SUMMARY': 'Bayesian prediction overview combining historical win rate, current pipeline, and engagement signals to forecast deal outcomes and churn risk.',
  'CALIBRATION STATUS': 'Model has been tuned using backtest data. Win LR and Churn LR multipliers adjust the Bayesian likelihood ratios based on how well past predictions matched actual outcomes. Values >1 mean the model was under-predicting; <1 means it was over-predicting.',
  'DEAL PREDICTIONS': 'Per-deal win probability using Bayesian updating: Prior (historical win rate) × Stage LR × Engagement LR × Health LR = Posterior probability.',
  'CHURN RISK INDICATORS': 'Churn probability signals using Bayesian log-odds. Base rate: 15%. Updated by engagement recency, intensity, breadth, historical churn, disconnects, and NRR.',
  'HISTORICAL WINS': 'Total number of deals with stage "Closed Won" across all historical records for this account.',
  'CHURN EVENTS': 'Count of negative re-rate (closed-won with negative MRR) deals. These represent contracted revenue reductions or service downgrades.',

  // ── Locations ──
  'TOTAL LOCATIONS': 'Number of unique locations (deduplicated by address) associated with this account from the locations dataset.',
  'LOCATION MRR': 'Sum of attributed Monthly Recurring Revenue across all account locations.',
  'ON-NET': 'Locations connected to Zayo\'s fiber network. These are active, serviceable sites with existing infrastructure.',
  'NEAR-NET': 'Locations within close proximity to Zayo\'s network. Lower cost to connect than off-net; strong expansion targets.',
  'OFF-NET': 'Locations not currently near Zayo\'s network. May require significant build-out to serve.',
  'LOCATION MAP': 'Geographic distribution of account locations. Green = on-net, yellow = near-net, red = off-net. Marker size scales with location MRR.',
  'TYPE': 'Building type classification (e.g., Office, Data Center, Multi Tenant, Single Tenant).',
  'MARKET': 'Zayo market region where this location is situated.',
  'CLASS': 'Building classification tier (e.g., Class A, Class B) indicating building quality and infrastructure.',
  'DISTANCE FROM NETWORK': 'Feet from Zayo\'s nearest network point of presence. Lower = easier/cheaper to connect.',

  // ── Deals ──
  'CURRENT FUNNEL': 'Active pipeline deals currently in progress. These are open opportunities that have not yet been won or lost.',
  'HISTORICALS': 'All closed deals (won and lost) from historical records. Includes new service, re-rates, renewals, and churned deals.',
  'PRODUCT': 'Product group or service category (e.g., Dark Fiber, Wavelengths, IP, Ethernet, Colocation).',
  'MRR': 'Monthly Recurring Revenue — the contracted monthly payment for this deal or service.',
  'STAGE': 'Current sales stage: Discover (early), Design (scoping), Propose (quoted), Negotiate (final), Closed Won, or Closed Lost.',
  'FORECAST': 'Forecast category assigned by the rep: Commit, Best Case, Pipeline, or Omit. Indicates confidence level.',
  'CLOSE DATE': 'Expected or actual close date for this opportunity.',
  'REP': 'Sales representative assigned to this deal.',
  'TOTAL DEALS': 'Total number of historical deals (both won and lost) for this account.',
  'NET MRR': 'Net MRR change from all historical deals: sum of won deal MRR minus lost deal MRR.',
  'WON': 'Deals with stage "Closed Won". Includes new service, upgrades, re-rates, and renewals.',
  'LOST / CHURN': 'Deals either "Closed Lost" (competitive loss / no decision) or won with negative MRR (churn/downgrade).',

  // ── Losses ──
  'CLOSE-LOST MRR': 'Total MRR from deals that were Closed Lost — opportunities the account chose not to proceed with.',
  'CHURN / RE-RATES': 'Negative re-rate deals (Closed Won with negative MRR). Revenue contractions from service downgrades or partial disconnects.',
  'DISCONNECTS': 'Services with status "Disconnected" in the installed base. Each disconnect represents a fully terminated service.',
  'DOWNGRADES': 'Services that were re-rated to a lower MRR. Partial revenue loss without full disconnect.',
  'LOSSES BY PRODUCT': 'Lost revenue broken down by product group. Shows which products are most vulnerable to churn.',
  'CLOSE-LOST DEALS': 'Individual deals that were Closed Lost, with product, MRR, date, loss type, and assigned rep.',
  'DISCONNECTED SERVICES': 'Services from the installed base that have been fully disconnected, with product, MRR, and disconnect date.',
  'CHURN / NEGATIVE RE-RATES': 'Historical deals that were technically "won" but represent revenue loss (negative MRR). Includes downgrades and partial service removals.',

  // ── Backtest ──
  'AVG ACCURACY': 'Mean prediction accuracy across all backtested quarters. Compares predicted outcomes (win/loss/churn) against actual results.',
  'OUTCOME HIT': 'Percentage of individual deal outcomes correctly predicted in backtesting (predicted win that actually won, etc.).',
  'QUARTERS TESTED': 'Number of historical quarters used in backtesting validation.',
  'AI PREDICTED': 'What the model predicted would happen in each backtested quarter based on signals available at prediction time.',
  'ACTUAL': 'What actually happened — real deal outcomes (won/lost/churn) and revenue impact in each quarter.',

  // ── Learning ──
  'ACCURACY vs. TRAINING DATA VOLUME': 'Shows how model accuracy improves as more historical deals are added to training. The 80% line marks the minimum viable accuracy threshold.',
  'MIN VIABLE DATASET': 'Minimum number of historical deals needed before predictions become reliably accurate (>80% threshold).',
  'PEAK ACCURACY': 'Highest accuracy achieved with the current training data volume.',
  'TREND': 'Whether accuracy is still improving (↗), plateauing (→), or declining with additional data.',
  'DATA EFFICIENCY ANALYSIS': 'Analysis of how efficiently the model learns from historical data and where diminishing returns begin.',

  // ── Signals ──
  'COMPANY INTELLIGENCE': 'External market signals and company intelligence data that may impact account strategy or deal outcomes.',
  'SIGNALS DETECTED': 'Number of external signals identified for this account (news, hiring, funding, M&A, technology changes).',

  // ── App-level ──
  'MANAGER': 'Filter accounts by their assigned Sales Funnel Manager. Shows only accounts managed by the selected person.',

  // ── Forecast Dashboard ──
  'TOTAL MRR': 'Total positive MRR in the funnel where close date falls within the selected period. Premier channel only. Sourced from funnel.csv.',
  'YTD BOOKINGS': 'Year-to-date sum of positive MRR where forecast category = Closed and close date is in the current year. Not annualized.',
  'MTD BOOKINGS': 'Month-to-date sum of positive MRR where forecast category = Closed and close date is in the current month. Not annualized.',
  'QTD BOOKINGS': 'Quarter-to-date sum of positive MRR where forecast category = Closed and close date is in the current quarter. Not annualized.',
  'WEIGHTED PIPELINE': 'SUM(Deal MRR × Stage Win Probability × 12). Probability-adjusted ARR from current pipeline.',
  'ACTIVE DEALS': 'Current non-closed deals with positive MRR in the pipeline. Premier channel only.',
  'WEIGHTED PIPELINE SUMMARY': 'Probability-adjusted pipeline ARR. Each deal\'s MRR is multiplied by its stage win probability and annualized (×12).',
  'PIPELINE BY FORECAST CATEGORY': 'Active pipeline deals grouped by forecast category: Closed, Commit, Best Case, Longshot, Not In Forecast. Shows deal count and MRR per category.',
  'MONTHLY CHURN TREND (ARR)': 'Monthly churn ARR from deals with negative MRR. Shows revenue contraction trend over time. Premier channel only.',
  'CHURN BY PRODUCT/TYPE': 'Churn ARR broken down by product group. Identifies which products are most vulnerable to revenue loss.',
  'AT-RISK ARR': 'Total ARR from accounts with a risk score ≥ 30. These accounts show warning signs of potential churn.',
  'AVG CHURN DEAL': 'Average ARR per churn deal. Calculated as total churn ARR ÷ number of churn deals.',
  'CHURN RATE': 'Percentage of accounts classified as at-risk (risk score ≥ 30) out of total accounts.',
  'PRODUCT BY PIPELINE (ARR)': 'Active pipeline ARR broken down by product group. Shows which products have the most open pipeline value.',
  'BOOKINGS BY PRODUCT (ARR)': 'Closed-won bookings ARR broken down by product group. Shows which products are generating the most revenue.',
  'ACCOUNT HEALTH': 'Distribution of accounts by health status: Healthy (risk < 30), Warning (30-49), Critical (≥ 50). Based on composite risk score.',
  'ACCOUNT VELOCITY': 'Distribution of accounts by deal velocity: Accelerating (deals moving faster), Stable, or Stalled (no progress).',
  'RAW PIPELINE ARR': 'Total raw ARR in active pipeline, positive MRR only (MRR × 12). Premier channel.',
  'WEIGHTED PIPELINE ARR': 'SUM(Deal MRR × Stage Win Probability × 12). The probability-adjusted view of the pipeline.',
  'MRR FORECAST': 'Pipeline MRR for the current period. Raw = total deal MRR. Forecast = MRR × stage win probability. Premier channel only.',
  'NET NEW MRR TREND': 'Net new MRR per quarter: bookings minus churn, annualized. Premier channel only.',
  'PIPELINE BY STAGE': 'Active pipeline deals grouped by sales stage (Discover → Design → Propose → Negotiate). Bar height shows relative MRR by stage.',

  // ── Seller Dashboard ──
  'MTD BOOKINGS (SELLER)': 'Month-to-date sum of positive MRR where forecast category = Closed, seller is the Opportunity Owner, and close date is in the current month. Not annualized.',
  'QTD BOOKINGS (SELLER)': 'Quarter-to-date sum of positive MRR where forecast category = Closed, seller is the Opportunity Owner, and close date is in the current quarter. Not annualized.',
  'YTD BOOKINGS (SELLER)': 'Year-to-date bookings from all closed-won deals where seller is the Opportunity Owner, with positive MRR.',
  'PIPELINE COVERAGE': 'Weighted pipeline ÷ remaining target. Uses stage win probabilities: Discover 30.6%, Design Solution 53.2%, Propose 66.2%, Negotiate 84.7%, Verbal Agreement 92.5%.',
  'BOOK OF BUSINESS': 'Total ARR across all accounts owned by this seller.',
  'PIPELINE MRR': 'Total raw MRR across all active deals in the seller\'s pipeline.',
  'PROB-ADJUSTED PIPELINE': 'SUM(Deal MRR × Stage Win Probability × 12). Weights each deal by its likelihood to close.',
  'TARGET REMAINING': 'Remaining target for the current period after subtracting bookings already closed.',
  'CLOSING IN 30D': 'Number of active deals with a close date within the next 30 days.',
  'STALLED': 'Deals with no next step or no recent activity. These may need attention to move forward.',
  'PIPELINE BY STAGE (PROBABILITY-WEIGHTED)': 'Each deal\'s MRR multiplied by its stage win probability. Discover 30.57%, Design Solution 53.21%, Propose 66.23%, Negotiate 84.67%, Verbal Agreement 92.49%, Closed 100%.',
  'MRR TRAJECTORY + FORECAST': 'Cumulative MRR from closed-won bookings (solid line) with 3-month forecast projection using stage win probability weighting (dashed line).',
  'STAGE WIN PROBABILITIES': 'Stage win probabilities from validated 2026 funnel model historical win rates.',
  'BOOKINGS BY TYPE': 'Bookings broken down by deal type: New Logo, Expansion, Renewal, Other.',
  'MONTHLY BOOKINGS': 'Monthly bookings for the current quarter from closed-won deals.',
  'YTD LOSSES': 'Deals lost year-to-date by this seller. Includes competitive losses, no-decisions, and churn.',
  'ANNUAL ATTAINMENT': 'Year-to-date bookings as a percentage of annual quota.',
  'ATTAINMENT': 'Period bookings as a percentage of the period target/quota.',
  'AVG DEAL SIZE': 'Average ARR per closed-won deal. Total bookings ARR ÷ number of closed deals.',
  'PIPELINE GENERATED': 'Total ARR in active pipeline deals. Represents future revenue opportunity.',
  'ACTIVE ACCOUNTS': 'Number of accounts with at least one active deal in the pipeline.',

  // ── Account Card MiniStats ──
  'DEALS': 'Total number of deals for this customer across all sales stages, including active pipeline and historical (won/lost).',
  'LAST ENG': 'Days since the most recent engagement activity with this account. Lower is better.',
}
