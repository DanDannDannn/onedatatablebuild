// All data — the merged grid. One row = one data entry; calculation outputs are
// columns on that row. Entries with 2+ calculations expand into MUI-style
// row-spanning sub-rows (one per calc); per-calc columns split, entry-level
// columns merge via rowSpan.
//
// State is owned by the ACTIVE VIEW (passed in `view.state`): filters + sort +
// column order/visibility/pins. Editing any of them marks the view dirty.
// Grouping + density are session-only controls (not saved into the view).

// Truncate long UUID entry ids for the grid (e.g. "667c054a-e492-…" → "667c054a…").
// Short seed ids like "D-001" are left untouched. Full id stays available on hover.
function fmtEntryId(id) {
  if (!id) return id;
  return id.length > 12 ? id.slice(0, 8) + "…" : id;
}

// ── Cross-mount caches (perf) ──────────────────────────────────────────────
// The grid remounts on every tab switch (key=view.id), which would otherwise
// rebuild these over all ~113k rows each time. Keyed on the data array identity
// so they auto-invalidate when window.ENTRIES/CALCS get a new reference (edits).
let _calcsByEntryCache = null;
function calcsByEntryFor(calcs) {
  if (_calcsByEntryCache && _calcsByEntryCache.ref === calcs) return _calcsByEntryCache.map;
  const m = new Map();
  calcs.forEach(c => { const a = m.get(c.entryId); if (a) a.push(c); else m.set(c.entryId, [c]); });
  _calcsByEntryCache = { ref: calcs, map: m };
  return m;
}
// EF matching strategy bucketed to the three the team reports on. The detailed
// per-calc method (Location-/Distance-based, etc.) collapses into Activity-based.
function efBasisOf(c) {
  const m = ((c && c.method) || "").toLowerCase();
  if (!m) return "";
  if (m.includes("spend")) return "Spend-based";
  if (m.includes("precalc") || (c && c.precalculated)) return "Precalculated";
  return "Activity-based";
}
// ── Styled grid tooltip ─────────────────────────────────────────────────────
// One floating tooltip for the whole grid, delegated on the table's mouseover:
//   · column headers → full title + column description + interaction hints
//   · body cells     → renderer-provided detail, or the full text when clipped
// Any native `title` attributes inside a hovered cell are moved onto data-tip
// so the delayed OS tooltip can never double up with the styled one.
let _tipEl = null, _tipTimer = null, _tipAnchor = null;
function gridTipHide() {
  clearTimeout(_tipTimer); _tipTimer = null; _tipAnchor = null;
  if (_tipEl) _tipEl.style.display = "none";
}
function gridTipShow(anchor, text) {
  if (!_tipEl) {
    _tipEl = document.createElement("div");
    _tipEl.className = "fwe-tip";
    document.body.appendChild(_tipEl);
    // Any scroll (incl. the table's own scroller) invalidates the position.
    document.addEventListener("scroll", gridTipHide, true);
    // Hovering anything outside the anchored cell hides the tip (covers leaving
    // the table entirely — mouseleave alone is unreliable across re-renders).
    document.addEventListener("mouseover", (ev) => {
      if (_tipAnchor && !(ev.target && _tipAnchor.contains(ev.target))) gridTipHide();
    }, true);
  }
  _tipEl.textContent = text;
  _tipEl.style.display = "block";
  _tipEl.style.left = "0px"; _tipEl.style.top = "0px";  // reset to measure
  const r = anchor.getBoundingClientRect();
  const w = _tipEl.offsetWidth, h = _tipEl.offsetHeight;
  const x = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
  let y = r.bottom + 6;
  if (y + h > window.innerHeight - 8) y = r.top - h - 6;
  _tipEl.style.left = x + "px"; _tipEl.style.top = y + "px";
}
function autoTitleOnOverflow(e) {  // name kept — same delegation point as before
  const cell = e.target.closest && e.target.closest("td, th");
  if (!cell) return;
  if (cell === _tipAnchor) return;  // still on the same cell — keep pending/shown tip
  gridTipHide();
  _tipAnchor = cell;
  // Harvest native titles → data-tip (re-done per hover; React may restore them
  // on re-render, but harvesting always beats the ~1s native tooltip delay).
  if (cell.getAttribute("title")) { cell.dataset.tip = cell.getAttribute("title"); cell.removeAttribute("title"); }
  cell.querySelectorAll("[title]").forEach(el => {
    if (el.classList.contains("col-resize")) return;  // tiny handle keeps its native hint
    el.dataset.tip = el.getAttribute("title"); el.removeAttribute("title");
  });
  // Rule: hovering ANY cell or header shows that cell's full value.
  let text = null;
  if (cell.tagName === "TH") {
    const sh = cell.querySelector(".sh[data-tip]");
    text = (sh && sh.dataset.tip) || null;
  } else {
    const inner = e.target.closest && e.target.closest("[data-tip]");
    text = (inner && cell.contains(inner) && inner.dataset.tip)   // renderer detail (e.g. full UUID)
        || cell.dataset.tip
        || (cell.innerText || "").replace(/\s+/g, " ").trim();   // full text (CSS only clips visually)
    if (text === "—") text = null;                                // empty-value dash: nothing to reveal
  }
  if (!text) return;
  _tipTimer = setTimeout(() => { if (_tipAnchor === cell) gridTipShow(cell, text); }, 250);
}
const _facetCache = new Map(); // entries ref → Map(colKey → options[])
function uniqueOptsFor(entries, calcsByEntry, key, getColFn, labelize) {
  let per = _facetCache.get(entries);
  if (!per) { _facetCache.clear(); per = new Map(); _facetCache.set(entries, per); }
  // Cache key includes the "Data 2" experiment flag — the same column yields a
  // different option set there (joined multi-values are split into parts).
  const ck = key + (window.FE_MULTI_ROUTE ? "|exp" : "");
  if (per.has(ck)) return per.get(ck);
  const set = new Set();
  for (let i = 0; i < entries.length; i++) {
    const en = entries[i];
    const v = getColFn({ ...en, _calcs: calcsByEntry.get(en.id) }, key);
    if (v == null || v === "") continue;
    const s = String(v);
    // Joined multi-values contribute only their base sub-row parts — "Multiple"
    // itself is not offered as a filter value (any-sub-value matching covers it).
    if (s.startsWith("multiple, ")) { s.slice(10).split(", ").forEach(p => p && set.add(p)); }
    else set.add(s);
  }
  const opts = [...set].sort().map(v => ({ k: String(v), l: labelize ? labelize(v) : String(v) }));
  per.set(ck, opts);
  return opts;
}

// Option-based column set lives on window (FilterBuilder.jsx · FB_OPTION_COLS).
function initRulesFromState(s) {
  const f = (s && s.filters) || {};
  if (Array.isArray(f.rules)) return f.rules.map(r => ({ ...r }));
  return window.rulesFromColFilters(f.colFilters || {}, window.FB_OPTION_COLS, window.NUMERIC_KEYS);
}

