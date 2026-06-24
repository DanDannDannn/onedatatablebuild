// Data entries page — common columns + drawer with category-specific fields & child calcs

const ENTRY_COLUMNS = [
  { k:"id",                label:"ID",                    w: 92 },
  { k:"status",            label:"Status",                w: 150 },
  { k:"business_unit",     label:"Business unit",         w: 140 },
  { k:"business_activity", label:"Business activity",     w: 200 },
  { k:"user_assigned",     label:"User assigned",         w: 160 },
  { k:"start_date",        label:"Start date",            w: 110 },
  { k:"end_date",          label:"End date",              w: 110 },
  { k:"data_input_type",   label:"Data input type",       w: 160 },
  { k:"site",              label:"Site",                  w: 140 },
  { k:"consumption",       label:"Consumption details",   w: 260 },
  { k:"factor",            label:"Emission factor",       w: 240 },
  { k:"emission",          label:"Emission details",      w: 170 },
  { k:"calcs_count",       label:"GHG calculations",      w: 130 },
  { k:"source_import",     label:"Source import",         w: 180 },
  { k:"notes",             label:"Notes",                 w: 220 },
  { k:"created_on",        label:"Created on",            w: 110 },
  { k:"last_updated",      label:"Last updated",          w: 110 },
  { k:"files",             label:"Files",                 w: 80 },
  { k:"bulk_import_ref",   label:"Bulk import file",      w: 180 },
  { k:"custom_factor",     label:"Custom Emission Factor",w: 180 },
];
const ENTRY_DEFAULT_VIS = ["id","status","business_unit","business_activity","user_assigned","start_date","end_date","data_input_type","consumption","factor","emission","calcs_count","source_import","notes"];

