// Shared data-grid model for the merged Data table.
//
// One canonical column catalog + two column ORIENTATIONS (Entry-oriented and
// Calculation-oriented) + the factory "view state" each default ships with.
//
// A *view* owns a bundle of state:
//   { filters:{period,query,colFilters}, sort:[{key,dir}…], columns:{order,visible,pinned} }
// Grouping and density are deliberately NOT part of a view — they're session
// controls (so switching views never silently regroups your screen).
//
// Loaded before AllData.jsx / DataViews.jsx so both can share the catalog.

// kind:   "entry"   = a data-entry field (the editable spine)
//         "calc"    = a per-calculation OUTPUT (read-only, derived)
//         "derived" = an entry-level rollup (read-only)
// ro:     read-only (no inline edit affordance)
// group:  "ef" → part of the collapsible Emission-factor column group
// editable getter = kind==="entry" && !ro
// Default `w` reflects typical CONTENT width, not the header label width
// (headers ellipsize via .sh-label). Short-content columns with long titles \u2014
// e.g. Consumption unit ("kWh"), CO2e emission unit ("tCO2e") \u2014 stay narrow.
const DATA_COLUMNS = [
  { k:"id",                label:"Data entry ID",            w:118, kind:"entry",   ro:true },
  { k:"status",            label:"Status",                   w:104, kind:"derived", ro:true },
  { k:"supplier",          label:"Supplier name",            w:184, kind:"entry",   ro:true },
  { k:"description",       label:"Description",              w:220, kind:"entry",   ro:true },
  { k:"additional_description", label:"Additional description", w:220, kind:"entry", ro:true },
  { k:"business_unit",     label:"Business unit",            w:120, kind:"entry" },
  { k:"business_activity", label:"Business activity",        w:160, kind:"entry" },
  { k:"data_input_type",   label:"Data input type",          w:132, kind:"derived", ro:true },
  { k:"consumption_data_type", label:"Consumption data type", w:116, kind:"calc",  ro:true },
  { k:"selection_type",    label:"Selection type",           w:128, kind:"derived", ro:true },
  { k:"start_date",        label:"Start date",               w:96, kind:"entry" },
  { k:"end_date",          label:"End date",                 w:96, kind:"entry" },
  { k:"scope",             label:"Scope",                    w:72,  kind:"calc",    ro:true },
  { k:"consumption_value", label:"Consumption value",        w:102, kind:"entry" },
  { k:"consumption_unit",  label:"Consumption unit",         w:80,  kind:"entry" },
  { k:"co2e_value",        label:"CO\u2082e emission",        w:104, kind:"calc",    ro:true },
  { k:"co2e_unit",         label:"CO\u2082e emission unit",   w:84, kind:"calc",    ro:true },
  { k:"user_assigned",     label:"User assigned",            w:140, kind:"entry" },
  { k:"last_updated",      label:"Last updated",             w:100, kind:"entry",   ro:true },
  // Emission-factor group — hidden by default, toggled as one block
  { k:"ef_name",           label:"Emission factor name",     w:200, kind:"calc", ro:true, group:"ef" },
  { k:"ef_value",          label:"Emission factor value",    w:112, kind:"calc", ro:true, group:"ef" },
  { k:"ef_unit",           label:"Emission factor unit",     w:112, kind:"calc", ro:true, group:"ef" },
  { k:"ef_source",         label:"Emission factor source",   w:140, kind:"calc", ro:true, group:"ef" },
  { k:"ef_dataset",        label:"Emission factor dataset",  w:150, kind:"calc", ro:true, group:"ef" },
  { k:"ef_year",           label:"Emission factor year",     w:92, kind:"calc", ro:true, group:"ef" },
  { k:"ef_region",         label:"Emission factor region",   w:116, kind:"calc", ro:true, group:"ef" },
  { k:"ef_lca",            label:"Emission factor LCA activity", w:170, kind:"calc", ro:true, group:"ef" },
  // Other hidden detail
  { k:"co2e_method",       label:"CO\u2082e calculation method", w:150, kind:"calc",  ro:true },
  { k:"scope2_method",     label:"Scope 2 method",           w:140, kind:"calc",  ro:true },
  { k:"scope3_category",   label:"Scope 3 category",         w:175, kind:"calc",  ro:true },
  { k:"notes",             label:"Notes",                    w:200, kind:"entry" },
  { k:"files",             label:"Files",                    w:72,  kind:"entry",  ro:true },
  { k:"bulk_import_ref",   label:"Bulk import",              w:140, kind:"entry",  ro:true },
  { k:"bulk_import_file",  label:"Bulk import file",         w:180, kind:"entry",  ro:true },
  { k:"created_on",        label:"Created on",               w:100, kind:"entry",  ro:true },
];

