// Calculations page — table with status filters + detail drawer

const ALL_COLUMNS = [
  { k:"id",                label:"Calculation ID",        w: 130 },
  { k:"status",            label:"Calculation status",    w: 160 },
  { k:"business_unit",     label:"Business unit",         w: 140 },
  { k:"business_activity", label:"Business activity",     w: 200 },
  { k:"site",              label:"Site",                  w: 140 },
  { k:"user_assigned",     label:"User assigned",         w: 160 },
  { k:"start_date",        label:"Start date",            w: 110 },
  { k:"end_date",          label:"End date",              w: 110 },
  { k:"data_input_type",   label:"Data input type",       w: 160 },
  { k:"source_import",     label:"Source",                w: 180 },
  { k:"consumption",       label:"Consumption details",   w: 220 },
  { k:"factor",            label:"Emission factor",       w: 240 },
  { k:"emission",          label:"Emission details",      w: 180 },
  { k:"calcs_count",       label:"Related calculations",  w: 130 },
  { k:"notes",             label:"Notes",                 w: 220 },
  { k:"created_on",        label:"Created on",            w: 110 },
  { k:"last_updated",      label:"Last updated",          w: 110 },
  { k:"files",             label:"Files",                 w: 80 },
  { k:"bulk_import_ref",   label:"Bulk import",           w: 180 },
  { k:"custom_factor",     label:"Custom Emission Factor",w: 180 },
];
const DEFAULT_VISIBLE = ["id","status","business_unit","business_activity","site","user_assigned","start_date","end_date","data_input_type","consumption","factor","emission","notes"];

// Truncate a calc id ("C-<uuid>") for the narrow ID column; full id shows on hover.
function shortCalcId(id) { return id && id.length > 12 ? id.slice(0, 10) + "…" : id; }

// Drag-to-park hook for the floating chart card. Tracks an {x,y} offset within
// the element's positioned parent (.deepdive-float-wrap), clamps to its bounds,
// and persists so the parked position survives navigation + reload. Dragging is
// ignored when it starts on an interactive control (button/link/the chart).
function useDraggable(storageKey) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState(() => {
    try { const p = JSON.parse(localStorage.getItem(storageKey) || "null"); return (p && typeof p.x === "number") ? p : null; } catch { return null; }
  });
  const [dragging, setDragging] = React.useState(false);
  const st = React.useRef(null);

  const onMove = (e) => {
    const s = st.current; if (!s) return;
    let x = e.clientX - s.px - s.dx;
    let y = e.clientY - s.py - s.dy;
    x = Math.max(0, Math.min(x, Math.max(0, s.pw - s.ew)));
    y = Math.max(0, Math.min(y, Math.max(0, s.ph - s.eh)));
    setPos({ x, y });
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    setDragging(false);
    st.current = null;
    setPos(p => { if (p) { try { localStorage.setItem(storageKey, JSON.stringify(p)); } catch {} } return p; });
  };
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("button, a, input, select, .ai-context-strip__chart")) return;
    const el = ref.current; if (!el) return;
    // Clamp to the whole viewport (not just the content column) so the card can
    // be parked over the side nav, freeing the data table. Coords are viewport-
    // relative; the element switches to position:fixed once a pos is set.
    const er = el.getBoundingClientRect();
    st.current = { dx: e.clientX - er.left, dy: e.clientY - er.top, px: 0, py: 0, pw: window.innerWidth, ph: window.innerHeight, ew: er.width, eh: er.height };
    setDragging(true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    e.preventDefault();
  };
  const reset = () => { setPos(null); try { localStorage.removeItem(storageKey); } catch {} };
  return { ref, pos, dragging, onPointerDown, reset };
}

