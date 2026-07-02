// Seed data — Forward Earth carbon accounting prototype
// Three linked entities: upload_batch -> data_entry -> calculation (1:M:M)

// Bulk-import display: a link label ("Bulk import (CSV)") + the uploaded file name,
// derived from the source upload batch. Manual entries have neither.
const IMPORT_TYPE_LABEL = { csv: "CSV", xlsx: "XLSX", pdf: "PDF" };
function bulkImportInfo(b) {
  if (!b || !b.source || b.source === "manual") return { ref: "—", file: "—" };
  if (b.source === "erp") return { ref: "ERP sync", file: "—" };
  const t = IMPORT_TYPE_LABEL[b.source] || String(b.source).toUpperCase();
  return { ref: "Bulk import (" + t + ")", file: b.fileName || "—" };
}

const BATCHES = [
  { id: "B-2026-03",  label: "March 2026 manual",     source: "manual",  date: "2026-03-31", uploadedBy: "Johannes Weber" },
  { id: "B-2026-02",  label: "Feb 2026 utility bills",  source: "pdf",     date: "2026-03-04", uploadedBy: "Johannes Weber", fileName: "utility-bills-feb-2026.pdf" },
  { id: "B-2026-Q1",  label: "Q1 travel (SAP Concur)", source: "erp",     date: "2026-04-05", uploadedBy: "System · Concur" },
  { id: "B-2026-FUEL","label": "Q1 fleet — WEX",        "source": "erp",   "date": "2026-04-02", "uploadedBy": "System · WEX" },
  { id: "B-2026-PG",  label: "Q1 purchased goods",     source: "csv",     date: "2026-04-10", uploadedBy: "Amelia Schroeder", fileName: "spend_q1_finance.csv" },
];

// Emission factors (simplified). Each has source + vintage + gas breakdown.
const FACTORS = {
  "ef-grid-uk":       { id:"ef-grid-uk",     name:"UK grid electricity — location-based", source:"BEIS/DEFRA 2025", vintage:"2025", unit:"kWh", kg_per_unit: 0.2075, gases:{ CO2: 0.198, CH4: 0.0004, N2O: 0.0091 } },
  "ef-grid-de":       { id:"ef-grid-de",     name:"DE grid electricity — location-based", source:"AIB/UBA 2025",    vintage:"2025", unit:"kWh", kg_per_unit: 0.380, gases:{ CO2: 0.370, CH4: 0.0012, N2O: 0.0088 } },
  "ef-grid-fr":       { id:"ef-grid-fr",     name:"FR grid electricity — location-based", source:"ADEME 2025",      vintage:"2025", unit:"kWh", kg_per_unit: 0.052 },
  "ef-gas-uk":        { id:"ef-gas-uk",      name:"Natural gas — gross CV",             source:"BEIS/DEFRA 2025", vintage:"2025", unit:"kWh", kg_per_unit: 0.1831 },
  "ef-gas-wtt":       { id:"ef-gas-wtt",     name:"Natural gas — WTT (upstream)",       source:"BEIS/DEFRA 2025", vintage:"2025", unit:"kWh", kg_per_unit: 0.0273 },
  "ef-diesel":        { id:"ef-diesel",      name:"Diesel (average biofuel blend)",      source:"BEIS/DEFRA 2025", vintage:"2025", unit:"L",   kg_per_unit: 2.512 },
  "ef-diesel-ch4":    { id:"ef-diesel-ch4",  name:"Diesel — CH₄",                       source:"BEIS/DEFRA 2025", vintage:"2025", unit:"L",   kg_per_unit: 0.00012 },
  "ef-diesel-n2o":    { id:"ef-diesel-n2o",  name:"Diesel — N₂O",                       source:"BEIS/DEFRA 2025", vintage:"2025", unit:"L",   kg_per_unit: 0.0158 },
  "ef-diesel-wtt":    { id:"ef-diesel-wtt",  name:"Diesel — WTT (upstream)",            source:"BEIS/DEFRA 2025", vintage:"2025", unit:"L",   kg_per_unit: 0.607 },
  "ef-flight-short":  { id:"ef-flight-short",name:"Air travel — short-haul economy",    source:"DEFRA 2025",      vintage:"2025", unit:"pax·km", kg_per_unit: 0.1558 },
  "ef-flight-long":   { id:"ef-flight-long", name:"Air travel — long-haul economy",     source:"DEFRA 2025",      vintage:"2025", unit:"pax·km", kg_per_unit: 0.1956 },
  "ef-flight-biz":    { id:"ef-flight-biz",  name:"Air travel — long-haul business",    source:"DEFRA 2025",      vintage:"2025", unit:"pax·km", kg_per_unit: 0.5671 },
  "ef-spend-steel":   { id:"ef-spend-steel", name:"Purchased goods — steel (spend)",    source:"EXIOBASE 2024",   vintage:"2024", unit:"€",   kg_per_unit: 0.412 },
  "ef-spend-it":      { id:"ef-spend-it",    name:"Purchased goods — IT services (spend)", source:"EXIOBASE 2024", vintage:"2024", unit:"€", kg_per_unit: 0.062 },
  "ef-spend-pack":    { id:"ef-spend-pack",  name:"Purchased goods — paper packaging",  source:"EXIOBASE 2024",   vintage:"2024", unit:"kg",  kg_per_unit: 0.941 },
  "ef-spend-office":  { id:"ef-spend-office",name:"Purchased goods — office supplies (spend)", source:"EXIOBASE 2024", vintage:"2024", unit:"€", kg_per_unit: 0.285 },
};