function DataEntries({ entries, calcs, selectedId, setSelectedId, onViewCalc, preselectEntryId, onViewImport, bulk, batchFilter, onClearBatchFilter, embedded, headerPortal }) {
  React.useEffect(() => { if (preselectEntryId) setSelectedId(preselectEntryId); }, [preselectEntryId]);

  const rollupFor = (entryId) => {
    const mine = calcs.filter(c => c.entryId === entryId);
    const pending   = mine.filter(c => c.status === "pending").length;
    const suggested = mine.filter(c => c.status === "suggested").length;
    const confirmed = mine.filter(c => c.status === "confirmed").length;
    const total = mine.reduce((s, c) => s + c.kgCO2e, 0);
    const uniqFactors = [...new Set(mine.map(c => c.factor.name))];
    const avgConf = mine.reduce((s,c) => s + (c.confidence ?? 1), 0) / (mine.length || 1);
    return { count: mine.length, pending, suggested, confirmed, total, uniqFactors, avgConf };
  };

  const [query, setQuery] = React.useState("");
  const [bu, setBu] = React.useState("all");
  const [cat, setCat] = React.useState("all");
  const [period, setPeriod] = React.useState("q1_2026");
  const [sort, setSort] = React.useState(null); // {key, dir}
  const [colFilters, setColFilters] = React.useState({});
  const setColFilter = (k, v) => setColFilters(f => {
    const next = { ...f };
    if (!v || v === "all" || v === "") delete next[k]; else next[k] = v;
    return next;
  });
  const handleSort = (key, dir) => setSort(key ? { key, dir } : null);
  const [visible, setVisible] = React.useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("fe-entry-cols"));
      if (!stored) return ENTRY_DEFAULT_VIS;
      // Merge any NEW default columns added after the user's prefs were first saved
      const missing = ENTRY_DEFAULT_VIS.filter(k => !stored.includes(k));
      return missing.length ? [...stored, ...missing] : stored;
    } catch { return ENTRY_DEFAULT_VIS; }
  });
  const [colMenu, setColMenu] = React.useState(false);
  React.useEffect(() => { localStorage.setItem("fe-entry-cols", JSON.stringify(visible)); }, [visible]);
  const isVisible = (k) => visible.includes(k);
  const toggleCol = (k) => setVisible(v => v.includes(k) ? v.filter(x=>x!==k) : [...v, k]);

  // Getter per column for sorting/filtering
  const entryGet = (e, key) => {
    switch (key) {
      case "id": return e.id;
      case "status": return e.entry_status;
      case "business_unit": return e.business_unit;
      case "business_activity": return e.business_activity;
      case "user_assigned": return e.user_assigned;
      case "start_date": return e.start_date;
      case "end_date": return e.end_date;
      case "data_input_type": return e.data_input_type;
      case "site": return e.site;
      case "consumption": return e.summary;
      case "factor": {
        const m = calcs.filter(c => c.entryId === e.id);
        return m[0]?.factor?.name || "";
      }
      case "emission": {
        const m = calcs.filter(c => c.entryId === e.id);
        return m.reduce((s,c)=>s+c.kgCO2e, 0);
      }
      case "calcs_count": return calcs.filter(c => c.entryId === e.id).length;
      case "source_import": {
        const b = (window.BATCHES || []).find(x => x.id === e.batchId);
        return b ? (b.fileName || b.label || b.id) : "";
      }
      case "notes": return e.notes;
      case "created_on": return e.created_on;
      case "last_updated": return e.last_updated;
      case "files": return e.files_count;
      case "bulk_import_ref": return e.bulk_import_ref;
      case "custom_factor": return e.custom_factor;
      default: return "";
    }
  };

  // Build per-column filter config: dropdown options for enumerable cols,
  // otherwise free-text filter.
  const entryFilterConfig = {
    status:           { options: [{k:"draft",l:"Draft"},{k:"ready",l:"Ready"},{k:"suggested",l:"Suggested"},{k:"confirmed",l:"Confirmed"},{k:"failed",l:"Failed"}] },
    business_unit:    { options: (window.BUSINESS_UNITS || []).map(u => ({k:u,l:u})) },
    user_assigned:    { options: (window.USERS || []).map(u => ({k:u,l:u})) },
    data_input_type:  { options: [{k:"Manual",l:"Manual"},{k:"Bulk import (CSV)",l:"Bulk import (CSV)"},{k:"Integration (ERP)",l:"Integration (ERP)"}] },
    site:             { options: [...new Set(entries.map(e=>e.site))].map(s => ({k:s,l:s})) },
    files:            { options: [{k:"has",l:"Has files"},{k:"none",l:"No files"}] },
    custom_factor:    { options: [{k:"yes",l:"Uses custom factor"},{k:"no",l:"Default factor"}] },
  };

  const filteredEntries = React.useMemo(() => {
    let r = entries;
    if (batchFilter) r = r.filter(e => e.batchId === batchFilter);
    if (period && period !== "all") r = r.filter(e => window.inPeriod(e, period));
    if (bu !== "all") r = r.filter(e => e.business_unit === bu);
    if (cat !== "all") r = r.filter(e => e.category === cat);
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter(e =>
        e.id.toLowerCase().includes(q) ||
        (e.summary||"").toLowerCase().includes(q) ||
        (e.business_activity||"").toLowerCase().includes(q) ||
        (e.business_unit||"").toLowerCase().includes(q) ||
        (e.user_assigned||"").toLowerCase().includes(q) ||
        (e.site||"").toLowerCase().includes(q)
      );
    }
    // Per-column filters
    Object.entries(colFilters).forEach(([k, val]) => {
      if (!val) return;
      if (k === "files") {
        r = r.filter(e => val === "has" ? (e.files_count > 0) : (e.files_count === 0));
        return;
      }
      if (k === "custom_factor") {
        r = r.filter(e => val === "yes" ? (e.custom_factor && e.custom_factor !== "—") : (!e.custom_factor || e.custom_factor === "—"));
        return;
      }
      const cfg = entryFilterConfig[k];
      if (cfg?.options) {
        r = r.filter(e => String(entryGet(e, k)) === String(val));
      } else {
        const q = String(val).toLowerCase();
        r = r.filter(e => String(entryGet(e, k) ?? "").toLowerCase().includes(q));
      }
    });
    if (sort) {
      r = [...r].sort((a, b) => cmpBy(a, b, (x) => entryGet(x, sort.key), sort.dir));
    }
    return r;
  }, [entries, query, bu, cat, batchFilter, colFilters, sort, calcs, period]);

  // Selection state
  const [selected, setSelected] = React.useState(() => new Set());
  React.useEffect(() => {
    // Drop any stale selections that are no longer visible or no longer exist
    const ids = new Set(entries.map(e => e.id));
    setSelected(prev => new Set([...prev].filter(id => ids.has(id))));
  }, [entries]);
  const visibleIds = filteredEntries.map(e => e.id);
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

  // Resolve a batch to a display label
  const batchLabel = (e) => {
    const b = (window.BATCHES || []).find(x => x.id === e.batchId);
    if (!b) return null;
    if (b.source === "csv") return { id: b.id, label: b.fileName || b.id, icon: "upload" };
    if (b.source === "erp") return { id: b.id, label: b.id + " · ERP", icon: "check" };
    return { id: b.id, label: "Manual entry", icon: "collect" };
  };

  // j/k/Esc
  const selectedIndex = filteredEntries.findIndex(e => e.id === selectedId);
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Escape" && selectedId) { setSelectedId(null); e.preventDefault(); }
      if (e.key === "j" || e.key === "ArrowDown") {
        const idx = selectedIndex < 0 ? 0 : Math.min(filteredEntries.length - 1, selectedIndex + 1);
        setSelectedId(filteredEntries[idx]?.id ?? null); e.preventDefault();
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        const idx = selectedIndex <= 0 ? 0 : selectedIndex - 1;
        setSelectedId(filteredEntries[idx]?.id ?? null); e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, selectedIndex, filteredEntries, setSelectedId]);

  React.useEffect(() => {
    if (!selectedId) return;
    const el = document.querySelector(`[data-entry-id="${selectedId}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const inView = rect.top > 120 && rect.bottom < window.innerHeight - 40;
      if (!inView) el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedId]);

  const actions = (
    <div className="page-actions" style={embedded ? {gap:8} : undefined}>
      <div className="col-menu-wrap">
        <button className="btn secondary small" onClick={() => setColMenu(v => !v)}>
          <Icon name="filter" size={16}/>Columns <span style={{color:"var(--fe-fg-muted)"}}>{visible.length}/{ENTRY_COLUMNS.length}</span>
        </button>
        {colMenu && (
          <>
            <div style={{position:"fixed", inset:0, zIndex:20}} onClick={() => setColMenu(false)}/>
            <div className="col-menu">
              <div className="head">
                <span>Show columns</span>
                <span><a onClick={() => setVisible(ENTRY_COLUMNS.map(c=>c.k))}>Show all</a> · <a onClick={() => setVisible([])}>Hide all</a></span>
              </div>
              {ENTRY_COLUMNS.map(col => (
                <label key={col.k}>
                  <input type="checkbox" checked={isVisible(col.k)} onChange={() => toggleCol(col.k)} />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>
      <button className="btn secondary small"><Icon name="upload" size={16}/>Import</button>
      <button className="btn primary small"><Icon name="plus" size={16}/>Data</button>
    </div>
  );

  return (
    <>
      {!embedded && (
        <div className="page-head">
          <div>
            <h1 className="page-title">Activity data</h1>
            <div className="page-subtitle">Every activity input behind your calculations · {entries.length} records in Q1 2026</div>
          </div>
          {actions}
        </div>
      )}
      {embedded && headerPortal && ReactDOM.createPortal(actions, headerPortal)}

      {selected.size > 0 ? (
        <BulkToolbar
          count={selected.size}
          kind="entries"
          onClear={clearSel}
          onStatus={(s) => { bulk?.status([...selected], s); }}
          onAssign={(u) => { bulk?.assign([...selected], u); }}
          onCategory={() => bulk?.export([...selected]) /* placeholder - would open picker */}
          onExport={() => bulk?.export([...selected])}
          onDelete={() => {
            if (confirm(`Delete ${selected.size} entries and their calculations?`)) {
              bulk?.delete([...selected]);
              clearSel();
            }
          }}
        />
      ) : (
      <div className="filter-bar">
        {batchFilter && (
          <FilterPill
            icon="upload"
            label="Batch"
            value={batchFilter}
            options={[{k: batchFilter, l: batchFilter}]}
            onChange={() => {}}
            onClear={() => onClearBatchFilter?.()}
          />
        )}
        <span className="filter active">All <span style={{color:"var(--fe-fg-muted)"}}>{filteredEntries.length}</span></span>

        {/* Status — combined into a single filter pill (parity with Calculations).
            Reads/writes colFilters.status so it stacks naturally with the rest. */}
        {(() => {
          const statusOpts = entryFilterConfig.status?.options || [];
          // Counts AFTER non-status filters, so the popover shows contextual values.
          // Cheap to compute against entries since the page volume is small.
          const baseForCount = entries.filter(e => {
            if (batchFilter && e.batchId !== batchFilter) return false;
            if (cat !== "all" && e.category !== cat) return false;
            if (bu !== "all" && e.business_unit !== bu) return false;
            return true;
          });
          const counts = {};
          for (const o of statusOpts) counts[o.k] = baseForCount.filter(e => e.entry_status === o.k).length;
          const current = colFilters.status;
          return (
            <FilterPill
              icon="filter"
              label="Status"
              value={current || null}
              options={statusOpts.map(o => ({k: o.k, l: `${o.l} (${counts[o.k] || 0})`}))}
              onChange={(v) => setColFilter("status", v)}
              onClear={() => setColFilter("status", null)}
              renderValue={(v) => {
                const opt = statusOpts.find(o => o.k === v);
                return <>{opt?.l || v} <span style={{opacity:0.65, marginLeft:2}}>({counts[v] || 0})</span></>;
              }}
            />
          );
        })()}

        {/* Category */}
        <FilterPill
          icon="filter"
          label="Category"
          value={cat !== "all" ? cat : null}
          options={[
            {k:"electricity",l:"Electricity"},
            {k:"natural_gas",l:"Natural gas"},
            {k:"diesel",l:"Diesel / fleet"},
            {k:"flight",l:"Flight"},
            {k:"purchased_goods",l:"Purchased goods"},
          ]}
          onChange={(v) => setCat(v)}
          onClear={() => setCat("all")}
        />

        {/* Business unit */}
        <FilterPill
          icon="users"
          label="Business unit"
          value={bu !== "all" ? bu : null}
          options={(window.BUSINESS_UNITS || []).map(u => ({k:u, l:u}))}
          onChange={(v) => setBu(v)}
          onClear={() => setBu("all")}
        />

        {/* Reporting period */}
        <FilterPill
          icon="calendar"
          label="Period"
          value={period}
          options={window.PERIOD_OPTIONS}
          onChange={(v) => setPeriod(v)}
          onClear={() => setPeriod("q1_2026")}
        />

        {/* Per-column filters as pills (excludes status — surfaced above as a primary pill) */}
        {Object.entries(colFilters).filter(([k]) => k !== "status").map(([k, val]) => {
          const col = ENTRY_COLUMNS.find(c => c.k === k);
          if (!col) return null;
          const cfg = entryFilterConfig[k];
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

        {/* + Filter */}
        <AddFilterButton
          facets={ENTRY_COLUMNS
            .filter(c => entryFilterConfig[c.k]?.options && !colFilters[c.k] && c.k !== "business_unit" && c.k !== "status")
            .map(c => ({k: c.k, label: c.label, icon: "filter"}))}
          onAdd={(k) => {
            const first = entryFilterConfig[k]?.options?.[0]?.k;
            if (first) setColFilter(k, first);
          }}
        />

        {/* Clear-all */}
        {(() => {
          const activeCount = (cat !== "all" ? 1 : 0) + (bu !== "all" ? 1 : 0) + (batchFilter ? 1 : 0) + Object.keys(colFilters).length;
          if (activeCount < 2) return null;
          return (
            <button className="filter-clear-all" onClick={() => {
              setCat("all"); setBu("all"); setColFilters({});
              if (batchFilter && onClearBatchFilter) onClearBatchFilter();
            }}>Clear all {activeCount}</button>
          );
        })()}

        <span className="filter-search">
          <Icon name="search" size={14} style={{color:"var(--fe-fg-muted)"}}/>
          <input placeholder="Search ID, summary, site…" value={query} onChange={e => setQuery(e.target.value)}/>
        </span>
        <span style={{marginLeft:"auto", fontSize:12, color:"var(--fe-fg-muted)"}}>
          Showing {filteredEntries.length} of {entries.length}
        </span>
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
              {ENTRY_COLUMNS.filter(c => isVisible(c.k)).map((col, i) => {
                const align = (col.k === "emission" || col.k === "calcs_count") ? "right" : "left";
                const cfg = entryFilterConfig[col.k];
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
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map(e => {
              const r = rollupFor(e.id);
              const isSel = selected.has(e.id);
              return (
                <tr key={e.id}
                    data-entry-id={e.id}
                    className={`${selectedId === e.id ? "selected" : ""} ${isSel ? "sel" : ""}`.trim()}
                    onClick={(ev) => {
                      if (ev.target.closest(".cb-cell") || ev.target.closest(".src-link")) return;
                      setSelectedId(e.id);
                    }}>
                  <td className="cb-cell" onClick={(ev) => ev.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="fe-cb"
                      checked={isSel}
                      onChange={() => toggleOne(e.id)}
                    />
                  </td>
                  {ENTRY_COLUMNS.filter(col => isVisible(col.k)).map((col) => {
                    switch (col.k) {
                      case "id":
                        return <td key={col.k} style={{fontFamily:"var(--fe-font-mono)", fontSize:12, color:"var(--fe-fg-strong)"}}>{e.id}</td>;
                      case "status":
                        return <td key={col.k}>
                          <div style={{display:"flex", flexDirection:"column", gap:4, alignItems:"flex-start"}}>
                            <StatusChip status={e.entry_status}/>
                            {r.count > 0 && (
                              <span className="rollup">
                                {r.pending > 0   && <span className="pill r" title="Pending AI match">{r.pending}</span>}
                                {r.suggested > 0 && <span className="pill s" title="Suggested — awaiting confirmation">{r.suggested}</span>}
                                {r.confirmed > 0 && <span className="pill v" title="Confirmed">{r.confirmed}</span>}
                              </span>
                            )}
                          </div>
                        </td>;
                      case "business_unit":
                        return <td key={col.k} style={{color:"var(--fe-fg-strong)", fontWeight:500}}>{e.business_unit}</td>;
                      case "business_activity":
                        return <td key={col.k}>
                          <div style={{color:"var(--fe-fg-strong)", fontWeight:500}}>{e.business_activity}</div>
                          <div style={{fontSize:11, color:"var(--fe-fg-muted)", marginTop:1}}><CatLabel cat={e.category}/></div>
                        </td>;
                      case "user_assigned":
                        return <td key={col.k}>{e.user_assigned}</td>;
                      case "start_date":
                        return <td key={col.k} style={{color:"var(--fe-fg-muted)"}}>{e.start_date}</td>;
                      case "end_date":
                        return <td key={col.k} style={{color:"var(--fe-fg-muted)"}}>{e.end_date}</td>;
                      case "data_input_type":
                        return <td key={col.k}>
                          <span className="chip"><span className="dot"></span>{e.data_input_type}</span>
                        </td>;
                      case "site":
                        return <td key={col.k} style={{color:"var(--fe-fg-strong)", fontWeight:500}}>{e.site}</td>;
                      case "consumption":
                        return <td key={col.k}>
                          <div style={{color:"var(--fe-fg-strong)", fontWeight:500}}>{e.summary}</div>
                          <div style={{fontSize:11, color:"var(--fe-fg-muted)", marginTop:1}}>{e.site}</div>
                        </td>;
                      case "factor":
                        return <td key={col.k} className="wrap" style={{fontSize:12}}>
                          <div style={{color:"var(--fe-fg-strong)", fontWeight:500, whiteSpace:"normal"}}>
                            {r.uniqFactors[0] || "—"}
                            {r.uniqFactors.length > 1 && <span style={{color:"var(--fe-fg-muted)", fontWeight:500}}> +{r.uniqFactors.length - 1}</span>}
                          </div>
                        </td>;
                      case "emission":
                        return <td key={col.k} style={{textAlign:"right", fontWeight:500, color:"var(--fe-fg-strong)"}} className="num">
                          {(r.total/1000).toLocaleString(undefined, {maximumFractionDigits: r.total<100 ? 3 : 2})} <span style={{fontSize:11, color:"var(--fe-fg-muted)", fontWeight:500}}>tCO₂e</span>
                        </td>;
                      case "calcs_count":
                        return <td key={col.k} style={{textAlign:"right"}} className="num">{r.count}</td>;
                      case "source_import": {
                        const b = batchLabel(e);
                        if (!b) return <td key={col.k}><span style={{color:"var(--fe-fg-subtle)"}}>—</span></td>;
                        return <td key={col.k}>
                          <span
                            className="src-link"
                            onClick={(ev) => { ev.stopPropagation(); onViewImport?.(b.id); }}
                            title={`Open bulk import ${b.id}`}>
                            <Icon name={b.icon} size={14}/>{b.label}
                          </span>
                        </td>;
                      }
                      case "notes":
                        return <td key={col.k} className="wrap" style={{color: e.notes ? "var(--fe-fg-default)" : "var(--fe-fg-subtle)", fontSize:12, whiteSpace:"normal"}}>{e.notes || "—"}</td>;
                      case "created_on":
                        return <td key={col.k} style={{color:"var(--fe-fg-muted)"}}>{e.created_on}</td>;
                      case "last_updated":
                        return <td key={col.k} style={{color:"var(--fe-fg-muted)"}}>{e.last_updated}</td>;
                      case "files":
                        return <td key={col.k}>
                          {e.files_count > 0
                            ? <span style={{display:"inline-flex", alignItems:"center", gap:4}}><Icon name="upload" size={14} style={{color:"var(--fe-fg-muted)"}}/>{e.files_count}</span>
                            : <span style={{color:"var(--fe-fg-subtle)"}}>—</span>}
                        </td>;
                      case "bulk_import_ref":
                        return <td key={col.k} style={{fontSize:12}}>{e.bulk_import_ref}</td>;
                      case "custom_factor":
                        return <td key={col.k} style={{fontSize:12, color: e.custom_factor === "—" ? "var(--fe-fg-subtle)" : "var(--fe-fg-default)"}}>{e.custom_factor}</td>;
                      default: return <td key={col.k}/>;
                    }
                  })}
                </tr>
              );
            })}
            {filteredEntries.length === 0 && (
              <tr><td colSpan={(visible.length || 0) + 1}><div className="empty">No entries match these filters.</div></td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}

// Category-specific detail rendering
// Per-category field specs — drive both the read-only view and the editable
// draft/edit form. `num` fields render numerically (and are parsed back to
// Numbers on commit); `prefix` puts the unit before the value (e.g. €).
const CAT_NUM_KEYS = ["kWh","liters","spend_eur","pax","distance_km","vehicle_count","avg_mpg","mass_kg","sku_count"];
// Category choices for the editable Classification dropdown (draft/create mode).
const CAT_CHOICES = [
  { k: "purchased_goods",    l: "Purchased goods & services" },
  { k: "capital_goods",      l: "Capital goods" },
  { k: "upstream_transport", l: "Upstream transport" },
  { k: "business_travel",    l: "Business travel" },
  { k: "waste",              l: "Waste in operations" },
  { k: "electricity",        l: "Electricity" },
  { k: "natural_gas",        l: "Natural gas" },
  { k: "diesel",             l: "Diesel (fleet)" },
  { k: "flight",             l: "Business flight" },
];
const CAT_SPECS = {
  electricity: [
    { label:"Consumption", key:"kWh", num:true, unit:"kWh" },
    { label:"Grid region", key:"grid_region" },
    { label:"Supplier", key:"supplier" },
    { label:"Meter ID", key:"meter_id" },
    { label:"Tariff", key:"tariff" },
    { label:"Renewable share", key:"renewable_share" },
  ],
  natural_gas: [
    { label:"Consumption", key:"kWh", num:true, unit:"kWh" },
    { label:"Supplier", key:"supplier" },
    { label:"Meter ID", key:"meter_id" },
    { label:"Calorific value", key:"cv" },
    { label:"End use", key:"end_use" },
  ],
  diesel: [
    { label:"Volume", key:"liters", num:true, unit:"L" },
    { label:"Vehicles", key:"vehicle_count", num:true },
    { label:"Avg. consumption", key:"avg_mpg", num:true, unit:"mpg" },
    { label:"Equipment", key:"equipment" },
    { label:"Card issuer", key:"card_issuer" },
    { label:"Fuel grade", key:"fuel_grade" },
  ],
  flight: [
    { label:"Origin", key:"origin" },
    { label:"Destination", key:"destination" },
    { label:"Class", key:"class" },
    { label:"Passengers", key:"pax", num:true },
    { label:"Distance", key:"distance_km", num:true, unit:"km" },
    { label:"Traveller(s)", key:"traveller" },
    { label:"Itinerary", key:"ticket" },
  ],
  purchased_goods: [
    { label:"Supplier", key:"supplier" },
    { label:"Activity amount", key:"activity_amount", num:true },
    { label:"Unit", key:"activity_unit" },
    { label:"Product / service", key:"product_service" },
    { label:"Line description", key:"description" },
    // legacy seed keys (kept so the bundled sample entries still render)
    { label:"Spend", key:"spend_eur", num:true, unit:"€", prefix:true, legacy:true },
    { label:"Mass", key:"mass_kg", num:true, unit:"kg", legacy:true },
    { label:"Category code", key:"category_code", legacy:true },
  ],
};
// The client Scope-3 dataset categories share one generic activity-field spec.
const _S3_SPEC = [
  { label:"Supplier", key:"supplier" },
  { label:"Activity amount", key:"activity_amount", num:true },
  { label:"Unit", key:"activity_unit" },
  { label:"Product / service", key:"product_service" },
  { label:"Line description", key:"description" },
];
["capital_goods", "upstream_transport", "waste", "business_travel"].forEach(k => { CAT_SPECS[k] = _S3_SPEC; });
function catFmt(spec, v) {
  if (v == null || v === "") return null;
  if (spec.num) {
    const n = typeof v === "number" ? v.toLocaleString() : v;
    if (spec.prefix) return `${spec.unit}${n}`;
    return spec.unit ? `${n} ${spec.unit}` : `${n}`;
  }
  return v;
}

function CategoryFields({ entry, editing = false, details = null, setDetail = null, requiredKeys = null }) {
  const d = details || entry.details || {};
  const specs = CAT_SPECS[entry.category] || [];
  const reqKeys = requiredKeys || new Set();

  return (
    <div className="d-grid d-fields">
      {specs.map(spec => {
        const val = d[spec.key];
        const isReq = reqKeys.has(spec.key);
        const hasVal = val != null && val !== "";
        // Read-only view: only show fields that carry a value.
        if (!editing) {
          if (!hasVal) return null;
          return <div className="d-field" key={spec.key}><div className="k">{spec.label}</div><div className="v">{catFmt(spec, val)}</div></div>;
        }
        // Edit mode: show all core fields (even when empty, so a fresh draft is
        // fully fillable) + required ones. Legacy seed-only fields stay hidden
        // unless they already carry a value.
        if (!hasVal && !isReq && spec.legacy) return null;
        return (
          <div className={"d-field" + (isReq ? " is-required" : "")} key={spec.key}>
            <div className="k">
              {spec.label}
              {isReq && <span className="req-dot" title="Required" aria-label="Required"></span>}
            </div>
            <div className="v">
              <span className="d-edit-unit">
                <input className="d-edit-input" value={val ?? ""}
                       placeholder={`Enter ${spec.label.toLowerCase()}`}
                       onChange={e => setDetail && setDetail(spec.key, e.target.value)}/>
                {spec.unit && <span className="u">{spec.unit}</span>}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Collapsible drawer section — keeps the panel scannable by letting lower-priority
// blocks (source/audit, notes, extra import columns) fold away.
function FoldSection({ title, sub, defaultOpen = true, children }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <details className="d-section d-fold" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="d-section-head d-fold-head">
        <span className="d-fold-title">{title}</span>
        {sub}
        <Icon name="chev" size={14} className="d-fold-chev"/>
      </summary>
      <div className="d-fold-body">{children}</div>
    </details>
  );
}

function EntryDrawer({ entry, calcs, batches, onClose, onNav, onViewCalc, onViewImport, onUpdateEntry, focusCalcId, onApproveCalc, onRejectCalc, onSwapCalc }) {
  if (!entry) return null;
  const mine = calcs.filter(c => c.entryId === entry.id);
  const batch = batches.find(b => b.id === entry.batchId);
  const total = mine.reduce((s,c) => s + c.kgCO2e, 0);
  const needs = mine.filter(c => c.status === "pending" || c.status === "suggested").length;

  // ── Editing (draft / ready / failed) ───────────────────────────────────
  const initForm = (e) => {
    return {
      category: e.category || "",
      business_unit: e.business_unit || "",
      business_activity: e.business_activity || "",
      site: e.site || "",
      start_date: e.start_date || "",
      end_date: e.end_date || "",
      user_assigned: e.user_assigned || "",
      summary: e.summary || "",
      custom_factor: (e.custom_factor && e.custom_factor !== "—") ? e.custom_factor : "",
      notes: e.notes || "",
      details: { ...(e.details || {}) },
    };
  };
  const [editing, setEditing] = React.useState(entry.entry_status === "draft");
  const [form, setForm] = React.useState(() => initForm(entry));
  React.useEffect(() => {
    setForm(initForm(entry));
    setEditing(entry.entry_status === "draft");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  // ── Unified panel: calculations expand inline inside the entry ──────────
  const pickOpenCalc = (list) => {
    if (focusCalcId) return focusCalcId;
    const review = list.find(c => c.status === "pending" || c.status === "suggested");
    return (review || list[0])?.id || null;
  };
  const [openCalc, setOpenCalc] = React.useState(() => pickOpenCalc(mine));
  const focusRef = React.useRef(null);
  React.useEffect(() => { setOpenCalc(pickOpenCalc(mine)); }, [focusCalcId, entry.id]);
  React.useEffect(() => {
    if (!focusCalcId) return;
    const t = setTimeout(() => {
      const el = focusRef.current;
      if (!el) return;
      const body = el.closest(".drawer-body");
      if (!body) return;
      const delta = el.getBoundingClientRect().top - body.getBoundingClientRect().top;
      body.scrollTop = Math.max(0, body.scrollTop + delta - 16);
    }, 70);
    return () => clearTimeout(t);
  }, [focusCalcId, entry.id]);
  const set    = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setDetail = (k, v) => setForm(f => ({ ...f, details: { ...f.details, [k]: v } }));
  // Map a missing-field label (e.g. "Meter / account #") to its details key.
  const reqKeyFor = (label) => /supplier|vendor/i.test(label) ? "supplier"
                            : /meter|account/i.test(label)   ? "meter_id"
                            : null;
  const requiredKeys = new Set((entry.missing_fields || []).map(reqKeyFor).filter(Boolean));
  const remainingMissing = (entry.missing_fields || []).filter(label => {
    const k = reqKeyFor(label);
    if (!k) return true;
    return !String(form.details[k] ?? "").trim();
  });
  const dirty =
    form.category          !== (entry.category || "") ||
    form.business_unit     !== (entry.business_unit || "") ||
    form.business_activity !== (entry.business_activity || "") ||
    form.site              !== (entry.site || "") ||
    form.start_date        !== (entry.start_date || "") ||
    form.end_date          !== (entry.end_date || "") ||
    form.user_assigned     !== (entry.user_assigned || "") ||
    form.summary           !== (entry.summary || "") ||
    form.custom_factor     !== ((entry.custom_factor && entry.custom_factor !== "—") ? entry.custom_factor : "") ||
    form.notes             !== (entry.notes || "") ||
    JSON.stringify(form.details) !== JSON.stringify(entry.details || {});

  const toast = (msg) => window.dispatchEvent(new CustomEvent("fe-toast", { detail: msg }));

  const commit = () => {
    const patch = {
      category: form.category,
      business_unit: form.business_unit,
      business_activity: form.business_activity,
      site: form.site,
      start_date: form.start_date,
      end_date: form.end_date,
      date: form.start_date,
      user_assigned: form.user_assigned,
      summary: form.summary,
      custom_factor: form.custom_factor.trim() || "—",
      notes: form.notes,
    };
    // Fold edited category details back in, parsing numeric fields to Numbers.
    const parsedDetails = {};
    Object.entries(form.details || {}).forEach(([k, v]) => {
      if (CAT_NUM_KEYS.includes(k) && typeof v === "string") {
        const n = Number(String(v).replace(/[,\s]/g, ""));
        parsedDetails[k] = (v.trim() === "" || isNaN(n)) ? v : n;
      } else {
        parsedDetails[k] = v;
      }
    });
    patch.details = parsedDetails;
    if (entry.entry_status === "draft") {
      patch.missing_fields = remainingMissing;
      if (remainingMissing.length === 0) patch.entry_status = "ready";
    }
    onUpdateEntry && onUpdateEntry(entry.id, patch);
    if (entry.entry_status === "draft" && remainingMissing.length === 0) {
      toast(`${entry.id} completed — ready to calculate`);
      setEditing(false);
    } else if (entry.entry_status === "draft") {
      toast(`Draft ${entry.id} saved`);
    } else {
      toast(`${entry.id} updated`);
      setEditing(false);
    }
  };
  const discard = () => {
    setForm(initForm(entry));
    if (entry.entry_status !== "draft") setEditing(false);
  };

  // Shared calc-detail body — reused by the inline single-calc view and the
  // multi-calc expandable cards.
  const renderCalcDetail = (c, confLevel) => (
    <>
      <div className="calc-formula">
        <span className="lbl">activity</span><span className="v">{c.quantity.toLocaleString()}</span><span>{c.unit}</span>
        <span className="op">×</span>
        <span className="lbl">factor</span><span className="v">{c.factor.kg_per_unit}</span><span>kg/{c.unit}</span>
        <span className="op">=</span>
        <span className="v">{fmtKgSmart(c.kgCO2e)}</span><span>kgCO₂e</span>
      </div>
      {window.EFMatchSection && <window.EFMatchSection calc={c} confLevel={confLevel} onSwap={() => onSwapCalc && onSwapCalc(c.id)} />}
      <div className="entry-calc-sub">
        <FoldSection title="Change log" defaultOpen={false}>
          {window.ChangeLog && <window.ChangeLog calc={c} entry={entry}/>}
        </FoldSection>
      </div>
      {window.CalcActions && (
        <div className="entry-calc-actions">
          <window.CalcActions calc={c} confLevel={confLevel} onApprove={() => onApproveCalc && onApproveCalc(c.id)} onSwap={() => onSwapCalc && onSwapCalc(c.id)} onReject={() => onRejectCalc && onRejectCalc(c.id)} />
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}/>
      <aside className="drawer" role="dialog" aria-label="Entry detail">
        <div className="drawer-head">
          <div style={{flex:1, minWidth:0}}>
            <div className="kicker">Activity · {entry.id}</div>
            <h2>{(entry.details && entry.details.description) || entry.summary || entry.business_activity || "Activity"}</h2>
            {(entry.details && entry.details.supplier) && <div className="dh-supplier">{entry.details.supplier}</div>}
            <div className="dh-tags">
              <StatusChip status={window.entryWorkflow ? window.entryWorkflow(entry, mine) : entry.entry_status}/>
              {needs > 0 && <span className="chip alert"><span className="dot"></span>{needs} calc{needs>1?"s":""} need review</span>}
              {!(entry.entry_status === "draft" || entry.entry_status === "ready") && mine.length > 0 && (
                <span className="dh-total"><b>{(total/1000).toLocaleString(undefined, {maximumFractionDigits: total<100 ? 3 : 2})}</b> tCO₂e · {mine.length} calculation{mine.length>1?"s":""}</span>
              )}
            </div>
          </div>
          <button className="btn-close" onClick={onClose} title="Close (Esc)"><Icon name="close" size={18}/></button>
        </div>

        <div className="drawer-body">
          {/* Activity data */}
          <FoldSection title="Activity data" defaultOpen={true}>
            {editing && (
              <div className="d-grid d-fields" style={{marginBottom:10}}>
                <div className="d-field wide">
                  <div className="k">Consumption summary</div>
                  <div className="v">
                    <input className="d-edit-input" value={form.summary} onChange={e=>set("summary", e.target.value)}/>
                  </div>
                </div>
              </div>
            )}
            <CategoryFields entry={entry} editing={editing} details={form.details} setDetail={setDetail} requiredKeys={requiredKeys}/>
          </FoldSection>

          {/* How this was calculated — secondary, below the activity context */}
          {mine.length > 0 ? (
            <FoldSection title={mine.length > 1 ? `Calculations from this entry (${mine.length})` : "Calculation"} defaultOpen={true}>
              {mine.length === 1 ? (() => {
                const c = mine[0];
                const confLevel = c.confidence == null ? "" : c.confidence < 0.6 ? "low" : c.confidence < 0.8 ? "med" : "";
                return (
                  <div className="entry-calc-single" ref={focusRef}>
                    <div className="entry-calc-single-head">
                      <ScopeBadge scope={c.scope}/>
                      <span className="calc-id-tag">{c.id}</span>
                      <StatusChip status={c.status}/>
                    </div>
                    {renderCalcDetail(c, confLevel)}
                  </div>
                );
              })() : (
                <div className="entry-calc-list">
                  {mine.map(c => {
                    const open = openCalc === c.id;
                    const confLevel = c.confidence == null ? "" : c.confidence < 0.6 ? "low" : c.confidence < 0.8 ? "med" : "";
                    return (
                      <div key={c.id} ref={c.id === focusCalcId ? focusRef : null} className={"entry-calc" + (open ? " open" : "")}>
                        <button className="entry-calc-head" onClick={() => setOpenCalc(open ? null : c.id)} aria-expanded={open}>
                          <Icon name="chev" size={14} className="entry-calc-chev"/>
                          <div className="entry-calc-main">
                            <div className="entry-calc-meta">
                              <ScopeBadge scope={c.scope}/>
                              <StatusChip status={c.status}/>
                              <div className="kg num">{fmtKgSmart(c.kgCO2e)} <span style={{fontSize:11, color:"var(--fe-fg-muted)", fontWeight:500}}>kg</span></div>
                            </div>
                            <div className="entry-calc-titles">
                              <div className="label">{c.activity}</div>
                              <div className="sub">{c.gas} · {c.factor.name} · {c.factor.source}</div>
                            </div>
                          </div>
                        </button>
                        {open && (
                          <div className="entry-calc-body">
                            {renderCalcDetail(c, confLevel)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </FoldSection>
          ) : (
            <div className="d-section">
              <div className="d-section-head">Calculations</div>
              <div className="nocalc-note">
                <Icon name="info" size={14}/>
                No calculations yet. {entry.entry_status === "draft" ? "Complete required fields first to enable submission." : "Submit to run AI factor matching."}
              </div>
            </div>
          )}

          {/* Classification */}
          <FoldSection title="Classification" defaultOpen={true}>
            <div className="d-grid d-fields">
              <div className="d-field">
                <div className="k">Business unit</div>
                <div className="v">
                  {editing
                    ? <select className="d-edit-select" value={form.business_unit} onChange={e=>set("business_unit", e.target.value)}>
                        <option value="">—</option>
                        {(window.BUSINESS_UNITS||[]).map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    : entry.business_unit}
                </div>
              </div>
              <div className="d-field">
                <div className="k">Business activity</div>
                <div className="v">
                  {editing
                    ? <input className="d-edit-input" value={form.business_activity} onChange={e=>set("business_activity", e.target.value)}/>
                    : entry.business_activity}
                </div>
              </div>
              <div className="d-field">
                <div className="k">Category</div>
                <div className="v">
                  {editing
                    ? <select className="d-edit-select" value={form.category} onChange={e=>set("category", e.target.value)}>
                        <option value="">—</option>
                        {CAT_CHOICES.map(c => <option key={c.k} value={c.k}>{c.l}</option>)}
                      </select>
                    : <CatLabel cat={entry.category}/>}
                </div>
              </div>
              <div className="d-field">
                <div className="k">Site</div>
                <div className="v">
                  {editing
                    ? <input className="d-edit-input" value={form.site} onChange={e=>set("site", e.target.value)}/>
                    : (entry.site || "—")}
                </div>
              </div>
              <div className="d-field">
                <div className="k">Reporting period</div>
                <div className="v">
                  {editing
                    ? <span className="d-edit-dates">
                        <input className="d-edit-input" type="date" value={form.start_date} onChange={e=>set("start_date", e.target.value)}/>
                        <span className="sep">→</span>
                        <input className="d-edit-input" type="date" value={form.end_date} onChange={e=>set("end_date", e.target.value)}/>
                      </span>
                    : <>{entry.start_date} → {entry.end_date}</>}
                </div>
              </div>
              <div className="d-field">
                <div className="k">Owner</div>
                <div className="v">
                  {editing
                    ? <select className="d-edit-select" value={form.user_assigned} onChange={e=>set("user_assigned", e.target.value)}>
                        {(window.USERS||[]).map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    : entry.user_assigned}
                </div>
              </div>
            </div>
          </FoldSection>

          {/* Source & audit */}
          <FoldSection title="Source & audit" defaultOpen={false}>
            <div className="d-grid d-fields">
              <div className="d-field">
                <div className="k">ID</div>
                <div className="v" style={{fontFamily:"var(--fe-font-mono)", fontSize:12}}>{entry.id}</div>
              </div>
              <div className="d-field wide">
                <div className="k">Source import</div>
                <div className="v">
                  {batch ? (
                    <span className="link" onClick={() => onViewImport?.(batch.id)} title={`Open bulk import ${batch.id}`}>
                      <Icon name={batch.source === "csv" ? "upload" : batch.source === "erp" ? "check" : "collect"} size={12}/>
                      {batch.label}
                      <Icon name="arrowRight" size={12}/>
                    </span>
                  ) : "—"}
                </div>
              </div>
              <div className="d-field">
                <div className="k">Bulk import file</div>
                <div className="v" style={{fontSize:12}}>{entry.bulk_import_ref}</div>
              </div>
              <div className="d-field">
                <div className="k">Files</div>
                <div className="v">
                  {entry.files_count > 0
                    ? <span style={{display:"inline-flex", alignItems:"center", gap:4}}><Icon name="upload" size={13}/>{entry.files_count} attachment{entry.files_count>1?"s":""}</span>
                    : <span className="d-empty">—</span>}
                </div>
              </div>
              <div className="d-field">
                <div className="k">Custom emission factor</div>
                <div className="v">
                  {editing
                    ? <input className="d-edit-input" value={form.custom_factor} placeholder="—" onChange={e=>set("custom_factor", e.target.value)}/>
                    : <span style={{color: (entry.custom_factor && entry.custom_factor!=="—") ? "var(--fe-fg-default)" : "var(--fe-fg-subtle)"}}>{entry.custom_factor || "—"}</span>}
                </div>
              </div>
              <div className="d-field">
                <div className="k">Created on</div>
                <div className="v" style={{color:"var(--fe-fg-muted)"}}>{entry.created_on}</div>
              </div>
              <div className="d-field">
                <div className="k">Last updated</div>
                <div className="v" style={{color:"var(--fe-fg-muted)"}}>{entry.last_updated}</div>
              </div>
              <div className="d-field wide">
                <div className="k">Notes</div>
                <div className="v">
                  {editing
                    ? <textarea className="d-edit-textarea" value={form.notes} placeholder="Add a note — source document, who provided this, special context…" onChange={e=>set("notes", e.target.value)}/>
                    : <div style={{fontSize:13, color: entry.notes ? "var(--fe-fg-default)" : "var(--fe-fg-subtle)", lineHeight:1.5}}>{entry.notes || "No notes."}</div>}
                </div>
              </div>
            </div>
          </FoldSection>

          {entry.extra_meta && (
            <FoldSection title="Additional info from bulk import" defaultOpen={false}
              sub={<span className="d-section-sub">Optional columns captured from <b>{entry.bulk_import_ref}</b></span>}>
              <div className="d-grid d-fields">
                {Object.entries(entry.extra_meta).map(([k, v]) => (
                  <div className="d-field" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>
                ))}
              </div>
            </FoldSection>
          )}

        </div>

        <div className="drawer-foot">
          <button className="btn secondary small" title="Previous entry" aria-label="Previous entry" onClick={() => onNav(-1)}><Icon name="chev" size={14} style={{transform:"rotate(180deg)"}}/></button>
          <button className="btn secondary small" title="Next entry" aria-label="Next entry" onClick={() => onNav(1)}><Icon name="chev" size={14}/></button>
          <div className="spacer"/>
          <EntryActions
            entry={entry}
            editing={editing}
            dirty={dirty}
            remainingMissing={remainingMissing}
            onSave={commit}
            onDiscard={discard}
            onEdit={() => setEditing(true)}
          />
        </div>
      </aside>
    </>
  );
}

// --- Drawer CTAs keyed off entry state --------------------------------------
// Spec:
//   Draft      → Primary: Save            Secondary: Discard changes
//   Ready      → Primary: Submit          Secondary: —
//   Processing → Spinner (+ optional Cancel → back to ready)
//   Calculated → Primary: Update (warns)  Secondary: —
//   Failed     → Primary: Retry           Secondary: Delete
// Menu (⋯): Duplicate, Delete, contextual warnings.
function EntryActions({ entry, editing, dirty, remainingMissing, onSave, onDiscard, onEdit }) {
  const s = entry.entry_status;

  // Every state shows exactly two buttons: secondary on the left, primary on
  // the right. No overflow (⋯) menu.
  if (s === "draft") {
    return <>
      <button className="btn ghost small" onClick={onDiscard} disabled={!dirty}>Discard changes</button>
      <button className="btn primary small" onClick={onSave} disabled={!dirty}>
        <Icon name="check" size={14}/>{remainingMissing.length === 0 ? "Save · mark ready" : "Save draft"}
      </button>
    </>;
  }
  if (s === "ready") {
    return editing ? <>
      <button className="btn ghost small" onClick={onDiscard}>Cancel</button>
      <button className="btn primary small" onClick={onSave} disabled={!dirty}><Icon name="check" size={14}/>Save</button>
    </> : <>
      <button className="btn secondary small" onClick={onEdit}><Icon name="pencil" size={14}/>Edit</button>
      <button className="btn primary small"><Icon name="sparkle" size={14}/>Submit</button>
    </>;
  }
  if (s === "processing") {
    return <>
      <div className="entry-processing">
        <span className="entry-spinner" aria-hidden/>
        <span>Matching factors…</span>
      </div>
      <button className="btn ghost small" title="Cancel and return to Ready">Cancel</button>
    </>;
  }
  if (s === "failed") {
    return editing ? <>
      <button className="btn ghost small" onClick={onDiscard}>Cancel</button>
      <button className="btn primary small" onClick={onSave} disabled={!dirty}><Icon name="check" size={14}/>Save</button>
    </> : <>
      <button className="btn secondary small" onClick={onEdit}><Icon name="pencil" size={14}/>Edit</button>
      <button className="btn primary small"><Icon name="refresh" size={14}/>Retry</button>
    </>;
  }
  // calculated (default)
  return <>
    <button className="btn ghost small" title="Delete this entry and its calculation"><Icon name="trash" size={14}/>Delete</button>
    <button className="btn primary small" title="Updating this entry will delete its calculation">Update</button>
  </>;
}

Object.assign(window, { DataEntries, EntryDrawer });
