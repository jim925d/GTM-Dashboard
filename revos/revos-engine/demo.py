"""
Generate 3,000 synthetic deals for demo/testing.
"""
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
import random

np.random.seed(42)
random.seed(42)

ACCOUNTS = [
    "Acme Corp", "TechFlow Inc", "DataSync Labs", "CloudFirst", "NetScale Systems",
    "Quantum Networks", "FiberLink", "DigiPath", "CoreConnect", "WavePoint",
    "SignalBridge", "PulseNet", "GridForce", "LinkStream", "ByteWorks",
    "NexGen Telecom", "VectorData", "PrimeRoute", "FlexNet Solutions", "HorizonIO",
    "Apex Digital", "ClearPath", "OmniConnect", "SkyBridge Networks", "TerraLink",
    "Zenith Systems", "BluePeak", "IronGate Tech", "SwiftNode", "Atlas Computing",
    "Pinnacle IT", "RedRock Data", "Summit Cloud", "Cascade Networks", "EchoPoint",
    "StarForge", "Titanium Labs", "CopperLine", "SilverStream", "GoldGrid",
]

PRODUCTS = [
    "Dark Fiber", "Wavelengths", "IP Transit", "Ethernet", "SD-WAN",
    "Cloud Connect", "DDoS Protection", "Managed Services", "Colocation", "MPLS",
]

STAGES_WON = ["Closed Won", "5 - Accepted"]
STAGES_LOST = ["Closed Lost"]
STAGES_ACTIVE = ["1 - Discover", "2 - Design Solution", "3 - Propose", "4 - Negotiate", "Verbal Agreement"]

REPS = [
    "Jose Banales", "Sarah Mitchell", "Mark Thompson", "Lisa Chen", "David Park",
    "Amy Rodriguez", "Chris Weber", "Jessica Kim", "Ryan O'Brien", "Nicole Foster",
]

CHANNELS = ["Direct", "Channel", "Agent"]

def random_date(start, end):
    delta = end - start
    return start + timedelta(days=random.randint(0, delta.days))

def generate_deals(n=3000):
    deals = []
    now = datetime.now()
    two_years_ago = now - timedelta(days=730)
    six_months_ahead = now + timedelta(days=180)

    for i in range(n):
        account = random.choice(ACCOUNTS)
        product = random.choice(PRODUCTS)
        rep = random.choice(REPS)
        channel = random.choice(CHANNELS)

        # 60% historical (won/lost), 40% active pipeline
        if random.random() < 0.60:
            # Historical deal
            if random.random() < 0.45:
                stage = random.choice(STAGES_WON)
                mrr = round(random.lognormvariate(6, 1.2), 2)  # positive MRR
                forecast = "Closed"
            else:
                stage = random.choice(STAGES_LOST)
                mrr = round(random.lognormvariate(6, 1.2), 2)
                forecast = "Not In Forecast"

            created = random_date(two_years_ago, now - timedelta(days=30))
            close = created + timedelta(days=random.randint(15, 180))
            if close > now:
                close = now - timedelta(days=random.randint(1, 30))
        else:
            # Active pipeline deal
            stage = random.choice(STAGES_ACTIVE)
            mrr = round(random.lognormvariate(6, 1.2), 2)
            forecast = random.choice(["Commit", "Best Case", "Longshot", "Not In Forecast"])
            created = random_date(now - timedelta(days=120), now)
            close = random_date(now, six_months_ahead)

        deals.append({
            "opportunity_id": f"OPP-{i+1:05d}",
            "customer_account": account,
            "product_group": product,
            "mrr": mrr,
            "stage": stage,
            "forecast_category": forecast,
            "rep": rep,
            "sales_channel": channel,
            "created_date": created.strftime("%m/%d/%Y"),
            "close_date": close.strftime("%m/%d/%Y"),
        })

    return pd.DataFrame(deals)

if __name__ == "__main__":
    output_dir = Path(__file__).parent / "demo_data"
    output_dir.mkdir(exist_ok=True)

    df = generate_deals(3000)

    # Split into funnel.csv and close_lost.csv
    won_mask = df['stage'].isin(STAGES_WON)
    lost_mask = df['stage'].isin(STAGES_LOST)
    active_mask = ~(won_mask | lost_mask)

    funnel = pd.concat([df[won_mask], df[active_mask]])
    close_lost = df[lost_mask]

    # Create minimal customers.csv
    accounts = df['customer_account'].unique()
    customers = pd.DataFrame({
        'customer_account': accounts,
        'total_brr': [round(random.uniform(50000, 500000), 2) for _ in accounts],
        'sales_owner': [random.choice(REPS) for _ in accounts],
        'mega_vertical': [random.choice(['Enterprise', 'Mid-Market', 'Government', 'Education']) for _ in accounts],
    })

    funnel.to_csv(output_dir / "funnel.csv", index=False)
    close_lost.to_csv(output_dir / "close_lost.csv", index=False)
    customers.to_csv(output_dir / "customers.csv", index=False)

    print(f"Generated {len(df)} deals:")
    print(f"  Funnel (won + active): {len(funnel)} deals -> demo_data/funnel.csv")
    print(f"  Close Lost: {len(close_lost)} deals -> demo_data/close_lost.csv")
    print(f"  Customers: {len(customers)} accounts -> demo_data/customers.csv")
    print(f"\nDemo data saved to {output_dir.resolve()}")
