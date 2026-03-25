"""
RevOS Data Loader
Ingests CSV/Excel exports and normalizes into engine-ready DataFrames.
Handles column name variants from Salesforce, HubSpot, and custom exports.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Optional
import logging
import json

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Column alias maps – extend these as new CRM variants are encountered
# ---------------------------------------------------------------------------

OPPORTUNITY_ALIASES = {
    # opportunity_id
    "Id": "opportunity_id", "OpportunityId": "opportunity_id",
    "Opportunity ID": "opportunity_id", "Deal ID": "opportunity_id",
    "dealid": "opportunity_id", "hs_object_id": "opportunity_id",
    "Opp ID": "opportunity_id",
    # opportunity_name
    "Name": "opportunity_name", "Opportunity Name": "opportunity_name",
    "Opp Name": "opportunity_name", "Deal Name": "opportunity_name",
    "dealname": "opportunity_name", "Deal": "opportunity_name",
    # account_name
    "Account.Name": "account_name", "AccountName": "account_name",
    "Account Name": "account_name", "Company": "account_name",
    "company": "account_name", "Account": "account_name",
    "Customer Name": "account_name", "Customer": "account_name",
    # stage
    "StageName": "stage", "Stage Name": "stage", "dealstage": "stage",
    "Pipeline Stage": "stage", "Sales Stage": "stage", "Phase": "stage",
    "Stage": "stage",
    # amount
    "Amount": "amount", "Deal Amount": "amount", "Value": "amount",
    "amount": "amount", "Total": "amount", "Price": "amount",
    "Contract Value": "amount", "MRR": "mrr", "TCV": "tcv",
    "Monthly Revenue": "mrr", "Total Contract Value": "tcv",
    # close_date
    "CloseDate": "close_date", "Close Date": "close_date",
    "closedate": "close_date", "Expected Close": "close_date",
    "Closed Date": "close_date",
    # probability
    "Probability": "probability", "Win Probability": "probability",
    "probability": "probability", "Forecast %": "probability",
    # product_type
    "Product": "product_type", "Product Type": "product_type",
    "Service Type": "product_type", "Type": "product_type",
    "Product Family": "product_type", "Product Line": "product_type",
    # rep
    "Owner.Name": "rep_name", "Owner Name": "rep_name",
    "Account Owner": "rep_name", "Rep": "rep_name",
    "Sales Rep": "rep_name", "Assigned To": "rep_name",
    "OwnerName": "rep_name",
    # territory
    "Territory": "territory", "Sales Territory": "territory",
    "Region": "territory", "Market": "territory", "Geo": "territory",
    # dates
    "CreatedDate": "created_date", "Created Date": "created_date",
    "createdate": "created_date", "Create Date": "created_date",
    "LastModifiedDate": "last_modified_date",
    "Last Modified": "last_modified_date",
    "LastActivityDate": "last_activity_date",
    "Last Activity Date": "last_activity_date",
    # status indicators
    "IsClosed": "is_closed", "IsWon": "is_won",
    "Status": "status", "Deal Status": "status", "Outcome": "status",
    # loss info
    "Loss Reason": "loss_reason", "Close Lost Reason": "loss_reason",
    "Reason Lost": "loss_reason", "Why Lost": "loss_reason",
    "Competitor": "competitor", "Lost To": "competitor",
    # misc
    "LeadSource": "lead_source", "Lead Source": "lead_source",
    "ForecastCategory": "forecast_category",
    "Forecast Category": "forecast_category",
    "NextStep": "next_step", "Next Step": "next_step",
    "Description": "description", "Notes": "description",
    "NumberOfLocations": "num_locations", "Locations": "num_locations",
    # stage tracking
    "last_active_stage": "last_active_stage",
    "Last Active Stage": "last_active_stage",
    "Stage At Loss": "last_active_stage",
    "Stage at Close": "last_active_stage",
}

QUOTE_ALIASES = {
    "Quote ID": "quote_id", "QuoteId": "quote_id", "Quote #": "quote_id",
    "Quote Number": "quote_id",
    "Opportunity ID": "opportunity_id", "OpportunityId": "opportunity_id",
    "Deal ID": "opportunity_id",
    "Amount": "quote_amount", "Quote Amount": "quote_amount",
    "Price": "quote_amount", "Quoted Price": "quote_amount",
    "Discount": "discount_pct", "Discount %": "discount_pct",
    "Discount Percent": "discount_pct",
    "Term": "term_months", "Term Length": "term_months",
    "Contract Term": "term_months", "Term (Months)": "term_months",
    "Escalator": "annual_escalator", "Annual Escalator": "annual_escalator",
    "Annual Increase": "annual_escalator",
    "Product": "product_type", "Service": "product_type",
    "Created Date": "created_date", "CreatedDate": "created_date",
    "Quote Date": "created_date", "Date": "created_date",
    "Revision": "revision_number", "Version": "revision_number",
}

SERVICE_ALIASES = {
    "Service ID": "service_id", "Circuit ID": "service_id",
    "SKU": "service_id",
    "Account ID": "customer_id", "AccountId": "customer_id",
    "Customer ID": "customer_id",
    "Service Type": "service_type", "Product": "service_type",
    "Product Type": "service_type", "Type": "service_type",
    "MRR": "mrr", "Monthly Revenue": "mrr", "Monthly": "mrr",
    "TCV": "tcv", "Total Contract Value": "tcv",
    "Bandwidth": "bandwidth", "Speed": "bandwidth",
    "Location": "location", "Address": "location",
    "Service Address": "location",
    "Install Date": "install_date", "Activation Date": "install_date",
    "Start Date": "install_date",
    "Contract End": "contract_end", "End Date": "contract_end",
    "Renewal Date": "contract_end",
    "Status": "status",
}

# ---------------------------------------------------------------------------
# Stage normalization
# ---------------------------------------------------------------------------

STAGE_MAP = {
    # → Discover
    "discovery": "Discover", "qualification": "Discover",
    "needs analysis": "Discover", "prospecting": "Discover",
    "initial contact": "Discover", "qual": "Discover",
    "qualifiedtobuy": "Discover", "appointmentscheduled": "Discover",
    "mql": "Discover", "sql": "Discover", "first meeting": "Discover",
    "discover": "Discover",
    # → Propose
    "proposal": "Propose", "proposal/price quote": "Propose",
    "value proposition": "Propose", "rfp": "Propose",
    "quote sent": "Propose", "demo": "Propose", "pricing": "Propose",
    "presentationscheduled": "Propose",
    "decisionmakerboughtin": "Propose", "propose": "Propose",
    # → Negotiate
    "negotiation": "Negotiate", "negotiation/review": "Negotiate",
    "contracting": "Negotiate", "legal review": "Negotiate",
    "redline": "Negotiate", "procurement": "Negotiate",
    "contractsent": "Negotiate", "negotiate": "Negotiate",
    # → Verbal Agreement
    "verbal": "Verbal Agreement", "verbal commitment": "Verbal Agreement",
    "verbal agreement": "Verbal Agreement", "pending": "Verbal Agreement",
    "commit": "Verbal Agreement", "po received": "Verbal Agreement",
    "awaiting signature": "Verbal Agreement",
    # → Closed Won
    "closed won": "Closed Won", "closed-won": "Closed Won",
    "closedwon": "Closed Won", "won": "Closed Won",
    "booked": "Closed Won", "signed": "Closed Won",
    # → Closed Lost
    "closed lost": "Closed Lost", "closed-lost": "Closed Lost",
    "closedlost": "Closed Lost", "lost": "Closed Lost",
    "dead": "Closed Lost", "cancelled": "Closed Lost",
    "no decision": "Closed Lost",
}

STAGE_ORDER = ["Discover", "Propose", "Negotiate", "Verbal Agreement",
               "Closed Won", "Closed Lost"]

# ---------------------------------------------------------------------------
# Product type normalization
# ---------------------------------------------------------------------------

PRODUCT_MAP = {
    "metro fiber": "Fiber", "lit building": "Fiber", "dark fiber": "Fiber",
    "gpon": "Fiber", "fiber 1g": "Fiber", "fiber 10g": "Fiber",
    "metro ethernet": "Fiber", "ethernet": "Fiber", "wavelength": "Fiber",
    "fiber": "Fiber",
    "copper": "Copper", "t1": "Copper", "ds3": "Copper", "pri": "Copper",
    "pots": "Copper", "tdm": "Copper", "legacy": "Copper",
    "sd-wan": "SD-WAN", "sdwan": "SD-WAN", "managed sd-wan": "SD-WAN",
    "sd-wan enterprise": "SD-WAN",
    "ucaas": "UCaaS", "unified communications": "UCaaS", "voip": "UCaaS",
    "hosted voice": "UCaaS", "cloud pbx": "UCaaS", "sip": "UCaaS",
    "sip trunking": "UCaaS",
    "managed services": "Managed Services", "msp": "Managed Services",
    "managed network": "Managed Services",
    "security": "Security", "sase": "Security", "ddos": "Security",
    "firewall": "Security", "managed security": "Security",
    "ztna": "Security",
    "cloud": "Cloud", "iaas": "Cloud", "colocation": "Cloud",
    "colo": "Cloud", "hosting": "Cloud",
}


# ---------------------------------------------------------------------------
# Core loader
# ---------------------------------------------------------------------------

class DataLoader:
    """Load and normalize CRM data exports for the RevOS engine."""

    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.opportunities: Optional[pd.DataFrame] = None
        self.quotes: Optional[pd.DataFrame] = None
        self.services: Optional[pd.DataFrame] = None
        self.customers: Optional[pd.DataFrame] = None
        self._load_stats = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load_all(self, files: dict[str, str] = None):
        """
        Load all data files. Accepts a dict mapping table names to file paths.
        Example: {"opportunities": "opps.csv", "quotes": "quotes.xlsx"}
        If files is None, auto-discover CSVs in self.data_dir.
        """
        if files is None:
            files = self._auto_discover()

        if "opportunities" in files:
            self.opportunities = self._load_opportunities(files["opportunities"])
        if "quotes" in files:
            self.quotes = self._load_quotes(files["quotes"])
        if "services" in files:
            self.services = self._load_services(files["services"])
        if "customers" in files:
            self.customers = self._load_customers(files["customers"])

        # If won/lost come as separate files, merge into opportunities
        if "won_deals" in files:
            won = self._load_opportunities(files["won_deals"])
            won["status"] = "won"
            self.opportunities = pd.concat(
                [self.opportunities, won], ignore_index=True
            ) if self.opportunities is not None else won
        if "close_lost" in files:
            lost = self._load_opportunities(files["close_lost"])
            lost["status"] = "lost"
            self.opportunities = pd.concat(
                [self.opportunities, lost], ignore_index=True
            ) if self.opportunities is not None else lost

        self._derive_features()
        self._log_summary()
        return self

    def get_won_deals(self) -> pd.DataFrame:
        if self.opportunities is None:
            return pd.DataFrame()
        return self.opportunities[
            self.opportunities["status"] == "won"
        ].copy()

    def get_lost_deals(self) -> pd.DataFrame:
        if self.opportunities is None:
            return pd.DataFrame()
        return self.opportunities[
            self.opportunities["status"] == "lost"
        ].copy()

    def get_open_deals(self) -> pd.DataFrame:
        if self.opportunities is None:
            return pd.DataFrame()
        return self.opportunities[
            self.opportunities["status"] == "open"
        ].copy()

    def get_closed_deals(self) -> pd.DataFrame:
        """All deals with known outcomes (won + lost) for training."""
        if self.opportunities is None:
            return pd.DataFrame()
        return self.opportunities[
            self.opportunities["status"].isin(["won", "lost"])
        ].copy()

    def summary(self) -> dict:
        return self._load_stats

    # ------------------------------------------------------------------
    # File loading
    # ------------------------------------------------------------------

    def _read_file(self, path: str) -> pd.DataFrame:
        p = Path(path)
        if not p.exists() and (self.data_dir / p).exists():
            p = self.data_dir / p
        if p.suffix in (".xlsx", ".xls"):
            return pd.read_excel(p)
        elif p.suffix == ".tsv":
            return pd.read_csv(p, sep="\t")
        else:
            return pd.read_csv(p)

    def _auto_discover(self) -> dict[str, str]:
        """Find CSV/Excel files in data_dir and guess table assignment."""
        files = {}
        if not self.data_dir.exists():
            logger.warning(f"Data directory {self.data_dir} not found")
            return files
        for f in self.data_dir.iterdir():
            if f.suffix not in (".csv", ".tsv", ".xlsx", ".xls"):
                continue
            name = f.stem.lower()
            if any(k in name for k in ("opp", "funnel", "pipeline", "deal")):
                files["opportunities"] = str(f)
            elif any(k in name for k in ("quote", "pricing")):
                files["quotes"] = str(f)
            elif any(k in name for k in ("service", "product", "circuit")):
                files["services"] = str(f)
            elif any(k in name for k in ("customer", "account", "company")):
                files["customers"] = str(f)
            elif "won" in name:
                files["won_deals"] = str(f)
            elif "lost" in name or "close_lost" in name:
                files["close_lost"] = str(f)
        logger.info(f"Auto-discovered files: {files}")
        return files

    # ------------------------------------------------------------------
    # Table-specific loading and normalization
    # ------------------------------------------------------------------

    def _load_opportunities(self, path: str) -> pd.DataFrame:
        df = self._read_file(path)
        df = self._apply_aliases(df, OPPORTUNITY_ALIASES)
        df = self._normalize_stages(df)
        df = self._normalize_products(df)
        df = self._normalize_dates(df, [
            "close_date", "created_date", "last_modified_date",
            "last_activity_date"
        ])
        df = self._normalize_amounts(df, ["amount", "mrr", "tcv"])
        df = self._normalize_probabilities(df)
        df = self._derive_status(df)
        self._load_stats["opportunities"] = {
            "rows": len(df), "file": path,
            "date_range": self._date_range(df, "created_date"),
        }
        return df

    def _load_quotes(self, path: str) -> pd.DataFrame:
        df = self._read_file(path)
        df = self._apply_aliases(df, QUOTE_ALIASES)
        df = self._normalize_products(df)
        df = self._normalize_dates(df, ["created_date"])
        df = self._normalize_amounts(df, ["quote_amount"])
        if "discount_pct" in df.columns:
            df["discount_pct"] = pd.to_numeric(
                df["discount_pct"].astype(str).str.replace("%", ""),
                errors="coerce"
            )
            # Normalize to 0-1 if on 0-100 scale
            if df["discount_pct"].max() > 1:
                df["discount_pct"] = df["discount_pct"] / 100.0
        self._load_stats["quotes"] = {"rows": len(df), "file": path}
        return df

    def _load_services(self, path: str) -> pd.DataFrame:
        df = self._read_file(path)
        df = self._apply_aliases(df, SERVICE_ALIASES)
        df = self._normalize_products(df, col="service_type")
        df = self._normalize_dates(df, ["install_date", "contract_end"])
        df = self._normalize_amounts(df, ["mrr", "tcv"])
        self._load_stats["services"] = {"rows": len(df), "file": path}
        return df

    def _load_customers(self, path: str) -> pd.DataFrame:
        df = self._read_file(path)
        df = self._apply_aliases(df, OPPORTUNITY_ALIASES)  # shares many aliases
        self._load_stats["customers"] = {"rows": len(df), "file": path}
        return df

    # ------------------------------------------------------------------
    # Normalization helpers
    # ------------------------------------------------------------------

    def _apply_aliases(self, df: pd.DataFrame,
                       aliases: dict) -> pd.DataFrame:
        rename_map = {}
        for col in df.columns:
            clean = col.strip()
            if clean in aliases:
                rename_map[col] = aliases[clean]
            elif clean.lower() in {k.lower(): v for k, v in aliases.items()}:
                lower_map = {k.lower(): v for k, v in aliases.items()}
                rename_map[col] = lower_map[clean.lower()]
        return df.rename(columns=rename_map)

    def _normalize_stages(self, df: pd.DataFrame) -> pd.DataFrame:
        if "stage" not in df.columns:
            return df
        df["stage_raw"] = df["stage"].copy()
        df["stage"] = (
            df["stage"].astype(str).str.strip().str.lower()
            .map(STAGE_MAP).fillna(df["stage"])
        )
        # Also normalize last_active_stage if present
        if "last_active_stage" in df.columns:
            df["last_active_stage"] = (
                df["last_active_stage"].astype(str).str.strip().str.lower()
                .map(STAGE_MAP).fillna(df["last_active_stage"])
            )
        unmapped = df[~df["stage"].isin(STAGE_ORDER)]["stage"].unique()
        if len(unmapped) > 0:
            logger.warning(f"Unmapped stages: {unmapped}")
        return df

    def _normalize_products(self, df: pd.DataFrame,
                            col: str = "product_type") -> pd.DataFrame:
        if col not in df.columns:
            return df
        df[f"{col}_raw"] = df[col].copy()
        df[col] = (
            df[col].astype(str).str.strip().str.lower()
            .map(PRODUCT_MAP).fillna(df[col])
        )
        return df

    def _normalize_dates(self, df: pd.DataFrame,
                         cols: list[str]) -> pd.DataFrame:
        for col in cols:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors="coerce",
                                         infer_datetime_format=True)
        return df

    def _normalize_amounts(self, df: pd.DataFrame,
                           cols: list[str]) -> pd.DataFrame:
        for col in cols:
            if col not in df.columns:
                continue
            s = df[col].astype(str)
            # Handle K/M suffixes
            multiplier = pd.Series(1.0, index=df.index)
            multiplier[s.str.upper().str.endswith("K")] = 1_000
            multiplier[s.str.upper().str.endswith("M")] = 1_000_000
            # Strip currency symbols and suffixes
            s = (s.str.replace(r"[\$,\s]", "", regex=True)
                   .str.replace(r"[KkMm]$", "", regex=True)
                   .str.replace(r"/mo$", "", regex=True))
            df[col] = pd.to_numeric(s, errors="coerce") * multiplier
        return df

    def _normalize_probabilities(self, df: pd.DataFrame) -> pd.DataFrame:
        if "probability" not in df.columns:
            return df
        df["probability"] = pd.to_numeric(df["probability"], errors="coerce")
        if df["probability"].max() > 1:
            df["probability"] = df["probability"] / 100.0
        return df

    def _derive_status(self, df: pd.DataFrame) -> pd.DataFrame:
        """Determine open/won/lost from various indicators."""
        if "status" in df.columns and df["status"].notna().any():
            # Already has a status column — normalize values
            s = df["status"].astype(str).str.strip().str.lower()
            df["status"] = np.where(
                s.isin(["won", "closed won", "closedwon", "true"]), "won",
                np.where(
                    s.isin(["lost", "closed lost", "closedlost"]), "lost",
                    np.where(s.isin(["open", "active"]), "open", s)
                )
            )
            return df

        # Derive from stage or is_closed/is_won flags
        if "is_closed" in df.columns and "is_won" in df.columns:
            df["status"] = np.where(
                df["is_won"].astype(str).str.lower().isin(["true", "1"]),
                "won",
                np.where(
                    df["is_closed"].astype(str).str.lower().isin(["true", "1"]),
                    "lost", "open"
                )
            )
        elif "stage" in df.columns:
            df["status"] = np.where(
                df["stage"] == "Closed Won", "won",
                np.where(df["stage"] == "Closed Lost", "lost", "open")
            )
        else:
            df["status"] = "open"
        return df

    # ------------------------------------------------------------------
    # Derived features
    # ------------------------------------------------------------------

    def _derive_features(self):
        """Add computed features the prediction engine needs."""
        if self.opportunities is None:
            return
        df = self.opportunities
        now = pd.Timestamp.now()

        # Days in pipeline
        if "created_date" in df.columns:
            close_or_now = df["close_date"].fillna(now)
            df["days_in_pipeline"] = (
                close_or_now - df["created_date"]
            ).dt.days.clip(lower=0)

        # Days since last activity (relative to close_date for closed, now for open)
        if "last_activity_date" in df.columns:
            ref_date = df["close_date"].fillna(now)
            df["days_since_activity"] = (
                ref_date - df["last_activity_date"]
            ).dt.days.clip(lower=0)

        # Amount bucket for segmentation
        if "amount" in df.columns:
            df["amount_bucket"] = pd.cut(
                df["amount"],
                bins=[0, 25_000, 50_000, 100_000, 250_000, float("inf")],
                labels=["<25K", "25-50K", "50-100K", "100-250K", "250K+"],
                right=True
            )

        # Stage numeric order for velocity calculations
        stage_num = {s: i for i, s in enumerate(STAGE_ORDER)}
        df["stage_num"] = df["stage"].map(stage_num)

        # Ensure amount fallback: if amount is null but mrr exists, use mrr
        if "mrr" in df.columns:
            df["amount"] = df["amount"].fillna(df.get("mrr", np.nan))
        if "tcv" in df.columns and "amount" in df.columns:
            df["amount"] = df["amount"].fillna(df.get("tcv", np.nan))

        self.opportunities = df

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    def _date_range(self, df: pd.DataFrame, col: str) -> Optional[str]:
        if col not in df.columns:
            return None
        dates = df[col].dropna()
        if dates.empty:
            return None
        return f"{dates.min().date()} to {dates.max().date()}"

    def _log_summary(self):
        for table, stats in self._load_stats.items():
            logger.info(
                f"Loaded {table}: {stats['rows']} rows from {stats['file']}"
            )
        if self.opportunities is not None:
            status_counts = self.opportunities["status"].value_counts()
            logger.info(f"Deal status breakdown: {status_counts.to_dict()}")
