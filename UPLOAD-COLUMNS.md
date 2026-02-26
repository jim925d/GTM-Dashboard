# CSV and Excel column headings for each upload

You can upload **one Excel file (.xlsx) with multiple tabs**: name each sheet after the function (e.g. **Accounts**, **Locations**, **Quotes**, **Product Catalog**). The app maps sheet names to tables and loads all in one go. Column rules below apply to each sheet; first row = headers.

**Sheet name → table mapping:** Accounts, Locations, Product Catalog (or Products), Current Products, Quotes (or Pipeline), Contacts, Engagement, Churned (or Prior), Closed Won, Closed Lost.

Headers are **auto-normalized**: spaces → underscore, lowercase, special characters removed.  
So `Account ID` and `Account ID` both become `account_id`. Use either style in your CSV/Excel; the first row must be headers.

---

## 1. Product Catalog

| Column (use one of) | Required | Notes |
|---------------------|----------|--------|
| product_name / productname | ✓ | |
| category / cat | ✓ | Default "Other" |
| mrr | ✓ | Number |
| description / desc | | |
| fit_signals / fitsignals | | For AI playbook |
| value_props / valueprops | | |
| use_cases / usecases | | |
| playbook_brief / playbookbrief | | Compressed playbook text |

**Example header row:**  
`product_name,category,mrr,description,fit_signals,value_props,use_cases`

---

## 2. Accounts

| Column (use one of) | Required | Notes |
|---------------------|----------|--------|
| account_id / accountid | ✓ | Links to all other tables |
| account_name / accountname | ✓ | |
| industry / ind | ✓ | Default "Other" |
| tier | ✓ | e.g. Strategic, Growth, Win-Back. Default "Growth" |
| mrr | ✓ | Current total MRR (number) |
| contract_end / contractend | | YYYY-MM-DD |

**Example:**  
`account_id,account_name,industry,tier,mrr,contract_end`

---

## 3. Locations

| Column (use one of) | Required | Notes |
|---------------------|----------|--------|
| account_id / accountid | ✓ | |
| address / a | ✓ | |
| net_status / netstatus / s | ✓ | on-net, near-net, off-net |
| billing_amount / billingamount / billing | | $/mo at this location |
| target_addressable_spend / target_spend | | Addressable spend for scoring |
| latitude / lat | | For map |
| longitude / lng / lon | | For map |
| products / products_at_site | | Comma-separated product names at this site |

**Example:**  
`account_id,address,net_status,billing_amount,target_addressable_spend,latitude,longitude`

---

## 4. Current Products

| Column (use one of) | Required |
|---------------------|----------|
| account_id / accountid | ✓ |
| product_name / productname | ✓ |

**Example:**  
`account_id,product_name`

---

## 5. Quotes / Pipeline

| Column (use one of) | Required | Notes |
|---------------------|----------|--------|
| account_id / accountid | ✓ | |
| product_name / productname | ✓ | |
| quoted_mrr / quotedmrr / mrr | ✓ | Number |
| quote_date / quotedate / date | | |
| close_date / closedate | | For “Pipeline this month” |
| status / st | ✓ | e.g. pending, stalled, pending-board. Default "pending" |
| notes | | |

**Example:**  
`account_id,product_name,quoted_mrr,quote_date,close_date,status,notes`

---

## 6. Contacts

| Column (use one of) | Required | Notes |
|---------------------|----------|--------|
| account_id / accountid | ✓ | |
| contact_name / contactname / name | ✓ | |
| title | | |
| engagement_level / engagementlevel / eng | ✓ | e.g. champion, engaged, cooling, cold |
| last_touch / lasttouch / last | | Last contact date |

**Example:**  
`account_id,contact_name,title,engagement_level,last_touch`

---

## 7. Engagement History

| Column (use one of) | Required | Notes |
|---------------------|----------|--------|
| account_id / accountid | ✓ | |
| date / d | ✓ | YYYY-MM-DD |
| type / t | | e.g. Call, Email, QBR, Quote Sent. Default "Call" |
| notes / n | ✓ | |

**Example:**  
`account_id,date,type,notes`

---

## 8. Prior / Churned Services

| Column (use one of) | Required |
|---------------------|----------|
| account_id / accountid | ✓ |
| service_description / servicedescription | ✓ |

**Example:**  
`account_id,service_description`

---

## 9. Closed Won

| Column (use one of) | Required | Notes |
|---------------------|----------|--------|
| opp_id | | Optional ID |
| account_id / accountid | ✓ | |
| account_name / accountname | ✓ | |
| industry | | For deal intelligence |
| product_name / productname | ✓ | |
| product_category / category | | Optional |
| mrr | ✓ | Won MRR |
| close_date / closedate | ✓ | |
| opp_type | | Optional |

**Example:**  
`opp_id,account_id,account_name,industry,product_name,mrr,close_date`

---

## 10. Closed Lost

| Column (use one of) | Required | Notes |
|---------------------|----------|--------|
| opp_id | | Optional |
| account_id / accountid | ✓ | |
| account_name / accountname | ✓ | |
| industry | | |
| product_name / productname | ✓ | |
| mrr | ✓ | Lost deal size |
| close_date / closedate | ✓ | |
| loss_reason / lossreason | ✓ | |
| competitor | | Who won |

**Example:**  
`opp_id,account_id,account_name,industry,product_name,mrr,close_date,loss_reason,competitor`

---

## Tips

- **Upload order:** Load **Accounts** first, then Locations, Current Products, Quotes, Contacts, Engagement, Churned. Product Catalog is independent. Closed Won/Lost can be last.
- **Same ID everywhere:** Use the same `account_id` in every table that has it so rows merge correctly.
- **Dates:** Use YYYY-MM-DD (e.g. 2025-02-28) for date columns.
- **Encoding:** Save CSVs as **UTF-8** (Excel: “CSV UTF-8” or export with UTF-8).