function AllData({
  entries, calcs, headerPortal, onViewEntry, onViewCalc,
  view, restoreTick, preset, loading, globalQuery = "", extraFilter,
  onSaveView, onSaveAsNew, onAddData, onDirtyChange, onClearSearch, onResultCount,
}) {
  const COLS = window.DATA_COLUMNS;
  const COL = window.DATA_COL_BY_KEY;
  const PER_CALC = window.PER_CALC_KEYS;

  // ── Working state, seeded from the active view ────────────────────────────
  const s0 = view.state;
  const [period, setPeriod]       = React.useState(s0.filters.period ?? null);
  const [filterRules, setFilterRules] = React.useState(() => initRulesFromState(s0));
  // Derived legacy {col: value} shape — keeps per-column header quick-filters,
  // dirty detection and saved-view naming working unchanged.
  const colFilters = React.useMemo(() => window.colFiltersFromRules(filterRules), [filterRules]);
  const [sort, setSort]           = React.useState((s0.sort || []).map(x => ({ ...x })));
  const [columns, setColumns]     = React.useState({
    order: [...s0.columns.order], visible: [...s0.columns.visible], pinned: [...s0.columns.pinned],
    widths: { ...(s0.columns.widths || {}) },
  });
  const [group, setGroup]         = React.useState(s0.group ?? null);
  const [page, setPage]           = React.useState(1);
  const [expanded, setExpanded]   = React.useState(() => new Set());
  // Track EXPANDED groups (default empty = all collapsed). Tracking expansion
  // rather than collapse means a fresh grouping renders only group headers on the
  // very first render — never a transient pass over every row of a 100k-row group.
  const [expandedGroups, setExpandedGroups] = React.useState(() => new Set());
  // Header drag-to-reorder
  const [dragCol, setDragCol]     = React.useState(null);
  const [overCol, setOverCol]     = React.useState(null);

  // Move `from` column to sit immediately before `to` in the saved order.
  const moveColumn = (from, to) => {
    if (!from || !to || from === to) return;
    setColumns(c => {
      const order = c.order.slice();
      const fi = order.indexOf(from); if (fi < 0) return c;
      order.splice(fi, 1);
      const ti = order.indexOf(to); if (ti < 0) return c;
      order.splice(ti, 0, from);
      return { ...c, order };
    });
  };

  const reinit = React.useCallback((v) => {
    const s = v.state;
    setPeriod(s.filters.period ?? null);
    setFilterRules(initRulesFromState(s));
    setSort((s.sort || []).map(x => ({ ...x })));
    setGroup(s.group ?? null);
    setColumns({ order: [...s.columns.order], visible: [...s.columns.visible], pinned: [...s.columns.pinned], widths: { ...(s.columns.widths || {}) } });
    setPage(1); setExpanded(new Set());
  }, []);

  // Re-init when the view changes (tab switch) or a restore is requested.
  React.useEffect(() => { reinit(view); setSelected(new Set()); setExpandedGroups(new Set()); /* eslint-disable-next-line */ }, [view.id, restoreTick]);

  // Chart deep-dive preset overlays filters on top of the current view.
  React.useEffect(() => {
    if (!preset || !preset.tick) return;
    setFilterRules(preset.colFilters ? window.rulesFromColFilters(preset.colFilters, window.FB_OPTION_COLS, window.NUMERIC_KEYS) : []);
    setPeriod(preset.period ?? null);
  }, [preset?.tick]);

  // Per-column header quick-filter writes through to the rules array: one "is"
  // rule per column, replacing any existing rule for that column.
  const setColFilter = (k, v) => setFilterRules(rules => {
    const rest = rules.filter(r => r.col !== k);
    if (!v || v === "all" || v === "") return rest;
    const op = colFilterCfg[k]?.options ? "is" : window.NUMERIC_KEYS.has(k) ? "eq" : "contains";
    const conn = rules[1]?.conn || "and";
    return [...rest, { id: window.fbRid(), conn, col: k, op, value: String(v) }];
  });

  // ── Dirty detection vs the saved view ─────────────────────────────────────
  const workingState = { filters: { period, colFilters, rules: filterRules }, sort, columns, group };
  const dirty = !window.viewStateEqual(workingState, view.state);
  React.useEffect(() => { onDirtyChange && onDirtyChange(dirty); }, [dirty]);

  const calcsByEntry = React.useMemo(() => calcsByEntryFor(calcs), [calcs]);
  // Attach each entry's calc list once per dataset (not on every filter/sort pass).
  // This avoids spreading a fresh `{...e, _calcs}` object per row on every keystroke —
  // the dominant cost when filtering/sorting 100k+ rows. Recomputed only when the
  // entries or calc grouping change, never on filter/search/sort changes.
  React.useMemo(() => {
    for (let i = 0; i < entries.length; i++) entries[i]._calcs = calcsByEntry.get(entries[i].id);
  }, [entries, calcsByEntry]);
  const withCalcs = (e) => e; // `_calcs` is already attached

  const rollup = (e) => {
    const mine = calcsByEntry.get(e.id) || [];
    const alternative = window.calcsAreAlternative(e, mine);
    return {
      mine, first: mine[0], count: mine.length,
      alternative,
      // Additive entries sum; alternative (A/B method) entries have no sum → null.
      total: alternative ? null : mine.reduce((s, c) => s + c.kgCO2e, 0),
      pending: mine.filter(c => c.status === "pending").length,
      suggested: mine.filter(c => c.status === "suggested").length,
      confirmed: mine.filter(c => c.status === "confirmed").length,
      factors: [...new Set(mine.map(c => c.factor.name))],
    };
  };

  const consumption = (e) => {
    const d = e.details || {};
    if (e.category === "electricity" || e.category === "natural_gas") return { v: d.kWh, u: "kWh" };
    if (e.category === "diesel")       return { v: d.liters, u: "L" };
    if (e.category === "flight")       return { v: d.distance_km, u: "km" };
    if (e.category === "purchased_goods" && d.spend_eur != null) return { v: d.spend_eur, u: "EUR" };
    // Client Scope-3 categories store a generic activity amount + unit.
    if (d.activity_amount != null) return { v: d.activity_amount, u: d.activity_unit || "" };
    return { v: null, u: "" };
  };

  // GHG Protocol Scope 3 category labels (e.g. "3.1 Purchased goods and services").
  // Non-Scope-3 sources keep a scope-prefixed label.
  // Emission source is the plain source name (per the export: ELECTRICITY,
  // PURCHASED_GOODS_AND_SERVICES, …). Scope and Scope 3 category are separate
  // columns — baking them into this label double-encodes and turns wrong on
  // mixed-scope entries (e.g. a "Scope 2 · Electricity" label on the 3.3 leg).
  const CATEGORY_LABELS = {
    electricity: "Electricity", natural_gas: "Natural gas", diesel: "Diesel",
    flight: "Business travel", purchased_goods: "Purchased goods and services",
    capital_goods: "Capital goods", upstream_transport: "Upstream transportation and distribution",
    waste: "Waste", business_travel: "Business travel",
    employee_commuting: "Employee commuting", fuel_energy: "Fuel & energy-related activities",
    fuel: "Fuel",
  };
  const SCOPE3_CAT = {
    flight: "3.6 Business travel", purchased_goods: "3.1 Purchased goods and services",
    capital_goods: "3.2 Capital goods", upstream_transport: "3.4 Upstream transportation and distribution",
    waste: "3.5 Waste generated in operations", business_travel: "3.6 Business travel",
    employee_commuting: "3.7 Employee commuting", fuel_energy: "3.3 Fuel- and energy-related activities",
    fuel: "3.3 Fuel- and energy-related activities",
  };
  const scope3CatOf = (c) => SCOPE3_CAT[c.category] || "3.3 Fuel- and energy-related activities";

  // Single rolled-up Status. Precedence (high→low):
  //   Calculation failed > Processing > Draft > Ready to Submit > Approved.
  // Approved is GATED by Quality: an entry with calcs still awaiting review
  // (suggested) can't reach Approved — it stays "Ready to submit".
  const mergedStatus = (e, mine) => {
    if (e.entry_status === "failed") return "failed";
    if (e.entry_status === "processing" || (mine && mine.some(c => c.status === "pending"))) return "processing";
    if (e.entry_status === "draft") return "draft";
    if (!mine || mine.length === 0) return "ready";
    if (mine.every(c => c.status === "confirmed")) return "approved";
    return "ready";
  };

  const getCol = (e, key) => {
    const mine = e._calcs || [];
    const first = mine[0];
    const f = first?.factor;
    const cons = consumption(e);
    // "Data 2" experiment: EF/unit columns aggregate across calcs — one shared
    // value shows as-is, conflicting values join to "multiple, v1, v2" so a
    // partial filter matches the parent row. Elsewhere: first calc (as before).
    const aggOrFirst = (getter, firstVal) => {
      if (!window.FE_MULTI_ROUTE) return firstVal;
      const vs = [...new Set(mine.map(getter).filter(v => v != null && v !== ""))];
      return vs.length === 0 ? "" : vs.length === 1 ? vs[0] : window.multiJoin(vs);
    };
    switch (key) {
      case "id": return e.id;
      case "status": return window.entryWorkflow(e, mine);
      case "scope": { const ss = [...new Set(mine.map(c => c.scope))]; return ss.length === 0 ? null : ss.length === 1 ? ss[0] : window.multiJoin(ss.sort()); }
      case "scope2_method": { const s2 = mine.filter(c => c.scope === 2); if (!s2.length) return ""; const ms = [...new Set(s2.map(c => c.method))]; return ms.length === 1 ? ms[0] : window.multiJoin(ms); }
      case "scope3_category": { const s3 = mine.filter(c => c.scope === 3); if (!s3.length) return ""; const cs = [...new Set(s3.map(scope3CatOf))]; return cs.length === 1 ? cs[0] : window.multiJoin(cs); }
      case "ef_name": return aggOrFirst(c => c.factor?.name, f?.name || "");
      case "additional_description": return (e.details && e.details.additional_description) || "";
      case "business_unit": return e.business_unit;
      case "co2e_value": {
        // Alternative methods (location vs market) aren't additive — mirror the
        // cell's "Multiple" so sorting/filtering never uses a fabricated sum.
        if (mine.length > 1 && window.calcsAreAlternative(e, mine)) return window.multiJoin(mine.map(c => c.kgCO2e));
        return mine.reduce((s, c) => s + c.kgCO2e, 0);
      }
      case "business_activity": return e.business_activity;
      case "user_assigned": return e.user_assigned;
      case "start_date": return e.start_date;
      case "end_date": return e.end_date;
      case "data_input_type": {
        // Spec: "Consumption data" vs "Precalculated" (was the ingestion source).
        const bases = [...new Set(mine.map(efBasisOf))].filter(Boolean);
        if (bases.length === 0) return "Consumption data";
        const hasPre = bases.includes("Precalculated");
        const hasOther = bases.some(b => b !== "Precalculated");
        return hasPre && hasOther ? window.multiJoin(["Precalculated", "Consumption data"]) : hasPre ? "Precalculated" : "Consumption data";
      }
      case "consumption_data_type": {
        // Spec: "Activity" / "Spend" (from the EF matching basis).
        const vals = [...new Set(mine.map(c => { const b = efBasisOf(c); return b === "Spend-based" ? "Spend" : b === "Activity-based" ? "Activity" : null; }).filter(Boolean))];
        return vals.length === 0 ? "" : vals.length === 1 ? vals[0] : window.multiJoin(vals);
      }
      case "selection_type": {
        // Real EF-details flag when present (AUTO/MANUALLY from the export);
        // otherwise deterministic ~80% auto-selected placeholder.
        if (e.ef_selection) return e.ef_selection;
        let x = 0; const s = e.id || ""; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0;
        return (Math.abs(x) % 5 === 0) ? "Manually selected" : "Auto-selected";
      }
      case "consumption_value": return cons.v;
      case "consumption_unit": return aggOrFirst(c => c.unit, cons.u);
      case "ef_value": return f?.kg_per_unit ?? null;
      case "ef_unit": return aggOrFirst(c => c.factor ? `kgCO₂e/${c.factor.unit}` : null, f ? `kgCO₂e/${f.unit}` : "");
      case "ef_source": return aggOrFirst(c => c.factor?.source, f?.source || "");
      case "ef_dataset": return aggOrFirst(c => c.factor ? (c.factor.dataset || c.factor.source) : null, f?.dataset || f?.source || "");
      case "ef_year": return aggOrFirst(c => c.factor?.vintage, f?.vintage || "");
      case "ef_region": return aggOrFirst(c => c.factor ? (c.factor.region || "Global") : null, f?.region || (f ? "Global" : ""));
      case "ef_lca": return aggOrFirst(c => c.factor ? (c.factor.lca || "Cradle-to-gate") : null, f?.lca || (f ? "Cradle-to-gate" : ""));
      case "co2e_unit": return mine.length ? "kgCO₂e" : "";
      case "co2e_method": { const ms = [...new Set(mine.map(c => c.calc_method || c.method))]; return ms.length === 0 ? "" : ms.length === 1 ? ms[0] : window.multiJoin(ms); }
      case "notes": return e.notes || "";
      case "bulk_import_ref": return e.bulk_import_ref || "";
      case "bulk_import_file": return e.bulk_import_file || "";
      case "created_on": return e.created_on || "";
      case "last_updated": return e.last_updated || "";
      case "files": return e.files_count || 0;
      default: return "";
    }
  };

  const uniqueOpts = (key, labelize) => uniqueOptsFor(entries, calcsByEntry, key, getCol, labelize);

  // On the multi-value route "Multiple" is not a filter value — filters match
  // the base sub-row values by membership, so the option would be redundant.
  // The archived classic route keeps it (there the cell value IS "multiple").
  const withMulti = (opts) => window.FE_MULTI_ROUTE ? opts : [...opts, { k: "multiple", l: "Multiple" }];
  const colFilterCfg = React.useMemo(() => ({
    business_unit:   { options: uniqueOpts("business_unit") },
    status:          { options: [
      { k: "de_draft", l: "Draft" }, { k: "de_ready", l: "Ready to submit" },
      { k: "de_review", l: "Review pending" }, { k: "de_submitted", l: "Submitted" },
    ] },
    scope:           { options: withMulti([{ k: "1", l: "Scope 1" }, { k: "2", l: "Scope 2" }, { k: "3", l: "Scope 3" }]) },
    scope3_category: { options: withMulti([
      { k: "3.1 Purchased goods and services", l: "3.1 Purchased goods and services" },
      { k: "3.2 Capital goods", l: "3.2 Capital goods" },
      { k: "3.3 Fuel- and energy-related activities", l: "3.3 Fuel- and energy-related activities" },
      { k: "3.4 Upstream transportation and distribution", l: "3.4 Upstream transportation and distribution" },
      { k: "3.5 Waste generated in operations", l: "3.5 Waste generated in operations" },
      { k: "3.6 Business travel", l: "3.6 Business travel" },
      { k: "3.7 Employee commuting", l: "3.7 Employee commuting" },
    ]) },
    user_assigned:   { options: uniqueOpts("user_assigned") },
    data_input_type: { options: withMulti([{ k: "Consumption data", l: "Consumption data" }, { k: "Precalculated", l: "Precalculated" }]) },
    consumption_data_type: { options: withMulti([{ k: "Activity", l: "Activity" }, { k: "Spend", l: "Spend" }]) },
    selection_type: { options: [{ k: "Auto-selected", l: "Auto-selected" }, { k: "Manually selected", l: "Manually selected" }] },
    ef_source:       { options: uniqueOpts("ef_source") },
    ef_year:         { options: uniqueOpts("ef_year") },
    ef_region:       { options: uniqueOpts("ef_region") },
    consumption_unit:{ options: uniqueOpts("consumption_unit") },
    co2e_unit:       { options: [{ k: "kgCO₂e", l: "kgCO₂e" }] },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [entries, calcsByEntry]);

  const passesColFilter = (e, key, val) => {
    if (!val || val === "all") return true;
    const cellVal = getCol(e, key);
    if (cellVal == null) return false;
    if (colFilterCfg[key]?.options) return String(cellVal) === String(val);
    return String(cellVal).toLowerCase().includes(String(val).toLowerCase());
  };

  // Resolve a rule's comparable cell value (mirrors the special-cased
  // normalization passesColFilter used — e.g. quality → needs/clear).
  const getRuleVal = (e, k) => getCol(e, k);

  // Free-text match — also covers supplier and emission-factor name so chart-bar
  // deep-dives (which filter by supplier / EF name) and the search box both hit them.
  const matchesQuery = (e, q) => (
    e.id.toLowerCase().includes(q) || (e.summary || "").toLowerCase().includes(q) ||
    (e.business_activity || "").toLowerCase().includes(q) || (e.business_unit || "").toLowerCase().includes(q) ||
    (e.user_assigned || "").toLowerCase().includes(q) || (e.site || "").toLowerCase().includes(q) ||
    ((e.details && e.details.supplier) || "").toLowerCase().includes(q) ||
    (e._calcs ? e._calcs.some(c => (c.factor && c.factor.name || "").toLowerCase().includes(q)) : false)
  );
  const filtered = React.useMemo(() => {
    let r = entries;
    if (period && period !== "all") r = r.filter(e => window.inPeriod(e, period));
    if (filterRules.length) r = r.filter(e => window.evalFilterRules(filterRules, withCalcs(e), getRuleVal));
    if (globalQuery.trim()) {
      const q = globalQuery.toLowerCase();
      r = r.filter(e => matchesQuery(e, q));
    }
    // Live overlay filter (e.g. a chart bar click in the deep-dive) — applied on
    // top of the view's own filters without disturbing sort/columns/page.
    if (extraFilter) {
      const cf = extraFilter.colFilters;
      if (cf) for (const k in cf) { const val = cf[k]; if (val != null && val !== "") r = r.filter(e => passesColFilter(e, k, val)); }
      const eq = (extraFilter.query || "").trim().toLowerCase();
      if (eq) r = r.filter(e => matchesQuery(e, eq));
    }
    if (sort.length) {
      // Precompute each row's sort key(s) once (O(n) getCol) rather than calling
      // getCol inside the comparator (O(n log n)) — matters for calc-derived columns.
      const keyed = r.map(e => {
        const k = new Array(sort.length);
        for (let i = 0; i < sort.length; i++) {
          const v = getCol(e, sort[i].key);
          // Aggregated "Multiple" cells sort like empties: always last, both directions.
          k[i] = (typeof v === "string" && (v === "multiple" || v.startsWith("multiple, "))) ? null : v;
        }
        return { e, k };
      });
      keyed.sort((a, b) => {
        for (let i = 0; i < sort.length; i++) { const c = window.cmpBy(a.k, b.k, kk => kk[i], sort[i].dir); if (c) return c; }
        return 0;
      });
      r = keyed.map(o => o.e);
    }
    return r;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, globalQuery, filterRules, sort, calcsByEntry, period, extraFilter]);

  // Footer total — memoized + lightweight (plain kg sum, no per-row Set/filters)
  // so it doesn't re-scan all rows on every render.
  const totalEmissions = React.useMemo(() => {
    let s = 0;
    for (const e of filtered) { const mine = calcsByEntry.get(e.id); if (mine) for (let i = 0; i < mine.length; i++) s += mine[i].kgCO2e; }
    return s;
  }, [filtered, calcsByEntry]);
  React.useEffect(() => { setPage(1); }, [globalQuery, period, group, JSON.stringify(filterRules)]);
  // Report the live result count up so the page-level Export (next to search)
  // can label itself with the exact number of rows it will export.
  React.useEffect(() => { onResultCount && onResultCount(filtered.length); }, [filtered.length]);

  // ── Column geometry: pinned-left sticky columns ───────────────────────────
  const visibleOrdered = columns.order.filter(k => columns.visible.includes(k));
  const pinnedSet = new Set(columns.pinned.filter(k => columns.visible.includes(k)));
  const renderKeys = [...visibleOrdered.filter(k => pinnedSet.has(k)), ...visibleOrdered.filter(k => !pinnedSet.has(k))];
  // Per-column width = user override (drag-resized) or the catalog default.
  const colW = (k) => (columns.widths && columns.widths[k]) || COL[k].w;
  const pinLeft = {}; { let L = 0; renderKeys.forEach(k => { if (pinnedSet.has(k)) { pinLeft[k] = L; L += colW(k); } }); }
  const pinnedList = renderKeys.filter(k => pinnedSet.has(k));
  const lastPinned = pinnedList.length ? pinnedList[pinnedList.length - 1] : null;
  const align = (k) => window.NUMERIC_KEYS.has(k) ? "right" : "left";
  const thStyle = (k) => ({ width: colW(k), textAlign: align(k), ...(pinnedSet.has(k) ? { left: pinLeft[k] } : {}) });

  // Drag the right edge of a header to resize that column (min 64px). Persists
  // into the view's column widths so save/restore keeps it.
  const startResize = (e, k) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = colW(k);
    const onMove = (ev) => {
      const w = Math.max(64, Math.round(startW + (ev.clientX - startX)));
      setColumns(c => ({ ...c, widths: { ...(c.widths || {}), [k]: w } }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("col-resizing");
    };
    document.body.classList.add("col-resizing");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const tdPinStyle = (k) => pinnedSet.has(k) ? { left: pinLeft[k] } : null;
  const tdPinClass = (k) => [pinnedSet.has(k) ? "td-pin" : "", k === lastPinned ? "td-pin-last" : ""].filter(Boolean).join(" ");

  const muted = { color: "var(--fe-fg-subtle)" };
  // DS alignment: aggregate cells are DEFAULT text (text-primary), same as any
  // other value — "Multiple" keeps only the italic as its aggregate cue.
  const Multi = <span style={{ color: "var(--fe-fg-default)", fontStyle: "italic" }}>Multiple</span>;
  // Show the underlying values behind "Multiple" so users can see (and
  // partially filter) what the aggregate hides. Falls back to the plain chip
  // on the archived classic page or when no values are supplied.
  const multiVals = (vals, mapLabel) => {
    if (!window.FE_MULTI_ROUTE || !vals || !vals.length) return Multi;
    const list = [...vals].map(v => mapLabel ? mapLabel(v) : String(v)).join(", ");
    return (
      <span title={"Multiple, " + list} style={{ color: "var(--fe-fg-default)" }}>
        <span style={{ fontStyle: "italic" }}>Multiple</span>
        {", " + list}
      </span>
    );
  };

  // ── Cell renderer (entry-level rollup when c==null; per-calc when c set) ──
  const dataCell = (k, e, r, c) => {
    const f = c ? c.factor : r.first?.factor;
    const cons = consumption(e);
    const dash = <span style={muted}>—</span>;
    // ── Multi-calc parent aggregation (DAM-7401 "Expandable Row Logic") ──
    // For each EF-group column, show the shared value when every sub-calc agrees,
    // else "Multiple" (Conflicting). This is per-VALUE, not per-EF-name, so e.g.
    // WTT/TTW legs (same EF name, different LCA activity) correctly read "Multiple"
    // on LCA while EF name stays shared. On a child row (c set) show that calc.
    const efCell = (getter, render) => {
      if (c) { const v = c.factor ? getter(c.factor) : null; return (v != null && v !== "") ? render(v) : dash; }
      const vals = [...new Set(r.mine.map(x => x.factor ? getter(x.factor) : null).filter(v => v != null && v !== ""))];
      if (!vals.length) return dash;
      if (vals.length > 1) return multiVals(vals);
      return render(vals[0]);
    };
    // Scope-conflict rule: if scope differs across sub-calcs, every scope-dependent
    // field (Scope 2 method, Scope 3 category) also shows "Multiple".
    const scopeConflict = !c && [...new Set(r.mine.map(x => x.scope))].length > 1;
    switch (k) {
      case "id":
        return <span title={e.id} style={{ fontFamily: "var(--fe-font-mono)", fontSize: 12, color: "var(--fe-fg-strong)" }}>{fmtEntryId(e.id)}</span>;
      case "status": return <StatusChip status={window.entryWorkflow(e, r.mine)} />;
      case "supplier": { const s = (e.details && e.details.supplier) || ""; return s ? <span title={s} style={{ color: "var(--fe-fg-strong)" }}>{s}</span> : dash; }
      case "description": { const t = (e.details && (e.details.description || e.details.product_service)) || e.summary || ""; return t ? <span title={t}>{t}</span> : dash; }
      case "additional_description": { const t = (e.details && e.details.additional_description) || ""; return t ? <span title={t}>{t}</span> : dash; }
      case "business_unit": return <span style={{ color: "var(--fe-fg-strong)" }}>{e.business_unit}</span>;
      case "business_activity": return <span title={e.business_activity} style={{ color: "var(--fe-fg-strong)" }}>{e.business_activity}</span>;
      case "data_input_type": {
        const v = String(getCol(e, "data_input_type"));
        if (v.startsWith("multiple")) return multiVals(v === "multiple" ? null : v.slice(10).split(", "));
        return <span>{v}</span>;
      }
      case "consumption_data_type": {
        const toVal = (x) => { const b = efBasisOf(x); return b === "Spend-based" ? "Spend" : b === "Activity-based" ? "Activity" : null; };
        if (c) { const v = toVal(c); return v ? <span>{v}</span> : dash; }
        const vals = [...new Set(r.mine.map(toVal).filter(Boolean))];
        if (vals.length === 0) return dash;
        if (vals.length > 1) return multiVals(vals);
        return <span>{vals[0]}</span>;
      }
      case "selection_type": return <span>{getCol(e, "selection_type")}</span>;
      case "start_date": return <span>{e.start_date}</span>;
      case "end_date": return <span>{e.end_date}</span>;
      case "user_assigned": return <span>{e.user_assigned}</span>;
      case "last_updated": return <span>{e.last_updated}</span>;
      case "created_on": return <span>{e.created_on}</span>;
      case "scope": {
        if (c) return <span>{c.scope}</span>;
        const ss = [...new Set(r.mine.map(x => x.scope))].sort();
        if (ss.length === 0) return dash;
        if (ss.length === 1) return <span>{ss[0]}</span>;
        return multiVals(ss);
      }
      case "scope2_method": { const s2ms = [...new Set((c ? [c] : r.mine).filter(x => x.scope === 2).map(x => x.method))]; if (scopeConflict) return multiVals(s2ms); const src = c ? (c.scope === 2 ? [c] : []) : r.mine.filter(x => x.scope === 2); if (!src.length) return dash; const ms = [...new Set(src.map(x => x.method))]; return ms.length === 1 ? <span style={{ fontSize: 12 }}>{ms[0]}</span> : multiVals(ms); }
      case "scope3_category": { const s3cs = [...new Set((c ? [c] : r.mine).filter(x => x.scope === 3).map(scope3CatOf))]; if (scopeConflict) return multiVals(s3cs); const src = c ? (c.scope === 3 ? [c] : []) : r.mine.filter(x => x.scope === 3); if (!src.length) return dash; const cs = [...new Set(src.map(scope3CatOf))]; return cs.length === 1 ? <span style={{ fontSize: 12 }}>{cs[0]}</span> : multiVals(cs); }
      case "consumption_value": {
        if (c) return c.quantity != null ? <span style={{ color: "var(--fe-fg-strong)" }}>{c.quantity.toLocaleString()}</span> : dash;
        // Different amounts across sub-calcs (e.g. commuting modes) → "Multiple";
        // shared amount → show once (prefer the calc quantity over the category-
        // specific entry field, which isn't populated for every demo category).
        const qs = [...new Set(r.mine.map(x => x.quantity).filter(v => v != null))];
        if (qs.length > 1) return multiVals(qs, v => v.toLocaleString());
        const v = qs.length === 1 ? qs[0] : cons.v;
        return v != null ? <span style={{ color: "var(--fe-fg-strong)" }}>{v.toLocaleString()}</span> : dash;
      }
      case "consumption_unit": {
        if (c) return c.unit ? <span style={{ fontSize: 12, color: "var(--fe-fg-default)" }}>{c.unit}</span> : dash;
        const us = [...new Set(r.mine.map(x => x.unit).filter(Boolean))];
        if (us.length > 1) return multiVals(us);
        const u = us.length === 1 ? us[0] : cons.u;
        return u ? <span style={{ fontSize: 12, color: "var(--fe-fg-default)" }}>{u}</span> : dash;
      }
      case "co2e_value": {
        if (r.count === 0) return dash;
        const v = c ? c.kgCO2e : r.total;
        // Alternative methods (e.g. location- vs market-based) aren't additive →
        // "Multiple" (DAM-7401); the per-method values live in the expand.
        if (v == null) return multiVals(r.mine.map(x => x.kgCO2e), n => n.toLocaleString(undefined, { maximumFractionDigits: 2 }));
        // Always kg CO2e (PRD OQ6 — the unit is confirmed always kg).
        return <span style={{ color: "var(--fe-fg-strong)" }}>{v.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>;
      }
      case "co2e_unit": { if (r.count === 0) return dash; return <span style={{ fontSize: 12, color: "var(--fe-fg-default)" }}>kgCO₂e</span>; }
      // CO2e calculation method is the GHG accounting method (GWP100 in the
      // export), not the EF matching method — prefer calc_method when present.
      case "co2e_method": { const mOf = (x) => x.calc_method || x.method; if (c) return <span style={{ fontSize: 12 }}>{mOf(c)}</span>; const ms = [...new Set(r.mine.map(mOf))]; if (!ms.length) return dash; return ms.length > 1 ? multiVals(ms) : <span style={{ fontSize: 12 }}>{ms[0]}</span>; }
      case "ef_name":    return efCell(fa => fa.name, v => <span title={v} style={{ color: "var(--fe-fg-strong)" }}>{v}</span>);
      case "ef_value":   return efCell(fa => fa.kg_per_unit, v => <span style={{ color: "var(--fe-fg-strong)" }}>{v}</span>);
      case "ef_unit":    return efCell(fa => fa.unit, v => <span style={{ fontSize: 12 }}>{`kgCO₂e/${v}`}</span>);
      case "ef_source":  return efCell(fa => fa.source, v => <span>{v}</span>);
      case "ef_dataset": return efCell(fa => fa.dataset || fa.source, v => <span style={{ fontSize: 12 }}>{v}</span>);
      case "ef_year":    return efCell(fa => fa.vintage, v => <span>{v}</span>);
      case "ef_region":  return efCell(fa => fa.region || "Global", v => <span>{v}</span>);
      case "ef_lca":     return efCell(fa => fa.lca || "Cradle-to-gate", v => <span style={{ fontSize: 12 }}>{v}</span>);
      case "notes": return <span title={e.notes || ""} style={{ color: e.notes ? "var(--fe-fg-default)" : "var(--fe-fg-subtle)", fontSize: 12 }}>{e.notes || "—"}</span>;
      case "bulk_import_ref": {
        const v = e.bulk_import_ref;
        if (!v || v === "—") return <span style={{ fontSize: 12, color: "var(--fe-fg-subtle)" }}>—</span>;
        return <a className="bulk-link" href="#" title={"Open " + v} onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}>{v}</a>;
      }
      case "bulk_import_file": {
        const f = e.bulk_import_file, has = f && f !== "—";
        return <span title={has ? f : ""} style={{ fontSize: 12, fontFamily: has ? "var(--fe-font-mono)" : undefined, color: has ? "var(--fe-fg-default)" : "var(--fe-fg-subtle)" }}>{f || "—"}</span>;
      }
      case "files": return e.files_count > 0 ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="upload" size={14} style={{ color: "var(--fe-fg-muted)" }} />{e.files_count}</span> : dash;
      default: return null;
    }
  };

  // ── Grouping ──────────────────────────────────────────────────────────────
  // ── Child-row display rule (expandable entries) ────────────────────────────
  // If every calculation shares the same value, it is shown ONCE on the summary
  // row and the child rows leave the cell blank. Exceptions that ALWAYS render
  // per child: CO2e emission (the key per-calc number) and its unit (kgCO₂e).
  // Scope-dependent fields also render per child whenever scope conflicts,
  // since the summary is forced to "Multiple" in that case.
  const calcColVal = (x, k) => {
    const f = x.factor || {};
    switch (k) {
      case "scope": return x.scope;
      case "scope2_method": return x.scope === 2 ? x.method : null;
      case "scope3_category": return x.scope === 3 ? scope3CatOf(x) : null;
      case "consumption_data_type": { const b = efBasisOf(x); return b === "Spend-based" ? "Spend" : b === "Activity-based" ? "Activity" : null; }
      case "co2e_method": return x.calc_method || x.method;
      case "consumption_value": return x.quantity;
      case "consumption_unit": return x.unit;
      case "ef_name": return f.name;
      case "ef_value": return f.kg_per_unit;
      case "ef_unit": return f.unit;
      case "ef_source": return f.source;
      case "ef_dataset": return f.dataset || f.source;
      case "ef_year": return f.vintage;
      case "ef_region": return f.region || "Global";
      case "ef_lca": return f.lca || "Cradle-to-gate";
      default: return undefined;
    }
  };
  const CHILD_ALWAYS = new Set(["co2e_value", "co2e_unit"]);
  const childShows = (k, mine) => {
    if (CHILD_ALWAYS.has(k)) return true;
    // EF unit accompanies EF value: if the value renders per sub-row, show its
    // unit on those rows too (a bare number without its unit is ambiguous).
    if (k === "ef_unit" && childShows("ef_value", mine)) return true;
    if (k === "scope2_method" || k === "scope3_category") {
      if ([...new Set(mine.map(x => x.scope))].length > 1) return true;
    }
    const vals = [...new Set(mine.map(x => calcColVal(x, k)).filter(v => v != null && v !== ""))];
    return vals.length > 1;
  };

  const GROUP_OPTS = [
    { k: "status", label: "Data entry status" }, { k: "scope", label: "Scope" },
    { k: "business_unit", label: "Business unit" },
    { k: "data_input_type", label: "Data input type" }, { k: "user_assigned", label: "User assigned" },
  ];
  const groupLabel = (key, val) => {
    if (key === "status") return (window.STATUS_LABELS && window.STATUS_LABELS[val]) || val;
    if (key === "scope") return val === "multiple" ? "Multiple scopes" : val == null ? "No calculation" : `Scope ${val}`;
    return val == null || val === "" ? "—" : String(val);
  };
  const grouped = React.useMemo(() => {
    if (!group) return null;
    const m = new Map();
    filtered.forEach(e => { const v = getCol(withCalcs(e), group); const key = String(v); if (!m.has(key)) m.set(key, { raw: v, rows: [] }); m.get(key).rows.push(e); });
    return [...m.entries()].map(([key, g]) => {
      let total = 0;
      for (const e of g.rows) { const mine = e._calcs; if (mine) for (let i = 0; i < mine.length; i++) total += mine[i].kgCO2e; }
      return { key, label: groupLabel(group, g.raw), rows: g.rows, total };
    }).sort((a, b) => b.total - a.total);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, filtered]);

  const PAGE_SIZE = 25;
  const GROUP_ROW_CAP = 100; // max rows rendered per expanded group (avoid 100k-row DOM)
  const paged = group ? filtered : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleExpand = (id) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleGroup = (key) => setExpandedGroups(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // ── Row selection + bulk actions ──────────────────────────────────────────────────────
  // Two-level selection: the unit is the CALCULATION (calc id). Calc-less entries
  // (drafts) select by entry id. An entry checkbox toggles all its calcs and
  // reads indeterminate when only some are selected; each calc sub-row also has
  // its own checkbox so individual calculations can be picked.
  const [selected, setSelected] = React.useState(() => new Set());
  const [selectionOn, setSelectionOn] = React.useState(true);
  const [bulkMsg, setBulkMsg] = React.useState(null);
  // Selection is entry-level: bulk actions operate on data entries, not on
  // individual calculations (DAM-7401), so calc sub-rows have no checkbox.
  const keysFor = (e) => [e.id];
  React.useEffect(() => {
    const valid = new Set();
    entries.forEach(e => { valid.add(e.id); (calcsByEntry.get(e.id) || []).forEach(c => valid.add(c.id)); });
    setSelected(prev => { const n = new Set([...prev].filter(k => valid.has(k))); return n.size === prev.size ? prev : n; });
  }, [entries, calcsByEntry]);
  const selectableKeys = (group ? filtered : paged).flatMap(keysFor);
  const selVis = selectableKeys.filter(k => selected.has(k));
  const allSel = selectableKeys.length > 0 && selVis.length === selectableKeys.length;
  const someSel = selVis.length > 0 && !allSel;
  const entryAll = (e) => { const ks = keysFor(e); return ks.length > 0 && ks.every(k => selected.has(k)); };
  const entrySome = (e) => { const ks = keysFor(e); return ks.some(k => selected.has(k)) && !ks.every(k => selected.has(k)); };
  const toggleEntry = (e) => setSelected(s => { const n = new Set(s); const ks = keysFor(e); const all = ks.every(k => n.has(k)); ks.forEach(k => all ? n.delete(k) : n.add(k)); return n; });
  const toggleCalc = (cid) => setSelected(s => { const n = new Set(s); n.has(cid) ? n.delete(cid) : n.add(cid); return n; });
  const toggleAll = () => setSelected(s => { const n = new Set(s); if (allSel) selectableKeys.forEach(k => n.delete(k)); else selectableKeys.forEach(k => n.add(k)); return n; });
  const clearSel = () => setSelected(new Set());
  // Checkbox that supports an indeterminate (partial) state.
  const Cb = ({ checked, indeterminate, onChange, label }) => (
    <input type="checkbox" className="fe-cb" checked={!!checked}
      ref={el => { if (el) el.indeterminate = !!indeterminate && !checked; }}
      onChange={onChange} aria-label={label} onClick={(ev) => ev.stopPropagation()} />
  );
  let bulkTimer = null;
  const runBulk = (msg, clear = true) => { setBulkMsg(msg); clearTimeout(bulkTimer); bulkTimer = setTimeout(() => setBulkMsg(null), 2200); if (clear) clearSel(); };

  // ── Toolbar (filter pills + Sort/Group/Columns/Density + dirty + Export) ──
  const colOptions = renderKeys.map(k => ({ k, label: COL[k].label }));
  const activeFilterCount = window.activeRuleCount(filterRules) + (period ? 1 : 0);

  // ── Row renderers ─────────────────────────────────────────────────────────
  // Per-row hover actions: copy a deep link, or delete the entry.
  const copyRowLink = (id) => {
    const url = `${location.origin}${location.pathname}#entry=${id}`;
    try { navigator.clipboard && navigator.clipboard.writeText(url); } catch {}
    window.dispatchEvent(new CustomEvent("fe-toast", { detail: `Link to ${id} copied to clipboard` }));
  };
  const deleteRow = (e) => {
    if (confirm(`Delete entry ${e.id} and its calculations?`)) {
      window.dispatchEvent(new CustomEvent("fe-toast", { detail: `Entry ${e.id} deleted · undo in 10s` }));
    }
  };
  const rowActions = (e) => (
    <div className="row-actions">
      <button className="row-action" title="Copy link to row" aria-label="Copy link to row" onClick={() => copyRowLink(e.id)}><Icon name="link" size={15} /></button>
      <button className="row-action danger" title="Delete entry" aria-label="Delete entry" onClick={() => deleteRow(e)}><Icon name="trash" size={15} /></button>
    </div>
  );
  // Show the dedicated expander gutter only when the current rows actually have
  // an expandable (multi-calc) entry, so single-calc views don't get dead space.
  const hasExpandable = (group ? filtered : paged).some(e => (calcsByEntry.get(e.id) || []).length > 1);
  const renderRow = (e, rowIdx) => {
    const r = rollup(e);
    // Child rows carry the PARENT's zebra colour (they're excluded from the
    // nth-child stripe count, so parity = the parent's index in this page).
    const stripe = rowIdx % 2 === 0 ? " stripe-w" : " stripe-g";
    const canExpand = r.count > 1;
    const isOpen = canExpand && expanded.has(e.id);
    const discBtn = canExpand ? (
      <button className={"row-disc" + (isOpen ? " open" : "")} onClick={(ev) => { ev.stopPropagation(); toggleExpand(e.id); }}
        aria-label={isOpen ? "Collapse calculations" : "Expand calculations"} aria-expanded={isOpen}
        title={isOpen ? "Collapse" : `Expand ${r.count} calculations`}><Icon name="chevRight" size={13} /></button>
    ) : <span className="row-disc-spacer" />;
    // The expand chevron lives in its own gutter column (rendered right after the
    // checkbox — see entryRow), so the first content column never shifts.
    // firstContentKey marks where a child row's data starts (for the connector).
    const firstContentKey = renderKeys.find(k => k === "id" || PER_CALC.has(k));
    const idInner = (
      <span title={e.id} style={{ fontFamily: "var(--fe-font-mono)", fontSize: 12, color: "var(--fe-fg-strong)" }}>{fmtEntryId(e.id)}</span>
    );
    const cellClassFor = (k) => [tdPinClass(k), window.WRAP_KEYS.has(k) ? "wrap" : "", window.isEditableCol(k) ? "cell-edit" : ""].filter(Boolean).join(" ") || undefined;

    // The entry (parent) row: entry-level columns + AGGREGATED per-calc columns
    // (e.g. summed CO₂e). Shown collapsed, and kept as the summary row when open.
    const entryRow = (
      <tr key={e.id} className={(canExpand ? "calc-parent" : "") + (isOpen ? " open" : "") + (entryAll(e) ? " sel" : "")} onClick={() => onViewEntry(e.id)}>
        {selectionOn && (
          <td className="cb-cell" onClick={(ev) => ev.stopPropagation()}>
            <Cb checked={entryAll(e)} indeterminate={entrySome(e)} onChange={() => toggleEntry(e)} label={`Select entry ${e.id}`} />
          </td>
        )}
        {hasExpandable && (
          <td className="exp-cell" onClick={(ev) => ev.stopPropagation()}>{canExpand ? discBtn : null}</td>
        )}
        {renderKeys.map(k => k === "id"
          ? <td key="id" className={tdPinClass("id") || undefined} style={tdPinStyle("id")} onClick={(ev) => { ev.stopPropagation(); onViewEntry(e.id); }}>{idInner}</td>
          : <td key={k} className={cellClassFor(k)} style={{ textAlign: align(k), ...tdPinStyle(k) }}>{dataCell(k, e, r, null)}</td>
        )}
        <td className="ra-cell" onClick={(ev) => ev.stopPropagation()}>{rowActions(e)}</td>
      </tr>
    );
    if (!isOpen) return entryRow;
    // Expanded: keep the parent summary row, then one child row per calculation.
    // Entry-level columns are blank on children (shown once on the parent); the
    // leftmost content cell gets a tree connector.
    // "Data 2" experiment: when active filter rules target per-calc columns,
    // every sub-row still renders, but the ones that don't themselves match
    // are visually de-emphasized (dimmed) so the matching leg(s) stand out.
    // If no sub-row matches individually (e.g. "is Multiple" matched only the
    // aggregate) — or all of them match — nothing is dimmed.
    const dimIds = (() => {
      if (!window.FE_MULTI_ROUTE) return null;
      const active = filterRules.filter(window.fbRuleActive).filter(rl => PER_CALC.has(rl.col));
      if (!active.length) return null;
      const kidVal = (x, k) => {
        if (k === "co2e_value") return x.kgCO2e;
        if (k === "co2e_unit") return "kgCO₂e";
        if (k === "ef_unit") return x.factor ? `kgCO₂e/${x.factor.unit}` : "";
        const v = calcColVal(x, k);
        return v == null ? "" : v;
      };
      const match = new Set(r.mine.filter(c => window.evalFilterRules(active, c, kidVal)).map(c => c.id));
      if (match.size === 0 || match.size === r.mine.length) return null;
      return new Set(r.mine.filter(c => !match.has(c.id)).map(c => c.id));
    })();
    return (
      <React.Fragment key={e.id}>
        {entryRow}
        {r.mine.map((c, i) => (
          <tr key={c.id} className={"calc-childrow" + stripe + (i === r.mine.length - 1 ? " last" : "") + (selected.has(e.id) ? " sel" : "") + (dimIds && dimIds.has(c.id) ? " is-dim" : "")} onClick={(ev) => { ev.stopPropagation(); onViewCalc(c.id); }}>
            {/* No checkbox on calc sub-rows — selection is entry-level. */}
            {selectionOn && <td className="cb-cell" aria-hidden="true" />}
            {hasExpandable && <td className="exp-cell exp-cell--rail"></td>}
            {renderKeys.map(k => {
              const lead = k === firstContentKey ? "child-lead" : "";
              // Data entry ID is entry-level — shown once on the parent row;
              // calculation ids are intentionally not surfaced in the grid.
              if (k === "id") return <td key="id" className={[lead, tdPinClass("id")].filter(Boolean).join(" ") || undefined} style={tdPinStyle("id")}></td>;
              // Shared values are shown once on the summary row — child cells
              // stay blank unless the value differs (or is a CHILD_ALWAYS col).
              if (PER_CALC.has(k)) return <td key={k} className={[window.WRAP_KEYS.has(k) ? "wrap" : "", lead, tdPinClass(k)].filter(Boolean).join(" ") || undefined} style={{ textAlign: align(k), ...tdPinStyle(k) }}>{childShows(k, r.mine) ? dataCell(k, e, r, c) : null}</td>;
              // entry-level column → blank on the child (the parent already shows it)
              return <td key={k} className={[lead, tdPinClass(k)].filter(Boolean).join(" ") || undefined} style={tdPinStyle(k)}></td>;
            })}
            <td className="ra-cell"></td>
          </tr>
        ))}
      </React.Fragment>
    );
  };

  const colCount = renderKeys.length + (selectionOn ? 1 : 0) + (hasExpandable ? 1 : 0) + 1;

  const toolbar = (
      <div className="filter-bar">
        <ViewDirtyCluster dirty={dirty} view={view}
          onSave={() => onSaveView && onSaveView(view.id, workingState)}
          onSaveAsNew={() => onSaveAsNew && onSaveAsNew(workingState)}
          onReset={() => reinit(view)} />

        <div className="filter-bar-controls">
          {/* Toolbar: Export · Columns · Filters (Sort removed). Export acts on
              the live filtered result set. */}
          <button type="button" className="tb-btn" title="Export the current view to CSV"
            onClick={() => window.dispatchEvent(new CustomEvent("fe-export-start", { detail: {
              title: "Current view", meta: `${filtered.length.toLocaleString()} rows · CSV`,
              filename: `data_${new Date().toISOString().slice(0,10)}.csv`, rows: filtered.length } }))}>
            <Icon name="download" size={15}/>
            <span className="tb-btn-label">Export</span>
          </button>
          <ColumnsPanel columns={columns} onChange={setColumns} defaultOrder={window.ENTRY_ORDER}
            selectionOn={selectionOn} onToggleSelection={() => setSelectionOn(v => { if (v) clearSel(); return !v; })} />
          <FilterBuilder
            rules={filterRules}
            onChange={setFilterRules}
            cols={COLS.map(c => ({ k: c.k, label: c.label }))}
            colConfig={colFilterCfg}
            numericKeys={window.NUMERIC_KEYS}
          />
          {period && (
            <FilterPill icon="calendar" label="Period" value={period} options={window.PERIOD_OPTIONS}
              onChange={(v) => setPeriod(v)} onClear={() => setPeriod(null)} />
          )}
        </div>
      </div>
  );

  return (
    <>
      {headerPortal ? ReactDOM.createPortal(toolbar, headerPortal) : toolbar}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-scroll">
          {loading ? (
            <SkeletonTable cols={Math.min(colCount, 8)} />
          ) : (
            <table className={"data-table data-grid-fixed density-comfortable" + (pinnedSet.size ? " has-pinned" : "")} onMouseOver={autoTitleOnOverflow} onMouseLeave={gridTipHide}>
              <colgroup>
                {selectionOn && <col style={{ width: 40 }} />}
                {hasExpandable && <col style={{ width: 44 }} />}
                {renderKeys.map(k => <col key={k} style={{ width: colW(k) }} />)}
                <col style={{ width: 84 }} />
              </colgroup>
              <thead>
                <tr>
                  {selectionOn && (
                    <th className="cb-cell">
                      <HeaderCheckbox checked={allSel} indeterminate={someSel} onChange={toggleAll} />
                    </th>
                  )}
                  {hasExpandable && <th className="exp-cell" aria-hidden="true"></th>}
                  {renderKeys.map(k => {
                    const cfg = colFilterCfg[k];
                    const sLevel = sort.findIndex(s => s.key === k);
                    return (
                      <th key={k} className={[tdPinClass(k), overCol === k && dragCol && dragCol !== k ? "th-drop" : "", dragCol === k ? "th-dragging" : ""].filter(Boolean).join(" ") || undefined} style={thStyle(k)}
                        draggable
                        onDragStart={(e) => { if (e.target.closest(".sh-pop, .sh-pop-input, .col-resize")) { e.preventDefault(); return; } setDragCol(k); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", k); } catch {} }}
                        onDragOver={(e) => { if (dragCol && dragCol !== k) { e.preventDefault(); setOverCol(k); } }}
                        onDragLeave={() => { if (overCol === k) setOverCol(null); }}
                        onDrop={(e) => { e.preventDefault(); moveColumn(dragCol, k); setDragCol(null); setOverCol(null); }}
                        onDragEnd={() => { setDragCol(null); setOverCol(null); }}>
                        <SortableHeader
                          label={COL[k].label} colKey={k} align={align(k)}
                          sort={sLevel >= 0 ? { key: k, dir: sort[sLevel].dir } : null}
                          sortRank={sLevel >= 0 && sort.length > 1 ? sLevel + 1 : null}
                          colKind={COL[k].kind} editable={window.isEditableCol(k)}
                          onSort={(key, dir, additive) => {
                            if (!key) { setSort(sort.filter(s => s.key !== k)); return; }
                            if (additive) {
                              setSort(prev => prev.find(s => s.key === key) ? prev.map(s => s.key === key ? { key, dir } : s) : [...prev, { key, dir }]);
                            } else setSort([{ key, dir }]);
                          }}
                          filterValue={colFilters[k]} onFilter={(v) => setColFilter(k, v)} filterOptions={cfg?.options}
                          pinned={pinnedSet.has(k)} onPin={() => setColumns(c => ({ ...c, pinned: pinnedSet.has(k) ? c.pinned.filter(x => x !== k) : [...c.pinned, k] }))}
                          onHide={k === "id" ? null : () => setColumns(c => ({ ...c, visible: c.visible.filter(x => x !== k) }))}
                        />
                        <span className="col-resize" onPointerDown={(e) => startResize(e, k)} onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => { e.stopPropagation(); setColumns(c => { const w = { ...(c.widths || {}) }; delete w[k]; return { ...c, widths: w }; }); }}
                          title="Drag to resize · double-click to reset" aria-hidden="true" />
                      </th>
                    );
                  })}
                  <th className="ra-cell" aria-hidden="true"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={colCount}>
                    {entries.length === 0
                      ? <div className="empty-state"><Icon name="collect" size={28} /><h3>No data yet</h3><p>Import a file or add an entry to start building this assessment.</p><button className="btn primary small" onClick={() => onAddData && onAddData()}><Icon name="plus" size={15} />Add data</button></div>
                      : <div className="empty-state"><Icon name="search" size={28} /><h3>No entries match these filters</h3><p>Try removing a filter or clearing the search.</p><button className="btn secondary small" onClick={() => { setFilterRules([]); setPeriod(null); onClearSearch && onClearSearch(); }}>Clear all filters</button></div>}
                  </td></tr>
                ) : group ? (
                  grouped.map(g => (
                    <React.Fragment key={g.key}>
                      <tr className="group-row" onClick={() => toggleGroup(g.key)}>
                        <td colSpan={colCount}>
                          <span className="group-disc"><Icon name="chevRight" size={13} className={expandedGroups.has(g.key) ? "open" : ""} /></span>
                          <span className="group-by">{GROUP_OPTS.find(o => o.k === group)?.label}:</span>
                          <span className="group-name">{g.label}</span>
                          <span className="group-count">{g.rows.length}</span>
                          <span className="group-total">{(g.total / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e</span>
                        </td>
                      </tr>
                      {expandedGroups.has(g.key) && g.rows.slice(0, GROUP_ROW_CAP).map(renderRow)}
                      {expandedGroups.has(g.key) && g.rows.length > GROUP_ROW_CAP && (
                        <tr className="group-more"><td colSpan={colCount} style={{ padding: "8px 16px 8px 44px", color: "var(--fe-fg-muted)", fontSize: 12, background: "var(--fe-bg-subtle)" }}>
                          Showing first {GROUP_ROW_CAP} of {g.rows.length.toLocaleString()} rows — narrow with filters to see more.
                        </td></tr>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  paged.map(renderRow)
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {!group && !loading && <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />}

      {selected.size > 0 && (
        <div className="ad-bulkbar" role="toolbar" aria-label="Bulk actions">
          <span className="ad-bulkbar__count">{selected.size} selected</span>
          <button className="ad-bulk-btn primary" onClick={() => runBulk(`Opening bulk edit for ${selected.size} item${selected.size > 1 ? "s" : ""}…`, false)}><Icon name="pencil" size={15} />Edit</button>
          <button className="ad-bulk-btn" onClick={() => runBulk(`${selected.size} item${selected.size > 1 ? "s" : ""} unsubmitted`)}><Icon name="close" size={15} />Unsubmit</button>
          <button className="ad-bulk-btn" onClick={() => runBulk(`${selected.size} item${selected.size > 1 ? "s" : ""} submitted`)}><Icon name="check" size={15} />Submit</button>
          <button className="ad-bulk-btn danger" onClick={() => { if (confirm(`Delete ${selected.size} selected item${selected.size > 1 ? "s" : ""}?`)) runBulk(`${selected.size} item${selected.size > 1 ? "s" : ""} deleted`); }}><Icon name="trash" size={15} />Delete</button>
          <button className="ad-bulkbar__x" onClick={clearSel} aria-label="Clear selection" title="Clear selection"><Icon name="close" size={16} /></button>
        </div>
      )}
      {bulkMsg && <div className="ad-bulk-toast">{bulkMsg}</div>}
    </>
  );
}

// Loading skeleton — shimmering placeholder rows while data resolves.
function SkeletonTable({ cols = 7 }) {
  return (
    <div className="skeleton-table" aria-busy="true" aria-label="Loading data">
      <div className="skel-row head">{Array.from({ length: cols }).map((_, i) => <span key={i} className="skel-cell" />)}</div>
      {Array.from({ length: 9 }).map((_, r) => (
        <div className="skel-row" key={r}>{Array.from({ length: cols }).map((_, i) => <span key={i} className="skel-cell" style={{ width: `${50 + ((r * 7 + i * 13) % 45)}%` }} />)}</div>
      ))}
    </div>
  );
}

Object.assign(window, { AllData, SkeletonTable });