// Data entries — 36 rows across categories
// Each entry: category-specific fields live in .details
const ENTRIES = [
  // --- Electricity ---
  { id:"D-001", batchId:"B-2026-02", category:"electricity", date:"2026-02-14", site:"London HQ",
    summary:"12,450 kWh · UK grid · Half-hourly",
    details:{ kWh: 12450, grid_region:"UK (GB)", supplier:"EDF Energy", meter_id:"MPAN-19-6273-0044", tariff:"Half-hourly", renewable_share:"28% (residual mix)" } },
  { id:"D-002", batchId:"B-2026-02", category:"electricity", date:"2026-02-14", site:"Berlin HQ",
    summary:"24,980 kWh · DE grid",
    details:{ kWh: 24980, grid_region:"DE", supplier:"Vattenfall", meter_id:"OBIS-1.8.0", tariff:"Flat", renewable_share:"0% (location-based)"} },
  { id:"D-003", batchId:"B-2026-02", category:"electricity", date:"2026-02-14", site:"Paris Office",
    summary:"4,120 kWh · FR grid",
    details:{ kWh: 4120, grid_region:"FR", supplier:"Enedis", meter_id:"PRM-09223...", tariff:"Base"} },
  { id:"D-004", batchId:"B-2026-02", category:"electricity", date:"2026-01-31", site:"London HQ",
    summary:"11,860 kWh · UK grid",
    details:{ kWh: 11860, grid_region:"UK (GB)", supplier:"EDF Energy", meter_id:"MPAN-19-6273-0044"} },
  { id:"D-005", batchId:"B-2026-02", category:"electricity", date:"2026-01-31", site:"Berlin HQ",
    summary:"26,110 kWh · DE grid",
    details:{ kWh: 26110, grid_region:"DE", supplier:"Vattenfall", meter_id:"OBIS-1.8.0"} },
  { id:"D-006", batchId:"B-2026-02", category:"electricity", date:"2026-01-15", site:"Munich Warehouse",
    summary:"8,640 kWh · DE grid",
    details:{ kWh: 8640, grid_region:"DE", supplier:"SWM", meter_id:"OBIS-1.8.0"} },
  { id:"D-007", batchId:"B-2026-03", category:"electricity", date:"2026-03-28", site:"Rotterdam DC",
    summary:"18,900 kWh · NL grid",
    details:{ kWh: 18900, grid_region:"NL", supplier:"Eneco", meter_id:"NL-EAN-8716..."} },

  // --- Natural gas ---
  { id:"D-008", batchId:"B-2026-02", category:"natural_gas", date:"2026-02-14", site:"London HQ",
    summary:"38,400 kWh · heating gas",
    details:{ kWh: 38400, supplier:"British Gas", meter_id:"MPRN-1234-7788", cv:"gross", end_use:"Space heating"} },
  { id:"D-009", batchId:"B-2026-02", category:"natural_gas", date:"2026-01-31", site:"London HQ",
    summary:"42,900 kWh · heating gas",
    details:{ kWh: 42900, supplier:"British Gas", meter_id:"MPRN-1234-7788", cv:"gross"} },
  { id:"D-010", batchId:"B-2026-02", category:"natural_gas", date:"2026-02-14", site:"Berlin HQ",
    summary:"58,200 kWh · district gas",
    details:{ kWh: 58200, supplier:"GASAG", meter_id:"BE-1149...", cv:"gross"} },
  { id:"D-011", batchId:"B-2026-03", category:"natural_gas", date:"2026-03-28", site:"Munich Warehouse",
    summary:"12,800 kWh · heating gas",
    details:{ kWh: 12800, supplier:"SWM", meter_id:"MU-8812...", cv:"gross"} },

  // --- Diesel / fleet ---
  { id:"D-012", batchId:"B-2026-FUEL", category:"diesel", date:"2026-02-10", site:"UK Fleet",
    summary:"1,840 L · diesel · 4 vehicles",
    details:{ liters: 1840, vehicle_count: 4, avg_mpg: 42.1, card_issuer:"WEX", fuel_grade:"EN590 B7"} },
  { id:"D-013", batchId:"B-2026-FUEL", category:"diesel", date:"2026-02-10", site:"DE Fleet",
    summary:"3,260 L · diesel · 7 vehicles",
    details:{ liters: 3260, vehicle_count: 7, avg_mpg: 38.4, card_issuer:"WEX", fuel_grade:"EN590 B7"} },
  { id:"D-014", batchId:"B-2026-FUEL", category:"diesel", date:"2026-03-10", site:"DE Fleet",
    summary:"2,980 L · diesel · 7 vehicles",
    details:{ liters: 2980, vehicle_count: 7, avg_mpg: 39.0, card_issuer:"WEX"} },
  { id:"D-015", batchId:"B-2026-FUEL", category:"diesel", date:"2026-03-10", site:"UK Fleet",
    summary:"1,620 L · diesel · 4 vehicles",
    details:{ liters: 1620, vehicle_count: 4, avg_mpg: 43.0, card_issuer:"WEX"} },
  { id:"D-016", batchId:"B-2026-FUEL", category:"diesel", date:"2026-01-28", site:"Rotterdam DC",
    summary:"5,740 L · diesel · forklifts",
    details:{ liters: 5740, equipment:"6 forklifts", card_issuer:"Shell Fleet"} },

  // --- Flights ---
  { id:"D-017", batchId:"B-2026-Q1", category:"flight", date:"2026-02-03", site:"—",
    summary:"LHR → JFK · business · 2 pax",
    details:{ origin:"LHR", destination:"JFK", class:"Business", pax:2, distance_km: 5541, traveller:"A. Schroeder, J. Weber", ticket:"BA-114"} },
  { id:"D-018", batchId:"B-2026-Q1", category:"flight", date:"2026-02-18", site:"—",
    summary:"LHR → BER · economy · 1 pax",
    details:{ origin:"LHR", destination:"BER", class:"Economy", pax:1, distance_km: 932, traveller:"J. Weber", ticket:"BA-986"} },
  { id:"D-019", batchId:"B-2026-Q1", category:"flight", date:"2026-03-04", site:"—",
    summary:"CDG → SIN · business · 1 pax",
    details:{ origin:"CDG", destination:"SIN", class:"Business", pax:1, distance_km: 10739, traveller:"M. Dupont", ticket:"AF-254"} },
  { id:"D-020", batchId:"B-2026-Q1", category:"flight", date:"2026-03-14", site:"—",
    summary:"BER → MAD · economy · 3 pax",
    details:{ origin:"BER", destination:"MAD", class:"Economy", pax:3, distance_km: 1872, traveller:"Marketing team", ticket:"IB-3173"} },
  { id:"D-021", batchId:"B-2026-Q1", category:"flight", date:"2026-03-22", site:"—",
    summary:"LHR → DXB · economy · 2 pax",
    details:{ origin:"LHR", destination:"DXB", class:"Economy", pax:2, distance_km: 5495, traveller:"Sales", ticket:"EK-008"} },
  { id:"D-022", batchId:"B-2026-Q1", category:"flight", date:"2026-01-19", site:"—",
    summary:"LHR → EDI · economy · 4 pax",
    details:{ origin:"LHR", destination:"EDI", class:"Economy", pax:4, distance_km: 534, traveller:"Eng team", ticket:"BA-1440"} },
  { id:"D-023", batchId:"B-2026-Q1", category:"flight", date:"2026-03-29", site:"—",
    summary:"FRA → NRT · business · 1 pax",
    details:{ origin:"FRA", destination:"NRT", class:"Business", pax:1, distance_km: 9370, traveller:"CFO", ticket:"LH-710"} },

  // --- Purchased goods ---
  { id:"D-024", batchId:"B-2026-PG", category:"purchased_goods", date:"2026-01-20", site:"London HQ",
    summary:"Laptop refresh · €42,800 IT spend",
    details:{ supplier:"Apple Business", spend_eur: 42800, sku_count: 24, category_code:"IT hardware"} },
  { id:"D-025", batchId:"B-2026-PG", category:"purchased_goods", date:"2026-02-08", site:"Rotterdam DC",
    summary:"Steel racking · 8,420 kg",
    details:{ supplier:"Van Doorn Staal", spend_eur: 19600, mass_kg: 8420, category_code:"Steel - hot rolled"} },
  { id:"D-026", batchId:"B-2026-PG", category:"purchased_goods", date:"2026-02-26", site:"Berlin HQ",
    summary:"Paper packaging · 1,240 kg",
    details:{ supplier:"Mondi AG", spend_eur: 3140, mass_kg: 1240, category_code:"Paper and board"} },
  { id:"D-027", batchId:"B-2026-PG", category:"purchased_goods", date:"2026-03-12", site:"London HQ",
    summary:"Office supplies · €2,180",
    details:{ supplier:"Viking Direct", spend_eur: 2180, category_code:"Office supplies - mixed"} },
  { id:"D-028", batchId:"B-2026-PG", category:"purchased_goods", date:"2026-03-19", site:"Munich Warehouse",
    summary:"SaaS & cloud · €18,400",
    details:{ supplier:"AWS / Atlassian / Figma", spend_eur: 18400, category_code:"IT services - cloud"} },

  // --- More electricity / gas variety ---
  { id:"D-029", batchId:"B-2026-02", category:"electricity", date:"2026-03-14", site:"Paris Office",
    summary:"3,980 kWh · FR grid",
    details:{ kWh: 3980, grid_region:"FR", supplier:"Enedis"} },
  { id:"D-030", batchId:"B-2026-02", category:"electricity", date:"2026-03-14", site:"Rotterdam DC",
    summary:"19,640 kWh · NL grid",
    details:{ kWh: 19640, grid_region:"NL", supplier:"Eneco"} },
  { id:"D-031", batchId:"B-2026-02", category:"natural_gas", date:"2026-03-14", site:"Berlin HQ",
    summary:"44,100 kWh · district gas",
    details:{ kWh: 44100, supplier:"GASAG"} },
  { id:"D-032", batchId:"B-2026-03", category:"electricity", date:"2026-03-28", site:"Munich Warehouse",
    summary:"9,220 kWh · DE grid",
    details:{ kWh: 9220, grid_region:"DE", supplier:"SWM"} },
  { id:"D-033", batchId:"B-2026-FUEL", category:"diesel", date:"2026-02-24", site:"UK Fleet",
    summary:"1,790 L · diesel · 4 vehicles",
    details:{ liters: 1790, vehicle_count:4, card_issuer:"WEX"} },
  { id:"D-034", batchId:"B-2026-Q1", category:"flight", date:"2026-02-27", site:"—",
    summary:"BER → LHR · economy · 2 pax",
    details:{ origin:"BER", destination:"LHR", class:"Economy", pax:2, distance_km: 932, traveller:"Sales"} },
  { id:"D-035", batchId:"B-2026-PG", category:"purchased_goods", date:"2026-03-03", site:"Berlin HQ",
    summary:"Paper packaging · 880 kg",
    details:{ supplier:"Mondi AG", spend_eur: 2230, mass_kg: 880, category_code:"Paper and board"} },
  { id:"D-036", batchId:"B-2026-PG", category:"purchased_goods", date:"2026-02-15", site:"Rotterdam DC",
    summary:"Steel racking · 3,180 kg",
    details:{ supplier:"Van Doorn Staal", spend_eur: 7400, mass_kg: 3180, category_code:"Steel - hot rolled"} },
];

// --- Calculation helpers --------------------------------------------------
const scopeForCategory = { electricity: 2, natural_gas: 1, diesel: 1, flight: 3, purchased_goods: 3,
  capital_goods: 3, upstream_transport: 3, waste: 3, business_travel: 3 };

