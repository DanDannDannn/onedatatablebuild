// Data page — a single grid surface (AllData) driven by saved VIEWS.
//
// Tabs ARE views. "All data" (id "all") is the permanent default and can't be
// deleted (only reset). Every other tab — including the seeded "Calculations"
// example — is an ordinary saved view: same entry-spine surface, just a
// different saved bundle of {filters + sort + columns}. A "+" creates a new
// view; an overflow menu handles many views. Editing filters/sort/columns marks
// the active view dirty → Save / Save as new / Reset (rendered by AllData).
//
// The ephemeral "Chart deepdive" tab still hosts the calc-grain Calculations
// component when a chart deep-dive is active.

const {
  useDataViews: _useDataViews,
  getDataView: _getDataView,
  createDataView: _createDataView,
  deleteDataView: _deleteDataView,
  renameDataView: _renameDataView,
  updateDataViewState: _updateDataViewState,
  resetDataView: _resetDataView,
} = window;

// One view tab: select, inline-rename (dbl-click when active), kebab menu.
function ViewTab({ v, active, dirty, onSelect, onRename, onDelete, onDuplicate, onReset }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(v.name);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => { setDraft(v.name); }, [v.name]);
  React.useEffect(() => {
    if (!menuOpen) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);
  const commit = () => { const n = (draft || "").trim(); if (n && n !== v.name) onRename(n); setEditing(false); };

  return (
    <div ref={ref} role="tab" aria-selected={active}
      className={`segment segment--saved ${active ? "active" : ""}`}
      onClick={() => { if (!editing) onSelect(); }}>
      {editing ? (
        <input autoFocus className="segment-rename" value={draft}
          onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") { setEditing(false); setDraft(v.name); } }}
          onClick={(e) => e.stopPropagation()} />
      ) : (
        <span onDoubleClick={(e) => { e.stopPropagation(); if (active) setEditing(true); }} title={active ? "Double-click to rename" : v.desc || undefined}>{v.name}</span>
      )}
      {active && dirty && <span className="segment-dirty" title="Unsaved changes" aria-label="Modified"/>}
      {active && !editing && (
        <div className="tab-menu-wrap">
          <button type="button" className="segment-action" title="View options" aria-haspopup="menu" aria-expanded={menuOpen}
            onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}><Icon name="dots" size={15}/></button>
          {menuOpen && (
            <div className="tab-menu" role="menu" onClick={(e) => e.stopPropagation()}>
              {!v.builtin && <button className="tab-menu__item" role="menuitem" onClick={() => { setMenuOpen(false); setEditing(true); }}><Icon name="pencil" size={14}/>Rename</button>}
              <button className="tab-menu__item" role="menuitem" onClick={() => { setMenuOpen(false); onDuplicate(); }}><Icon name="copy" size={14}/>Duplicate</button>
              {v.builtin
                ? <button className="tab-menu__item" role="menuitem" onClick={() => { setMenuOpen(false); onReset(); }}><Icon name="refresh" size={14}/>Reset to default</button>
                : <><div className="tab-menu__sep"/><button className="tab-menu__item tab-menu__item--danger" role="menuitem" onClick={() => { setMenuOpen(false); onDelete(); }}><Icon name="trash" size={14}/>Delete view</button></>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Export control for the Data page — sits at the right of the search row.
// Opens a menu of scopes; each fires the shared `fe-export-start` event that
// the app shell turns into a progress banner.
function DataExportMenu({ filteredCount, totalCount }) {
  const [open, setOpen] = React.useState(false);
  const fire = (title, meta, filename) => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("fe-export-start", { detail: { title, meta, filename, rows: filteredCount } }));
  };
  const fc = (filteredCount ?? 0).toLocaleString();
  const tc = (totalCount ?? 0).toLocaleString();
  return (
    <span className="data-export-wrap">
      <button className="btn secondary" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Icon name="download" size={16}/>Export<Icon name="chev" size={12}/>
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 20 }} onClick={() => setOpen(false)}/>
          <div className="export-menu" role="menu">
            <div className="em-item" role="menuitem" onClick={() => fire("Current filtered data", `${fc} rows`, "data-filtered.csv")}>
              <div className="em-label"><Icon name="download" size={14}/>Current filtered data <span className="em-meta">({fc} rows)</span></div>
              <div className="em-desc">Visible rows &amp; columns only</div>
            </div>
            <div className="em-item" role="menuitem" onClick={() => fire("Detailed filtered data", `${fc} rows`, "data-filtered-detailed.csv")}>
              <div className="em-label"><Icon name="download" size={14}/>Detailed filtered data</div>
              <div className="em-desc">Filtered rows + all columns</div>
            </div>
            <div className="em-item" role="menuitem" onClick={() => fire("Full data set", `${tc} rows`, "data-full.csv")}>
              <div className="em-label"><Icon name="download" size={14}/>Full data set</div>
              <div className="em-desc">All entries + calculation details</div>
            </div>
            <div className="em-sep"/>
            <div className="em-item" role="menuitem" onClick={() => fire("Custom export", "configuring…", "data-custom.csv")}>
              <div className="em-label"><Icon name="settings" size={14}/>Customize export…</div>
              <div className="em-desc">Choose columns, format, delimiter</div>
            </div>
          </div>
        </>
      )}
    </span>
  );
}

