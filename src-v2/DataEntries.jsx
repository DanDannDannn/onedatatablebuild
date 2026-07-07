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
// Small centred confirmation card (product pattern: "Submit your entry?").
function ConfirmCard({ title, body, cancelLabel, confirmLabel, onCancel, onConfirm }) {
  return (
    <div className="fwe-confirm-scrim" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="fwe-confirm" role="alertdialog" aria-modal="true">
        <h4>{title}</h4>
        <p>{body}</p>
        <div className="fwe-confirm__actions">
          <button className="fwe-btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button className="fwe-btn-primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// Detail surface — mirrors the product's entry-status logic:
//   Draft (or no calculations yet) → editable form modal, NO calculation section.
//   Ready to submit (unsubmitted, calcs exist) → detail modal where the EF name
//     per calculation is a dropdown; the EF detail values below follow the
//     selection but stay read-only. Footer: Save draft · Submit (confirm dialog).
//   Submitted → read-only detail modal. Footer: Unsubmit (confirm dialog) —
//     unsubmitting returns the entry to Ready and unlocks the EF selection.
function EntryDrawer({ entry, calcs, onClose, onUpdateEntry, onUpdateCalc }) {
  if (!entry) return null;
  const mine = calcs.filter(c => c.entryId === entry.id);
  const wf = window.entryWorkflow(entry, mine);
  const isSubmitted = wf === "de_submitted";
  // Unsubmitted-but-calculated: the state between Unsubmit and re-Submit.
  const isReadyWithCalcs = wf === "de_ready" && mine.length > 0;
  const total = window.entryTotalKg ? window.entryTotalKg(entry, mine) : mine.reduce((s, c) => s + c.kgCO2e, 0);
  const first = mine[0];
  const toast = (msg) => window.dispatchEvent(new CustomEvent("fe-toast", { detail: msg }));

  // Fold state for the Calculation cards (submitted-entry modal). Cards start
  // COLLAPSED by default (DAM-7401 open question: "collapsed or something else")
  // — the one-line summary (EF name · CO2e) carries the scan; expand for detail.
  const [collapsedCalcs, setCollapsedCalcs] = React.useState(() => new Set(mine.map(c => c.id)));
  React.useEffect(() => {
    // Ready state starts with the cards OPEN — the EF selection is the point.
    setCollapsedCalcs(isReadyWithCalcs ? new Set() : new Set(calcs.filter(c => c.entryId === entry.id).map(c => c.id)));
  }, [entry.id, isReadyWithCalcs]);
  const toggleCalcFold = (id) => setCollapsedCalcs(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Pending EF choice per calculation (Ready state only) — applied on Submit.
  const [pendingEF, setPendingEF] = React.useState({});
  React.useEffect(() => { setPendingEF({}); }, [entry.id]);
  // Which confirmation dialog is open: "unsubmit" | "submit" | null.
  const [confirm, setConfirm] = React.useState(null);

  // Close on Esc — an open confirmation dialog eats the first Esc.
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (confirm) { setConfirm(null); return; }
      onClose && onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, confirm]);

  const num = (n) => n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const d = entry.details || {};
  const cons = { v: d.activity_amount, u: d.activity_unit || "" };
  const isSpend = ["USD", "EUR", "GBP"].includes(String(cons.u).toUpperCase())
    || (entry.extra_meta && entry.extra_meta["Spend"] && entry.extra_meta["Spend"] !== "—");
  const activityName = entry.business_activity || (window.CatLabel ? null : entry.category) || entry.category;
  const period = `${entry.start_date} → ${entry.end_date}`;

  // Draft, review, or never-calculated entries → the editable "New entry" form
  // modal (centred), which has NO calculation section. Submitted and
  // Ready-with-calculations entries use the detail modal below.
  if (!isSubmitted && !isReadyWithCalcs) {
    return <NewEntryModal entry={entry} onClose={onClose} />;
  }

  // EF choices for a calculation: every distinct factor used by calcs of the
  // same emission source across the dataset (a realistic stand-in for the
  // product's factor search, and deterministic for the demo).
  const efOptionsFor = (c) => {
    const opts = new Map();
    if (c.factor) opts.set(c.factor.name, c.factor);
    (calcs || []).forEach(x => { if (x.category === c.category && x.factor && !opts.has(x.factor.name)) opts.set(x.factor.name, x.factor); });
    return [...opts.values()];
  };

  // ── Submitted-entry modal (read-only form) ──────────────────────────────
  const Ro = (label, value, o) => {
    o = o || {};
    const empty = value === "" || value == null || value === "—";
    const v = empty ? (o.empty || "—") : value;
    return (
      <div className="fwe-fld" key={label}>
        <span className="lab">{label}{o.optional && <span className="opt"> (optional)</span>}</span>
        <div className={"control" + (empty ? " placeholder" : "")}>{v}</div>
      </div>
    );
  };
  const S3 = {
    flight: "3.6 Business travel", business_travel: "3.6 Business travel",
    purchased_goods: "3.1 Purchased goods and services", capital_goods: "3.2 Capital goods",
    upstream_transport: "3.4 Upstream transportation and distribution", waste: "3.5 Waste generated in operations",
  };
  const scope3Of = (c) => S3[c.category] || (entry.extra_meta && entry.extra_meta["Scope & category"]) || "3.3 Fuel- and energy-related activities";
  const CUR = { USD: "USD – US dollar", EUR: "EUR – Euro", GBP: "GBP – Pound sterling" };

  const consumptionFields = isSpend
    ? [Ro("Currency", CUR[String(cons.u).toUpperCase()] || cons.u), Ro("Price", num(cons.v))]
    : [Ro("Material/service quantity", num(cons.v)), Ro("Material/service unit", cons.u)];

  return (
    <>
      <div className="fwe-scrim" onClick={onClose} />
      <div className="fwe-modal-wrap" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="fwe-modal">
          <div className="fwe-modal__head">
            <h2 className="trunc">{activityName}{"  |  "}{entry.business_unit}{"  |  "}{entry.start_date} - {entry.end_date}</h2>
            <window.StatusChip status={wf} />
            <button className="link-ic" title="Copy link to this entry" aria-label="Copy link to this entry"
              onClick={(e) => { e.stopPropagation(); toast(`Link to ${entry.id} copied to clipboard`); }}>
              <Icon name="link" size={17} />
            </button>
            <button className="close" aria-label="Close" onClick={onClose}><Icon name="close" size={18} /></button>
          </div>

          <div className="fwe-modal__body">
            <section className="fwe-form-card">
              <h3 className="fwe-form-card__title">General information</h3>
              <div className="fwe-form-grid">
                {Ro("Business activity", activityName)}
                {Ro("Business unit", entry.business_unit)}
                {Ro("User assigned", entry.user_assigned)}
                <div className="fwe-form-grid two">
                  {Ro("Start date", entry.start_date)}
                  {Ro("End date", entry.end_date)}
                </div>
              </div>
            </section>

            <section className="fwe-form-card">
              <h3 className="fwe-form-card__title">Data entry type</h3>
              <p className="fwe-form-card__sub">How the data in this entry was provided</p>
              <div className="fwe-form-grid">
                {Ro("Data input type", entry.data_input_type)}
                {Ro("Consumption data type", isSpend ? "Spend data" : "Material/service data")}
              </div>
            </section>

            <section className="fwe-form-card">
              <h3 className="fwe-form-card__title">Consumption details</h3>
              <div className="fwe-form-grid">
                {consumptionFields}
                {Ro("Description", d.description || d.product_service || entry.summary, { optional: true })}
                {Ro("Supplier name", d.supplier, { optional: true })}
              </div>
            </section>

            {mine.map((c, i) => {
              // In the Ready state the EF NAME drives the card: the pending
              // selection (if any) supplies every derived detail value below,
              // and the CO₂e re-derives from quantity × factor when it can.
              const f = pendingEF[c.id] || c.factor || {};
              const efChanged = !!pendingEF[c.id] && (!c.factor || pendingEF[c.id].name !== c.factor.name);
              const shownKg = efChanged && c.quantity != null && f.kg_per_unit != null
                ? Math.round(c.quantity * f.kg_per_unit * 100) / 100
                : c.kgCO2e;
              const collapsed = collapsedCalcs.has(c.id);
              const title = mine.length > 1
                ? <>Calculation <span className="calc-n">{i + 1} of {mine.length}</span></>
                : "Calculation";
              return (
                <section className="fwe-form-card" key={c.id}>
                  <h3 className="fwe-form-card__title fwe-card-head">
                    <span>{title}</span>
                    <button type="button" className={"fwe-card-fold" + (collapsed ? " is-collapsed" : "")}
                      onClick={() => toggleCalcFold(c.id)} aria-expanded={!collapsed}
                      aria-label={collapsed ? "Expand calculation" : "Collapse calculation"} title={collapsed ? "Expand" : "Collapse"}>
                      <Icon name="chev" size={16} />
                    </button>
                  </h3>
                  {collapsed ? (
                    <p className="fwe-card-collapsed-sum">{f.name || "—"} · {num(shownKg)} kgCO₂e</p>
                  ) : (
                    <>
                      <div className="fwe-form-grid">
                        {isReadyWithCalcs ? (
                          <div className="fwe-fld">
                            <span className="lab">Emission factor name</span>
                            <select className="control" value={f.name || ""}
                              onChange={(ev) => {
                                const nf = efOptionsFor(c).find(o => o.name === ev.target.value);
                                if (nf) setPendingEF(p => ({ ...p, [c.id]: nf }));
                              }}>
                              {efOptionsFor(c).map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
                            </select>
                          </div>
                        ) : Ro("Emission factor name", f.name)}
                      </div>
                      <div className="fwe-form-grid two" style={{ marginTop: 18 }}>
                        {Ro("Emission factor value", f.kg_per_unit != null ? String(f.kg_per_unit) : "—")}
                        {Ro("Emission factor unit", f.unit ? "kgCO₂e/" + f.unit : "—")}
                        {Ro("Emission factor source", f.source)}
                        {Ro("Emission factor dataset", f.dataset || f.source)}
                        {Ro("Emission factor year", f.vintage)}
                        {Ro("Emission factor region", f.region || "Global")}
                        {Ro("Emission factor LCA activity", f.lca || "Cradle-to-gate")}
                        {Ro("Scope", c.scope != null ? String(c.scope) : "—")}
                        {c.scope === 2 && Ro("Scope 2 method", c.method)}
                        {c.scope === 3 && Ro("Scope 3 category", scope3Of(c))}
                      </div>
                      <div className="fwe-form-grid two" style={{ marginTop: 18 }}>
                        {Ro("CO2e emission", num(shownKg))}
                        {Ro("CO2e emission unit", "kgCO₂e")}
                      </div>
                      <div className="fwe-form-grid" style={{ marginTop: 18 }}>
                        {Ro("CO2e calculation method", "GWP100")}
                      </div>
                    </>
                  )}
                </section>
              );
            })}

            <section className="fwe-form-card">
              <h3 className="fwe-form-card__title">Attachments</h3>
              <p className="fwe-form-card__sub">Upload supporting documents (images or PDFs, max 2MB) as proof of your entries</p>
              <div className="fwe-dropzone">
                <div className="fwe-dropzone__drop">
                  <Icon name="upload" size={18} />
                  <span>{isReadyWithCalcs ? "Drag or upload" : "You can't add files to a submitted data entry"}</span>
                </div>
                <div className="fwe-dropzone__files">
                  <h4>Uploaded files</h4>
                  <p>{entry.files_count > 0 ? `${entry.files_count} file${entry.files_count > 1 ? "s" : ""} attached` : "Files have not been uploaded yet"}</p>
                </div>
              </div>
            </section>

            <section className="fwe-form-card">
              <h3 className="fwe-form-card__title">Notes</h3>
              <div className="fwe-fld">
                <span className="lab">Notes</span>
                <div className={"control" + (entry.notes ? "" : " placeholder")} style={{ minHeight: 84, alignItems: "flex-start" }}>
                  {entry.notes || "—"}
                </div>
              </div>
            </section>
          </div>

          <div className="fwe-modal__foot">
            {isSubmitted ? (
              <button className="fwe-btn-danger" onClick={() => setConfirm("unsubmit")}>Unsubmit</button>
            ) : (
              <>
                <button className="fwe-btn-secondary" onClick={() => toast("Draft saved")}>Save draft</button>
                <button className="fwe-btn-primary" onClick={() => setConfirm("submit")}>Submit to start calculations</button>
              </>
            )}
          </div>
        </div>
      </div>

      {confirm === "unsubmit" && (
        <ConfirmCard
          title="Unsubmit this entry?"
          body="The entry returns to Ready and you can change its emission factors. Calculations run again when you submit."
          cancelLabel="Cancel" confirmLabel="Unsubmit"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            onUpdateEntry && onUpdateEntry(entry.id, { entry_status: "ready" });
            toast(`${entry.id} unsubmitted — ready to submit`);
          }} />
      )}
      {confirm === "submit" && (
        <ConfirmCard
          title="Submit your entry?"
          body="Submitting will start emission calculations. You can unsubmit at any time."
          cancelLabel="Review data" confirmLabel="Submit"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            mine.forEach(c => {
              const nf = pendingEF[c.id];
              if (!nf || (c.factor && nf.name === c.factor.name)) return;
              const patch = { factor: nf };
              if (c.quantity != null && nf.kg_per_unit != null) patch.kgCO2e = Math.round(c.quantity * nf.kg_per_unit * 100) / 100;
              onUpdateCalc && onUpdateCalc(c.id, patch);
            });
            setPendingEF({});
            onUpdateEntry && onUpdateEntry(entry.id, { entry_status: "confirmed" });
            toast(`${entry.id} submitted — calculations updated`);
          }} />
      )}
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