// Build calculations. Some entries have multiple calcs (gas breakdowns, WTT).
function buildCalcs() {
  const calcs = [];
  let n = 1;
  const add = (entry, partial) => {
    const id = `C-${String(n).padStart(4,"0")}`; n++;
    calcs.push({
      id, entryId: entry.id, date: entry.date, site: entry.site,
      category: entry.category, scope: partial.scope ?? scopeForCategory[entry.category],
      ...partial,
    });
  };
  ENTRIES.forEach(e => {
    if (e.category === "electricity") {
      const ef = e.details.grid_region?.startsWith("UK") ? FACTORS["ef-grid-uk"]
               : e.details.grid_region === "DE" ? FACTORS["ef-grid-de"]
               : e.details.grid_region === "FR" ? FACTORS["ef-grid-fr"]
               : FACTORS["ef-grid-de"];
      add(e, {
        activity: `${e.details.kWh.toLocaleString()} kWh · ${e.details.grid_region||"grid"}`,
        gas:"CO₂e", method:"Location-based", factor: ef,
        quantity: e.details.kWh, unit:"kWh",
        kgCO2e: +(e.details.kWh * ef.kg_per_unit).toFixed(1),
        status: "verified",
        confidence: 0.97, reason:`Matched to ${ef.name} based on site country (${e.details.grid_region}) and meter type.`,
      });
    } else if (e.category === "natural_gas") {
      const combust = FACTORS["ef-gas-uk"];
      const wtt = FACTORS["ef-gas-wtt"];
      add(e, {
        activity: `${e.details.kWh.toLocaleString()} kWh · combustion`,
        gas:"CO₂e", method:"Activity-based", factor: combust,
        quantity: e.details.kWh, unit:"kWh",
        kgCO2e: +(e.details.kWh * combust.kg_per_unit).toFixed(1),
        status:"verified", confidence: 0.95,
        reason:"Matched on fuel type (natural gas) and gross calorific value convention."
      });
      add(e, {
        activity: `${e.details.kWh.toLocaleString()} kWh · WTT (upstream)`,
        scope:3, gas:"CO₂e", method:"Activity-based", factor: wtt,
        quantity: e.details.kWh, unit:"kWh",
        kgCO2e: +(e.details.kWh * wtt.kg_per_unit).toFixed(1),
        status:"verified", confidence: 0.88,
        reason:"Upstream well-to-tank auto-generated from parent combustion entry."
      });
    } else if (e.category === "diesel") {
      const co2 = FACTORS["ef-diesel"];
      add(e, {
        activity: `${e.details.liters.toLocaleString()} L · combustion CO₂`,
        gas:"CO₂", method:"Activity-based", factor: co2,
        quantity: e.details.liters, unit:"L",
        kgCO2e: +(e.details.liters * co2.kg_per_unit).toFixed(1),
        status: "verified", confidence: 0.96,
        reason:"Matched on fuel grade EN590 B7 and UK/DEFRA diesel factor."
      });
      add(e, {
        activity: `${e.details.liters.toLocaleString()} L · CH₄`,
        gas:"CH₄", method:"Activity-based", factor: FACTORS["ef-diesel-ch4"],
        quantity: e.details.liters, unit:"L",
        kgCO2e: +(e.details.liters * FACTORS["ef-diesel-ch4"].kg_per_unit).toFixed(3),
        status:"verified", confidence: 0.90,
        reason:"CH₄ co-emission from diesel combustion (small)."
      });
      add(e, {
        activity: `${e.details.liters.toLocaleString()} L · N₂O`,
        gas:"N₂O", method:"Activity-based", factor: FACTORS["ef-diesel-n2o"],
        quantity: e.details.liters, unit:"L",
        kgCO2e: +(e.details.liters * FACTORS["ef-diesel-n2o"].kg_per_unit).toFixed(1),
        status:"verified", confidence: 0.90,
        reason:"N₂O co-emission from diesel combustion."
      });
      add(e, {
        activity: `${e.details.liters.toLocaleString()} L · WTT (upstream)`,
        scope:3, gas:"CO₂e", method:"Activity-based", factor: FACTORS["ef-diesel-wtt"],
        quantity: e.details.liters, unit:"L",
        kgCO2e: +(e.details.liters * FACTORS["ef-diesel-wtt"].kg_per_unit).toFixed(1),
        status:"ai_matched", confidence: 0.82,
        reason:"Upstream fuel production & distribution (well-to-tank)."
      });
    } else if (e.category === "flight") {
      const dist = e.details.distance_km * e.details.pax;
      const isLong = e.details.distance_km > 3700;
      const isBiz = e.details.class === "Business";
      const ef = isBiz && isLong ? FACTORS["ef-flight-biz"]
               : isLong ? FACTORS["ef-flight-long"]
               : FACTORS["ef-flight-short"];
      add(e, {
        activity: `${dist.toLocaleString()} pax·km · ${e.details.class}`,
        gas:"CO₂e", method:"Distance-based", factor: ef,
        quantity: dist, unit:"pax·km",
        kgCO2e: +(dist * ef.kg_per_unit).toFixed(1),
        status: isBiz ? "ai_matched" : "under_review",
        confidence: isBiz ? 0.93 : 0.71,
        reason: isBiz
          ? `Matched to business long-haul factor based on class=${e.details.class}, distance=${e.details.distance_km}km.`
          : `Class could not be confirmed from itinerary — defaulted to economy. Please verify.`,
      });
    } else if (e.category === "purchased_goods") {
      const cat = e.details.category_code || "";
      let ef, act, unit, qty, conf, reason, status;
      if (cat.startsWith("Steel")) {
        ef = FACTORS["ef-spend-steel"]; qty = e.details.mass_kg; unit = "kg";
        act = `${qty.toLocaleString()} kg steel`;
        conf = 0.68; status="under_review";
        reason = "Spend-based fallback — supplier-specific PCF not available. Consider swapping for EPD once received.";
        // For steel, factor is spend-based; recompute as per-spend for realism:
        ef = { ...FACTORS["ef-spend-steel"], unit:"kg", name:"Steel (hot-rolled) — mass basis"};
      } else if (cat.startsWith("Paper")) {
        ef = FACTORS["ef-spend-pack"]; qty = e.details.mass_kg; unit = "kg";
        act = `${qty.toLocaleString()} kg paper packaging`;
        conf = 0.84; status="ai_matched";
        reason = "Matched on category 'Paper and board' with mass-based factor.";
      } else if (cat.includes("IT services")) {
        ef = FACTORS["ef-spend-it"]; qty = e.details.spend_eur; unit = "€";
        act = `€${qty.toLocaleString()} IT services`;
        conf = 0.58; status="pending_match";
        reason = "Low confidence — SaaS category is very heterogeneous. Reviewer input needed to pick the right sub-factor.";
      } else if (cat.includes("IT hardware")) {
        ef = FACTORS["ef-spend-it"]; qty = e.details.spend_eur; unit = "€";
        act = `€${qty.toLocaleString()} IT hardware`;
        conf = 0.49; status="pending_match";
        reason = "Spend-based IT services factor applied to hardware — mismatch likely. Suggested swap: Laptop LCA factor (Apple PCF).";
      } else {
        ef = FACTORS["ef-spend-office"]; qty = e.details.spend_eur; unit = "€";
        act = `€${qty.toLocaleString()} office supplies`;
        conf = 0.72; status="ai_matched";
        reason = "Matched on category 'Office supplies'.";
      }
      add(e, {
        activity: act, gas:"CO₂e", method:"Spend-based", factor: ef,
        quantity: qty, unit, kgCO2e: +(qty * ef.kg_per_unit).toFixed(1),
        status, confidence: conf, reason
      });
    }
  });

  // Migrate to new 3-state calculation taxonomy: pending | suggested | confirmed
  const CALC_MIGRATE = {
    pending_match: "pending",
    ai_matched:    "suggested",
    under_review:  "suggested",
    verified:      "confirmed",
    locked:        "confirmed",
  };
  calcs.forEach(c => { c.status = CALC_MIGRATE[c.status] || c.status; });

  // A few remain "pending" to show the queued state realistically
  calcs.forEach((c, i) => {
    if (c.status === "suggested" && c.confidence < 0.55 && i % 7 === 0) {
      c.status = "pending";
      c.confidence = null; // no AI suggestion yet
    }
  });

  return calcs;
}

const CALCS = buildCalcs();