// ── Multi-value "Multiple" cells (default Data page behaviour) ──────────────
// Columns that would read "multiple" instead expose "multiple, v1, v2, …" —
// both displayed and used as the filter/sort value — so a partial text or
// option filter can match the data-entry (parent) row. Formerly the "Data 2"
// experiment; the classic single-"Multiple" table is archived at #data-classic.
// The flag is set by App during render (window.FE_MULTI_ROUTE).
const multiJoin = (vals) => (window.FE_MULTI_ROUTE && vals && vals.length)
  ? "multiple, " + vals.join(", ")
  : "multiple";

const DATA_COL_BY_KEY = Object.fromEntries(DATA_COLUMNS.map(c => [c.k, c]));
const EF_GROUP_KEYS = DATA_COLUMNS.filter(c => c.group === "ef").map(c => c.k);

// Columns that vary per calculation — they split into sub-rows when a data
// entry is expanded. Everything else is constant per entry and merges (rowSpan).
const PER_CALC_KEYS = new Set([
  "scope","scope2_method","scope3_category","consumption_data_type",
  "co2e_value","co2e_unit","co2e_method",
  "consumption_value","consumption_unit",
  "ef_name","ef_value","ef_unit","ef_source","ef_dataset","ef_year","ef_region","ef_lca",
]);
const WRAP_KEYS = new Set(["ef_name","notes","business_activity","description","additional_description"]);
const NUMERIC_KEYS = new Set(["co2e_value","ef_value","consumption_value"]);
const isEditableCol = (k) => { const c = DATA_COL_BY_KEY[k]; return c && c.kind === "entry" && !c.ro; };

// ── Column ORIENTATIONS ────────────────────────────────────────────────────
// Each orientation defines the full column ORDER (every key, so reordering has
// a stable base) plus which are visible. The Entry default leads with entry
// context; the Calculation default promotes the calc outcome.
// Default ("entry") orientation: lead with activity context (Category, Supplier,
// Description), keep the status compact, and push the time columns to the far
// right. `id` and the EF group stay in the catalog but hidden by default.
// Order + visibility follow the Confluence "Unified column map and default order"
// spec (Combined Data Table).
const ENTRY_ORDER = [
  "status","supplier","description","additional_description","selection_type","ef_name","co2e_value","co2e_unit",
  "consumption_value","consumption_unit","business_unit","data_input_type","consumption_data_type",
  "scope","scope2_method","scope3_category","business_activity","user_assigned",
  "start_date","end_date","last_updated","id",
  "ef_value","ef_unit","ef_source","ef_dataset","ef_year","ef_region","ef_lca",
  "co2e_method","notes","files","bulk_import_ref","bulk_import_file","created_on",
];
const ENTRY_VISIBLE = [
  "status","supplier","description","ef_name","co2e_value","co2e_unit",
  "consumption_value","consumption_unit","business_unit","data_input_type","consumption_data_type",
  "scope","scope3_category","business_activity","user_assigned",
  "start_date","end_date","last_updated","id","ef_lca","files","bulk_import_ref","created_on",
];
const CALC_ORDER = [
  "id","status","co2e_value","co2e_unit","scope","ef_name",
  "business_unit","business_activity","supplier","description","additional_description",
  "consumption_value","consumption_unit",
  "start_date","end_date","data_input_type","consumption_data_type","selection_type","user_assigned","last_updated",
  "ef_value","ef_unit","ef_source","ef_dataset","ef_year","ef_region","ef_lca",
  "co2e_method","scope2_method","scope3_category","notes","files","bulk_import_ref","bulk_import_file","created_on",
];
const CALC_VISIBLE = [
  "id","status","co2e_value","co2e_unit","scope","ef_name",
  "business_unit","business_activity","consumption_value","consumption_unit",
  "start_date","end_date","user_assigned","last_updated",
];

