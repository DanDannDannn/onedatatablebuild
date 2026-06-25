#!/usr/bin/env python3
"""
Transform the anonymized client CSV into a compact JSON the prototype loads at
runtime. One CSV row -> one data entry + one calculation (1:1; emissionResultsCount=1).

Compact + deduped so 113k rows stay loadable in-browser:
  - emission factors deduped into a `factors` table (rows reference an index)
  - low-cardinality strings (category, site, business unit/activity, user, scope-3
    category, currency, method, supplier, batch) live in `dict` arrays; rows hold indices
  - per-row unique data (id, dates, amount, co2e, price, description, notes) inline
The loader in `For build.html` rebuilds window.ENTRIES / window.CALCS from this.
"""
import csv, sys, json, hashlib, os

csv.field_size_limit(10**7)
SRC = sys.argv[1] if len(sys.argv) > 1 else \
    "/Users/danwu/Forward-Earth/prototypes/design_handoff_calculations_app/data-anonymized.csv"
DST = sys.argv[2] if len(sys.argv) > 2 else \
    "/Users/danwu/Forward-Earth/prototypes/design_handoff_calculations_app/dataset.json"
# Cap the row count for a lighter handoff build. 0 = no cap (full dataset).
# Usage: MAX_ROWS=3000 python build_dataset.py   (or pass as 3rd arg)
MAX_ROWS = int(sys.argv[3]) if len(sys.argv) > 3 else int(os.environ.get("MAX_ROWS", "0"))

CAT = {
    "PURCHASED_GOODS_AND_SERVICES": "purchased_goods",
    "CAPITAL_GOODS": "capital_goods",
    "UPSTREAM_TRANSPORTATION_AND_DISTRIBUTION": "upstream_transport",
    "WASTE_GENERATED_IN_OPERATIONS": "waste",
    "BUSINESS_TRAVEL": "business_travel",
}
BU_BY_CAT = {
    "purchased_goods": "Supply chain", "capital_goods": "Finance",
    "upstream_transport": "Operations", "waste": "Operations",
    "business_travel": "Commercial",
}
ACT_BY_CAT = {
    "purchased_goods": "Upstream purchased goods", "capital_goods": "Capital goods",
    "upstream_transport": "Transport & distribution", "waste": "Waste in operations",
    "business_travel": "Business travel",
}
S3_BY_CAT = {
    "purchased_goods": "1 · Purchased goods & services",
    "capital_goods": "2 · Capital goods",
    "upstream_transport": "4 · Upstream transport & distribution",
    "waste": "5 · Waste generated in operations",
    "business_travel": "6 · Business travel",
}
USERS = ["Johannes Weber", "Amelia Schroeder", "Marc Dupont", "Lena Becker", "System · Auto"]

def h(s):
    return int(hashlib.md5(s.encode("utf-8")).hexdigest()[:8], 16)

class Dict_:
    def __init__(self): self.items = []; self.idx = {}
    def get(self, key):
        if key not in self.idx:
            self.idx[key] = len(self.items); self.items.append(key)
        return self.idx[key]

def short_unit(efunit):
    # "kg CO2-Eq / kg" -> "kg" ; "kgCO2e/€" -> "€"
    if not efunit: return ""
    return efunit.split("/")[-1].strip()

def num(s):
    if s is None or s == "": return None
    try: return float(s)
    except ValueError: return None

d_cat = Dict_(); d_site = Dict_(); d_bu = Dict_(); d_act = Dict_()
d_user = Dict_(); d_s3 = Dict_(); d_cur = Dict_(); d_method = Dict_()
d_supplier = Dict_(); d_batch = Dict_()
factors = Dict_()  # key = json tuple string -> index; store parallel list of dicts
factor_objs = []

def factor_index(name, source, vintage, unit, kg_per_unit, region):
    key = "|".join([name, source, vintage, unit, str(kg_per_unit), region])
    if key not in factors.idx:
        factors.idx[key] = len(factor_objs)
        slug = "ef-" + hashlib.md5(key.encode()).hexdigest()[:10]
        factor_objs.append({
            "id": slug, "name": name, "source": source, "vintage": vintage,
            "unit": unit, "kg_per_unit": kg_per_unit, "region": region,
            "dataset": source, "lca": "Cradle-to-gate",
        })
    return factors.idx[key]