// Enrich entries + calcs with columns seen in the screenshot (deterministic, seeded by id hash)
const BUSINESS_UNITS = ["Operations","Commercial","Finance","R&D","Supply chain"];
const USERS = ["Johannes Weber","Amelia Schroeder","Marc Dupont","Priya Rao","Lena Becker","System · Auto"];
const INPUT_TYPES = { manual:"Manual", csv:"Bulk import (CSV)", erp:"Integration (ERP)" };
function hash(s){ let h=0; for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i))|0; return Math.abs(h); }
function addDays(d, n){ const dt = new Date(d); dt.setDate(dt.getDate()+n); return dt.toISOString().slice(0,10);}
ENTRIES.forEach(e => {
  const h = hash(e.id);
  e.business_unit = BUSINESS_UNITS[h % BUSINESS_UNITS.length];
  const cat = e.category;
  e.business_activity =
    cat==="electricity"   ? "Purchased electricity" :
    cat==="natural_gas"   ? "Stationary combustion — gas" :
    cat==="diesel"        ? "Mobile combustion — diesel" :
    cat==="flight"        ? "Business travel — air" :
                            "Upstream purchased goods";
  e.user_assigned = USERS[h % USERS.length];
  const b = BATCHES.find(x => x.id === e.batchId);
  e.data_input_type = INPUT_TYPES[b?.source || "manual"];
  e.start_date = e.date;
  e.end_date = addDays(e.date, 13 + (h%14));
  e.created_on = addDays(e.date, -2 - (h%5));
  e.last_updated = addDays(e.date, (h%9));
  e.files_count = (h % 3);
  e.notes = [
    "Reading reconciled with supplier invoice.",
    "Pending renewable certificate attachment.",
    "Unit converted from therms to kWh (×29.3001).",
    "",
    "Flagged anomaly — awaiting site confirmation.",
    "",
  ][h % 6];
  { const bi = bulkImportInfo(b); e.bulk_import_ref = bi.ref; e.bulk_import_file = bi.file; }
  e.custom_factor = (h % 7 === 0) ? "Supplier PCF v2.1" : "—";

  // Extra metadata captured during bulk import (optional columns the user mapped)
  // Only populated when the entry came from a bulk upload (csv/xlsx/erp).
  if (b && b.source !== "manual") {
    const COST_CENTERS = ["CC-4401 Operations","CC-2102 Facilities","CC-7330 Fleet","CC-9090 Travel","CC-3115 Commercial"];
    const VENDORS_BY_CAT = {
      electricity: ["EDF Energy","Vattenfall","Enedis","Eneco","SWM","Octopus Energy"],
      natural_gas: ["British Gas","GASAG","SWM","Total Energies","Engie"],
      diesel: ["WEX","Shell Fleet","BP Plus","Circle K Routex"],
      flight: ["American Express GBT","BCD Travel","FCM Travel","CWT"],
      goods: ["Siemens AG","3M Europe","BASF","Henkel","Bosch"],
    };
    const PAYMENT = ["Invoice (NET30)","Invoice (NET60)","Corporate card","Direct debit"];
    const APPROVERS = ["M. Hartmann","S. Okafor","L. Becker","J. Weber","A. Schroeder"];
    const REGIONS = { "London HQ":"UK","Berlin HQ":"DE","Paris Office":"FR","Munich Warehouse":"DE","Rotterdam DC":"NL","UK Fleet":"UK","DE Fleet":"DE","—":"—" };
    const vendorList = VENDORS_BY_CAT[e.category] || VENDORS_BY_CAT.goods;
    const invoiceSerial = String(10000 + (h % 89999));
    e.extra_meta = {
      "Supplier / vendor": e.details?.supplier || e.details?.card_issuer || vendorList[h % vendorList.length],
      "Invoice / reference #": (e.category === "flight" ? "TKT-" : "INV-") + invoiceSerial,
      "PO number": "PO-" + (2026000 + (h % 9999)),
      "Cost center": COST_CENTERS[h % COST_CENTERS.length],
      "GL account": "60" + (100 + (h % 899)) + " · " +
        (e.category === "electricity" ? "Utilities — electricity" :
         e.category === "natural_gas" ? "Utilities — gas" :
         e.category === "diesel" ? "Fleet fuel" :
         e.category === "flight" ? "Travel — air" : "COGS — purchased goods"),
      "Payment terms": PAYMENT[h % PAYMENT.length],
      "Approver": APPROVERS[h % APPROVERS.length],
      "Region code": REGIONS[e.site] || "—",
      "Currency": e.category === "flight" ? (h % 2 ? "EUR" : "GBP") : (e.site?.includes("London") ? "GBP" : e.site?.includes("Paris") ? "EUR" : "EUR"),
      "Amount (gross)": (e.category === "flight" ? "€" + (800 + (h % 4500)).toLocaleString() :
                        e.category === "diesel" ? "€" + (1800 + (h % 6000)).toLocaleString() :
                        "€" + (420 + (h % 8400)).toLocaleString()),
      "Source row": "Row " + (12 + (h % 820)),
      "Original filename": b.fileName || b.id,
    };
  }
});

// Propagate onto calcs for table rendering
CALCS.forEach(c => {
  const e = ENTRIES.find(x => x.id === c.entryId);
  if (!e) return;
  c.business_unit = e.business_unit;
  c.business_activity = e.business_activity;
  c.user_assigned = e.user_assigned;
  c.start_date = e.start_date;
  c.end_date = e.end_date;
  c.data_input_type = e.data_input_type;
  c.created_on = e.created_on;
  c.last_updated = e.last_updated;
  c.files_count = e.files_count;
  c.notes = e.notes;
  c.bulk_import_ref = e.bulk_import_ref;
  c.bulk_import_file = e.bulk_import_file;
  c.custom_factor = e.custom_factor;
});

// Derive entry lifecycle status from child calcs + field completeness
// draft     → mandatory fields missing (synthetic: a handful of entries with blank notes + missing meter/supplier)
// ready     → validations passed, no calcs yet
// suggested → has calculations, not all confirmed yet (under review)
// confirmed → every calculation confirmed
// failed    → pipeline error (synthetic: a couple of entries)
ENTRIES.forEach(e => {
  const h = hash(e.id);
  const mine = CALCS.filter(c => c.entryId === e.id);
  const anyConfirmed = mine.some(c => c.status === "confirmed");
  const anyPending   = mine.some(c => c.status === "pending");
  const anySuggested = mine.some(c => c.status === "suggested");

  // Synthetic failed (rare — pipeline error)
  if (h % 37 === 0) { e.entry_status = "failed"; return; }
  // Synthetic draft (~1/8 — mandatory fields missing). Strip any calcs.
  if (h % 8 === 0) {
    e.entry_status = "draft";
    e.missing_fields = ["Supplier", "Meter / account #"].filter((_,i) => (h >> i) & 1);
    if (e.missing_fields.length === 0) e.missing_fields = ["Supplier"];
    e._strip_calcs = true;
    return;
  }
  // Synthetic ready (~1/9 — validated, not submitted). Strip any calcs.
  if (h % 9 === 0) {
    e.entry_status = "ready";
    e._strip_calcs = true;
    return;
  }

  // V2: the entry status IS the rolled-up calculation review status — an entry
  // with calculations is "suggested" until every calc is confirmed, then
  // "confirmed". (Per-calc confidence is kept separately for EF-match quality.)
  if (mine.length === 0) { e.entry_status = "ready"; return; }
  e.entry_status = mine.every(c => c.status === "confirmed") ? "confirmed" : "suggested";
});

// Strip calcs from draft/ready synthetic entries
const _stripIds = new Set(ENTRIES.filter(e => e._strip_calcs).map(e => e.id));
for (let i = CALCS.length - 1; i >= 0; i--) {
  if (_stripIds.has(CALCS[i].entryId)) CALCS.splice(i, 1);
}
ENTRIES.forEach(e => { delete e._strip_calcs; });

// Expose
Object.assign(window, { BATCHES, FACTORS, ENTRIES, CALCS, scopeForCategory, BUSINESS_UNITS, USERS });