function DataPage(props) {
  const {
    calcPreset, calcs, entries, selCalcId, setSelCalcId,
    exploreFilter, setExploreFilter,
    onViewEntry, calcsBulk, setSelEntryId,
    onViewCalc, tab, setTab,
    allDataPreset, onCloseDeepdive, onBack, onAddData,
  } = props;

  const views = _useDataViews ? _useDataViews() : [];
  const builtin = views.find(v => v.id === "all") || views[0];
  const savedViews = views.filter(v => v.id !== "all");

  // Defer the heavy grid content to a lower-priority render so the tab highlight
  // (which reads `tab`) repaints immediately on click — the table swaps a beat
  // later without blocking the click feedback. (Concurrent React, createRoot.)
  const gridTab = React.useDeferredValue(tab);

  // Resolve the active view for the GRID from the deferred tab.
  const activeView = gridTab === "all" ? builtin
    : (gridTab && gridTab.startsWith("view:")) ? views.find(v => v.id === gridTab.slice(5))
    : null;

  // Fall back to "all" if a saved view tab vanished.
  React.useEffect(() => {
    if (tab && tab.startsWith("view:") && !views.find(v => v.id === tab.slice(5))) setTab("all");
  }, [tab, views.length]);

  // Dirty state of the active view (reported up by AllData).
  const [dirtyTabId, setDirtyTabId] = React.useState(null);
  const activeViewId = activeView ? activeView.id : null;
  const onDirtyChange = React.useCallback((d) => setDirtyTabId(d ? activeViewId : null), [activeViewId]);

  // No artificial loading delay — view data is already in memory, so switching
  // renders immediately. (The skeleton state stays available for real async loads.)
  const loading = false;

  // Chart deep-dive ephemeral tab (calc grain) — unchanged behaviour.
  const onSavedViewTab = !!(tab && tab.startsWith("view:"));
  const hasChartContext = !!(calcPreset && (calcPreset.chartSpec || calcPreset.bu || calcPreset.scope || calcPreset.category || (calcPreset.query && calcPreset.query.length > 0)));
  const deepdiveActive = hasChartContext && !onSavedViewTab && tab !== "all";
  React.useEffect(() => { if (tab === "deepdive" && !deepdiveActive) setTab("all"); }, [tab, deepdiveActive]);

  const onSaveView = (id, state) => {
    _updateDataViewState && _updateDataViewState(id, state);
    const v = views.find(x => x.id === id);
    window.dispatchEvent(new CustomEvent("fe-toast", { detail: `Saved changes to “${v ? v.name : "view"}”` }));
  };
  const onSaveAsNew = (state) => {
    if (!_createDataView) return;
    const base = activeView ? activeView.name : "View";
    const v = _createDataView({ name: `${base} copy`, kind: "alldata", state, icon: "filter" });
    setTab("view:" + v.id);
    window.dispatchEvent(new CustomEvent("fe-toast", { detail: `New view “${v.name}” — double-click the tab to rename` }));
  };
  const newBlankView = () => {
    if (!_createDataView) return;
    const v = _createDataView({ name: "New view", kind: "alldata", state: (activeView ? activeView.state : window.defaultViewState("entry")), icon: "filter" });
    setTab("view:" + v.id);
    window.dispatchEvent(new CustomEvent("fe-toast", { detail: `New view created — adjust filters & columns, then Save` }));
  };

  // Pin the current chart deep-dive as a persistent saved view (kind "deepdive").
  // Captures the chartSpec + deep-dive filters so reopening the tab rebuilds it.
  const pinDeepdive = () => {
    if (!_createDataView || !calcPreset) return;
    const cp = calcPreset;
    const chartContext = {
      chartSpec: cp.chartSpec || null,
      bu: cp.bu ?? null, scope: cp.scope ?? null, category: cp.category ?? null,
      query: cp.query || "", period: cp.period ?? null,
      origin: cp.origin ?? null, originLabel: cp.originLabel ?? null, originAnchor: cp.originAnchor ?? null,
    };
    const name = (cp.chartSpec && cp.chartSpec.title) ? cp.chartSpec.title : "Chart view";
    const v = _createDataView({ name, kind: "deepdive", chartContext, icon: "chart" });
    onCloseDeepdive && onCloseDeepdive();
    setTab("view:" + v.id);
    window.dispatchEvent(new CustomEvent("fe-toast", { detail: `Saved “${v.name}” as a view` }));
  };

  // A pinned deep-dive view re-applies its chart context to a fresh preset; the
  // tick bumps on each open so Calculations re-runs the filter effect.
  const isDeepdiveView = !!(activeView && activeView.kind === "deepdive");
  const [ddTick, setDdTick] = React.useState(1);
  React.useEffect(() => { if (isDeepdiveView) setDdTick(t => t + 1); }, [activeViewId]);
  const ddPreset = isDeepdiveView ? { ...(activeView.chartContext || {}), tick: ddTick } : null;

  // The deep-dive grid is now the SAME AllData grid as the default tabs — its
  // chart context (scope/category/BU/period) is applied as column filters via a
  // synthetic alldata view, and the chart floats on top. Identical toolbar/options.
  const deepdiveCtx = isDeepdiveView ? (activeView.chartContext || {}) : (calcPreset || {});
  const deepdiveView = React.useMemo(() => {
    const cf = {};
    if (deepdiveCtx.scope != null && deepdiveCtx.scope !== "all") cf.scope = String(deepdiveCtx.scope);
    if (deepdiveCtx.category) cf.emission_source = deepdiveCtx.category;
    if (deepdiveCtx.bu) cf.business_unit = deepdiveCtx.bu;
    const base = window.defaultViewState ? window.defaultViewState("calc") : { filters: {}, sort: [], columns: { order: [], visible: [], pinned: [] } };
    return {
      id: isDeepdiveView ? activeView.id : ("deepdive-" + (calcPreset && calcPreset.tick || 0)),
      name: isDeepdiveView ? activeView.name : "Chart deepdive",
      kind: "alldata", builtin: false,
      state: { ...base, filters: { period: deepdiveCtx.period ?? null, query: deepdiveCtx.query || "", colFilters: cf } },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDeepdiveView, activeViewId, calcPreset]);

  // Clicking a chart bar in the deep-dive applies a live overlay filter to the
  // grid (without disturbing sort/columns). Reset when the deep-dive changes.
  const [deepdiveBar, setDeepdiveBar] = React.useState(null); // { dd, label }
  React.useEffect(() => { setDeepdiveBar(null); /* eslint-disable-next-line */ }, [activeViewId, (calcPreset && calcPreset.tick)]);
  const deepdiveExtraFilter = React.useMemo(() => {
    const dd = deepdiveBar && deepdiveBar.dd;
    if (!dd) return null;
    const cf = {};
    if (dd.category) cf.emission_source = dd.category;
    if (dd.scope != null && dd.scope !== "all") cf.scope = String(dd.scope);
    if (dd.bu) cf.business_unit = dd.bu;
    if (dd.status) cf.quality = { confirmed: "cs_confirmed", suggested: "cs_sug_high", pending: "cs_processing" }[dd.status];
    return { colFilters: cf, query: dd.query || "" };
  }, [deepdiveBar]);

  const [overflowOpen, setOverflowOpen] = React.useState(false);
  const viewRowRef = React.useRef(null);
  const visN = window.useViewOverflow ? window.useViewOverflow(viewRowRef, savedViews) : savedViews.length;
  const [visibleViews, hiddenViews] = window.splitViewsForOverflow
    ? window.splitViewsForOverflow(savedViews, visN, v => tab === "view:" + v.id)
    : [savedViews, []];
  const selectView = (v) => { setSelEntryId && setSelEntryId(null); setSelCalcId && setSelCalcId(null); setTab("view:" + v.id); };

  // Global search — a transient layer that overlays the active view (NOT saved
  // into the view, and it never switches tabs). Matches the entry spine.
  const [globalQuery, setGlobalQuery] = React.useState("");
  const [dataResultCount, setDataResultCount] = React.useState(entries.length);
  // Defer the query used for filtering so the input stays responsive while typing;
  // the 100k-row match pass + grid filter run at lower priority and can be interrupted.
  const deferredQuery = React.useDeferredValue(globalQuery);
  const matchCount = React.useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return null;
    return entries.filter(e =>
      e.id.toLowerCase().includes(q) || (e.summary || "").toLowerCase().includes(q) ||
      (e.business_activity || "").toLowerCase().includes(q) || (e.business_unit || "").toLowerCase().includes(q) ||
      (e.user_assigned || "").toLowerCase().includes(q) || (e.site || "").toLowerCase().includes(q)).length;
  }, [deferredQuery, entries]);

  return (
    <div className="data-page-root">
      <div className="page-head data-page-head">
        <div className="data-page-head-title">
          <h1 className="page-title">Data</h1>
        </div>
        <div className="data-header-right">
          <button className="btn primary" style={{ whiteSpace: "nowrap" }} onClick={() => onAddData && onAddData()}>
            <Icon name="plus" size={18}/>Add data
          </button>
        </div>
      </div>

      <div className="data-search-row">
        <span className="global-search">
          <Icon name="search" size={16} style={{ color: "var(--fe-fg-muted)" }} />
          <input placeholder="Search all data…" value={globalQuery} onChange={(e) => setGlobalQuery(e.target.value)} aria-label="Search all data" />
          {globalQuery && <button className="fs-clear" onClick={() => setGlobalQuery("")} aria-label="Clear search"><Icon name="close" size={13} /></button>}
        </span>
        {matchCount != null && (
          <span className="search-result-chip">
            <b>{matchCount}</b> of {entries.length} entries match “{globalQuery.trim()}”
          </span>
        )}
        <button type="button" className="btn secondary data-search-export"
          title="Export the current view to CSV"
          onClick={() => window.dispatchEvent(new CustomEvent("fe-export-start", { detail: {
            title: "Current view", meta: `${dataResultCount.toLocaleString()} rows · CSV`,
            filename: `data_${new Date().toISOString().slice(0,10)}.csv`, rows: dataResultCount } }))}>
          <Icon name="download" size={16}/>Export
        </button>
      </div>

      <div className="view-bar">
        <div className="segments view-tabs" role="tablist" aria-label="Saved views" ref={viewRowRef}>
          <button role="tab" aria-selected={tab === "all"} className={`segment ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>
            <Icon name="home" size={14}/><span>{builtin ? builtin.name : "All data"}</span>
            {tab === "all" && dirtyTabId === "all" && <span className="segment-dirty" title="Unsaved changes"/>}
          </button>

          {visibleViews.map(v => (
            <span className="ovf-seg" data-vid={v.id} key={v.id}>
              <ViewTab v={v} active={tab === "view:" + v.id} dirty={dirtyTabId === v.id}
                onSelect={() => selectView(v)}
                onRename={(n) => _renameDataView && _renameDataView(v.id, n)}
                onDuplicate={() => { const d = _createDataView({ name: `${v.name} copy`, kind: v.kind, state: v.state, icon: v.icon, chartContext: v.chartContext }); if (d) setTab("view:" + d.id); }}
                onDelete={() => { if (confirm(`Delete view “${v.name}”?`)) { _deleteDataView && _deleteDataView(v.id); setTab("all"); } }}
                onReset={() => { _resetDataView && _resetDataView(v.id); }} />
            </span>
          ))}

          {deepdiveActive && (
            <div role="tab" aria-selected={tab === "deepdive"} className={`segment segment--ephemeral ${tab === "deepdive" ? "active" : ""}`} onClick={() => setTab("deepdive")}>
              <Icon name="search" size={14}/><span>Chart deepdive</span>
              {tab === "deepdive" && (
                <>
                  <button type="button" className="segment-action" onClick={(e) => { e.stopPropagation(); pinDeepdive(); }} title="Save as view" aria-label="Save chart deepdive as a view"><Icon name="pin" size={13}/></button>
                  <button type="button" className="segment-close" onClick={(e) => { e.stopPropagation(); onCloseDeepdive && onCloseDeepdive(); }} title="Close" aria-label="Close"><Icon name="close" size={12}/></button>
                </>
              )}
            </div>
          )}

          {hiddenViews.length > 0 && (
            <ViewOverflowMenu items={hiddenViews} isActive={v => tab === "view:" + v.id} dirtyId={dirtyTabId} onSelect={selectView} />
          )}
          <button className="view-add" onClick={newBlankView} title="New view" aria-label="New view"><Icon name="plus" size={15}/><span>New view</span></button>
        </div>
      </div>

      {activeView && !isDeepdiveView && (
        <AllData
          view={activeView}
          restoreTick={activeView.builtin && allDataPreset ? allDataPreset.tick : 0}
          preset={activeView.builtin ? allDataPreset : null}
          loading={loading}
          globalQuery={deferredQuery}
          onClearSearch={() => setGlobalQuery("")}
          onResultCount={setDataResultCount}
          entries={entries}
          calcs={calcs}
          onViewEntry={(eid) => { setSelEntryId && setSelEntryId(eid); }}
          onViewCalc={(cid) => { const c = calcs.find(x => x.id === cid); setSelCalcId(cid); if (c) setSelEntryId && setSelEntryId(c.entryId); }}
          onAddData={onAddData}
          onSaveView={onSaveView}
          onSaveAsNew={onSaveAsNew}
          onDirtyChange={onDirtyChange}
        />
      )}

      {(gridTab === "deepdive" || isDeepdiveView) && (
        <div className="deepdive-float-wrap">
          {/* Floating chart overlay (drag/collapse/pin-back) — same component, chart-only */}
          <Calculations
            chartOnly
            preset={isDeepdiveView ? ddPreset : calcPreset}
            calcs={calcs}
            entries={entries}
            onBack={onBack}
            onBarSelect={setDeepdiveBar}
            selectedBar={deepdiveBar && deepdiveBar.label}
          />
          {/* The grid is the standard default-tab grid → identical Filter/Sort/Group/Columns toolbar */}
          <AllData
            key={deepdiveView.id}
            view={deepdiveView}
            entries={entries}
            calcs={calcs}
            loading={false}
            globalQuery=""
            extraFilter={deepdiveExtraFilter}
            onResultCount={() => {}}
            onViewEntry={(eid) => { setSelEntryId && setSelEntryId(eid); }}
            onViewCalc={(cid) => { const c = calcs.find(x => x.id === cid); setSelCalcId(cid); if (c) setSelEntryId && setSelEntryId(c.entryId); }}
            onAddData={onAddData}
          />
        </div>
      )}
    </div>
  );
}

Object.assign(window, { DataPage });