function defaultViewState(orientation) {
  const calc = orientation === "calc";
  return {
    filters: { period: null, colFilters: {}, rules: [] },
    sort: calc ? [{ key: "co2e_value", dir: "desc" }] : [],
    group: null,
    columns: {
      order:   (calc ? CALC_ORDER : ENTRY_ORDER).slice(),
      visible: (calc ? CALC_VISIBLE : ENTRY_VISIBLE).slice(),
      pinned:  [],
    },
  };
}

// Seed a single default view. The user builds their own views from here (via
// "+ New view" or by carrying a chart deep-dive in); no pre-set orientations.
function seedDataViews() {
  return [
    { id: "all", builtin: true, name: "All data", icon: "home", kind: "alldata",
      desc: "Default view", state: defaultViewState("entry"),
      createdAt: new Date().toISOString() },
  ];
}

// ── View-state normalization + equality (drives the dirty indicator) ────────
// NOTE: the global search query is intentionally NOT part of a view — it's a
// transient layer that overlays whichever view is active. Grouping IS saved.
function normalizeViewState(s) {
  const st = s || {};
  const f = st.filters || {};
  // Canonical filter representation = the rules array (legacy {col: value} is
  // converted the same way AllData seeds it, so old saved views stay stable).
  const rules = Array.isArray(f.rules)
    ? f.rules
    : (window.rulesFromColFilters ? window.rulesFromColFilters(f.colFilters || {}, window.FB_OPTION_COLS, window.NUMERIC_KEYS) : []);
  const rulesNorm = (rules || [])
    .filter(r => r && r.col && (window.fbRuleActive ? window.fbRuleActive(r) : true))
    .map(r => [r.col, r.op, String(r.value == null ? "" : r.value), r.conn || "and"]);
  const cols = st.columns || {};
  return JSON.stringify({
    period: f.period || null,
    rules: rulesNorm,
    sort: (st.sort || []).map(s => [s.key, s.dir]),
    group: st.group || null,
    order: cols.order || [],
    visible: (cols.visible || []).slice().sort(),   // visibility is a set
    pinned: cols.pinned || [],
    widths: cols.widths || {},
  });
}
function viewStateEqual(a, b) { return normalizeViewState(a) === normalizeViewState(b); }

// ── Shared view-match predicate ─────────────────────────────────────────────
// Does one entry survive a given view's filters PLUS a global search query?
// Used for per-tab match counts and the gentle auto-switch in DataPage. Mirrors
// the filtering AllData applies, but only the filterable column values are
// derived here (rendering stays in AllData).
const _MATCH_SCOPE3 = { flight: "6 \u00b7 Business travel", purchased_goods: "1 \u00b7 Purchased goods & services",
  capital_goods: "2 \u00b7 Capital goods", upstream_transport: "4 \u00b7 Upstream transport & distribution",
  waste: "5 \u00b7 Waste generated in operations", business_travel: "6 \u00b7 Business travel" };