// ── Runtime dataset loader ──────────────────────────────────────────────────
// Rebuilds window.ENTRIES / window.CALCS / window.BATCHES from the compact,
// deduped dataset.json (one entry + one calc per row). Called from index.html
// before the first render; falls back to the seed above if the fetch fails.
window.applyDataset = function (ds) {
  const D = ds.dict, F = ds.factors;
  const { cat, site, bu, act, user, s3, cur, method, supplier, batch } = D;
  const fmtNum = (n) => n == null ? "" : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  // Deterministic high confidence (0.85–0.98) — these are confirmed/submitted
  // calcs with a known matched factor, so the EF-match panel shows it confidently.
  const confOf = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return 0.85 + (Math.abs(h) % 14) / 100; };
  const N = ds.rows.length;
  const entries = new Array(N), calcs = new Array(N);
  for (let i = 0; i < N; i++) {
    const r = ds.rows[i];
    const id = r[0], category = cat[r[1]], siteName = site[r[2]], start = r[3], end = r[4],
      amount = r[5], co2e = r[6], price = r[7], factor = F[r[8]], sup = supplier[r[9]],
      buName = bu[r[10]], actName = act[r[11]], userName = user[r[12]], s3cat = s3[r[13]],
      curName = cur[r[14]], meth = method[r[15]], batchId = batch[r[16]], unit = r[17],
      product = r[18], desc = r[19], notes = r[20];
    const title = product || desc || factor.name;
    const amtStr = amount != null ? fmtNum(amount) + " " + unit : "";
    const dataInput = "Bulk import (CSV)";
    entries[i] = {
      id, batchId, category, date: start, site: siteName,
      summary: (amtStr ? amtStr + " · " : "") + title,
      details: { supplier: sup, activity_amount: amount, activity_unit: unit, product_service: product, description: desc },
      business_unit: buName, business_activity: actName, user_assigned: userName,
      data_input_type: dataInput, start_date: start, end_date: end,
      created_on: start, last_updated: end, files_count: 0,
      notes, bulk_import_ref: batchId === "manual" ? "—" : "Bulk import (CSV)", bulk_import_file: batchId === "manual" ? "—" : "spend_fy2025_anon.csv", custom_factor: "—", entry_status: "confirmed",
      extra_meta: {
        "Supplier / vendor": sup || "—",
        "Spend": price != null ? curName + " " + fmtNum(price) : "—",
        "Activity amount": amount != null ? fmtNum(amount) + " " + unit : "—",
        "Emission factor": factor.name,
        "EF source": factor.source, "EF year": factor.vintage || "—", "EF region": factor.region || "—",
        "Scope & category": s3cat,
        "Line description": desc || "—",
        "Import batch": batchId,
      },
    };
    calcs[i] = {
      id: "C-" + id, entryId: id, date: start, site: siteName, category, scope: 3,
      activity: (amtStr ? amtStr + " · " : "") + meth, gas: "CO₂e", method: meth, factor,
      quantity: amount, unit, kgCO2e: co2e, status: "confirmed", confidence: confOf(id),
      reason: "Matched to " + factor.name + " (" + factor.source + (factor.vintage ? " " + factor.vintage : "") + ").",
      business_unit: buName, business_activity: actName, user_assigned: userName,
      start_date: start, end_date: end, data_input_type: dataInput,
      created_on: start, last_updated: end, files_count: 0, notes,
      bulk_import_ref: batchId === "manual" ? "—" : "Bulk import (CSV)", bulk_import_file: batchId === "manual" ? "—" : "spend_fy2025_anon.csv", custom_factor: "—",
    };
  }
  const batches = batch.map((bid, idx) => ({
    id: bid, label: bid === "manual" ? "Manual entry" : "Bulk import · spend FY2025",
    source: bid === "manual" ? "manual" : "csv", date: "2025-09-30",
    uploadedBy: "Amelia Schroeder", fileName: bid === "manual" ? undefined : "spend_fy2025_anon.csv",
  }));
  // ── Demo: a handful of manually-created entries in varied workflow states,
  // prepended so they sit on the first page. The bulk-imported rows are all
  // Submitted · Confirmed, so these surface the other Data-entry / Calculation
  // statuses (Draft, Ready to submit, Review pending, Processing). ────────────
  const mkFactor = (name, kpu, src) => ({ name, source: src, vintage: "2024", unit: "kg", kg_per_unit: kpu, region: "Global", dataset: src, lca: "Cradle-to-gate" });
  const mkDemoEntry = (o) => ({
    id: o.id, batchId: "manual", category: o.category, date: o.date, site: o.site,
    summary: o.summary,
    details: { supplier: o.supplier, activity_amount: o.amount, activity_unit: o.unit, product_service: o.product, description: o.desc },
    business_unit: o.bu, business_activity: o.activity, user_assigned: o.user,
    data_input_type: "Manual entry", start_date: o.start, end_date: o.end,
    created_on: o.date, last_updated: o.date, files_count: 0,
    notes: o.notes || "", bulk_import_ref: "—", bulk_import_file: "—", custom_factor: "—", entry_status: o.entry_status,
    calc_relation: o.calc_relation || "additive",
    ef_selection: o.ef_selection,
    extra_meta: {
      "Supplier / vendor": o.supplier || "—",
      "Spend": o.spend || "—",
      "Activity amount": o.amount != null ? o.amount.toLocaleString() + " " + o.unit : "—",
      "Emission factor": o.factor ? o.factor.name : "Not matched yet",
      "Scope & category": o.s3cat,
      "Line description": o.desc || "—",
      "Import batch": "Manual entry",
    },
  });
  const mkDemoCalc = (e, o) => ({
    id: o.id || ("C-" + e.id), entryId: e.id, date: e.date, site: e.site, category: o.category || e.category, scope: o.scope || 3,
    activity: o.summary, gas: "CO₂e", method: o.method, calc_method: o.calc_method || "GWP100", factor: o.factor,
    quantity: o.amount, unit: o.unit, kgCO2e: o.kgCO2e, status: o.calcStatus, confidence: o.confidence,
    reason: o.reason || ("Matched to " + (o.factor ? o.factor.name : "—") + "."),
    business_unit: e.business_unit, business_activity: e.business_activity, user_assigned: e.user_assigned,
    start_date: e.start_date, end_date: e.end_date, data_input_type: "Manual entry",
    created_on: e.created_on, last_updated: e.last_updated, files_count: 0, notes: e.notes,
    bulk_import_ref: "—", bulk_import_file: "—", custom_factor: "—",
  });
  const demoSpecs = [
    { id: "draft-2f9c", entry_status: "draft", category: "purchased_goods", site: "Vienna HQ",
      supplier: "Donauland Verpackung GmbH", product: "Corrugated packaging", desc: "Q2 packaging spend — awaiting line detail",
      amount: 18450, unit: "€", spend: "EUR 18,450", bu: "Procurement", activity: "Purchased goods", user: "Lena Hofer",
      date: "2026-06-22", start: "2026-04-01", end: "2026-06-30", s3cat: "1 · Purchased goods & services",
      summary: "Corrugated packaging · draft", notes: "Draft — supplier invoice not yet itemised" },
    { id: "ready-7b1a", entry_status: "ready", category: "business_travel", site: "Munich Office",
      supplier: "Alpen Rail Travel", product: "Rail travel", desc: "Employee rail travel, May 2026",
      amount: 12400, unit: "km", spend: "EUR 3,720", bu: "Sales", activity: "Business travel", user: "Tobias Brandt",
      date: "2026-06-20", start: "2026-05-01", end: "2026-05-31", s3cat: "6 · Business travel",
      summary: "Rail travel 12,400 km · ready to submit", notes: "Ready — pending analyst sign-off" },
    { id: "review-4e8d", entry_status: "confirmed", category: "capital_goods", site: "Linz Plant",
      supplier: "Steiermark Maschinenbau AG", product: "CNC machining centre", desc: "New CNC line — spend-based estimate",
      amount: 240000, unit: "€", spend: "EUR 240,000", bu: "Operations", activity: "Capital goods", user: "Markus Reiter",
      date: "2026-06-18", start: "2026-06-01", end: "2026-06-15", s3cat: "2 · Capital goods",
      summary: "CNC machining centre · review pending",
      factor: mkFactor("Spend-based · industrial machinery", 0.31, "EXIOBASE"), method: "Spend-based",
      kgCO2e: 74400, calcStatus: "suggested", confidence: 0.52, reason: "Low-confidence spend-based match — verify activity data." },
    { id: "review-9c2f", entry_status: "confirmed", category: "upstream_transport", site: "Rotterdam DC",
      supplier: "NordSee Logistik BV", product: "Road freight", desc: "Inbound road freight, June 2026",
      amount: 8800, unit: "t·km", spend: "EUR 6,100", bu: "Logistics", activity: "Upstream transport", user: "Sofie Daan",
      date: "2026-06-17", start: "2026-06-01", end: "2026-06-16", s3cat: "4 · Upstream transport & distribution",
      summary: "Road freight 8,800 t·km · processing",
      factor: mkFactor("Road freight, HGV >32t", 0.082, "DEFRA"), method: "Activity-based",
      kgCO2e: 721600, calcStatus: "pending", confidence: null, reason: "Calculation queued — matching activity factor." },
    { id: "sub-1a6b", entry_status: "confirmed", category: "purchased_goods", site: "Vienna HQ",
      supplier: "Wiener Bürobedarf GmbH", product: "Office paper", desc: "Office paper, FY26 Q1",
      amount: 5400, unit: "kg", spend: "EUR 4,320", bu: "Facilities", activity: "Purchased goods", user: "Lena Hofer",
      date: "2026-06-15", start: "2026-01-01", end: "2026-03-31", s3cat: "1 · Purchased goods & services",
      summary: "Office paper 5,400 kg · submitted",
      factor: mkFactor("Paper & paperboard, primary", 0.94, "ecoinvent"), method: "Activity-based",
      kgCO2e: 5076, calcStatus: "confirmed", confidence: 0.93 },
  ];
  // Multi-calculation entries: single lines split across several emission
  // factors. Prepended to the very top so the master-detail layout (parent
  // aggregate + per-calc child rows) + two-level selection sit on the first
  // rows. The leading ones are Submitted (all calcs confirmed); the last is a
  // review case (one suggested calc) for variety.
  demoSpecs.unshift(
    // Alternative (A-or-B) entries grouped on top for demo: electricity estimated
    // location- vs market-based. Not additive, so each parent total shows "—".
    {
      id: "multi-elec-4b1c", entry_status: "confirmed", category: "electricity", site: "Berlin HQ",
      calc_relation: "alternative",
      supplier: "Vattenfall", product: "Grid electricity",
      desc: "Grid electricity, Berlin HQ — FY26 Q2 (location vs market-based)",
      amount: 84000, unit: "kWh", spend: "EUR 21,000", bu: "Facilities", activity: "Purchased electricity", user: "Lena Hofer",
      date: "2026-06-20", start: "2026-04-01", end: "2026-06-30", s3cat: "—",
      summary: "Grid electricity · location vs market-based",
      calcs: [
        { summary: "Location-based", method: "Location-based", scope: 2, factor: mkFactor("DE grid electricity — location-based", 0.38, "AIB/UBA"),
          amount: 84000, unit: "kWh", kgCO2e: 31920, calcStatus: "confirmed", confidence: 0.95 },
        { summary: "Market-based", method: "Market-based", scope: 2, factor: mkFactor("Supplier residual mix — market-based", 0.21, "Supplier disclosure"),
          amount: 84000, unit: "kWh", kgCO2e: 17640, calcStatus: "confirmed", confidence: 0.9 },
      ],
    },
    {
      id: "multi-elec-9d22", entry_status: "confirmed", category: "electricity", site: "London HQ",
      calc_relation: "alternative",
      supplier: "EDF Energy", product: "Grid electricity",
      desc: "Grid electricity, London HQ — FY26 Q2 (location vs green tariff)",
      amount: 132000, unit: "kWh", spend: "GBP 29,700", bu: "Facilities", activity: "Purchased electricity", user: "Tobias Brandt",
      date: "2026-06-19", start: "2026-04-01", end: "2026-06-30", s3cat: "—",
      summary: "Grid electricity · location vs market-based",
      calcs: [
        { summary: "Location-based", method: "Location-based", scope: 2, factor: mkFactor("UK grid electricity — location-based", 0.207, "DEFRA"),
          amount: 132000, unit: "kWh", kgCO2e: 27324, calcStatus: "confirmed", confidence: 0.96 },
        { summary: "Market-based", method: "Market-based", scope: 2, factor: mkFactor("Renewable tariff (REGO-backed) — market-based", 0.0, "Supplier contract"),
          amount: 132000, unit: "kWh", kgCO2e: 0, calcStatus: "confirmed", confidence: 0.93 },
      ],
    },
    {
      id: "multi-elec-1f70", entry_status: "confirmed", category: "electricity", site: "Paris Office",
      calc_relation: "alternative",
      supplier: "EDF", product: "Grid electricity",
      desc: "Grid electricity, Paris Office — FY26 Q2 (location vs residual mix)",
      amount: 96000, unit: "kWh", spend: "EUR 18,200", bu: "Facilities", activity: "Purchased electricity", user: "Amelia Schroeder",
      date: "2026-06-18", start: "2026-04-01", end: "2026-06-30", s3cat: "—",
      summary: "Grid electricity · location vs market-based",
      calcs: [
        { summary: "Location-based", method: "Location-based", scope: 2, factor: mkFactor("FR grid electricity — location-based", 0.052, "ADEME"),
          amount: 96000, unit: "kWh", kgCO2e: 4992, calcStatus: "confirmed", confidence: 0.95 },
        { summary: "Market-based", method: "Market-based", scope: 2, factor: mkFactor("FR residual mix — market-based", 0.45, "AIB"),
          amount: 96000, unit: "kWh", kgCO2e: 43200, calcStatus: "confirmed", confidence: 0.87 },
      ],
    },
    {
      id: "multi-7f3b", entry_status: "confirmed", category: "capital_goods", site: "Linz Plant",
      supplier: "Steiermark Maschinenbau AG", product: "Production line upgrade",
      desc: "Production line upgrade, FY26 Q1 — machinery + installation",
      amount: 320000, unit: "€", spend: "EUR 320,000", bu: "Operations", activity: "Capital goods", user: "Markus Reiter",
      date: "2026-06-24", start: "2026-01-01", end: "2026-03-31", s3cat: "2 · Capital goods",
      summary: "Production line upgrade · 2 calculations",
      calcs: [
        { summary: "Industrial machinery", method: "Spend-based", factor: mkFactor("Industrial machinery, spend", 0.31, "EXIOBASE"),
          amount: 280000, unit: "€", kgCO2e: 86800, calcStatus: "confirmed", confidence: 0.84 },
        { summary: "Electrical installation", method: "Spend-based", factor: mkFactor("Electrical installation, spend", 0.27, "EXIOBASE"),
          amount: 40000, unit: "€", kgCO2e: 10800, calcStatus: "confirmed", confidence: 0.81 },
      ],
    },
    {
      id: "multi-2e9d", entry_status: "confirmed", category: "purchased_goods", site: "Hamburg Office",
      supplier: "Alpenland Konsumgüter Handel", product: "Catering & supplies",
      desc: "Catering & supplies, FY26 Q1 — multi-line invoice",
      amount: 7600, unit: "kg", spend: "EUR 8,900", bu: "Facilities", activity: "Purchased goods", user: "Amelia Schroeder",
      date: "2026-06-23", start: "2026-01-01", end: "2026-03-31", s3cat: "1 · Purchased goods & services",
      summary: "Catering & supplies · 3 calculations",
      calcs: [
        { summary: "Food & beverage", method: "Activity-based", factor: mkFactor("Food & beverage, mixed", 1.9, "ecoinvent"),
          amount: 3200, unit: "kg", kgCO2e: 6080, calcStatus: "confirmed", confidence: 0.9 },
        { summary: "Paper & packaging", method: "Activity-based", factor: mkFactor("Paper & paperboard, primary", 0.94, "ecoinvent"),
          amount: 2400, unit: "kg", kgCO2e: 2256, calcStatus: "confirmed", confidence: 0.91 },
        { summary: "Cleaning supplies", method: "Activity-based", factor: mkFactor("Cleaning agents, mixed", 1.2, "ecoinvent"),
          amount: 2000, unit: "kg", kgCO2e: 2400, calcStatus: "confirmed", confidence: 0.87 },
      ],
    },
    {
      id: "multi-8a2c", entry_status: "confirmed", category: "upstream_transport", site: "Rotterdam DC",
      supplier: "NordSee Logistik BV", product: "Inbound freight",
      desc: "Inbound freight, FY26 Q2 — split by transport leg",
      amount: 14200, unit: "t·km", spend: "EUR 9,400", bu: "Logistics", activity: "Upstream transport", user: "Sofie Daan",
      date: "2026-06-21", start: "2026-04-01", end: "2026-06-30", s3cat: "4 · Upstream transport & distribution",
      summary: "Inbound freight · 2 calculations",
      calcs: [
        { summary: "Road freight, HGV >32t", method: "Activity-based", factor: mkFactor("Road freight, HGV >32t", 0.082, "DEFRA"),
          amount: 5400, unit: "t·km", kgCO2e: 442800, calcStatus: "confirmed", confidence: 0.9 },
        { summary: "Sea freight, container", method: "Activity-based", factor: mkFactor("Sea freight, container", 0.016, "DEFRA"),
          amount: 8800, unit: "t·km", kgCO2e: 140800, calcStatus: "confirmed", confidence: 0.86 },
      ],
    },
    {
      id: "multi-3d7e", entry_status: "confirmed", category: "purchased_goods", site: "Vienna HQ",
      supplier: "Wiener Bürobedarf GmbH", product: "Mixed facilities supplies",
      desc: "Mixed facilities supplies, FY26 Q2 — split across materials",
      amount: 9200, unit: "kg", spend: "EUR 11,800", bu: "Facilities", activity: "Purchased goods", user: "Lena Hofer",
      date: "2026-06-19", start: "2026-04-01", end: "2026-06-30", s3cat: "1 · Purchased goods & services",
      summary: "Mixed facilities supplies · 3 calculations",
      calcs: [
        { summary: "Paper & paperboard", method: "Activity-based", factor: mkFactor("Paper & paperboard, primary", 0.94, "ecoinvent"),
          amount: 5400, unit: "kg", kgCO2e: 5076, calcStatus: "confirmed", confidence: 0.93 },
        { summary: "Plastics, primary form", method: "Activity-based", factor: mkFactor("Plastics, primary form", 2.7, "ecoinvent"),
          amount: 1800, unit: "kg", kgCO2e: 4860, calcStatus: "confirmed", confidence: 0.88 },
        { summary: "Office electronics (spend-based)", method: "Spend-based", factor: mkFactor("Office electronics, spend", 0.42, "EXIOBASE"),
          amount: 6800, unit: "€", kgCO2e: 2856, calcStatus: "suggested", confidence: 0.49,
          reason: "Low-confidence spend-based match — verify with activity data." },
      ],
    },
  );
  // ── Multi-calc examples from the PM's real export (2026-07-01) ─────────────
  // Source: data-entries-2026-07-01.csv + Calculation-GHG-results-2026-07-01.csv
  // (8 test data entries / 29 calc rows — the set Ruben verified the PRD's
  // "Expandable Row Logic" against). Values are verbatim from the export.
  // Summary-row behaviour follows the PRD deconfliction table:
  //   Shared → show once · Summed → total · Conflicting → "Multiple".
  const FX = (name, value, src, dataset, year, region, lca, unit) =>
    ({ ...mkFactor(name, value, src), dataset, vintage: year, region, lca, unit });
  demoSpecs.unshift(
    // 1 — Electricity (market + location + Scope 3.3): 12,000 kWh Berlin office.
    //     Everything except consumption conflicts → "Multiple" across the row
    //     (incl. CO2e — market vs location are alternatives, not additive).
    {
      id: "a219af03-6509-4552-9044-f7fa735b1485", entry_status: "confirmed", category: "electricity", site: "1O Taicang",
      calc_relation: "alternative",
      supplier: "Test Electricity Case - Berlin Office", product: "Grid electricity",
      desc: "",  // CSV consumption details carry no description for this entry
      amount: 12000, unit: "kWh", spend: "—", bu: "1O Taicang", activity: "Electricity", user: "Ruben Korenke",
      date: "2026-07-01", start: "2026-01-01", end: "2026-01-31", s3cat: "—",
      ef_selection: "Auto-selected",
      summary: "Electricity · market + location + Scope 3.3",
      calcs: [
        { summary: "Market-based (Scope 2)", method: "Market-based", scope: 2, category: "electricity",
          factor: FX("electricity, low voltage, residual mix", 0.7195, "ecoinvent", "electricity emission factors – scope 2 – 3 in ecoinvent v3.12", "2024", "DE", "scope-2", "kWh"),
          amount: 12000, unit: "kWh", kgCO2e: 8634.5515, calcStatus: "confirmed", confidence: 0.95 },
        { summary: "Upstream emissions (Scope 3.3)", method: "Activity-based", scope: 3, category: "electricity",
          factor: FX("market for electricity, low voltage", 0.0848, "ecoinvent", "electricity emission factors – scope 2 – 3 in ecoinvent v3.12", "2022", "DE", "scope-3-upstream-emissions", "kWh"),
          amount: 12000, unit: "kWh", kgCO2e: 1017.6038, calcStatus: "confirmed", confidence: 0.9 },
        { summary: "Location-based (Scope 2)", method: "Location-based", scope: 2, category: "electricity",
          factor: FX("market for electricity, low voltage", 0.3632, "ecoinvent", "electricity emission factors – scope 2 – 3 in ecoinvent v3.12", "2022", "DE", "scope-2", "kWh"),
          amount: 12000, unit: "kWh", kgCO2e: 4358.0172, calcStatus: "confirmed", confidence: 0.95 },
      ],
    },
    // 2 — Spend-based purchased goods: €4,500 office supplies → 3 EXIOBASE rows.
    {
      id: "13929f61-3440-442d-9605-a1d9844c7633", entry_status: "confirmed", category: "purchased_goods", site: "1O Taicang",
      supplier: "", product: "Office supplies",
      desc: "Test Spend-based Case - Office Supplies",
      amount: 4500, unit: "€", spend: "EUR 4,500", bu: "1O Taicang", activity: "Purchased goods and services", user: "Ruben Korenke",
      date: "2026-07-01", start: "2026-01-01", end: "2026-01-31", s3cat: "1 · Purchased goods & services",
      ef_selection: "Manually selected",
      summary: "Purchased goods · spend-based (supplier scope split)",
      calcs: [
        { summary: "Supplier Scope 3", method: "Spend-based", scope: 3, category: "purchased_goods",
          factor: FX("Office machinery and computers", 0.434, "EXIOBASE", "3_10_1_20250610", "2022", "DE", "scope-3", "EUR"),
          amount: 4500, unit: "EUR", kgCO2e: 1953.1151, calcStatus: "confirmed" },
        { summary: "Supplier Scope 1", method: "Spend-based", scope: 3, category: "purchased_goods",
          factor: FX("Office machinery and computers", 0.01926, "EXIOBASE", "3_10_1_20250610", "2022", "DE", "scope-1", "EUR"),
          amount: 4500, unit: "EUR", kgCO2e: 86.6652, calcStatus: "confirmed" },
        { summary: "Supplier Scope 2", method: "Spend-based", scope: 3, category: "purchased_goods",
          factor: FX("Office machinery and computers", 0.05152, "EXIOBASE", "3_10_1_20250610", "2022", "DE", "scope-2", "EUR"),
          amount: 4500, unit: "EUR", kgCO2e: 231.8501, calcStatus: "confirmed" },
      ],
    },
    // 3 — Employee commuting: 10 calc rows (5 modes × WTT+TTW, incl. two zero
    //     "NA" legs — PRD 2026-07-01 correction). Consumption Multiple ·
    //     EF name Multiple · LCA Multiple · CO2e summed (1,706.78).
    {
      id: "dabbf969-3caa-42ac-a8bd-055b6500180c", entry_status: "confirmed", category: "employee_commuting", site: "1O Taicang",
      supplier: "", product: "Employee commuting — HQ",
      desc: "", notes: "Test Employee Commuting Case - HQ",  // CSV: text is in Notes, no description
      amount: null, unit: "", spend: "—", bu: "1O Taicang", activity: "Employee commuting", user: "Ruben Korenke",
      date: "2026-07-01", start: "2026-01-01", end: "2026-01-31", s3cat: "7 · Employee commuting",
      ef_selection: "Auto-selected",
      summary: "Employee commuting · 10 calculations (5 modes × WTT/TTW)",
      calcs: [
        { summary: "Bicycle / on-foot (TTW)", method: "Activity-based", scope: 3, category: "employee_commuting",
          factor: FX("NA", "NA", "NA", "NA", "NA", "NA", "NA", "vehicle·km"),
          amount: 0, unit: "vehicle*km", kgCO2e: 0, calcStatus: "confirmed" },
        { summary: "Rail, National rail (TTW)", method: "Activity-based", scope: 3, category: "employee_commuting",
          factor: FX("Rail, National rail", 0.0355, "UK Government", "UK Government GHG Conversion Factors for Company Reporting 2024 v1", "2024", "GB", "TTW", "passenger·km"),
          amount: 456, unit: "passenger*km", kgCO2e: 16.188, calcStatus: "confirmed", confidence: 0.9 },
        { summary: "Bicycle / on-foot (WTT)", method: "Activity-based", scope: 3, category: "employee_commuting",
          factor: FX("NA", "NA", "NA", "NA", "NA", "NA", "NA", "vehicle·km"),
          amount: 0, unit: "vehicle*km", kgCO2e: 0, calcStatus: "confirmed" },
        { summary: "Rail, Light rail and tram (WTT)", method: "Activity-based", scope: 3, category: "employee_commuting",
          factor: FX("Rail, Light rail and tram", 0.0075, "UK Government", "UK Government GHG Conversion Factors for Company Reporting 2024 v1", "2024", "GB", "WTT", "passenger·km"),
          amount: 741, unit: "passenger*km", kgCO2e: 5.5575, calcStatus: "confirmed", confidence: 0.9 },
        { summary: "Motorbike, Average (WTT)", method: "Activity-based", scope: 3, category: "employee_commuting",
          factor: FX("Motorbike, Average", 0.0296, "UK Government", "UK Government GHG Conversion Factors for Company Reporting 2024 v1", "2024", "GB", "WTT", "passenger·km"),
          amount: 47.5, unit: "passenger*km", kgCO2e: 1.406, calcStatus: "confirmed", confidence: 0.9 },
        { summary: "Motorbike, Average (TTW)", method: "Activity-based", scope: 3, category: "employee_commuting",
          factor: FX("Motorbike, Average", 0.1137, "UK Government", "UK Government GHG Conversion Factors for Company Reporting 2024 v1", "2024", "GB", "TTW", "passenger·km"),
          amount: 47.5, unit: "passenger*km", kgCO2e: 5.4007, calcStatus: "confirmed", confidence: 0.9 },
        { summary: "Rail, Light rail and tram (TTW)", method: "Activity-based", scope: 3, category: "employee_commuting",
          factor: FX("Rail, Light rail and tram", 0.0286, "UK Government", "UK Government GHG Conversion Factors for Company Reporting 2024 v1", "2024", "GB", "TTW", "passenger·km"),
          amount: 741, unit: "passenger*km", kgCO2e: 21.1926, calcStatus: "confirmed", confidence: 0.9 },
        { summary: "Average car, Unknown (TTW)", method: "Activity-based", scope: 3, category: "employee_commuting",
          factor: FX("Average car, Unknown", 0.1669, "UK Government", "UK Government GHG Conversion Factors for Company Reporting 2024 v1", "2024", "GB", "TTW", "passenger·km"),
          amount: 7837.5, unit: "passenger*km", kgCO2e: 1308.0787, calcStatus: "confirmed", confidence: 0.9 },
        { summary: "Rail, National rail (WTT)", method: "Activity-based", scope: 3, category: "employee_commuting",
          factor: FX("Rail, National rail", 0.009, "UK Government", "UK Government GHG Conversion Factors for Company Reporting 2024 v1", "2024", "GB", "WTT", "passenger·km"),
          amount: 456, unit: "passenger*km", kgCO2e: 4.104, calcStatus: "confirmed", confidence: 0.9 },
        { summary: "Average car, Unknown (WTT)", method: "Activity-based", scope: 3, category: "employee_commuting",
          factor: FX("Average car, Unknown", 0.044, "UK Government", "UK Government GHG Conversion Factors for Company Reporting 2024 v1", "2024", "GB", "WTT", "passenger·km"),
          amount: 7837.5, unit: "passenger*km", kgCO2e: 344.85, calcStatus: "confirmed", confidence: 0.9 },
      ],
    },
    // 4 — Business travel, spend-based: €800 flight booking → 3 EXIOBASE rows.
    {
      id: "5d2857c6-6e32-4671-9966-305b8ac17932", entry_status: "confirmed", category: "business_travel", site: "1O Taicang",
      supplier: "", product: "Flight booking",
      desc: "Test Business Travel Spend Case - Flight Booking",
      amount: 800, unit: "€", spend: "EUR 800", bu: "1O Taicang", activity: "Business travel", user: "Ruben Korenke",
      date: "2026-07-01", start: "2026-01-01", end: "2026-01-31", s3cat: "6 · Business travel",
      ef_selection: "Manually selected",
      summary: "Business travel · spend-based (supplier scope split)",
      calcs: [
        { summary: "Supplier Scope 2", method: "Spend-based", scope: 3, category: "business_travel",
          factor: FX("Air transport services", 0.002406, "EXIOBASE", "3_10_1_20250610", "2022", "DE", "scope-2", "EUR"),
          amount: 800, unit: "EUR", kgCO2e: 1.925, calcStatus: "confirmed" },
        { summary: "Supplier Scope 1", method: "Spend-based", scope: 3, category: "business_travel",
          factor: FX("Air transport services", 0.2999, "EXIOBASE", "3_10_1_20250610", "2022", "DE", "scope-1", "EUR"),
          amount: 800, unit: "EUR", kgCO2e: 239.9484, calcStatus: "confirmed" },
        { summary: "Supplier Scope 3", method: "Spend-based", scope: 3, category: "business_travel",
          factor: FX("Air transport services", 0.3558, "EXIOBASE", "3_10_1_20250610", "2022", "DE", "scope-3", "EUR"),
          amount: 800, unit: "EUR", kgCO2e: 284.6463, calcStatus: "confirmed" },
      ],
    },
    // 5 — Business travel, activity-based (WTT/TTW): flight BER → JFK, 6,389.87 km.
    //     EF name shared · LCA Multiple · CO2e summed (1,190.43).
    {
      id: "f5de0044-6883-4a5b-9980-21148a0544fd", entry_status: "confirmed", category: "business_travel", site: "1O Taicang",
      supplier: "", product: "Flight BER → JFK",
      desc: "Test Business Travel Activity Case - Flight WTT-TTW",
      amount: 6389.8693, unit: "km", spend: "—", bu: "1O Taicang", activity: "Business travel", user: "Ruben Korenke",
      date: "2026-07-01", start: "2026-01-01", end: "2026-01-31", s3cat: "6 · Business travel",
      ef_selection: "Auto-selected",
      summary: "Business travel · activity-based (WTT + TTW)",
      calcs: [
        { summary: "Tank-to-wheel (TTW)", method: "Activity-based", scope: 3, category: "business_travel",
          factor: FX("Business travel- air, Long-haul, to/from UK, Average passenger, Without RF", 0.1542, "UK Government", "UK Government GHG Conversion Factors for Company Reporting 2024 v1", "2024", "GB", "TTW", "km"),
          amount: 6389.8693, unit: "km", kgCO2e: 985.3178, calcStatus: "confirmed", confidence: 0.9 },
        { summary: "Well-to-tank (WTT)", method: "Activity-based", scope: 3, category: "business_travel",
          factor: FX("Business travel- air, Long-haul, to/from UK, Average passenger, Without RF", 0.0321, "UK Government", "UK Government GHG Conversion Factors for Company Reporting 2024 v1", "2024", "GB", "WTT", "km"),
          amount: 6389.8693, unit: "km", kgCO2e: 205.1148, calcStatus: "confirmed", confidence: 0.9 },
      ],
    },
    // 6 — Upstream T&D, spend-based: €1,200 freight invoice → 3 EXIOBASE rows
    //     (LCA scope-1/2/3). EF name shared · LCA Multiple · CO2e summed (251.85).
    {
      id: "50367a7b-95c6-4e74-968c-0f5c37d07769", entry_status: "confirmed", category: "upstream_transport", site: "1O Taicang",
      supplier: "", product: "Freight invoice",
      desc: "Test Upstream T&D Spend Case - Freight Invoice",
      amount: 1200, unit: "€", spend: "EUR 1,200", bu: "1O Taicang", activity: "Upstream transportation and distribution", user: "Ruben Korenke",
      date: "2026-07-01", start: "2026-01-01", end: "2026-01-31", s3cat: "4 · Upstream transport & distribution",
      ef_selection: "Manually selected",
      summary: "Upstream T&D · spend-based (supplier scope split)",
      calcs: [
        { summary: "Supplier Scope 2", method: "Spend-based", scope: 3, category: "upstream_transport",
          factor: FX("Other land transportation services", 0.01326, "EXIOBASE", "3_10_1_20250610", "2022", "DE", "scope-2", "EUR"),
          amount: 1200, unit: "EUR", kgCO2e: 15.917, calcStatus: "confirmed" },
        { summary: "Supplier Scope 1", method: "Spend-based", scope: 3, category: "upstream_transport",
          factor: FX("Other land transportation services", 0.08595, "EXIOBASE", "3_10_1_20250610", "2022", "DE", "scope-1", "EUR"),
          amount: 1200, unit: "EUR", kgCO2e: 103.1443, calcStatus: "confirmed" },
        { summary: "Supplier Scope 3", method: "Spend-based", scope: 3, category: "upstream_transport",
          factor: FX("Other land transportation services", 0.1107, "EXIOBASE", "3_10_1_20250610", "2022", "DE", "scope-3", "EUR"),
          amount: 1200, unit: "EUR", kgCO2e: 132.7841, calcStatus: "confirmed" },
      ],
    },
    // 7 — Upstream T&D, activity-based (WTT/TTW): 100 kg road freight Lisbon → Berlin.
    //     EF name shared · LCA Multiple · scope/cat shared · CO2e summed (21.98).
    {
      id: "668b6935-d35b-485a-bc9f-f3e7620d3a01", entry_status: "confirmed", category: "upstream_transport", site: "1O Taicang",
      supplier: "", product: "Road freight, Lisbon → Berlin",
      desc: "Test Upstream T&D Activity Case - Road Freight WTT-TTW",
      amount: 100, unit: "kg", spend: "—", bu: "1O Taicang", activity: "Upstream transportation and distribution", user: "Ruben Korenke",
      date: "2026-07-01", start: "2026-01-01", end: "2026-01-31", s3cat: "4 · Upstream transport & distribution",
      ef_selection: "Auto-selected",
      summary: "Upstream T&D · activity-based (WTT + TTW)",
      calcs: [
        { summary: "Well-to-tank (WTT)", method: "Activity-based", scope: 3, category: "upstream_transport",
          factor: FX("Artic truck up to 40 t GVW, Average/mixed, Diesel", 22, "GLEC", "GLEC Framework v3.0", "2023", "europe", "WTT", "kg"),
          amount: 100, unit: "kg", kgCO2e: 5.0891, calcStatus: "confirmed", confidence: 0.9 },
        { summary: "Tank-to-wheel (TTW)", method: "Activity-based", scope: 3, category: "upstream_transport",
          factor: FX("Artic truck up to 40 t GVW, Average/mixed, Diesel", 73, "GLEC", "GLEC Framework v3.0", "2023", "europe", "TTW", "kg"),
          amount: 100, unit: "kg", kgCO2e: 16.8865, calcStatus: "confirmed", confidence: 0.9 },
      ],
    },
    // 8 — Fuel burned (Scope 1 + 3.3): diesel 500 kWh, WTT (S3.3) + TTW (S1).
    //     EF name shared · LCA Multiple · Scope Multiple(1+3) → S3 cat Multiple · CO2e summed.
    {
      id: "39eecd54-d3a2-42c9-824d-356df140b69c", entry_status: "confirmed", category: "fuel", site: "1O Taicang",
      supplier: "", product: "Diesel (average biofuel blend)",
      desc: "", notes: "Test Fuel Burned Case - Diesel Combustion (Scope 1 + 3.3)",  // CSV: text is in Notes, no description
      amount: 500, unit: "kWh", spend: "—", bu: "1O Taicang", activity: "Fuel", user: "Ruben Korenke",
      date: "2026-07-01", start: "2026-01-01", end: "2026-01-31", s3cat: "3 · Fuel & energy-related",
      ef_selection: "Auto-selected",
      summary: "Fuel burned · Scope 1 + 3.3 (WTT + TTW)",
      calcs: [
        { summary: "Well-to-tank (Scope 3.3)", method: "Activity-based", scope: 3, category: "fuel",
          factor: FX("Diesel (average biofuel blend)", 0.05816, "UK Government", "UK Government GHG Conversion Factors for Company Reporting 2025 v1.0", "2025", "GB", "wtt", "kWh"),
          amount: 500, unit: "kWh", kgCO2e: 29.08, calcStatus: "confirmed", confidence: 0.92 },
        { summary: "Combustion / tank-to-wheel (Scope 1)", method: "Activity-based", scope: 1, category: "fuel",
          factor: FX("Diesel (average biofuel blend)", 0.2441, "UK Government", "UK Government GHG Conversion Factors for Company Reporting 2025 v1.0", "2025", "GB", "ttw", "kWh"),
          amount: 500, unit: "kWh", kgCO2e: 122.055, calcStatus: "confirmed", confidence: 0.92 },
      ],
    },
  );
  const demoEntries = [], demoCalcs = [];
  demoSpecs.forEach(o => {
    const e = mkDemoEntry(o); demoEntries.push(e);
    if (o.calcs) o.calcs.forEach((cs, i) => demoCalcs.push(mkDemoCalc(e, { ...cs, id: "C-" + e.id + "-" + (i + 1) })));
    else if (o.factor) demoCalcs.push(mkDemoCalc(e, o));
  });
  entries.unshift(...demoEntries);
  calcs.unshift(...demoCalcs);

  window.ENTRIES = entries;
  window.CALCS = calcs;
  window.BATCHES = batches;
  window.BUSINESS_UNITS = bu.slice();
  window.USERS = user.slice();
  return { entries: entries.length, calcs: calcs.length, factors: F.length, total_tco2e: Math.round((ds.meta.total_co2e_kg || 0) / 1000) };
};

// Factory for a brand-new, empty DRAFT entry — used by "Add data" to open the
// detail drawer in create mode (Notion-style new-item peek) instead of routing
// to a separate page. All fields start blank and editable; saving fills them in.
window.makeDraftEntry = function () {
  const today = new Date().toISOString().slice(0, 10);
  const id = "draft-" + Math.random().toString(36).slice(2, 6);
  return {
    id, batchId: "manual", category: "purchased_goods", date: today, site: "",
    summary: "",
    details: { supplier: "", activity_amount: null, activity_unit: "", product_service: "", description: "" },
    business_unit: "", business_activity: "", user_assigned: (window.USERS && window.USERS[0]) || "",
    data_input_type: "Manual entry", start_date: today, end_date: today,
    created_on: today, last_updated: today, files_count: 0,
    notes: "", bulk_import_ref: "—", bulk_import_file: "—", custom_factor: "—", entry_status: "draft",
    _isNew: true,
  };
};