function Calculations({ calcs, entries, selectedId, setSelectedId, filter, setFilter, onViewEntry, bulk, preset, embedded, headerPortal, onBack, onSaveView, onUpdateView, activeViewName, onFiltersChange, chartOnly, onBarSelect, selectedBar }) {
  // `counts` is computed below from `nonStatusFiltered` so the status-chip
  // badges reflect the active filters from other dimensions (BU, scope, search,
  // column filters, date period). See line ~195.

  const [query, setQuery] = React.useState("");
  const [bu, setBu] = React.useState("all");
  const [scopeF, setScopeF] = React.useState("all");
  const [catF, setCatF] = React.useState("all"); // category filter — set via deep-dive links
  const [period, setPeriod] = React.useState(null);
  const [sort, setSort] = React.useState(null);
  const [colFilters, setColFilters] = React.useState({});
  const setColFilter = (k, v) => setColFilters(f => {
    const next = { ...f };
    if (!v || v === "all" || v === "") delete next[k]; else next[k] = v;
    return next;
  });
  const handleSort = (key, dir) => setSort(key ? { key, dir } : null);
  // Apply deep-dive / saved-view preset whenever the tick bumps.
  // A saved view carries a full `filters` snapshot (status, scope, BU, period,
  // per-column pills, search); a chart deep-dive carries only bu/scope/etc.
  React.useEffect(() => {
    if (!preset || !preset.tick) return;
    const f = preset.filters;
    if (f) {
      setBu(f.bu ?? "all");
      setScopeF(f.scope && f.scope !== "all" ? String(f.scope) : "all");
      setCatF(f.category ?? "all");
      setQuery(f.query ?? "");
      setPeriod(f.period ?? null);
      setColFilters(f.colFilters ? { ...f.colFilters } : {});
    } else {
      setBu(preset.bu ?? "all");
      setScopeF(preset.scope ? String(preset.scope) : "all");
      setCatF(preset.category ?? "all");
      setQuery(preset.query ?? "");
    }
  }, [preset?.tick]);

  // Carry-over AI insight chart — reactively re-derives from current filters.
  // The chartSpec arrives via the preset (set by an AI insight's "View detailed data" CTA).
  // Dismissable by the user; resets on each new tick (= each new jump).
  const [chartDismissed, setChartDismissed] = React.useState(false);
  React.useEffect(() => { setChartDismissed(false); }, [preset?.tick]);
  const chartSpec = (!chartDismissed && preset?.chartSpec) || null;

  // The floating deep-dive chart starts COLLAPSED so it doesn't cover the table;
  // the user can show it via the toggle. Re-collapses on each new deep-dive jump.
  // (The inline chart, if any, stays expanded by default.)
  const [chartCollapsed, setChartCollapsed] = React.useState(!!chartOnly);
  React.useEffect(() => { if (chartOnly) setChartCollapsed(true); }, [preset?.tick]);
  const toggleChart = () => setChartCollapsed(v => !v);
  // Drag-to-park for the floating chart card.
  const floatDrag = useDraggable("fe-deepdive-chart-pos");

  // Per-row hover actions — mirrors the All-data grid (copy deep link / delete).
  const copyRowLink = (id) => {
    const url = `${location.origin}${location.pathname}#calc=${id}`;
    try { navigator.clipboard && navigator.clipboard.writeText(url); } catch {}
    window.dispatchEvent(new CustomEvent("fe-toast", { detail: `Link to ${id} copied to clipboard` }));
  };
  const deleteRow = (c) => {
    if (!confirm(`Delete calculation ${c.id}?`)) return;
    if (bulk && bulk.delete) bulk.delete([c.id]);
    else window.dispatchEvent(new CustomEvent("fe-toast", { detail: `Calculation ${c.id} deleted` }));
  };
  const rowActions = (c) => (
    <div className="row-actions">
      <button className="row-action" title="Copy link to row" aria-label="Copy link to row" onClick={(e) => { e.stopPropagation(); copyRowLink(c.id); }}><Icon name="link" size={15} /></button>
      <button className="row-action danger" title="Delete calculation" aria-label="Delete calculation" onClick={(e) => { e.stopPropagation(); deleteRow(c); }}><Icon name="trash" size={15} /></button>
    </div>
  );

  // Lookup maps — declared BEFORE the chart memos because the chart row
  // builder reads entryById to label per-entry bars.
  const entryById = React.useMemo(() => {
    const m = new Map();
    (entries || []).forEach(e => m.set(e.id, e));
    return m;
  }, [entries]);
  const calcsByEntryId = React.useMemo(() => {
    const m = new Map();
    calcs.forEach(c => {
      const arr = m.get(c.entryId) || [];
      arr.push(c);
      m.set(c.entryId, arr);
    });
    return m;
  }, [calcs]);

  // Calcs available to the carry-over chart — applies most filters but skips
  // the chart's own dimension (e.g. a "by category" chart ignores the category
  // filter, so it still shows multiple bars after a category deep-dive).
  const chartCalcs = React.useMemo(() => {
    if (!chartSpec || chartSpec.kind !== "auto") return [];
    const by = chartSpec.by;
    let r = calcs;
    if (bu !== "all" && by !== "site")    r = r.filter(c => c.business_unit === bu);
    if (scopeF !== "all")                  r = r.filter(c => String(c.scope) === scopeF);
    if (catF !== "all" && by !== "category") r = r.filter(c => c.category === catF);
    if (period && period !== "all")        r = r.filter(c => window.inPeriod(c, period));
    // NOTE: the free-text `query` is intentionally NOT applied here. `query`
    // doubles as the chart's bar-selection store (click a bar → set query →
    // filter the table). Re-segmenting the chart on it would collapse it to a
    // single matched bar and you could no longer switch bars. The chart still
    // re-segments on the structured filters above.
    return r;
  // eslint-disable-next-line
  }, [calcs, bu, scopeF, catF, period, chartSpec]);

  // Derived chart rows — recomputes whenever filters change
  const chartRows = React.useMemo(() => {
    if (!chartSpec) return null;
    if (chartSpec.kind === "static-bar" || chartSpec.kind === "static-delta") return chartSpec.rows;
    if (chartSpec.kind !== "auto") return null;
    const { by, topN = 6, highlightKey, highlightId } = chartSpec;

    if (by === "low-confidence") {
      const filt = chartCalcs.filter(c => c.status === "pending" || (c.status === "suggested" && c.confidence != null && c.confidence < 0.7));
      return filt
        .sort((a,b) => b.kgCO2e - a.kgCO2e)
        .slice(0, topN)
        .map((c, i) => ({
          label: c.activity,
          value: c.kgCO2e/1000,
          display: (c.kgCO2e/1000).toFixed(2) + " t",
          highlight: i === 0,
        }));
    }
    if (by === "spend-supplier") {
      const filt = chartCalcs.filter(c => /spend/i.test(c.method || ""));
      return filt
        .sort((a,b) => b.kgCO2e - a.kgCO2e)
        .slice(0, topN)
        .map((c, i) => ({
          label: c.business_activity || c.activity,
          value: c.kgCO2e/1000,
          display: (c.kgCO2e/1000).toFixed(2) + " t",
          highlight: i === 0,
        }));
    }

    // Group-based dimensions
    const groups = {};
    const labels = {};
    chartCalcs.forEach(c => {
      let k = null;
      if (by === "category") { k = c.category; if (k) labels[k] = (window.CAT_LABEL && window.CAT_LABEL(k)) || k; }
      else if (by === "site") { k = c.site; if (!k || k === "—") return; labels[k] = k; }
      else if (by === "entry") {
        k = c.entryId;
        const e = entryById.get(k);
        labels[k] = e?.summary || k;
      }
      if (!k) return;
      groups[k] = (groups[k] || 0) + c.kgCO2e;
    });
    const arr = Object.entries(groups).sort((a,b) => b[1] - a[1]).slice(0, topN);
    return arr.map(([k, v]) => ({
      label: labels[k] || k,
      value: v/1000,
      display: (v/1000).toFixed(1) + " t",
      highlight: highlightKey === k || highlightId === k,
      // Bar→filter target for the deep-dive grid.
      dd: by === "category" ? { category: k } : by === "site" ? { query: k } : { query: labels[k] || k },
    }));
  }, [chartSpec, chartCalcs, entryById]);
  const [visible, setVisible] = React.useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("fe-calc-cols"));
      if (!stored) return DEFAULT_VISIBLE;
      const missing = DEFAULT_VISIBLE.filter(k => !stored.includes(k));
      return missing.length ? [...stored, ...missing] : stored;
    } catch { return DEFAULT_VISIBLE; }
  });
  const [colMenu, setColMenu] = React.useState(false);
  const [exportMenu, setExportMenu] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 25;
  const bulkToastLocal = (msg) => { window.dispatchEvent(new CustomEvent("fe-toast", {detail: msg})); };
  React.useEffect(() => { localStorage.setItem("fe-calc-cols", JSON.stringify(visible)); }, [visible]);

  // (entryById / calcsByEntryId moved above the chart memos so chartRows can
  // safely read them.)
  // Friendly label for the activity's source (manual / import file / ERP)
  const sourceLabel = (entryId) => {
    const e = entryById.get(entryId);
    if (!e) return "";
    const b = (window.BATCHES || []).find(x => x.id === e.batchId);
    if (!b) return "Manual";
    if (b.source === "csv") return b.fileName || b.id;
    if (b.source === "erp") return (b.id || "ERP") + " · ERP";
    return "Manual";
  };
  const sourceKind = (entryId) => {
    const e = entryById.get(entryId);
    if (!e) return "manual";
    const b = (window.BATCHES || []).find(x => x.id === e.batchId);
    if (!b) return "manual";
    return b.source || "manual";
  };

  const calcGet = (c, key) => {
    switch (key) {
      case "id": return c.id;
      case "status": return c.status;
      case "business_unit": return c.business_unit;
      case "business_activity": return c.business_activity;
      case "user_assigned": return c.user_assigned;
      case "start_date": return c.start_date;
      case "end_date": return c.end_date;
      case "data_input_type": return c.data_input_type;
      case "consumption": return c.activity;
      case "factor": return c.factor?.name || "";
      case "emission": return c.kgCO2e;
      case "notes": return c.notes;
      case "created_on": return c.created_on;
      case "last_updated": return c.last_updated;
      case "files": return c.files_count;
      case "bulk_import_ref": return c.bulk_import_ref;
      case "custom_factor": return c.custom_factor;
      // New columns sourced from the linked activity record
      case "site": return entryById.get(c.entryId)?.site || "";
      case "source_import": return sourceLabel(c.entryId);
      case "calcs_count": return (calcsByEntryId.get(c.entryId) || []).length;
      default: return "";
    }
  };
  const calcFilterConfig = {
    status:          { options: [{k:"pending",l:"Pending"},{k:"suggested",l:"Suggested"},{k:"confirmed",l:"Confirmed"}] },
    business_unit:   { options: (window.BUSINESS_UNITS || []).map(u => ({k:u,l:u})) },
    user_assigned:   { options: (window.USERS || []).map(u => ({k:u,l:u})) },
    data_input_type: { options: [{k:"Manual",l:"Manual"},{k:"Bulk import (CSV)",l:"Bulk import (CSV)"},{k:"Integration (ERP)",l:"Integration (ERP)"}] },
    files:           { options: [{k:"has",l:"Has files"},{k:"none",l:"No files"}] },
    custom_factor:   { options: [{k:"yes",l:"Uses custom factor"},{k:"no",l:"Default factor"}] },
    // Activity-data columns
    source_import:   { options: [{k:"manual",l:"Manual entry"},{k:"csv",l:"Imported (CSV/PDF)"},{k:"erp",l:"Integration (ERP)"}] },
    calcs_count:     { options: [{k:"single",l:"Single calculation"},{k:"multi",l:"Multiple calculations (1:N)"}] },
  };

  // Compute the working set with every filter EXCEPT the status chip applied.
  // Used both for the visible table (after applying status) and to compute
  // contextual badge counts on each status chip — so e.g. "Pending 1"
  // becomes "Pending 0" when a date or BU filter excludes that pending row.
  const nonStatusFiltered = React.useMemo(() => {
    let r = calcs;
    if (bu !== "all") r = r.filter(c => c.business_unit === bu);
    if (scopeF !== "all") r = r.filter(c => String(c.scope) === scopeF);
    if (catF !== "all") r = r.filter(c => c.category === catF);
    if (period && period !== "all") r = r.filter(c => window.inPeriod(c, period));
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter(c =>
        c.id.toLowerCase().includes(q) ||
        c.activity.toLowerCase().includes(q) ||
        (c.business_activity||"").toLowerCase().includes(q) ||
        (c.business_unit||"").toLowerCase().includes(q) ||
        (c.user_assigned||"").toLowerCase().includes(q) ||
        (c.factor?.name||"").toLowerCase().includes(q) ||
        (c.site||"").toLowerCase().includes(q)
      );
    }
    Object.entries(colFilters).forEach(([k, val]) => {
      if (!val) return;
      // Skip the per-column status filter so it doesn't double-apply with the chip row
      if (k === "status") return;
      if (k === "files") {
        r = r.filter(c => val === "has" ? (c.files_count > 0) : (c.files_count === 0));
        return;
      }
      if (k === "custom_factor") {
        r = r.filter(c => val === "yes" ? (c.custom_factor && c.custom_factor !== "—") : (!c.custom_factor || c.custom_factor === "—"));
        return;
      }
      if (k === "source_import") {
        r = r.filter(c => sourceKind(c.entryId) === val);
        return;
      }
      if (k === "calcs_count") {
        r = r.filter(c => {
          const n = (calcsByEntryId.get(c.entryId) || []).length;
          return val === "multi" ? n > 1 : n <= 1;
        });
        return;
      }
      const cfg = calcFilterConfig[k];
      if (cfg?.options) {
        r = r.filter(c => String(calcGet(c, k)) === String(val));
      } else {
        const q = String(val).toLowerCase();
        r = r.filter(c => String(calcGet(c, k) ?? "").toLowerCase().includes(q));
      }
    });
    return r;
  }, [calcs, bu, scopeF, catF, query, colFilters, entryById, calcsByEntryId, period]);

  // Status chip badges reflect the contextual subset (everything except status itself).
  const counts = {
    all: nonStatusFiltered.length,
    pending:   nonStatusFiltered.filter(c => c.status === "pending").length,
    suggested: nonStatusFiltered.filter(c => c.status === "suggested").length,
    confirmed: nonStatusFiltered.filter(c => c.status === "confirmed").length,
  };

  const filtered = React.useMemo(() => {
    let r = nonStatusFiltered;
    if (filter === "pending")        r = r.filter(c => c.status === "pending");
    else if (filter === "suggested") r = r.filter(c => c.status === "suggested");
    else if (filter === "confirmed") r = r.filter(c => c.status === "confirmed");
    else if (filter === "needs_review") r = r.filter(c => c.status === "pending" || c.status === "suggested"); // legacy key
    // Per-column status filter (if user set it via header) layers on top
    const colStatus = colFilters.status;
    if (colStatus) r = r.filter(c => c.status === colStatus);
    if (sort) {
      r = [...r].sort((a, b) => cmpBy(a, b, (x) => calcGet(x, sort.key), sort.dir));
    }
    return r;
  }, [filter, nonStatusFiltered, colFilters.status, sort]);

  const isVisible = (k) => visible.includes(k);
  const toggleCol = (k) => setVisible(v => v.includes(k) ? v.filter(x=>x!==k) : [...v, k]);

  // Bulk selection
  const [selected, setSelected] = React.useState(() => new Set());
  React.useEffect(() => {
    const ids = new Set(calcs.map(c => c.id));
    setSelected(prev => new Set([...prev].filter(id => ids.has(id))));
  }, [calcs]);
  const visibleIds = filtered.map(c => c.id);
  const visSel = visibleIds.filter(id => selected.has(id));
  const allVisSelected = visibleIds.length > 0 && visSel.length === visibleIds.length;
  const someVisSelected = visSel.length > 0 && !allVisSelected;
  const toggleOne = (id) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAllVisible = () => setSelected(s => {
    const n = new Set(s);
    if (allVisSelected) visibleIds.forEach(id => n.delete(id));
    else visibleIds.forEach(id => n.add(id));
    return n;
  });
  const clearSel = () => setSelected(new Set());

  const selectedIndex = filtered.findIndex(c => c.id === selectedId);

  // Keyboard nav: j/k moves through filtered rows, Esc closes
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Escape" && selectedId) { setSelectedId(null); e.preventDefault(); }
      if (e.key === "j" || e.key === "ArrowDown") {
        const idx = selectedIndex < 0 ? 0 : Math.min(filtered.length - 1, selectedIndex + 1);
        setSelectedId(filtered[idx]?.id ?? null);
        e.preventDefault();
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        const idx = selectedIndex <= 0 ? 0 : selectedIndex - 1;
        setSelectedId(filtered[idx]?.id ?? null);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, selectedIndex, filtered, setSelectedId]);

  // Scroll selected row into view
  React.useEffect(() => {
    if (!selectedId) return;
    const el = document.querySelector(`[data-row-id="${selectedId}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const inView = rect.top > 120 && rect.bottom < window.innerHeight - 40;
      if (!inView) el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedId]);

  // ── Saved-view snapshot ────────────────────────────────────────────────
  // Capture the entire filter-bar state so a view can be re-applied exactly.
  const buildSnapshot = React.useCallback(() => ({
    bu,
    scope: scopeF,
    category: catF,
    period,
    query,
    colFilters: { ...colFilters },
    status: filter,
    chartSpec: chartSpec || null,
    // kept for back-compat with the chart deep-dive apply path
    deepDive: { bu, scope: scopeF, category: catF, query },
  }), [bu, scopeF, catF, period, query, colFilters, filter, chartSpec]);

  const filterActiveCount =
    (scopeF !== "all" ? 1 : 0) +
    (bu !== "all" ? 1 : 0) +
    (catF !== "all" ? 1 : 0) +
    (period ? 1 : 0) +
    Object.keys(colFilters).length +
    (query.trim() ? 1 : 0);
  const anyFilterActive = filterActiveCount > 0 || !!chartSpec;

  // Keep the parent informed of the live filter state so its tab-level
  // "Save view" affordances can capture the full context too.
  React.useEffect(() => {
    if (onFiltersChange) onFiltersChange(buildSnapshot());
  }, [buildSnapshot, onFiltersChange]);

  const columnsControl = (
          <div className="col-menu-wrap">
            <button className="btn secondary small" onClick={() => setColMenu(v => !v)}>
              <Icon name="filter" size={16}/>Columns
            </button>
            {colMenu && (
              <>
                <div style={{position:"fixed", inset:0, zIndex:20}} onClick={() => setColMenu(false)}/>
                <div className="col-menu">
                  <div className="head">
                    <span style={{whiteSpace:"nowrap"}}>Show columns <span style={{color:"var(--fe-fg-muted)", fontWeight:500}}>{visible.length}/{ALL_COLUMNS.length}</span></span>
                    <span><a onClick={() => setVisible(ALL_COLUMNS.map(c=>c.k))}>Show all</a> · <a onClick={() => setVisible([])}>Hide all</a></span>
                  </div>
                  <div className="col-menu-presets">
                    <button className="col-preset" onClick={() => setVisible(DEFAULT_VISIBLE)}>
                      <Icon name="check" size={11}/>Essentials
                      <span className="col-preset-desc">Calculation-focused view</span>
                    </button>
                    <button className="col-preset" onClick={() => setVisible(ALL_COLUMNS.map(c=>c.k))}>
                      <Icon name="collect" size={11}/>Show all data
                      <span className="col-preset-desc">Every field, including activity context</span>
                    </button>
                  </div>
                  <div className="col-menu-divider"></div>
                  {ALL_COLUMNS.map(col => (
                    <label key={col.k}>
                      <input type="checkbox" checked={isVisible(col.k)} onChange={() => toggleCol(col.k)} />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
  );

  const exportControl = (
          <div className="col-menu-wrap">
            <button className="btn secondary small" onClick={() => setExportMenu(v => !v)}>
              <Icon name="arrowDown" size={16}/>Export <Icon name="chev" size={12}/>
            </button>
            {exportMenu && (
              <>
                <div style={{position:"fixed", inset:0, zIndex:20}} onClick={() => setExportMenu(false)}/>
                <div className="export-menu" role="menu">
                  <div className="em-item" onClick={() => { setExportMenu(false); window.dispatchEvent(new CustomEvent("fe-export-start", {detail: { title: "Current filtered data", meta: `${filtered.length.toLocaleString()} rows · ${visible.length} cols · CSV`, filename: `calculations_${new Date().toISOString().slice(0,10)}.csv`, rows: filtered.length }})); }}>
                    <div className="em-label"><Icon name="arrowDown" size={14}/>Current filtered data <span className="em-meta">({filtered.length.toLocaleString()} rows)</span></div>
                    <div className="em-desc">Visible rows, columns only</div>
                  </div>
                  <div className="em-item" onClick={() => { setExportMenu(false); window.dispatchEvent(new CustomEvent("fe-export-start", {detail: { title: "Detailed filtered data", meta: `${filtered.length.toLocaleString()} rows · all ${ALL_COLUMNS.length} cols · XLSX`, filename: `calculations_detailed_${new Date().toISOString().slice(0,10)}.xlsx`, rows: filtered.length * 1.4 }})); }}>
                    <div className="em-label"><Icon name="arrowDown" size={14}/>Detailed filtered data</div>
                    <div className="em-desc">Filtered rows + all columns</div>
                  </div>
                  <div className="em-item" onClick={() => { setExportMenu(false); window.dispatchEvent(new CustomEvent("fe-export-start", {detail: { title: "Full data set", meta: `${calcs.length.toLocaleString()} calcs + ${(window.ENTRIES||[]).length} entries · XLSX`, filename: `full_data_${new Date().toISOString().slice(0,10)}.xlsx`, rows: calcs.length + (window.ENTRIES||[]).length }})); }}>
                    <div className="em-label"><Icon name="arrowDown" size={14}/>Full data set</div>
                    <div className="em-desc">All calculations + data entry info</div>
                  </div>
                  <div className="em-sep"/>
                  <div className="em-item" onClick={() => { setExportMenu(false); bulkToastLocal("Opening export customization…"); }}>
                    <div className="em-label"><Icon name="settings" size={14}/>Customize export…</div>
                    <div className="em-desc">Choose columns, format, delimiter</div>
                  </div>
                </div>
              </>
            )}
          </div>
  );

  const actions = (
    <div className="page-actions" style={embedded ? {gap:8} : undefined}>
      {columnsControl}
      {exportControl}
    </div>
  );

  // Reset to first page whenever the filtered set changes.
  React.useEffect(() => { setPage(1); }, [filter, scopeF, bu, catF, period, query, JSON.stringify(colFilters), chartSpec]);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // chartOnly: render JUST the floating chart strip (absolute). The deep-dive's
  // grid is now the standard AllData grid (rendered by DataPage), with this chart
  // overlaid on top — so the deep-dive shares the exact toolbar/options as default tabs.
  if (chartOnly) {
    if (!(chartSpec && chartRows && chartRows.length > 0)) return null;
    return (
      <div
        ref={floatDrag.ref}
        onPointerDown={floatDrag.onPointerDown}
        onDoubleClick={(e) => { if (!e.target.closest("button, a, input, select, .ai-context-strip__chart")) floatDrag.reset(); }}
        style={(!chartCollapsed && floatDrag.pos) ? { position: "fixed", left: floatDrag.pos.x, top: floatDrag.pos.y, right: "auto", zIndex: 60 } : undefined}
        className={"ai-context-strip ai-context-strip--float" + (chartCollapsed ? " is-collapsed" : "") + (floatDrag.dragging ? " is-dragging" : "")}
        role="region" aria-label="Forward AI insight chart"
      >
        <span className="ai-context-strip__grip" aria-hidden="true" title="Drag to move · double-click to reset"><Icon name="grip" size={14}/></span>
        <button
          type="button"
          className="ai-context-strip__toggle"
          onClick={toggleChart}
          aria-expanded={!chartCollapsed}
          title={chartCollapsed ? "Show chart" : "Hide chart"}
        >
          <span className="ai-context-strip__toggle-label">{chartCollapsed ? "Show chart" : "Hide chart"}</span>
          <Icon name="chev" size={14}/>
        </button>
        <div className="ai-context-strip__text">
          {preset?.origin && onBack && (
            <button
              type="button"
              className="deepdive-back deepdive-back--strip"
              onClick={() => onBack(preset.origin, preset.originAnchor)}
              title={`Back to ${preset.originLabel || "previous page"}`}
            >
              <Icon name="arrowLeft" size={15}/>
              <span>Back to {preset.originLabel || "previous page"}</span>
            </button>
          )}
          <div className="ai-context-strip__meta">
            <FaiBrand soft />
            {chartSpec.tag && <span className="ai-context-strip__tag">· {chartSpec.tag}</span>}
            <span className="ai-context-strip__snapshot" title="A snapshot of the chart you came from — the table is filtered to match">Snapshot</span>
          </div>
          <div className="ai-context-strip__title">{chartSpec.title}</div>
          {!chartCollapsed && (
          <div className="ai-context-strip__sub">Carried over · the table is filtered to match.</div>
          )}
        </div>
        {!chartCollapsed && (
        <div className="ai-context-strip__chart">
          {(() => {
            // Click a bar → filter the deep-dive grid (toggle off if re-clicked).
            const onSel = (label) => {
              if (!onBarSelect) return;
              if (!label || label === selectedBar) { onBarSelect(null); return; }
              const row = (chartRows || []).find(r => r.label === label);
              onBarSelect({ dd: (row && row.dd) || { query: label }, label });
            };
            return chartSpec.variant
              ? <CarriedChart spec={chartSpec} rows={chartRows} onSelect={onSel} selectedLabel={selectedBar || null} />
              : chartSpec.kind === "static-delta"
              ? <DeltaBarChart rows={chartRows} unit={chartSpec.unit || "t"}/>
              : <HorizBarChart rows={chartRows} unit={chartSpec.unit || "t"} onSelect={onSel} selectedLabel={selectedBar || null} />;
          })()}
        </div>
        )}
      </div>
    );
  }

  return (
    <>
      {!embedded && (
        <div className="page-head">
          <div>
            <h1 className="page-title">Calculations</h1>
            <div className="page-subtitle">One row per emission calculation · {calcs.length} results in Q1 2026</div>
          </div>
          {actions}
        </div>
      )}
      {/* Embedded actions (Columns / Export) now render inline in the filter bar. */}

      {/* Fallback back-link — only when there's no carried chart to host it. */}
      {preset?.origin && onBack && !(chartSpec && chartRows && chartRows.length > 0) && (
        <button
          type="button"
          className="deepdive-back"
          onClick={() => onBack(preset.origin, preset.originAnchor)}
          title={`Back to ${preset.originLabel || "previous page"}`}
        >
          <Icon name="arrowLeft" size={15}/>
          <span>Back to {preset.originLabel || "previous page"}</span>
        </button>
      )}

      {/* The carried chart renders as a floating overlay anchored to the grid
          (see .deepdive-float-wrap below), so the table keeps full height. */}

      {selected.size > 0 ? (
        <BulkToolbar
          count={selected.size}
          kind="calcs"
          onClear={clearSel}
          onStatus={(s) => bulk?.status([...selected], s)}
          onAssign={(u) => bulk?.assign([...selected], u)}
          onExport={() => bulk?.export([...selected])}
          onDelete={() => {
            if (confirm(`Delete ${selected.size} calculations?`)) {
              bulk?.delete([...selected]); clearSel();
            }
          }}
        />
      ) : (
      <div className="filter-bar">
        <span className="filter-search">
          <Icon name="search" size={14} style={{color:"var(--fe-fg-muted)"}}/>
          <input placeholder="Search ID, activity, factor…" value={query} onChange={e => setQuery(e.target.value)}/>
        </span>

        {/* Status — only as a removable pill once added (no default filter) */}
        {colFilters.status && (
        <FilterPill
          icon="filter"
          label="Status"
          value={colFilters.status || null}
          options={[
            {k:"pending",   l:`Pending (${counts.pending})`},
            {k:"suggested", l:`Suggested (${counts.suggested})`},
            {k:"confirmed", l:`Confirmed (${counts.confirmed})`},
          ]}
          onChange={(v) => setColFilter("status", v)}
          onClear={() => setColFilter("status", null)}
          renderValue={(v) => {
            const n = counts[v] ?? 0;
            const label = v.charAt(0).toUpperCase() + v.slice(1);
            return <>{label} <span style={{opacity:0.65, marginLeft:2}}>({n})</span></>;
          }}
        />
        )}
        {/* Scope — only when set */}
        {scopeF !== "all" && (
        <FilterPill
          icon="filter"
          label="Scope"
          value={scopeF !== "all" ? scopeF : null}
          options={[{k:"1",l:"1"},{k:"2",l:"2"},{k:"3",l:"3"}]}
          onChange={(v) => setScopeF(v)}
          onClear={() => setScopeF("all")}
        />
        )}

        {/* Business unit — only when set */}
        {bu !== "all" && (
          <FilterPill
            icon="users"
            label="Business unit"
            triggerLabel="Business unit"
            value={bu}
            options={(window.BUSINESS_UNITS || []).map(u => ({k:u, l:u}))}
            onChange={(v) => setBu(v)}
            onClear={() => setBu("all")}
          />
        )}

        {/* Reporting period — only when set */}
        {period && (
          <FilterPill
            icon="calendar"
            label="Period"
            value={period}
            options={window.PERIOD_OPTIONS}
            onChange={(v) => setPeriod(v)}
            onClear={() => setPeriod(null)}
          />
        )}

        {/* Category — only when active (set via deep-dive); show as removable pill */}
        {catF !== "all" && (
          <FilterPill
            icon="filter"
            label="Category"
            value={catF}
            options={[{k: catF, l: window.CAT_LABEL?.(catF) || catF}]}
            onChange={() => {}}
            onClear={() => setCatF("all")}
            renderValue={(v) => window.CAT_LABEL?.(v) || v}
          />
        )}

        {/* Per-column filters surfaced as removable pills (excludes status — primary pill above) */}
        {Object.entries(colFilters).filter(([k]) => k !== "status").map(([k, val]) => {
          const col = ALL_COLUMNS.find(c => c.k === k);
          if (!col) return null;
          const cfg = calcFilterConfig[k];
          return (
            <FilterPill
              key={k}
              icon="filter"
              label={col.label}
              value={val}
              options={cfg?.options}
              onChange={(v) => setColFilter(k, v)}
              onClear={() => setColFilter(k, null)}
            />
          );
        })}

        {/* + Filter — quick-add menu of unused facets (BU, Period, per-column) */}
        <AddFilterButton
          facets={[
            ...(!colFilters.status ? [{k: "__status", label: "Status", icon: "filter"}] : []),
            ...(scopeF === "all"   ? [{k: "__scope",  label: "Scope",  icon: "filter"}] : []),
            ...(bu === "all" ? [{k: "__bu", label: "Business unit", icon: "users"}] : []),
            ...(!period      ? [{k: "__period", label: "Period",      icon: "calendar"}] : []),
            ...ALL_COLUMNS
              .filter(c => calcFilterConfig[c.k]?.options && !colFilters[c.k] && c.k !== "business_unit" && c.k !== "status")
              .map(c => ({k: c.k, label: c.label, icon: "filter"})),
          ]}
          onAdd={(k) => {
            if (k === "__status") { setColFilter("status", "suggested"); return; }
            if (k === "__scope")  { setScopeF("1"); return; }
            if (k === "__bu") {
              const first = (window.BUSINESS_UNITS || [])[0];
              if (first) setBu(first);
              return;
            }
            if (k === "__period") { setPeriod("q1_2026"); return; }
            const first = calcFilterConfig[k]?.options?.[0]?.k;
            if (first) setColFilter(k, first);
          }}
        />

        {/* Clear-all only appears when ≥2 conditions are active */}
        {(() => {
          const activeCount = (scopeF !== "all" ? 1 : 0) + (bu !== "all" ? 1 : 0) + (catF !== "all" ? 1 : 0) + (period ? 1 : 0) + Object.keys(colFilters).length;
          if (activeCount < 2) return null;
          return (
            <button className="filter-clear-all" onClick={() => {
              setScopeF("all"); setBu("all"); setCatF("all"); setColFilters({}); setPeriod(null);
            }}>Clear all {activeCount}</button>
          );
        })()}

        {/* Save view — snapshot the current filter combination as a renamable
            tab. When already on a saved view, offer Update + Save-as-new. */}
        {onSaveView && anyFilterActive && (
          activeViewName ? (
            <span className="save-view-group">
              <button
                className="filter-saveview"
                onClick={() => onUpdateView && onUpdateView(buildSnapshot())}
                title={`Update “${activeViewName}” with the current filters`}
              >
                <Icon name="check" size={13}/>Update view
              </button>
              <button
                className="filter-saveview ghost"
                onClick={() => onSaveView(buildSnapshot())}
                title="Save the current filters as a new view"
              >
                Save as new
              </button>
            </span>
          ) : (
            <button
              className="filter-saveview"
              onClick={() => onSaveView(buildSnapshot())}
              title="Save the current filters as a reusable view tab"
            >
              <Icon name="pin" size={13}/>Save view
            </button>
          )
        )}

        <div style={{marginLeft:"auto", display:"flex", alignItems:"center", gap:14}}>
          {embedded && actions}
        </div>
      </div>
      )}

      <div className="deepdive-float-wrap">
      {chartSpec && chartRows && chartRows.length > 0 && (
        <div
          ref={floatDrag.ref}
          onPointerDown={floatDrag.onPointerDown}
          onDoubleClick={(e) => { if (!e.target.closest("button, a, input, select, .ai-context-strip__chart")) floatDrag.reset(); }}
          style={floatDrag.pos ? { position: "fixed", left: floatDrag.pos.x, top: floatDrag.pos.y, right: "auto", zIndex: 60 } : undefined}
          className={"ai-context-strip ai-context-strip--float" + (chartCollapsed ? " is-collapsed" : "") + (floatDrag.dragging ? " is-dragging" : "")}
          role="region" aria-label="Forward AI insight chart"
        >
          <span className="ai-context-strip__grip" aria-hidden="true" title="Drag to move · double-click to reset"><Icon name="grip" size={14}/></span>
          <button
            type="button"
            className="ai-context-strip__toggle"
            onClick={toggleChart}
            aria-expanded={!chartCollapsed}
            title={chartCollapsed ? "Show chart" : "Hide chart"}
          >
            <span className="ai-context-strip__toggle-label">{chartCollapsed ? "Show chart" : "Hide chart"}</span>
            <Icon name="chev" size={14}/>
          </button>
          <div className="ai-context-strip__text">
            {preset?.origin && onBack && (
              <button
                type="button"
                className="deepdive-back deepdive-back--strip"
                onClick={() => onBack(preset.origin, preset.originAnchor)}
                title={`Back to ${preset.originLabel || "previous page"}`}
              >
                <Icon name="arrowLeft" size={15}/>
                <span>Back to {preset.originLabel || "previous page"}</span>
              </button>
            )}
            <div className="ai-context-strip__meta">
              <FaiBrand soft />
              {chartSpec.tag && <span className="ai-context-strip__tag">· {chartSpec.tag}</span>}
              {chartSpec.variant
                ? <span className="ai-context-strip__snapshot" title="A snapshot of the chart you came from — it stays fixed while you explore the rows below">Snapshot</span>
                : <span className="ai-context-strip__live" title="Recalculates as you filter">
                    <span className="ai-context-strip__pulse" aria-hidden="true"/>Live · updates with filters
                  </span>
              }
            </div>
            <div className="ai-context-strip__title">{chartSpec.title}</div>
            {!chartCollapsed && (
            <div className="ai-context-strip__sub">
              {chartSpec.variant
                ? <>Carried over from <b>{chartSpec.carriedFrom}</b> · the table below is filtered to match.</>
                : chartSpec.carriedFrom
                ? <>Carried over from <b>{chartSpec.carriedFrom}</b> · adjust filters below to re-segment the chart.</>
                : <>From {filtered.length.toLocaleString()} of {calcs.length.toLocaleString()} calculations · adjust filters below to re-segment the chart.</>
              }
            </div>
            )}
          </div>
          {!chartCollapsed && (
          <div className="ai-context-strip__chart">
            {chartSpec.variant
              ? <CarriedChart
                  spec={chartSpec}
                  rows={chartRows}
                  onSelect={(label) => setQuery(label || "")}
                  selectedLabel={(chartRows.find(r => r.label === query.trim()) || {}).label || null}
                />
              : chartSpec.kind === "static-delta"
              ? <DeltaBarChart rows={chartRows} unit={chartSpec.unit || "t"}/>
              : <HorizBarChart
                  rows={chartRows}
                  unit={chartSpec.unit || "t"}
                  onSelect={(label) => setQuery(label || "")}
                  selectedLabel={(chartRows.find(r => r.label === query.trim()) || {}).label || null}
                />
            }
          </div>
          )}
        </div>
      )}
      <div className="card" style={{padding:0, overflow:"hidden"}}>
        <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th className="cb-cell">
                <HeaderCheckbox
                  checked={allVisSelected}
                  indeterminate={someVisSelected}
                  onChange={toggleAllVisible}
                />
              </th>
              {ALL_COLUMNS.filter(c => isVisible(c.k)).map((col) => {
                const align = (col.k === "emission" || col.k === "calcs_count") ? "right" : "left";
                const cfg = calcFilterConfig[col.k];
                return (
                  <th key={col.k} style={{ width: col.w, minWidth: col.w, textAlign: align }}>
                    <SortableHeader
                      label={col.label}
                      colKey={col.k}
                      align={align}
                      sort={sort}
                      onSort={handleSort}
                      filterValue={colFilters[col.k]}
                      onFilter={(v) => setColFilter(col.k, v)}
                      filterOptions={cfg?.options}
                    />
                  </th>
                );
              })}
              <th className="ra-cell" aria-label="Row actions"/>
            </tr>
          </thead>
          <tbody>
            {paged.map(c => {
              const isSel = selected.has(c.id);
              return (
              <tr key={c.id}
                  data-row-id={c.id}
                  className={`${selectedId === c.id ? "selected" : ""} ${isSel ? "sel" : ""}`.trim()}
                  onClick={(ev) => {
                    if (ev.target.closest(".cb-cell")) return;
                    setSelectedId(c.id);
                  }}>
                <td className="cb-cell" onClick={(ev) => ev.stopPropagation()}>
                  <input type="checkbox" className="fe-cb" checked={isSel} onChange={() => toggleOne(c.id)}/>
                </td>
                {ALL_COLUMNS.filter(col => isVisible(col.k)).map((col) => {
                  switch (col.k) {
                    case "id":
                      return <td key={col.k} title={c.id} style={{fontFamily:"var(--fe-font-mono)", fontSize:12, color:"var(--fe-fg-strong)", width:col.w, maxWidth:col.w, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{shortCalcId(c.id)}</td>;
                    case "status":
                      return <td key={col.k}>
                        <div style={{display:"flex", flexDirection:"column", gap:4, alignItems:"flex-start"}}>
                          <StatusChip status={c.status}/>
                          {c.status === "suggested" && c.confidence != null &&
                            <Confidence value={c.confidence} />}
                        </div>
                      </td>;
                    case "business_unit":
                      return <td key={col.k} style={{color:"var(--fe-fg-strong)", fontWeight:500}}>{c.business_unit}</td>;
                    case "business_activity":
                      return <td key={col.k}>
                        <div style={{color:"var(--fe-fg-strong)", fontWeight:500}}>{c.business_activity}</div>
                        <div style={{fontSize:11, color:"var(--fe-fg-muted)", marginTop:1, display:"flex", alignItems:"center", gap:6}}>
                          <ScopeBadge scope={c.scope}/>
                          <span><CatLabel cat={c.category}/></span>
                        </div>
                      </td>;
                    case "user_assigned":
                      return <td key={col.k} style={{color:"var(--fe-fg-default)"}}>{c.user_assigned}</td>;
                    case "start_date":
                      return <td key={col.k} style={{color:"var(--fe-fg-muted)"}}>{c.start_date}</td>;
                    case "end_date":
                      return <td key={col.k} style={{color:"var(--fe-fg-muted)"}}>{c.end_date}</td>;
                    case "data_input_type":
                      return <td key={col.k}>
                        <span className="chip"><span className="dot"></span>{c.data_input_type}</span>
                      </td>;
                    case "consumption":
                      return <td key={col.k}>
                        <div style={{color:"var(--fe-fg-strong)", fontWeight:500}}>{c.quantity.toLocaleString()} {c.unit}</div>
                        <div style={{fontSize:11, color:"var(--fe-fg-muted)", marginTop:1}}>{c.site}</div>
                      </td>;
                    case "factor":
                      return <td key={col.k} className="wrap" style={{fontSize:12}}>
                        <div style={{color:"var(--fe-fg-strong)", fontWeight:500, whiteSpace:"normal"}}>{c.factor.name}</div>
                        <div style={{color:"var(--fe-fg-muted)", marginTop:1}}>{c.factor.source} · {c.factor.kg_per_unit} kg/{c.factor.unit}</div>
                      </td>;
                    case "emission":
                      return <td key={col.k} style={{textAlign:"right", fontWeight:500, color:"var(--fe-fg-strong)"}} className="num">
                        {fmtKgSmart(c.kgCO2e)} <span style={{fontSize:11, color:"var(--fe-fg-muted)", fontWeight:500}}>kgCO₂e</span>
                      </td>;
                    case "notes":
                      return <td key={col.k} className="wrap" style={{color: c.notes ? "var(--fe-fg-default)" : "var(--fe-fg-subtle)", fontSize:12, whiteSpace:"normal"}}>{c.notes || "—"}</td>;
                    case "created_on":
                      return <td key={col.k} style={{color:"var(--fe-fg-muted)"}}>{c.created_on}</td>;
                    case "last_updated":
                      return <td key={col.k} style={{color:"var(--fe-fg-muted)"}}>{c.last_updated}</td>;
                    case "files":
                      return <td key={col.k} style={{color:"var(--fe-fg-default)"}}>
                        {c.files_count > 0
                          ? <span style={{display:"inline-flex", alignItems:"center", gap:4}}><Icon name="upload" size={14} style={{color:"var(--fe-fg-muted)"}}/>{c.files_count}</span>
                          : <span style={{color:"var(--fe-fg-subtle)"}}>—</span>}
                      </td>;
                    case "bulk_import_ref":
                      return <td key={col.k} style={{fontSize:12, color:"var(--fe-fg-default)"}}>{c.bulk_import_ref}</td>;
                    case "custom_factor":
                      return <td key={col.k} style={{fontSize:12, color: c.custom_factor === "—" ? "var(--fe-fg-subtle)" : "var(--fe-fg-default)"}}>{c.custom_factor}</td>;
                    case "site": {
                      const e = entryById.get(c.entryId);
                      const v = e?.site;
                      return <td key={col.k} style={{color: v && v !== "—" ? "var(--fe-fg-strong)" : "var(--fe-fg-subtle)", fontWeight: v && v !== "—" ? 500 : 400}}>{v || "—"}</td>;
                    }
                    case "source_import": {
                      const kind = sourceKind(c.entryId);
                      const label = sourceLabel(c.entryId);
                      const icon = kind === "csv" ? "upload" : kind === "erp" ? "check" : "pencil";
                      return <td key={col.k}>
                        <span className="src-chip" title={label}>
                          <Icon name={icon} size={12}/>
                          <span className="src-chip-label">{label}</span>
                        </span>
                      </td>;
                    }
                    case "calcs_count": {
                      const n = (calcsByEntryId.get(c.entryId) || []).length;
                      if (n <= 1) {
                        return <td key={col.k} style={{textAlign:"right", color:"var(--fe-fg-subtle)", fontSize:12}} className="num">1</td>;
                      }
                      // Find this calc's index among siblings to render "2 of 3" style
                      const sibs = calcsByEntryId.get(c.entryId) || [];
                      const idx = sibs.findIndex(s => s.id === c.id) + 1;
                      return <td key={col.k} style={{textAlign:"right"}}>
                        <span className="multi-calc-pill" title={`This activity has ${n} calculations — common for fuels (Scope 1 + 3.3 well-to-tank) or multi-gas factors`}>
                          {idx} of {n}
                        </span>
                      </td>;
                    }
                    default: return <td key={col.k}/>;
                  }
                })}
                <td className="ra-cell" onClick={(ev) => ev.stopPropagation()}>{rowActions(c)}</td>
              </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={(visible.length || 0) + 2}><div className="empty">No calculations match these filters.</div></td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage}/>
    </>
  );
}


// Calculation detail drawer
function CalculationDrawer({ calc, entries, calcs, onClose, onNav, onApprove, onReject, onSwap, onViewEntry, onViewCalc }) {
  if (!calc) return null;
  const entry = entries.find(e => e.id === calc.entryId);
  const siblings = calcs.filter(c => c.entryId === calc.entryId);
  const confLevel = calc.confidence < 0.6 ? "low" : calc.confidence < 0.8 ? "med" : "";
  const isFinal = calc.status === "confirmed";

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Calculation detail">
        <div className="drawer-head">
          <div style={{flex:1, minWidth:0}}>
            <div className="kicker">Calculation · {calc.id}</div>
            <h2>{calc.activity}</h2>
            <div style={{display:"flex", gap:8, alignItems:"center", marginTop:10, flexWrap:"wrap"}}>
              <ScopeBadge scope={calc.scope}/>
              <StatusChip status={calc.status}/>
              <span style={{fontSize:12, color:"var(--fe-fg-muted)"}}>{calc.date} · {calc.site}</span>
            </div>
          </div>
          <button className="btn-close" onClick={onClose} title="Close (Esc)"><Icon name="close" size={18}/></button>
        </div>

        <div className="drawer-body">
          {/* Result */}
          <div className="d-section">
            <div className="big-number">
              <span className="n">{fmtKgSmart(calc.kgCO2e)}</span>
              <span className="u">kgCO₂e · {calc.gas}</span>
            </div>
            <div className="calc-formula">
              <span className="lbl">activity</span>
              <span className="v">{calc.quantity.toLocaleString()}</span>
              <span>{calc.unit}</span>
              <span className="op">×</span>
              <span className="lbl">factor</span>
              <span className="v">{calc.factor.kg_per_unit}</span>
              <span>kg/{calc.unit}</span>
              <span className="op">=</span>
              <span className="v">{fmtKgSmart(calc.kgCO2e)}</span>
              <span>kgCO₂e</span>
            </div>
          </div>

          {/* EF matching — always rendered, status-aware */}
          <EFMatchSection calc={calc} confLevel={confLevel} onSwap={onSwap} />


          {/* Activity data */}
          <div className="d-section">
            <div className="d-section-head">Activity data</div>
            <div className="d-grid">
              <div className="k">Source entry</div>
              <div className="v"><span className="link" onClick={() => onViewEntry(entry.id)}>{entry.id} · {entry.summary}<Icon name="arrowRight" size={12}/></span></div>
              <div className="k">Quantity</div>
              <div className="v num">{calc.quantity.toLocaleString()} {calc.unit}</div>
              <div className="k">Activity date</div>
              <div className="v">{calc.date}</div>
              <div className="k">Site</div>
              <div className="v">{calc.site}</div>
              <div className="k">Method</div>
              <div className="v">{calc.method}</div>
            </div>
          </div>

          {/* Change log */}
          <div className="d-section">
            <div className="d-section-head">Change log</div>
            <ChangeLog calc={calc} entry={entry}/>
          </div>

          {/* Sibling calculations */}
          {siblings.length > 1 && (
            <div className="d-section">
              <div className="d-section-head">Other calculations from this entry ({siblings.length})</div>
              <div className="sibling-list">
                {siblings.map(s => (
                  <div key={s.id}
                       className={`sibling-row ${s.id === calc.id ? "active" : ""}`}
                       onClick={() => s.id !== calc.id && onViewCalc(s.id)}>
                    <ScopeBadge scope={s.scope}/>
                    <div>
                      <div className="label">{s.activity}</div>
                      <div className="sub">{s.gas} · {s.factor.name}</div>
                    </div>
                    <div className="kg num">{fmtKgSmart(s.kgCO2e)}</div>
                    <StatusChip status={s.status}/>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="drawer-foot">
          <CalcActions calc={calc} confLevel={confLevel} onApprove={onApprove} onSwap={onSwap} onReject={onReject}/>
          <div className="spacer"/>
          <span className="drawer-nav-hint">
            <span className="kbd">J</span><span className="kbd">K</span> navigate
            <span style={{margin:"0 4px"}}>·</span>
            <span className="kbd">Esc</span> close
          </span>
          <button className="btn secondary small" onClick={() => onNav(-1)} title="Previous (k)"><Icon name="chev" size={14} style={{transform:"rotate(180deg)"}}/></button>
          <button className="btn secondary small" onClick={() => onNav(1)} title="Next (j)"><Icon name="chev" size={14}/></button>
        </div>
      </aside>
    </>
  );
}

// --- EF matching section: status-aware rationale, expandable for confirmed --
function EFMatchSection({ calc, confLevel, onSwap }) {
  const s = calc.status;
  const hasMatch = !!calc.factor?.name && calc.confidence != null;
  const conf = Math.round((calc.confidence || 0) * 100);

  // Pending — no match attempted yet
  if (s === "pending") {
    return (
      <div className="d-section">
        <div className="d-section-head">Emission factor matching</div>
        <div className="ef-match pending">
          <div className="ef-match-head">
            <span className="ef-match-icon"><span className="entry-spinner" aria-hidden/></span>
            <div className="ef-match-titles">
              <div className="ef-match-title">Queued for AI matching</div>
              <div className="ef-match-sub">The matching engine will scan the EF library against this entry's category, unit, region, and vintage. Typically completes within a minute.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Suggested without a match
  if (!hasMatch) {
    return (
      <div className="d-section">
        <div className="d-section-head">Emission factor matching</div>
        <div className="ef-match nomatch">
          <div className="ef-match-head">
            <span className="ef-match-icon"><Icon name="warn" size={16}/></span>
            <div className="ef-match-titles">
              <div className="ef-match-title">No factor confidently matched</div>
              <div className="ef-match-sub">Manual selection required.</div>
            </div>
          </div>
          <div className="ef-match-rationale">
            <div className="ef-rationale-head"><Icon name="sparkle" size={13}/>Why no match</div>
            <div className="ef-rationale-body">
              No library factor scored above the 50% confidence threshold for <b>{calc.activity}</b>. Likely causes: the activity description is ambiguous, the unit basis ({calc.unit}) doesn't map cleanly to spend- or mass-based factors in this category, or the regional / vintage scope of available factors doesn't cover the source entry's reporting period. {calc.reason || ""}
            </div>
          </div>
          <div className="ef-match-foot">
            <button className="btn primary small" onClick={onSwap}><Icon name="filter" size={14}/>Select emission factor</button>
          </div>
        </div>
      </div>
    );
  }

  // Confirmed — collapsed by default
  if (s === "confirmed") {
    return (
      <div className="d-section ef-section">
        <details className="ef-match confirmed">
          <summary className="ef-match-head">
            <span className="ef-match-icon ok"><Icon name="check" size={14}/></span>
            <div className="ef-match-titles">
              <div className="ef-match-kicker">Emission factor</div>
              <div className="ef-match-title">{calc.factor.name}</div>
              <div className="ef-match-sub">{calc.factor.source} · {calc.factor.vintage} · {calc.factor.kg_per_unit} kgCO₂e/{calc.factor.unit}</div>
            </div>
            <Icon name="chev" size={14} className="ef-match-chev"/>
          </summary>
          <div className="ef-match-body">
            <div className="d-grid d-fields">
              <div className="d-field"><div className="k">Source</div><div className="v">{calc.factor.source}</div></div>
              <div className="d-field"><div className="k">Vintage</div><div className="v">{calc.factor.vintage}</div></div>
              <div className="d-field"><div className="k">Value</div><div className="v mono">{calc.factor.kg_per_unit} kgCO₂e / {calc.factor.unit}</div></div>
              <div className="d-field"><div className="k">Gas</div><div className="v">{calc.gas}</div></div>
              <div className="d-field"><div className="k">Method</div><div className="v">{calc.method}</div></div>
            </div>
            <div className="ef-match-rationale subtle">
              <div className="ef-rationale-head"><Icon name="sparkle" size={13}/>Original match rationale</div>
              <div className="ef-rationale-body">
                {calc.reason || "Matched by the AI engine and reviewed."} The activity data ({calc.activity}, {calc.scope}) aligned with this factor's scope and unit basis; region and vintage were cross-checked against the source entry's reporting period before confirmation.
              </div>
              <a className="ef-rationale-link" onClick={(ev) => { ev.preventDefault(); window.dispatchEvent(new CustomEvent("fe-toast", {detail: `Would open ${calc.factor.name} · ${calc.factor.source}`})); }} href="#">
                View factor details<Icon name="arrowRight" size={12}/>
              </a>
            </div>
          </div>
        </details>
      </div>
    );
  }

  // Suggested with match — open card, tone keyed to confidence
  const tone = confLevel === "" ? "high" : confLevel; // "" | "med" | "low"
  const headline =
    tone === "high" ? "High-confidence match" :
    tone === "med"  ? "Medium-confidence match — please verify" :
                      "Low-confidence match — review recommended";
  const rationaleExtra =
    tone === "high"
      ? `Activity (${calc.activity}, ${calc.scope}), unit (${calc.unit}), and the source entry's region & vintage all aligned with this factor. Safe to confirm if no supplier-specific data is available.`
      : tone === "med"
      ? `Activity and unit basis matched, but at least one signal — region, vintage, sub-category, or method — was inferred rather than explicit. Verify the factor's regional scope and vintage against the source entry before confirming.`
      : `The strongest available match still falls below our high-confidence threshold. Common causes: a generic spend-based fallback was applied where a more specific physical factor would be better, or the source entry's category mapping is ambiguous. Consider swapping to a more specific factor before confirming.`;

  return (
    <div className="d-section">
      <div className="d-section-head"><Icon name="sparkle" size={14}/>Suggested emission factor</div>
      <div className={`ef-match suggested ${tone}`}>
        <div className="ef-match-head">
          <span className="ef-match-icon"><Icon name="sparkle" size={16}/></span>
          <div className="ef-match-titles">
            <div className="ef-match-title">{calc.factor.name}</div>
            <div className="ef-match-sub">{calc.factor.source} · {calc.factor.vintage} · {calc.factor.kg_per_unit} kgCO₂e/{calc.factor.unit}</div>
          </div>
          <span className={`ai-conf ${confLevel}`}>{conf}% · {headline.split(" ")[0]}</span>
        </div>
        <div className="ef-match-body open">
          <div className="ef-match-headline">{headline}</div>
          <Confidence value={calc.confidence} inline={false}/>
          <div className="ef-match-rationale">
            <div className="ef-rationale-head"><Icon name="sparkle" size={13}/>Why this factor</div>
            <div className="ef-rationale-body">
              {calc.reason} {rationaleExtra}
            </div>
            <a className="ef-rationale-link" onClick={(ev) => { ev.preventDefault(); window.dispatchEvent(new CustomEvent("fe-toast", {detail: `Would open ${calc.factor.name} · ${calc.factor.source}`})); }} href="#">
              View factor details<Icon name="arrowRight" size={12}/>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Calculation drawer CTAs keyed off status + confidence ---------------
// Spec:
//   Pending               → spinner, no CTA
//   Suggested (High)      → Primary: Confirm               Secondary: Edit emission factor
//   Suggested (Medium)    → Primary: Edit emission factor  Secondary: Confirm
//   Suggested (Low)       → Primary: Edit emission factor  Secondary: Confirm
//   Suggested (No match)  → Primary: Select emission factor
//   Confirmed             → Secondary: Edit emission factor
// Flag button always present on Suggested + Confirmed (nice-to-have).
function CalcActions({ calc, confLevel, onApprove, onSwap, onReject }) {
  const s = calc.status;

  if (s === "pending") {
    return (
      <div className="entry-processing">
        <span className="entry-spinner" aria-hidden/>
        <span>Queued for AI match…</span>
      </div>
    );
  }

  const hasMatch = !!calc.factor?.name && calc.confidence != null;

  if (s === "confirmed") {
    // No inline action on a confirmed calc — editing happens via the entry's
    // footer Update button (which warns it recalculates).
    return null;
  }

  // Suggested states
  if (!hasMatch) {
    return <>
      <button className="btn primary small" onClick={onSwap}><Icon name="filter" size={14}/>Select emission factor</button>
    </>;
  }
  if (confLevel === "") { // high confidence
    return <>
      <button className="btn secondary small" onClick={onSwap}><Icon name="pencil" size={14}/>Edit emission factor</button>
      <button className="btn primary small" onClick={onApprove}><Icon name="check" size={14}/>Confirm</button>
    </>;
  }
  // medium or low confidence — editing is the encouraged primary
  return <>
    <button className="btn secondary small" onClick={onApprove}><Icon name="check" size={14}/>Confirm</button>
    <button className="btn primary small" onClick={onSwap}><Icon name="pencil" size={14}/>Edit emission factor</button>
  </>;
}

Object.assign(window, { Calculations, CalculationDrawer, EFMatchSection, CalcActions, ChangeLog });

// Change log — synthesized from calc/entry metadata
function ChangeLog({ calc, entry }) {
  // Deterministic hash based on calc.id for stable pseudo-dates / actors
  const h = [...calc.id].reduce((a,c) => (a*31 + c.charCodeAt(0)) | 0, 0);
  const seed = (n) => Math.abs((h ^ (n * 2654435761)) % 1000) / 1000;

  const batch = (window.BATCHES || []).find(b => b.id === entry?.batchId);
  const uploader = batch?.uploadedBy || entry?.user_assigned || "System";
  const assignee = calc.user_assigned || entry?.user_assigned || "Unassigned";

  // Base date = entry.start_date (or end_date, fallback today)
  const baseDate = new Date(entry?.end_date || entry?.start_date || Date.now());
  const fmt = (d) => d.toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
  const mkDate = (offsetMin) => { const d = new Date(baseDate); d.setMinutes(d.getMinutes() + offsetMin); return d; };

  const events = [];

  // 1. Created
  events.push({
    kind: "created",
    icon: "plus",
    title: batch?.source === "csv" ? "Calculation created from bulk import" : batch?.source === "erp" ? "Calculation created from ERP sync" : "Calculation created manually",
    actor: uploader,
    date: mkDate(0),
    note: batch?.fileName ? `Source: ${batch.fileName}` : batch?.source === "erp" ? `Source: ${batch.id} · ERP` : null,
  });

  // 2. AI match
  events.push({
    kind: "ai",
    icon: "sparkle",
    title: `AI matched to ${calc.factor.name}`,
    actor: "Forward Earth AI",
    date: mkDate(Math.round(seed(1) * 30) + 2),
    note: `${Math.round((calc.confidence || 0.85) * 100)}% confidence · ${calc.factor.source}`,
  });

  // 3. Optional reassignment
  if (seed(2) > 0.55 && assignee !== uploader) {
    events.push({
      kind: "assign",
      icon: "users",
      title: `Assigned to ${assignee}`,
      actor: uploader,
      date: mkDate(60 * (Math.round(seed(3) * 20) + 4)),
      note: seed(4) > 0.6 ? "Routed by business unit ownership rules" : null,
    });
  }

  // 4. Optional factor swap (only some)
  if (seed(5) > 0.72) {
    events.push({
      kind: "swap",
      icon: "filter",
      title: "Emission factor updated",
      actor: assignee,
      date: mkDate(60 * 24 * (Math.round(seed(6) * 5) + 1)),
      note: `Swapped from older DEFRA vintage → current ${calc.factor.vintage}. Reason: more recent dataset available.`,
    });
  }

  // 5. Optional note edit
  if (seed(7) > 0.65) {
    events.push({
      kind: "note",
      icon: "pencil",
      title: "Note added",
      actor: assignee,
      date: mkDate(60 * 24 * (Math.round(seed(8) * 7) + 2)),
      note: seed(9) > 0.5 ? "Cross-referenced with supplier invoice #INV-2847." : "Flagged for Q-end reviewer follow-up.",
    });
  }

  // 6. If confirmed, add confirmation event as the latest
  if (calc.status === "confirmed") {
    events.push({
      kind: "confirm",
      icon: "check",
      title: "Calculation confirmed",
      actor: assignee,
      date: mkDate(60 * 24 * (Math.round(seed(10) * 10) + 8)),
      note: null,
    });
  } else if (calc.status === "suggested") {
    events.push({
      kind: "review",
      icon: "clock",
      title: "Awaiting review",
      actor: assignee,
      date: mkDate(60 * 24 * (Math.round(seed(11) * 14) + 3)),
      note: "Open for review — approve, swap factor, or reject.",
    });
  }

  // Sort newest-first
  events.sort((a,b) => b.date - a.date);

  return (
    <div className="changelog">
      {events.map((ev, i) => (
        <div key={i} className={`cl-row ${ev.kind}`}>
          <div className="cl-dot"><Icon name={ev.icon} size={12}/></div>
          <div className="cl-body">
            <div className="cl-title">{ev.title}</div>
            <div className="cl-meta">
              <span className="cl-actor">{ev.actor}</span>
              <span className="cl-dotsep">·</span>
              <span className="cl-date">{fmt(ev.date)}</span>
            </div>
            {ev.note && <div className="cl-note">{ev.note}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