// Editable "New entry" form modal — mirrors the reference HTML's New entry form.
// Used both for creating a new entry (no `entry` → empty fields) and for opening
// a non-submitted (draft / ready / review) entry (populated). Inputs are
// uncontrolled; Save/Submit just close (the prototype doesn't persist edits).
function NewEntryModal({ entry, onClose }) {
  const toast = (msg) => window.dispatchEvent(new CustomEvent("fe-toast", { detail: msg }));
  React.useEffect(() => {
    const onKey = (ev) => { if (ev.key === "Escape") onClose && onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const e = entry || {};
  const d = e.details || {};
  const isNew = !entry || e._isNew;
  const BUS = window.BUSINESS_UNITS || [];
  const USERS = window.USERS || [];
  const UNITS = ["kg", "tn", "litre", "kWh", "m³", "USD", "EUR", "GBP", "km", "t·km"];
  const v = (x) => (x == null ? "" : String(x));
  const withCur = (list, cur) => (cur && !list.includes(cur)) ? [cur, ...list] : list;

  const Fld = ({ label, opt, span, children }) => (
    <div className="fwe-fld" style={span ? { gridColumn: "1 / -1" } : undefined}>
      <span className="lab">{label}{opt && <span className="opt"> (optional)</span>}</span>
      {children}
    </div>
  );
  const Sel = (defVal, opts) => (
    <select className="control select" defaultValue={defVal || ""}>
      <option value="" disabled>Select…</option>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <>
      <div className="fwe-scrim" onClick={onClose} />
      <div className="fwe-modal-wrap" role="dialog" aria-modal="true" onClick={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
        <div className="fwe-modal">
          <div className="fwe-modal__head">
            <h2 className="trunc">{isNew ? "New entry" : (e.business_activity || "Edit entry")}</h2>
            <span className="fwe-badge-draft">Draft</span>
            <button className="close" aria-label="Close" onClick={onClose}><Icon name="close" size={18} /></button>
          </div>

          <div className="fwe-modal__body">
            <section className="fwe-form-card">
              <h3 className="fwe-form-card__title">General information</h3>
              <div className="fwe-form-grid">
                <Fld label="Business activity"><input className="control" defaultValue={v(e.business_activity)} placeholder="e.g. Purchased electricity" /></Fld>
                <Fld label="Business unit">{Sel(e.business_unit, withCur(BUS, e.business_unit))}</Fld>
                <Fld label="User assigned">{Sel(e.user_assigned, withCur(USERS, e.user_assigned))}</Fld>
                <div className="fwe-form-grid two">
                  <Fld label="Start date"><input className="control" defaultValue={v(e.start_date)} placeholder="MM/DD/YYYY" /></Fld>
                  <Fld label="End date"><input className="control" defaultValue={v(e.end_date)} placeholder="MM/DD/YYYY" /></Fld>
                </div>
              </div>
            </section>

            <section className="fwe-form-card">
              <h3 className="fwe-form-card__title">Data entry type</h3>
              <p className="fwe-form-card__sub">Choose how you want to provide the data in this data entry</p>
              <div className="fwe-form-grid">
                <Fld label="Data input type">{Sel("Consumption data", ["Consumption data", "Spend data", "Precalculated"])}</Fld>
                <Fld label="Consumption data type">{Sel("Activity", ["Activity", "Spend", "Energy", "Distance"])}</Fld>
                <Fld label="Emission factor type">{Sel("Auto-selected emission factor", ["Auto-selected emission factor", "Manually selected emission factor"])}</Fld>
              </div>
            </section>

            {/* Consumption details + Emission factor details are omitted here —
                they're generated by the system after submit (the calculation),
                so they aren't part of the create / draft form. */}

            <section className="fwe-form-card">
              <h3 className="fwe-form-card__title">Note <span className="opt">(optional)</span></h3>
              <p className="fwe-form-card__sub">Add any notes here for future reference. This can help other users understand your entries and is useful for auditing.</p>
              <div className="fwe-fld"><span className="lab">Notes</span><textarea className="control" rows="3" defaultValue={v(e.notes)} /></div>
            </section>

            <section className="fwe-form-card">
              <h3 className="fwe-form-card__title">Attachments <span className="opt">(optional)</span></h3>
              <p className="fwe-form-card__sub">Upload supporting documents (images or PDFs, max 2MB) as proof of your entries</p>
              <div className="fwe-dropzone">
                <div className="fwe-dropzone__drop fwe-dropzone__drop--active" onClick={() => toast("File upload — not built in this prototype")}>
                  <Icon name="upload" size={18} /><span><b>Drag or upload</b> up to 3 files</span>
                </div>
                <div className="fwe-dropzone__files"><h4>Uploaded files</h4><p>Files have not been uploaded yet</p></div>
              </div>
            </section>
          </div>

          <div className="fwe-modal__foot">
            <button className="fwe-btn-secondary" onClick={() => { toast("Draft saved"); onClose && onClose(); }}>Save draft</button>
            <button className="fwe-btn-primary" onClick={() => { toast(isNew ? "Submitted — matching emission factor…" : (e.id + " updated")); onClose && onClose(); }}>Submit to start calculation</button>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { DataEntries, EntryDrawer, NewEntryModal });
