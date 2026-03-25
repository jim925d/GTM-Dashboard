"""
Data loader for RevOS Prediction Engine.
Loads deal data from CSV/JSON files in frontend/data/.
"""
import pandas as pd
import numpy as np
import json
from pathlib import Path
from datetime import datetime


class DataLoader:
    def __init__(self):
        self.deals = None
        self.accounts = None
        self.raw_data = {}
        self.engagement_features = {}   # account_name -> engagement stats
        self.services_features = {}     # account_name -> services stats

    def _read_csv(self, path):
        """Read CSV with encoding fallback."""
        for enc in ['utf-8', 'latin-1', 'cp1252']:
            try:
                return pd.read_csv(path, encoding=enc)
            except (UnicodeDecodeError, UnicodeError):
                continue
        return pd.read_csv(path, encoding='latin-1')

    def _read_json(self, path):
        """Read JSON file."""
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def load_from_csv(self, data_dir: str):
        """Load deal data from CSV/JSON files in the given directory."""
        data_path = Path(data_dir)

        # Load funnel (active pipeline + closed deals)
        funnel_path = data_path / "funnel.csv"
        if funnel_path.exists():
            self.raw_data['funnel'] = self._read_csv(funnel_path)

        # Load close_lost
        close_lost_path = data_path / "close_lost.csv"
        if close_lost_path.exists():
            self.raw_data['close_lost'] = self._read_csv(close_lost_path)

        # Load historical deals (CSV — same format as funnel)
        hist_path = data_path / "historical.csv"
        if hist_path.exists():
            self.raw_data['historical'] = self._read_csv(hist_path)

        # Load customers
        customers_path = data_path / "customers.csv"
        if customers_path.exists():
            self.raw_data['customers'] = self._read_csv(customers_path)

        # Load services
        services_path = data_path / "services.csv"
        if services_path.exists():
            self._load_services(self._read_csv(services_path))

        # Load engagement JSONs
        for eng_file in ['engagements.json', 'engagements_2026.json']:
            eng_path = data_path / eng_file
            if eng_path.exists():
                self._load_engagement_json(self._read_json(eng_path))

        # Build unified deal dataset
        self._build_deals()
        return len(self.deals) if self.deals is not None else 0

    def load_from_json(self, deals_data: list):
        """Load deal data from JSON payload."""
        self.deals = pd.DataFrame(deals_data)
        self._normalize_columns()
        return len(self.deals)

    def _load_services(self, df):
        """Extract per-account service features."""
        # Normalize column names
        col_map = {col: col.strip().lower().replace(' ', '_') for col in df.columns}
        df = df.rename(columns=col_map)

        # Find the account and MRR columns
        acct_col = None
        for c in df.columns:
            if 'customer_account' in c:
                acct_col = c
                break
        if acct_col is None:
            return

        mrr_col = None
        for c in df.columns:
            if 'mrr' in c and 'currency' not in c:
                mrr_col = c
                break

        disconnect_col = None
        for c in df.columns:
            if 'disconnect' in c:
                disconnect_col = c
                break

        for acct, grp in df.groupby(acct_col):
            if not acct or pd.isna(acct):
                continue
            acct_name = str(acct).strip()

            # Parse MRR — strip currency symbols
            mrr_values = []
            if mrr_col:
                for v in grp[mrr_col]:
                    if pd.isna(v):
                        mrr_values.append(0)
                    else:
                        cleaned = str(v).replace('$', '').replace(',', '').replace('(', '-').replace(')', '').strip()
                        try:
                            mrr_values.append(float(cleaned))
                        except ValueError:
                            mrr_values.append(0)

            active_count = len(grp)
            disconnected = 0
            if disconnect_col:
                disconnected = grp[disconnect_col].notna().sum()
                active_count = len(grp) - disconnected

            self.services_features[acct_name] = {
                'total_services': len(grp),
                'active_services': int(active_count),
                'disconnected_services': int(disconnected),
                'total_service_mrr': sum(mrr_values),
                'product_groups': grp['product_group'].nunique() if 'product_group' in grp.columns else 0,
            }

    def _load_engagement_json(self, data):
        """Extract per-account engagement features from JSON."""
        for acct_name, info in data.items():
            if acct_name in self.engagement_features:
                # Merge — add counts
                existing = self.engagement_features[acct_name]
                existing['total_engagements'] += info.get('t', 0)
                tp = info.get('tp', {})
                existing['calls'] += tp.get('call', 0)
                existing['emails'] += tp.get('email', 0)
                existing['meetings'] += tp.get('meeting', 0)
                existing['contacts'] = max(existing['contacts'], info.get('c', 0))
                # Keep most recent last_engagement
                new_last = info.get('l', '')
                if new_last > existing.get('last_engagement', ''):
                    existing['last_engagement'] = new_last
            else:
                tp = info.get('tp', {})
                self.engagement_features[acct_name] = {
                    'total_engagements': info.get('t', 0),
                    'calls': tp.get('call', 0),
                    'emails': tp.get('email', 0),
                    'meetings': tp.get('meeting', 0),
                    'contacts': info.get('c', 0),
                    'reps_engaged': info.get('r', 0),
                    'last_engagement': info.get('l', ''),
                }

    @staticmethod
    def _dedup_columns(df):
        """Drop duplicate columns (e.g. Opportunity_Id vs Opportunity ID)."""
        seen = {}
        to_drop = []
        for i, col in enumerate(df.columns):
            clean = col.strip().lower().replace(' ', '_')
            if clean in seen:
                to_drop.append(i)
            else:
                seen[clean] = i
        if to_drop:
            df = df.iloc[:, [i for i in range(len(df.columns)) if i not in to_drop]]
        return df

    def _build_deals(self):
        """Combine funnel, close_lost, and historical into unified deal dataset."""
        frames = []

        if 'funnel' in self.raw_data:
            df = self._dedup_columns(self.raw_data['funnel'].copy())
            df['source'] = 'funnel'
            frames.append(df)

        if 'close_lost' in self.raw_data:
            df = self._dedup_columns(self.raw_data['close_lost'].copy())
            df['source'] = 'close_lost'
            frames.append(df)

        if 'historical' in self.raw_data:
            df = self._dedup_columns(self.raw_data['historical'].copy())
            df['source'] = 'historical'
            frames.append(df)

        if frames:
            self.deals = pd.concat(frames, ignore_index=True)
            self._normalize_columns()
            self._attach_engagement_features()
            self._attach_services_features()
        else:
            self.deals = pd.DataFrame()

    def _normalize_columns(self):
        """Normalize column names and types."""
        if self.deals is None or self.deals.empty:
            return

        # Standardize column names
        col_map = {}
        for col in self.deals.columns:
            clean = col.strip().lower().replace(' ', '_')
            col_map[col] = clean
        self.deals.rename(columns=col_map, inplace=True)

        # Map real column names to standard names
        rename_map = {}
        for col in self.deals.columns:
            if col == 'total_mrr_&_mar_(converted)' or (col.startswith('total_mrr') and 'currency' not in col):
                rename_map[col] = 'mrr'
            elif col == 'opportunity_owner':
                rename_map[col] = 'rep'
            elif col == 'opportunity_id' and 'opportunity_id' not in rename_map.values():
                rename_map[col] = 'opportunity_id'
            elif col == 'opportunity__id' or col == 'opportunity_id':
                pass  # already handled or will be handled
        self.deals.rename(columns=rename_map, inplace=True)

        # Handle Opportunity_Id vs Opportunity ID (both exist in funnel.csv)
        if 'opportunity_id' not in self.deals.columns:
            for col in self.deals.columns:
                if 'opportunity' in col and 'id' in col and 'owner' not in col:
                    self.deals.rename(columns={col: 'opportunity_id'}, inplace=True)
                    break

        # Ensure key columns exist
        for col in ['mrr', 'stage', 'close_date', 'customer_account', 'product_group', 'rep', 'opportunity_id']:
            if col not in self.deals.columns:
                self.deals[col] = None

        # Parse MRR — handle currency strings like "$1,234.00 USD"
        self.deals['mrr'] = self.deals['mrr'].apply(self._parse_currency)

        # Parse dates
        self.deals['close_date'] = pd.to_datetime(self.deals['close_date'], errors='coerce')
        if 'created_date' in self.deals.columns:
            self.deals['created_date'] = pd.to_datetime(self.deals['created_date'], errors='coerce')

        # Normalize stage
        self.deals['stage_normalized'] = self.deals['stage'].apply(self._normalize_stage)

        # Outcome label
        self.deals['won'] = self.deals['stage_normalized'].apply(
            lambda s: 1 if s == 'closed_won' else (0 if s == 'closed_lost' else None)
        )

    @staticmethod
    def _parse_currency(val):
        """Parse currency string like '$1,234.56 USD' or plain number."""
        if pd.isna(val):
            return 0.0
        if isinstance(val, (int, float)):
            return float(val)
        s = str(val).strip()
        # Remove currency code, symbols, commas
        for remove in ['USD', 'usd', '$', ',', '(', ')']:
            s = s.replace(remove, '')
        s = s.strip()
        try:
            return float(s)
        except ValueError:
            return 0.0

    @staticmethod
    def _normalize_stage(stage):
        if not stage or pd.isna(stage):
            return 'unknown'
        s = str(stage).lower().strip()
        if 'accepted' in s or 'closed won' in s or 'closed-won' in s or s.startswith('5'):
            return 'closed_won'
        if 'closed lost' in s or 'close lost' in s:
            return 'closed_lost'
        if 'discover' in s or s.startswith('1'):
            return 'discover'
        if 'design' in s or s.startswith('2'):
            return 'design_solution'
        if 'propose' in s or s.startswith('3'):
            return 'propose'
        if 'negotiate' in s or s.startswith('4'):
            return 'negotiate'
        if 'verbal' in s:
            return 'verbal_agreement'
        return s

    def _attach_engagement_features(self):
        """Add engagement features to deals by matching on customer_account."""
        if not self.engagement_features or 'customer_account' not in self.deals.columns:
            return

        eng_cols = ['eng_total', 'eng_calls', 'eng_emails', 'eng_meetings', 'eng_contacts', 'eng_months_since_last']
        for col in eng_cols:
            self.deals[col] = 0.0

        now_month = datetime.now().strftime('%Y-%m')
        for idx, row in self.deals.iterrows():
            acct = row.get('customer_account')
            if not acct or pd.isna(acct):
                continue
            acct_name = str(acct).strip()
            eng = self.engagement_features.get(acct_name)
            if eng:
                self.deals.at[idx, 'eng_total'] = eng['total_engagements']
                self.deals.at[idx, 'eng_calls'] = eng['calls']
                self.deals.at[idx, 'eng_emails'] = eng['emails']
                self.deals.at[idx, 'eng_meetings'] = eng['meetings']
                self.deals.at[idx, 'eng_contacts'] = eng['contacts']
                last = eng.get('last_engagement', '')
                if last:
                    try:
                        last_dt = datetime.strptime(last, '%Y-%m')
                        months_since = (datetime.now().year - last_dt.year) * 12 + (datetime.now().month - last_dt.month)
                        self.deals.at[idx, 'eng_months_since_last'] = max(0, months_since)
                    except ValueError:
                        pass

    def _attach_services_features(self):
        """Add services features to deals by matching on customer_account."""
        if not self.services_features or 'customer_account' not in self.deals.columns:
            return

        svc_cols = ['svc_total', 'svc_active', 'svc_disconnected', 'svc_mrr', 'svc_product_groups']
        for col in svc_cols:
            self.deals[col] = 0.0

        for idx, row in self.deals.iterrows():
            acct = row.get('customer_account')
            if not acct or pd.isna(acct):
                continue
            acct_name = str(acct).strip()
            svc = self.services_features.get(acct_name)
            if svc:
                self.deals.at[idx, 'svc_total'] = svc['total_services']
                self.deals.at[idx, 'svc_active'] = svc['active_services']
                self.deals.at[idx, 'svc_disconnected'] = svc['disconnected_services']
                self.deals.at[idx, 'svc_mrr'] = svc['total_service_mrr']
                self.deals.at[idx, 'svc_product_groups'] = svc['product_groups']

    def get_training_data(self):
        """Get deals with known outcomes for training."""
        if self.deals is None:
            return pd.DataFrame()
        return self.deals[self.deals['won'].notna()].copy()

    def get_active_deals(self):
        """Get currently active pipeline deals."""
        if self.deals is None:
            return pd.DataFrame()
        return self.deals[self.deals['won'].isna()].copy()

    def get_deal_count(self):
        return len(self.deals) if self.deals is not None else 0