// Fallback mirror of bits.jsx entryWorkflow (used only if that script is absent):
// Submitted / Ready to submit / Draft / Failed.
function _matchStatus(e, mine) {
  if (e.entry_status === "failed" || (mine && mine.some(c => c.status === "failed"))) return "de_failed";
  if (e.entry_status === "draft") return "de_draft";
  if (e.entry_status === "ready" || !mine || mine.length === 0) return "de_ready";
  return "de_submitted";
}
function _matchConsumptionUnit(e) {
  if (e.category === "electricity" || e.category === "natural_gas") return "kWh";
  if (e.category === "diesel") return "L";
  if (e.category === "flight") return "km";
  if (e.category === "purchased_goods" && e.details && e.details.spend_eur != null) return "EUR";
  if (e.details && e.details.activity_unit) return e.details.activity_unit;
  return "";
}
function _matchColValue(e, mine, key) {
  switch (key) {
    case "business_unit":   return e.business_unit;
    case "user_assigned":   return e.user_assigned;
    case "data_input_type": return e.data_input_type;
    case "status":          return window.entryWorkflow ? window.entryWorkflow(e, mine) : _matchStatus(e, mine);
    case "scope":           { const ss = [...new Set(mine.map(c => c.scope))]; return ss.length === 0 ? null : ss.length === 1 ? ss[0] : multiJoin(ss.sort()); }
    case "scope3_category": { const s3 = mine.filter(c => c.scope === 3); if (!s3.length) return ""; const cs = [...new Set(s3.map(c => _MATCH_SCOPE3[c.category] || "3 \u00b7 Fuel & energy-related"))]; return cs.length === 1 ? cs[0] : multiJoin(cs); }
    case "ef_source":       return mine[0]?.factor?.source || "";
    case "ef_year":         return mine[0]?.factor?.vintage || "";
    case "ef_region":       return mine[0]?.factor?.region || (mine[0]?.factor ? "Global" : "");
    case "consumption_unit":return _matchConsumptionUnit(e);
    case "co2e_unit":       return mine.length ? "tCO\u2082e" : "";
    default:                return null;
  }
}
function entryMatchesView(entry, mine, viewState, query) {
  const f = (viewState && viewState.filters) || {};
  if (f.period && f.period !== "all" && window.inPeriod && !window.inPeriod(entry, f.period)) return false;
  const rules = Array.isArray(f.rules)
    ? f.rules
    : (window.rulesFromColFilters ? window.rulesFromColFilters(f.colFilters || {}, window.FB_OPTION_COLS, window.NUMERIC_KEYS) : []);
  if (rules.length && window.evalFilterRules) {
    const getVal = (e, k) => _matchColValue(e, mine, k);
    if (!window.evalFilterRules(rules, entry, getVal)) return false;
    // Rule-wide invariant (shared with the grid + sub-row dimming): an AND
    // group additionally requires ONE calculation to satisfy every per-calc
    // condition — different legs matching different rules is not a match.
    if (window.entryMatchesAndGroup && !window.entryMatchesAndGroup(entry, mine, rules)) return false;
  }
  const q = (query || "").trim().toLowerCase();
  if (q) {
    const hit = entry.id.toLowerCase().includes(q) || (entry.summary || "").toLowerCase().includes(q) ||
      (entry.business_activity || "").toLowerCase().includes(q) || (entry.business_unit || "").toLowerCase().includes(q) ||
      (entry.user_assigned || "").toLowerCase().includes(q) || (entry.site || "").toLowerCase().includes(q);
    if (!hit) return false;
  }
  return true;
}

Object.assign(window, {
  multiJoin,
  DATA_COLUMNS, DATA_COL_BY_KEY, EF_GROUP_KEYS, PER_CALC_KEYS, WRAP_KEYS, NUMERIC_KEYS,
  isEditableCol, ENTRY_ORDER, ENTRY_VISIBLE, CALC_ORDER, CALC_VISIBLE,
  defaultViewState, seedDataViews, normalizeViewState, viewStateEqual, entryMatchesView,
});