with open(SRC, newline="", encoding="utf-8") as f:
    all_raw = list(csv.DictReader(f))

# Even-stride sample so the smaller build keeps the full spread of categories,
# suppliers, sites and dates (taking the first N would skew to one batch).
if MAX_ROWS and len(all_raw) > MAX_ROWS:
    stride = len(all_raw) / MAX_ROWS
    raw = [all_raw[int(i * stride)] for i in range(MAX_ROWS)]
    print(f"sampling {len(raw)} of {len(all_raw)} rows (MAX_ROWS={MAX_ROWS})")
else:
    raw = all_raw

rows = []
n = 0
total_co2e = 0.0
for row in raw:
        n += 1
        cat = CAT.get(row["emissionSource"], "purchased_goods")
        is_activity = row["consumptionDataType"] == "ACTIVITY_DATA"
        amount = num(row["consumptionDetails_activityAmount"]) if is_activity else num(row["consumptionDetails_price"])
        price = num(row["consumptionDetails_price"])
        co2e = num(row["calculationGhg_co2e"]) or 0.0
        total_co2e += co2e
        ef_unit = short_unit(row["calculationGhg_efUnit"])
        unit = ef_unit or ("kg" if is_activity else "€")
        method = "Activity-based" if is_activity else "Spend-based"
        fac_i = factor_index(
            row["calculationGhg_efName"] or "Unknown factor",
            row["calculationGhg_efSource"] or "—",
            row["calculationGhg_efYear"] or "",
            unit,
            num(row["calculationGhg_efValue"]),
            row["calculationGhg_efRegion"] or "Global",
        )
        product = row["consumptionDetails_activityDescription"] or ""
        desc = row["consumptionDetails_description"] or ""
        supplier = row["consumptionDetails_supplierName"] or ""
        user = USERS[h(row["id"]) % len(USERS)]
        batch_id = row["bulkImportId"] or "manual"
        rows.append([
            row["id"],                                  # 0 id
            d_cat.get(cat),                             # 1 category
            d_site.get(row["location_name"] or "—"),    # 2 site
            (row["startDate"] or "")[:10],              # 3 start_date
            (row["endDate"] or "")[:10],                # 4 end_date
            amount,                                     # 5 amount (activity or spend)
            round(co2e, 4),                             # 6 co2e (kg)
            price,                                      # 7 price (EUR)
            fac_i,                                      # 8 factor index
            d_supplier.get(supplier),                   # 9 supplier
            d_bu.get(BU_BY_CAT[cat]),                   # 10 business unit
            d_act.get(ACT_BY_CAT[cat]),                 # 11 business activity
            d_user.get(user),                           # 12 user
            d_s3.get(S3_BY_CAT[cat]),                   # 13 scope-3 category
            d_cur.get(row["consumptionDetails_currency"] or "EUR"),  # 14 currency
            d_method.get(method),                       # 15 method
            d_batch.get(batch_id),                      # 16 batch
            unit,                                       # 17 activity unit
            product,                                    # 18 product / service
            desc,                                       # 19 line description
            (row["notes"] or "").strip(),               # 20 notes
        ])

out = {
    "meta": {"count": n, "total_co2e_kg": round(total_co2e, 1),
             "source": "anonymized client export (Scope 3)"},
    "dict": {
        "cat": d_cat.items, "site": d_site.items, "bu": d_bu.items,
        "act": d_act.items, "user": d_user.items, "s3": d_s3.items,
        "cur": d_cur.items, "method": d_method.items, "supplier": d_supplier.items,
        "batch": d_batch.items,
    },
    "factors": factor_objs,
    "rows": rows,
}
with open(DST, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

print(f"rows: {n}")
print(f"unique factors: {len(factor_objs)} | suppliers: {len(d_supplier.items)} | sites: {len(d_site.items)}")
print(f"categories: {d_cat.items}")
print(f"methods: {d_method.items} | business units: {d_bu.items}")
print(f"total co2e: {total_co2e/1000:,.1f} tCO2e")
print(f"output size: {os.path.getsize(DST)/1e6:.1f} MB")
