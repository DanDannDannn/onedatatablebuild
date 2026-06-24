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
// Show a native tooltip on a grid cell only when its text is actually clipped.
// Delegated on the table's mouseover so it covers every (current + future) cell
// without each renderer having to opt in. Cells whose renderer already set a
// `title` keep it; we only manage the ones we add (data-auto-title).
function autoTitleOnOverflow(e) {
  const td = e.target.closest && e.target.closest("td");
  if (!td) return;
  const overflowing = td.scrollWidth > td.clientWidth + 1;
  if (overflowing) {
    if (!td.getAttribute("title")) {
      const t = (td.innerText || "").replace(/\s+/g, " ").trim();
      if (t) { td.setAttribute("title", t); td.dataset.autoTitle = "1"; }
    }
  } else if (td.dataset.autoTitle) {
    td.removeAttribute("title");
    delete td.dataset.autoTitle;
  }
}
const _facetCache = new Map(); // entries ref → Map(colKey → options[])
function uniqueOptsFor(entries, calcsByEntry, key, getColFn, labelize) {
  let per = _facetCache.get(entries);
  if (!per) { _facetCache.clear(); per = new Map(); _facetCache.set(entries, per); }
  if (per.has(key)) return per.get(key);
  const set = new Set();
  for (let i = 0; i < entries.length; i++) {
    const en = entries[i];
    const v = getColFn({ ...en, _calcs: calcsByEntry.get(en.id) }, key);
    if (v != null && v !== "") set.add(v);
  }
  const opts = [...set].sort().map(v => ({ k: String(v), l: labelize ? labelize(v) : String(v) }));
  per.set(key, opts);
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
    return {
      mine, first: mine[0], total: mine.reduce((s, c) => s + c.kgCO2e, 0), count: mine.length,
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

  const CATEGORY_LABELS = {
    electricity: "ELECTRICITY", natural_gas: "STATIONARY_COMBUSTION", diesel: "MOBILE_COMBUSTION",
    flight: "BUSINESS_TRAVEL_AIR", purchased_goods: "PURCHASED_GOODS",
    capital_goods: "CAPITAL_GOODS", upstream_transport: "UPSTREAM_TRANSPORT",
    waste: "WASTE_OPERATIONS", business_travel: "BUSINESS_TRAVEL",
  };
  const SCOPE3_CAT = {
    flight: "6 \u00b7 Business travel", purchased_goods: "1 \u00b7 Purchased goods & services",
    capital_goods: "2 \u00b7 Capital goods", upstream_transport: "4 \u00b7 Upstream transport & distribution",
    waste: "5 \u00b7 Waste generated in operations", business_travel: "6 \u00b7 Business travel",
  };
  const scope3CatOf = (c) => SCOPE3_CAT[c.category] || "3 \u00b7 Fuel & energy-related";

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
    switch (key) {
      case "id": return e.id;
      case "status": return window.entryWorkflow(e, mine);
      case "quality": return window.calcWorkflow(e, mine);
      case "scope": { const ss = [...new Set(mine.map(c => c.scope))]; return ss.length === 0 ? null : ss.length === 1 ? ss[0] : "multiple"; }
      case "scope2_method": { const s2 = mine.filter(c => c.scope === 2); if (!s2.length) return ""; const ms = [...new Set(s2.map(c => c.method))]; return ms.length === 1 ? ms[0] : "multiple"; }
      case "scope3_category": { const s3 = mine.filter(c => c.scope === 3); if (!s3.length) return ""; const cs = [...new Set(s3.map(scope3CatOf))]; return cs.length === 1 ? cs[0] : "multiple"; }
      case "emission_source": { const cs = [...new Set(mine.map(c => c.category))]; return cs.length === 0 ? null : cs.length === 1 ? cs[0] : "multiple"; }
      case "ef_name": return f?.name || "";
      case "business_unit": return e.business_unit;
      case "co2e_value": return mine.reduce((s, c) => s + c.kgCO2e, 0);
      case "business_activity": return e.business_activity;
      case "user_assigned": return e.user_assigned;
      case "start_date": return e.start_date;
      case "end_date": return e.end_date;
      case "data_input_type": return e.data_input_type;
      case "consumption_value": return cons.v;
      case "consumption_unit": return cons.u;
      case "ef_value": return f?.kg_per_unit ?? null;
      case "ef_unit": return f ? `kgCO₂e/${f.unit}` : "";
      case "ef_source": return f?.source || "";
      case "ef_dataset": return f?.dataset || f?.source || "";
      case "ef_year": return f?.vintage || "";
      case "ef_region": return f?.region || (f ? "Global" : "");
      case "ef_lca": return f?.lca || (f ? "Cradle-to-gate" : "");
      case "co2e_unit": return mine.length ? "tCO₂e" : "";
      case "co2e_method": { const ms = [...new Set(mine.map(c => c.method))]; return ms.length === 0 ? "" : ms.length === 1 ? ms[0] : "multiple"; }
      case "calc_basis": { const bs = [...new Set(mine.map(efBasisOf))].filter(Boolean); return bs.length === 0 ? "" : bs.length === 1 ? bs[0] : "multiple"; }
      case "calcs_count": return mine.length;
      case "custom_factor": return e.custom_factor || "";
      case "notes": return e.notes || "";
      case "bulk_import_ref": return e.bulk_import_ref || "";
      case "created_on": return e.created_on || "";
      case "last_updated": return e.last_updated || "";
      case "files": return e.files_count || 0;
      default: return "";
    }
  };

  const uniqueOpts = (key, labelize) => uniqueOptsFor(entries, calcsByEntry, key, getCol, labelize);

  const colFilterCfg = React.useMemo(() => ({
    business_unit:   { options: uniqueOpts("business_unit") },
    status:          { options: [
      { k: "de_draft", l: "Draft" }, { k: "de_ready", l: "Ready to submit" },
      { k: "de_review", l: "Review pending" }, { k: "de_submitted", l: "Submitted" },
    ] },
    quality:         { options: [
      { k: "cs_none", l: "No calculation" }, { k: "cs_processing", l: "Processing" },
      { k: "cs_sug_high", l: "Suggested · high confidence" }, { k: "cs_sug_low", l: "Suggested · low confidence" },
      { k: "cs_confirmed", l: "Confirmed" },
    ] },
    scope:           { options: [{ k: "1", l: "Scope 1" }, { k: "2", l: "Scope 2" }, { k: "3", l: "Scope 3" }, { k: "multiple", l: "Multiple" }] },
    calc_basis:      { options: [
      { k: "Activity-based", l: "Activity-based" }, { k: "Spend-based", l: "Spend-based" },
      { k: "Precalculated", l: "Precalculated" }, { k: "multiple", l: "Multiple" },
    ] },
    scope3_category: { options: [
      { k: "1 \u00b7 Purchased goods & services", l: "1 · Purchased goods & services" },
      { k: "2 \u00b7 Capital goods", l: "2 · Capital goods" },
      { k: "3 \u00b7 Fuel & energy-related", l: "3 · Fuel & energy-related" },
      { k: "4 \u00b7 Upstream transport & distribution", l: "4 · Upstream transport & distribution" },
      { k: "5 \u00b7 Waste generated in operations", l: "5 · Waste generated in operations" },
      { k: "6 \u00b7 Business travel", l: "6 · Business travel" }, { k: "multiple", l: "Multiple" },
    ] },
    emission_source: { options: [...Object.entries(CATEGORY_LABELS).map(([k, l]) => ({ k, l })), { k: "multiple", l: "Multiple" }] },
    user_assigned:   { options: uniqueOpts("user_assigned") },
    data_input_type: { options: uniqueOpts("data_input_type") },
    ef_source:       { options: uniqueOpts("ef_source") },
    ef_year:         { options: uniqueOpts("ef_year") },
    ef_region:       { options: uniqueOpts("ef_region") },
    consumption_unit:{ options: uniqueOpts("consumption_unit") },
    co2e_unit:       { options: [{ k: "tCO₂e", l: "tCO₂e" }] },
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
        for (let i = 0; i < sort.length; i++) k[i] = getCol(e, sort[i].key);
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
  const Multi = <span style={{ color: "var(--fe-fg-muted)", fontStyle: "italic" }}>Multiple</span>;

  // ── Cell renderer (entry-level rollup when c==null; per-calc when c set) ──
  const dataCell = (k, e, r, c) => {
    const f = c ? c.factor : r.first?.factor;
    const efMulti = !c && r.factors.length > 1;
    const cons = consumption(e);
    const dash = <span style={muted}>—</span>;
    switch (k) {
      case "id":
        return <span title={e.id} style={{ fontFamily: "var(--fe-font-mono)", fontSize: 12, color: "var(--fe-fg-strong)" }}>{fmtEntryId(e.id)}</span>;
      case "status": return <StatusChip status={window.entryWorkflow(e, r.mine)} />;
      case "quality": return <StatusChip status={window.calcWorkflow(e, r.mine)} />;
      case "supplier": { const s = (e.details && e.details.supplier) || ""; return s ? <span title={s} style={{ color: "var(--fe-fg-strong)", fontWeight: 500 }}>{s}</span> : dash; }
      case "description": { const t = (e.details && (e.details.description || e.details.product_service)) || e.summary || ""; return t ? <span title={t}>{t}</span> : dash; }
      case "business_unit": return <span style={{ color: "var(--fe-fg-strong)", fontWeight: 500 }}>{e.business_unit}</span>;
      case "business_activity": return <span title={e.business_activity} style={{ color: "var(--fe-fg-strong)", fontWeight: 500 }}>{e.business_activity}</span>;
      case "data_input_type": return <span className="chip"><span className="dot"></span>{e.data_input_type}</span>;
      case "start_date": return <span style={{ color: "var(--fe-fg-muted)" }}>{e.start_date}</span>;
      case "end_date": return <span style={{ color: "var(--fe-fg-muted)" }}>{e.end_date}</span>;
      case "user_assigned": return <span>{e.user_assigned}</span>;
      case "last_updated": return <span style={{ color: "var(--fe-fg-muted)" }}>{e.last_updated}</span>;
      case "created_on": return <span style={{ color: "var(--fe-fg-muted)" }}>{e.created_on}</span>;
      case "calcs_count":
        return r.count > 0
          ? <span className="link" onClick={(ev) => { ev.stopPropagation(); onViewCalc(r.first.id); }}>{r.count} calc{r.count > 1 ? "s" : ""}</span>
          : <span className="draft-tag">0 · draft</span>;
      case "emission_source": {
        if (c) return <span className="mono-cell">{CATEGORY_LABELS[c.category] || c.category.toUpperCase()}</span>;
        const cs = [...new Set(r.mine.map(x => x.category))];
        if (cs.length === 0) return dash;
        if (cs.length > 1) return Multi;
        return <span className="mono-cell">{CATEGORY_LABELS[cs[0]] || cs[0].toUpperCase()}</span>;
      }
      case "scope": {
        if (c) return <ScopeBadge scope={c.scope} />;
        const ss = [...new Set(r.mine.map(x => x.scope))].sort();
        if (ss.length === 0) return dash;
        if (ss.length === 1) return <ScopeBadge scope={ss[0]} />;
        return Multi;
      }
      case "scope2_method": { const src = c ? (c.scope === 2 ? [c] : []) : r.mine.filter(x => x.scope === 2); if (!src.length) return dash; const ms = [...new Set(src.map(x => x.method))]; return ms.length === 1 ? <span style={{ fontSize: 12 }}>{ms[0]}</span> : Multi; }
      case "scope3_category": { const src = c ? (c.scope === 3 ? [c] : []) : r.mine.filter(x => x.scope === 3); if (!src.length) return dash; const cs = [...new Set(src.map(scope3CatOf))]; return cs.length === 1 ? <span style={{ fontSize: 12 }}>{cs[0]}</span> : Multi; }
      case "consumption_value": { const v = c ? c.quantity : cons.v; return v != null ? <span style={{ color: "var(--fe-fg-strong)", fontWeight: 500 }}>{v.toLocaleString()}</span> : dash; }
      case "consumption_unit": { const u = c ? c.unit : cons.u; return u ? <span style={{ fontSize: 12, color: "var(--fe-fg-default)" }}>{u}</span> : dash; }
      case "co2e_value": { if (r.count === 0) return dash; const v = c ? c.kgCO2e : r.total; return <span style={{ fontWeight: 600, color: "var(--fe-fg-strong)" }}>{(v / 1000).toLocaleString(undefined, { maximumFractionDigits: v < 100 ? 3 : 2 })}</span>; }
      case "co2e_unit": return r.count > 0 ? <span style={{ fontSize: 12, color: "var(--fe-fg-default)" }}>tCO₂e</span> : dash;
      case "co2e_method": { if (c) return <span style={{ fontSize: 12 }}>{c.method}</span>; const ms = [...new Set(r.mine.map(x => x.method))]; if (!ms.length) return dash; return ms.length > 1 ? Multi : <span style={{ fontSize: 12 }}>{ms[0]}</span>; }
      case "calc_basis": {
        const src = c ? [c] : r.mine;
        const bs = [...new Set(src.map(efBasisOf))].filter(Boolean);
        if (bs.length === 0) return dash;
        if (bs.length > 1) return Multi;
        const b = bs[0];
        const cls = b === "Spend-based" ? "basis-spend" : b === "Precalculated" ? "basis-precalc" : "basis-activity";
        return <span className={"basis-chip " + cls}>{b}</span>;
      }
      case "ef_name":
        if (!f) return dash;
        if (efMulti) return <span title={`${f.name} +${r.factors.length - 1} more`} style={{ color: "var(--fe-fg-strong)", fontWeight: 500 }}>{f.name}<span style={{ color: "var(--fe-fg-muted)" }}> +{r.factors.length - 1}</span></span>;
        return <span title={f.name} style={{ color: "var(--fe-fg-strong)", fontWeight: 500 }}>{f.name}</span>;
      case "ef_value":   return efMulti ? Multi : (f ? <span style={{ color: "var(--fe-fg-strong)" }}>{f.kg_per_unit}</span> : dash);
      case "ef_unit":    return efMulti ? Multi : (f ? <span style={{ fontSize: 12 }}>{`kgCO₂e/${f.unit}`}</span> : dash);
      case "ef_source":  return efMulti ? Multi : (f ? <span>{f.source}</span> : dash);
      case "ef_dataset": return efMulti ? Multi : (f ? <span style={{ fontSize: 12 }}>{f.dataset || f.source}</span> : dash);
      case "ef_year":    return efMulti ? Multi : (f ? <span style={{ color: "var(--fe-fg-muted)" }}>{f.vintage}</span> : dash);
      case "ef_region":  return efMulti ? Multi : (f ? <span>{f.region || "Global"}</span> : dash);
      case "ef_lca":     return efMulti ? Multi : (f ? <span style={{ fontSize: 12 }}>{f.lca || "Cradle-to-gate"}</span> : dash);
      case "custom_factor": return <span style={{ fontSize: 12, color: e.custom_factor && e.custom_factor !== "—" ? "var(--fe-fg-default)" : "var(--fe-fg-subtle)" }}>{e.custom_factor || "—"}</span>;
      case "notes": return <span title={e.notes || ""} style={{ color: e.notes ? "var(--fe-fg-default)" : "var(--fe-fg-subtle)", fontSize: 12 }}>{e.notes || "—"}</span>;
      case "bulk_import_ref": return <span style={{ fontSize: 12, color: e.bulk_import_ref ? "var(--fe-fg-default)" : "var(--fe-fg-subtle)" }}>{e.bulk_import_ref || "—"}</span>;
      case "files": return e.files_count > 0 ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="upload" size={14} style={{ color: "var(--fe-fg-muted)" }} />{e.files_count}</span> : dash;
      default: return null;
    }
  };

  // ── Grouping ──────────────────────────────────────────────────────────────
  const GROUP_OPTS = [
    { k: "status", label: "Data entry status" }, { k: "scope", label: "Scope" },
    { k: "emission_source", label: "Emission source" }, { k: "business_unit", label: "Business unit" },
    { k: "data_input_type", label: "Data input type" }, { k: "user_assigned", label: "User assigned" },
    { k: "quality", label: "Calculation status" },
  ];
  const groupLabel = (key, val) => {
    if (key === "status") return (window.STATUS_LABELS && window.STATUS_LABELS[val]) || val;
    if (key === "scope") return val === "multiple" ? "Multiple scopes" : val == null ? "No calculation" : `Scope ${val}`;
    if (key === "emission_source") return val === "multiple" ? "Multiple sources" : val == null ? "No calculation" : (CATEGORY_LABELS[val] || val);
    if (key === "quality") return (window.STATUS_LABELS && window.STATUS_LABELS[val]) || val;
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
  // Selection is per-ENTRY (the row), not per calc sub-row. Select-all targets
  // whatever rows are currently rendered (the page, or the full set when grouped).
  const [selected, setSelected] = React.useState(() => new Set());
  const [selectionOn, setSelectionOn] = React.useState(true);
  const [bulkMsg, setBulkMsg] = React.useState(null);
  React.useEffect(() => {
    const ids = new Set(entries.map(e => e.id));
    setSelected(prev => { const n = new Set([...prev].filter(id => ids.has(id))); return n.size === prev.size ? prev : n; });
  }, [entries]);
  const selectableIds = (group ? filtered : paged).map(e => e.id);
  const selVis = selectableIds.filter(id => selected.has(id));
  const allSel = selectableIds.length > 0 && selVis.length === selectableIds.length;
  const someSel = selVis.length > 0 && !allSel;
  const toggleOne = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(s => { const n = new Set(s); if (allSel) selectableIds.forEach(id => n.delete(id)); else selectableIds.forEach(id => n.add(id)); return n; });
  const clearSel = () => setSelected(new Set());
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
  const renderRow = (e) => {
    const r = rollup(e);
    const canExpand = r.count > 1;
    const isOpen = canExpand && expanded.has(e.id);
    const discBtn = canExpand ? (
      <button className={"row-disc" + (isOpen ? " open" : "")} onClick={(ev) => { ev.stopPropagation(); toggleExpand(e.id); }}
        aria-label={isOpen ? "Collapse calculations" : "Expand calculations"} aria-expanded={isOpen}
        title={isOpen ? "Collapse" : `Expand ${r.count} calculations`}><Icon name="chevRight" size={13} /></button>
    ) : <span className="row-disc-spacer" />;
    const idInner = (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        {discBtn}<span title={e.id} style={{ fontFamily: "var(--fe-font-mono)", fontSize: 12, color: "var(--fe-fg-strong)" }}>{fmtEntryId(e.id)}</span>
      </span>
    );
    const cellClassFor = (k) => [tdPinClass(k), window.WRAP_KEYS.has(k) ? "wrap" : "", window.isEditableCol(k) ? "cell-edit" : ""].filter(Boolean).join(" ") || undefined;

    if (!isOpen) {
      return (
        <tr key={e.id} className={(canExpand ? "calc-parent" : "") + (selected.has(e.id) ? " sel" : "")} onClick={() => onViewEntry(e.id)}>
          {selectionOn && (
            <td className="cb-cell" onClick={(ev) => ev.stopPropagation()}>
              <input type="checkbox" className="fe-cb" checked={selected.has(e.id)} onChange={() => toggleOne(e.id)} aria-label={`Select entry ${e.id}`} />
            </td>
          )}
          {renderKeys.map(k => k === "id"
            ? <td key="id" className={tdPinClass("id") || undefined} style={tdPinStyle("id")} onClick={(ev) => { ev.stopPropagation(); onViewEntry(e.id); }}>{idInner}</td>
            : <td key={k} className={cellClassFor(k)} style={{ textAlign: align(k), ...tdPinStyle(k) }}>{dataCell(k, e, r, null)}</td>
          )}
          <td className="ra-cell" onClick={(ev) => ev.stopPropagation()}>{rowActions(e)}</td>
        </tr>
      );
    }
    // Expanded: MUI-style row spanning — per-calc columns split, others merge.
    return (
      <React.Fragment key={e.id}>
        {r.mine.map((c, i) => (
          <tr key={c.id} className={"calc-subrow" + (i === 0 ? " first" : "") + (i === r.mine.length - 1 ? " last" : "") + (selected.has(e.id) ? " sel" : "")} onClick={(ev) => { ev.stopPropagation(); onViewCalc(c.id); }}>
            {selectionOn && i === 0 ? (
              <td className="cb-cell" rowSpan={r.mine.length} style={{ verticalAlign: "top" }} onClick={(ev) => ev.stopPropagation()}>
                <input type="checkbox" className="fe-cb" checked={selected.has(e.id)} onChange={() => toggleOne(e.id)} aria-label={`Select entry ${e.id}`} />
              </td>
            ) : null}
            {renderKeys.map(k => {
              if (k === "id") return i === 0
                ? <td key="id" rowSpan={r.mine.length} className={["span-cell", tdPinClass("id")].filter(Boolean).join(" ")} style={{ verticalAlign: "top", ...tdPinStyle("id") }} onClick={(ev) => { ev.stopPropagation(); onViewEntry(e.id); }}>{idInner}</td>
                : null;
              if (PER_CALC.has(k)) return <td key={k} className={[window.WRAP_KEYS.has(k) ? "wrap" : "", tdPinClass(k)].filter(Boolean).join(" ") || undefined} style={{ textAlign: align(k), ...tdPinStyle(k) }}>{dataCell(k, e, r, c)}</td>;
              return i === 0
                ? <td key={k} rowSpan={r.mine.length} className={["span-cell", window.WRAP_KEYS.has(k) ? "wrap" : "", tdPinClass(k), window.isEditableCol(k) ? "cell-edit" : ""].filter(Boolean).join(" ")} style={{ textAlign: align(k), verticalAlign: "top", ...tdPinStyle(k) }} onClick={(ev) => { ev.stopPropagation(); onViewEntry(e.id); }}>{dataCell(k, e, r, null)}</td>
                : null;
            })}
            {i === 0 ? <td className="ra-cell" rowSpan={r.mine.length} style={{ verticalAlign: "top" }} onClick={(ev) => ev.stopPropagation()}>{rowActions(e)}</td> : null}
          </tr>
        ))}
      </React.Fragment>
    );
  };

  const colCount = renderKeys.length + (selectionOn ? 1 : 0) + 1;

  return (
    <>
      <div className="filter-bar">
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

        <span className="tb-divider" />
        <SortControl sort={sort} colOptions={colOptions} onChange={setSort} />
        {/* Grouping hidden for now */}
        <ColumnsPanel columns={columns} onChange={setColumns} defaultOrder={window.ENTRY_ORDER}
          selectionOn={selectionOn} onToggleSelection={() => setSelectionOn(v => { if (v) clearSel(); return !v; })} />

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="tb-btn" title="Export the current view to CSV"
            onClick={() => window.dispatchEvent(new CustomEvent("fe-export-start", { detail: {
              title: "Current view", meta: `${filtered.length.toLocaleString()} rows · ${renderKeys.length} cols · CSV`,
              filename: `data_${new Date().toISOString().slice(0,10)}.csv`, rows: filtered.length } }))}>
            <Icon name="download" size={15}/>
            <span className="tb-btn-label">Export</span>
          </button>
          <ViewDirtyCluster dirty={dirty} view={view}
            onSave={() => onSaveView && onSaveView(view.id, workingState)}
            onSaveAsNew={() => onSaveAsNew && onSaveAsNew(workingState)}
            onReset={() => reinit(view)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-scroll">
          {loading ? (
            <SkeletonTable cols={Math.min(colCount, 8)} />
          ) : (
            <table className={"data-table data-grid-fixed density-comfortable" + (pinnedSet.size ? " has-pinned" : "")} onMouseOver={autoTitleOnOverflow}>
              <colgroup>
                {selectionOn && <col style={{ width: 40 }} />}
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
                        onDragEnd={() => { setDragCol(null); setOverCol(null); }}
                        title="Drag to reorder column">
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
          <button className="ad-bulk-btn primary" onClick={() => runBulk(`Opening bulk edit for ${selected.size} entries…`, false)}><Icon name="pencil" size={15} />Edit</button>
          <button className="ad-bulk-btn" onClick={() => runBulk(`${selected.size} entries unsubmitted`)}><Icon name="close" size={15} />Unsubmit</button>
          <button className="ad-bulk-btn" onClick={() => runBulk(`${selected.size} entries submitted`)}><Icon name="check" size={15} />Submit</button>
          <button className="ad-bulk-btn danger" onClick={() => { if (confirm(`Delete ${selected.size} entries and their calculations?`)) runBulk(`${selected.size} entries deleted`); }}><Icon name="trash" size={15} />Delete</button>
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
