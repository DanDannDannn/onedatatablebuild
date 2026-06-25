// Trends — third Analyse sub-page.
// Focuses on hotspot analytics, top contributors, and YoY changes.
// AI chat and AI insights now live on the Home page; Trends pages display
// any AI insights the user has pinned to this board at the top.

// Board actions menu — kebab (...) next to a board title that consolidates
// Edit layout / Rename / Export / Delete into a single dropdown.
//
// `editLayoutActive` + `onToggleEditLayout` make the menu's "Edit layout"
// item a toggle (with a checkmark when active). Other actions fire callbacks
// or fall through to a "not implemented in this prototype" toast.
function BoardActionsMenu({
  editLayoutActive,
  onToggleEditLayout,
  onRename,
  onExport,
  onDelete,
  canDelete = false,
  canRename = false,
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const stub = (label) => () => {
    window.dispatchEvent(new CustomEvent("fe-toast", {
      detail: `${label} — not built in this prototype`,
    }));
    setOpen(false);
  };

  const Item = ({ icon, label, onClick, active, danger, disabled, hint }) => (
    <button
      type="button"
      className={"board-actions__item"
        + (active ? " is-active" : "")
        + (danger ? " is-danger" : "")
        + (disabled ? " is-disabled" : "")}
      onClick={() => { if (disabled) return; onClick(); }}
      title={hint || undefined}
    >
      <Icon name={icon} size={14}/>
      <span className="board-actions__item-label">{label}</span>
      {active && <Icon name="check" size={14}/>}
    </button>
  );

  return (
    <div className="board-actions" ref={ref}>
      <button
        type="button"
        className={"board-actions__trigger" + (open ? " is-open" : "")}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Board actions"
      >
        <Icon name="dots" size={16}/>
      </button>
      {open && (
        <div className="board-actions__menu" role="menu">
          <Item
            icon="pencil"
            label="Edit layout"
            onClick={() => { onToggleEditLayout(); setOpen(false); }}
            active={editLayoutActive}
          />
          <Item
            icon="pencil"
            label="Rename board"
            onClick={onRename ? () => { onRename(); setOpen(false); } : stub("Rename")}
            disabled={!canRename}
            hint={!canRename ? "Built-in boards can't be renamed" : undefined}
          />
          <Item
            icon="download"
            label="Export board"
            onClick={onExport ? () => { onExport(); setOpen(false); } : stub("Export")}
          />
          <div className="board-actions__sep" />
          <Item
            icon="trash"
            label="Delete board"
            onClick={onDelete ? () => { onDelete(); setOpen(false); } : stub("Delete")}
            danger
            disabled={!canDelete}
            hint={!canDelete ? "Built-in boards can't be deleted" : undefined}
          />
        </div>
      )}
    </div>
  );
}

function Trends({ calcs, entries, onJumpTo }) {
  const [editLayout, setEditLayout] = React.useState(false);
  const [hm12Open, setHm12Open] = React.useState(() => localStorage.getItem("fe-tr-hm12-open") !== "0");
  const [hm3Open,  setHm3Open]  = React.useState(() => localStorage.getItem("fe-tr-hm3-open") !== "0");
  const totalKg = calcs.reduce((s,c) => s + c.kgCO2e, 0);

  // Top contributors helpers
  const topN = (keyFn, n=8, labelFn=null) => {
    const m = {};
    const labels = {};
    calcs.forEach(c => {
      const k = keyFn(c); if (!k) return;
      m[k] = (m[k]||0) + c.kgCO2e;
      if (labelFn) labels[k] = labelFn(c) || k;
    });
    const arr = Object.entries(m).sort((a,b) => b[1]-a[1]);
    return arr.slice(0, n).map(([k, v]) => ({
      k, label: labelFn ? (labels[k] || k) : k, kg: v, pct: v/totalKg
    }));
  };

  const CAT_LABELS = {
    // Real Scope 3 categories (current dataset)
    purchased_goods: "Purchased goods",
    capital_goods: "Capital goods",
    upstream_transport: "Upstream transport",
    waste: "Waste",
    business_travel: "Business travel",
    // Legacy seed keys (fallback)
    electricity: "Electricity",
    natural_gas: "Natural gas",
    diesel: "Diesel / fleet",
    flight: "Business travel — air",
  };

  const topCategories = topN(c => c.category, 6, c => CAT_LABELS[c.category]);
  const topSites = topN(c => c.site && c.site !== "—" ? c.site : null, 6);
  // Top 5 helpers
  const topNPct = (keyFn, n=5) => {
    const m = {};
    calcs.forEach(c => { const k = keyFn(c); if (!k) return; m[k] = (m[k]||0) + c.kgCO2e; });
    const arr = Object.entries(m).sort((a,b) => b[1]-a[1]);
    const tot = arr.reduce((s,[,v]) => s+v, 0) || 1;
    return arr.slice(0, n).map(([k, v]) => ({ k, v, pct: v/tot }));
  };
  const topSuppliers = topNPct(c => c.business_activity);
  const topMaterials = topNPct(c => c.category);
  const topLocations = topNPct(c => c.business_unit);

  // Real monthly trend series, computed from calcs.
  // Bucket by month (start_date YYYY-MM), sum kgCO2e per scope, convert to tCO₂e.
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const scopesPresent = Array.from(new Set(calcs.map(c => c.scope).filter(s => s != null))).sort((a, b) => a - b);
  // Sorted unique month keys (YYYY-MM) across all calcs, with short labels.
  const monthKeys = Array.from(new Set(
    calcs.map(c => (c.start_date || "").slice(0, 7)).filter(Boolean)
  )).sort();
  const monthShortLabels = monthKeys.map(mk => MONTH_NAMES[(parseInt(mk.slice(5, 7), 10) || 1) - 1]);
  const { monthLabels, trendData } = (() => {
    // Per-scope kg buckets per month.
    const buckets = {}; // scope -> { monthKey -> kg }
    scopesPresent.forEach(s => { buckets[s] = {}; });
    calcs.forEach(c => {
      const mk = (c.start_date || "").slice(0, 7);
      if (!mk || c.scope == null || !buckets[c.scope]) return;
      buckets[c.scope][mk] = (buckets[c.scope][mk] || 0) + c.kgCO2e;
    });
    // Always expose scope1/2/3 arrays (the stacked chart consumes them);
    // scopes not present resolve to all-zeros so the chart never errors.
    const series = (s) => monthKeys.map(mk => (buckets[s]?.[mk] || 0) / 1000);
    return {
      monthLabels: monthShortLabels,
      trendData: { scope1: series(1), scope2: series(2), scope3: series(3) },
    };
  })();

  // --- Carry-over chart specs so every Trends chart deep-dives in its native
  // style with a "Back to Trends" anchor. ---
  const SC_COLORS = { 1: "#F35151", 2: "#AD6EFF", 3: "#5A4DFF" };
  // Derive each category's scope from the real calcs (falls back to 3).
  const catScopeMap = (() => {
    const m = {};
    calcs.forEach(c => { if (c.category != null && m[c.category] == null) m[c.category] = c.scope; });
    return m;
  })();
  const scopeOfCat = (k) => catScopeMap[k] ?? 3;
  const trendScopeRows = scopesPresent.map(s => ({ scope: s, kg: calcs.filter(c => c.scope === s).reduce((a, c) => a + c.kgCO2e, 0) }));
  const trendSpec = (hl) => ({
    kind: "static-bar", variant: "bars", tag: "Emissions by scope",
    title: "Emissions trend · by scope · tCO₂e", unit: "tCO₂e", carriedFrom: "Trends",
    legend: scopesPresent.map(s => ({ label: `Scope ${s}`, color: SC_COLORS[s] })),
    rows: trendScopeRows.map(r => ({ label: `Scope ${r.scope}`, value: r.kg / 1000, display: (r.kg / 1000).toFixed(2), color: SC_COLORS[r.scope], highlight: hl === r.scope })),
  });
  const catSpec = (hlKey) => ({
    kind: "static-bar", variant: "bars", tag: "Top categories",
    title: "Top emitting categories · tCO₂e", unit: "tCO₂e", carriedFrom: "Trends",
    rows: topCategories.map(c => ({ label: c.label, value: c.kg / 1000, display: (c.kg / 1000).toFixed(1), color: SC_COLORS[scopeOfCat(c.k)], highlight: hlKey === c.k })),
  });
  const siteSpec = (hlKey) => ({
    kind: "static-bar", variant: "bars", tag: "Top sites",
    title: "Top sites · tCO₂e", unit: "tCO₂e", carriedFrom: "Trends",
    rows: topSites.map(s => ({ label: s.k, value: s.kg / 1000, display: (s.kg / 1000).toFixed(1), color: "var(--fe-accent-primary)", highlight: hlKey === s.k })),
  });
  const topCardSpec = (title, tag, rows, labelOf, color, hlKey) => ({
    kind: "static-bar", variant: "bars", tag, title, unit: "tCO₂e", carriedFrom: "Trends",
    rows: rows.map(r => ({ label: labelOf(r), value: r.v / 1000, display: (r.v / 1000).toFixed(2), color, highlight: hlKey != null && hlKey === (r._raw != null ? r._raw : r.k) })),
  });

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <div className="page-head__titlerow">
            <h1 className="page-title">Trends</h1>
            <BoardActionsMenu
              editLayoutActive={editLayout}
              onToggleEditLayout={() => setEditLayout(v => !v)}
            />
          </div>
          <div className="page-subtitle">Hotspots, top contributors, period comparison</div>
        </div>
      </div>

      <BoardFilters boardKey="trends" />

      <PageSections pageKey="trends" editMode={editLayout}>

      <PageSection id="trend-chart" label="Emissions trend">
      {/* Trend chart */}
      <div className="card" style={{marginBottom: 24}}>
        <div className="card-head">
          <div>
            <h3 className="card-title">Emissions trend · FY 2024/25</h3>
            <div className="card-sub">Stacked by scope · tCO₂e</div>
          </div>
          <button className="deep-dive" title="Open in the data table" onClick={() => onJumpTo("calcs", { deepDive: {}, chartSpec: trendSpec(null), anchor: "trend-chart" })}>
            <Icon name="search" size={14}/><span className="dd-label">Deep dive</span>
          </button>
        </div>
        <TrendStackChart
          labels={monthLabels}
          series={trendData}
          onScopeClick={(scope) => onJumpTo("calcs", { deepDive: { scope }, chartSpec: trendSpec(scope), anchor: "trend-chart" })}
        />
        <div className="trend-legend">
          {scopesPresent.map(s => (
            <div key={s} className="trend-legend-item"><span className="swatch" style={{background:SC_COLORS[s]}}/>Scope {s}</div>
          ))}
        </div>
      </div>
      </PageSection>

      <PageSection id="hotspots" label="Top categories & sites">
      {/* Hotspot breakdowns */}
      <div className="grid-2" style={{marginBottom: 24}}>
        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">Top emitting categories</h3>
              <div className="card-sub">Where to focus first</div>
            </div>
            <button className="deep-dive" title="Open in the data table" onClick={() => onJumpTo("calcs", { deepDive: {}, chartSpec: catSpec(null), anchor: "hotspots" })}>
              <Icon name="search" size={14}/><span className="dd-label">Deep dive</span>
            </button>
          </div>
          <div className="hotspot-list">
            {topCategories.map(c => (
              <div
                key={c.k}
                className={"hotspot-row clickable scope-" + scopeOfCat(c.k)}
                role="button"
                tabIndex={0}
                title={`Deep dive: ${c.label}`}
                onClick={() => onJumpTo("calcs", { deepDive: { category: c.k }, chartSpec: catSpec(c.k), anchor: "hotspots" })}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onJumpTo("calcs", { deepDive: { category: c.k }, chartSpec: catSpec(c.k), anchor: "hotspots" }); } }}
              >
                <div className="label">{c.label}</div>
                <div className="track"><div className="fill" style={{width: (c.pct/topCategories[0].pct*100) + "%"}}/></div>
                <div className="val">{(c.kg/1000).toFixed(1)} t</div>
                <div className="pct">{Math.round(c.pct*100)}%</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">Top sites</h3>
              <div className="card-sub">By FY 2024/25 total emissions</div>
            </div>
            <button className="deep-dive" title="Open in the data table" onClick={() => onJumpTo("calcs", { deepDive: {}, chartSpec: siteSpec(null), anchor: "hotspots" })}>
              <Icon name="search" size={14}/><span className="dd-label">Deep dive</span>
            </button>
          </div>
          <div className="hotspot-list">
            {topSites.map(s => (
              <div
                key={s.k}
                className="hotspot-row clickable"
                role="button"
                tabIndex={0}
                title={`Deep dive: ${s.k}`}
                onClick={() => onJumpTo("calcs", { deepDive: { bu: s.k }, chartSpec: siteSpec(s.k), anchor: "hotspots" })}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onJumpTo("calcs", { deepDive: { bu: s.k }, chartSpec: siteSpec(s.k), anchor: "hotspots" }); } }}
              >
                <div className="label">{s.k}</div>
                <div className="track"><div className="fill" style={{width: (s.pct/topSites[0].pct*100) + "%"}}/></div>
                <div className="val">{(s.kg/1000).toFixed(1)} t</div>
                <div className="pct">{Math.round(s.pct*100)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </PageSection>

      <PageSection id="top-5" label="Top 5 tables">
      {/* Top 5 tables — moved from Home */}
      <div className="grid-3" style={{marginBottom: 24}}>
        {window.TopCard && (<>
          <window.TopCard title="Top 5 Suppliers" rows={topSuppliers} color="var(--fe-primary-200)"
            onDeepDive={() => onJumpTo("calcs", { deepDive: {}, chartSpec: topCardSpec("Top 5 suppliers · tCO₂e", "Top suppliers", topSuppliers, r => r.k, "var(--fe-accent-primary)", null), anchor: "top-5" })}
            onRowDeepDive={(row) => onJumpTo("calcs", { deepDive: { query: row.k }, chartSpec: topCardSpec("Top 5 suppliers · tCO₂e", "Top suppliers", topSuppliers, r => r.k, "var(--fe-accent-primary)", row.k), anchor: "top-5" })}
          />
          <window.TopCard title="Top 5 Materials" rows={topMaterials.map(r => ({...r, _raw: r.k, k: window.CAT_LABEL?.(r.k) || r.k}))} color="var(--fe-accent-primary)"
            onDeepDive={() => onJumpTo("calcs", { deepDive: {}, chartSpec: topCardSpec("Top 5 materials · tCO₂e", "Top materials", topMaterials, r => window.CAT_LABEL?.(r.k) || r.k, "var(--fe-accent-primary)", null), anchor: "top-5" })}
            onRowDeepDive={(row) => onJumpTo("calcs", { deepDive: { category: row._raw }, chartSpec: topCardSpec("Top 5 materials · tCO₂e", "Top materials", topMaterials, r => window.CAT_LABEL?.(r.k) || r.k, "var(--fe-accent-primary)", row._raw), anchor: "top-5" })}
            showRawTooltip
          />
          <window.TopCard title="Top 5 Locations" rows={topLocations} color="#F87171"
            onDeepDive={() => onJumpTo("calcs", { deepDive: {}, chartSpec: topCardSpec("Top 5 locations · tCO₂e", "Top locations", topLocations, r => r.k, "#F87171", null), anchor: "top-5" })}
            onRowDeepDive={(row) => onJumpTo("calcs", { deepDive: { bu: row.k }, chartSpec: topCardSpec("Top 5 locations · tCO₂e", "Top locations", topLocations, r => r.k, "#F87171", row.k), anchor: "top-5" })}
          />
        </>)}
      </div>
      </PageSection>

      {calcs.some(c => c.scope === 1 || c.scope === 2) && (
      <PageSection id="heatmap-12" label="Scope 1 & 2 heatmap">
      {window.Heatmap && (
        <window.Heatmap
          title="Scope 1 & 2 Heatmap"
          subtitle="Site × month · FY 2024/25 · tCO₂e"
          open={hm12Open}
          onToggle={() => { const n = !hm12Open; setHm12Open(n); localStorage.setItem("fe-tr-hm12-open", n ? "1" : "0"); }}
          onDeepDive={() => onJumpTo("calcs", { deepDive: { scope: 1 }, anchor: "heatmap-12" })}
          rows={(() => {
            const monthsAll = monthKeys;
            const sites = Array.from(new Set(calcs.filter(c => (c.scope === 1 || c.scope === 2) && c.site && c.site !== "—").map(c => c.site)));
            return sites.map(site => ({
              label: site,
              cells: monthsAll.map(m => ({
                kg: calcs.filter(c => (c.scope === 1 || c.scope === 2) && c.site === site && (c.start_date || "").startsWith(m)).reduce((s, c) => s + c.kgCO2e, 0),
                key: m,
                onClick: () => onJumpTo("calcs", { deepDive: { bu: site }, anchor: "heatmap-12" }),
              })),
            })).sort((a, b) => b.cells.reduce((s,c)=>s+c.kg,0) - a.cells.reduce((s,c)=>s+c.kg,0));
          })()}
          cols={monthShortLabels.map(l => ({ label: l }))}
          accent="var(--fe-primary-600)"
        />
      )}
      </PageSection>
      )}

      <PageSection id="heatmap-3" label="Scope 3 heatmap">
      {window.Heatmap && (
        <window.Heatmap
          title="Scope 3 Heatmap"
          subtitle="Category × month · FY 2024/25 · tCO₂e"
          open={hm3Open}
          onToggle={() => { const n = !hm3Open; setHm3Open(n); localStorage.setItem("fe-tr-hm3-open", n ? "1" : "0"); }}
          onDeepDive={() => onJumpTo("calcs", { deepDive: { scope: 3 }, anchor: "heatmap-3" })}
          rows={(() => {
            const monthsAll = monthKeys;
            const cats = Array.from(new Set(calcs.filter(c => c.scope === 3).map(c => c.category)));
            return cats.map(cat => ({
              label: window.CAT_LABEL?.(cat) || CAT_LABELS[cat] || cat,
              cells: monthsAll.map(m => ({
                kg: calcs.filter(c => c.scope === 3 && c.category === cat && (c.start_date || "").startsWith(m)).reduce((s, c) => s + c.kgCO2e, 0),
                key: m,
                onClick: () => onJumpTo("calcs", { deepDive: { category: cat }, anchor: "heatmap-3" }),
              })),
            })).sort((a, b) => b.cells.reduce((s,c)=>s+c.kg,0) - a.cells.reduce((s,c)=>s+c.kg,0));
          })()}
          cols={monthShortLabels.map(l => ({ label: l }))}
          accent="#00BBA7"
        />
      )}
      </PageSection>
      </PageSections>
    </>
  );
}


// --- Stacked trend chart (SVG) ---
function TrendStackChart({ labels, series, onScopeClick }) {
  const W = 800, H = 240, PAD_L = 40, PAD_R = 12, PAD_T = 12, PAD_B = 28;
  const totals = labels.map((_, i) => (series.scope1[i]||0) + (series.scope2[i]||0) + (series.scope3[i]||0));
  const peak = totals.length ? Math.max(...totals) : 0;
  const yMax = Math.max(Math.ceil(peak / 20) * 20, 20); // never 0 → no divide-by-zero
  const xStep = labels.length > 1 ? (W - PAD_L - PAD_R) / (labels.length - 1) : 0;
  const y = (v) => PAD_T + (1 - v/yMax) * (H - PAD_T - PAD_B);
  const x = (i) => PAD_L + i * xStep;

  const buildPath = (vals, baseline = []) => {
    let d = "";
    vals.forEach((v, i) => {
      const total = (baseline[i] || 0) + v;
      d += (i === 0 ? "M" : "L") + x(i) + "," + y(total);
    });
    for (let i = baseline.length - 1; i >= 0; i--) {
      d += "L" + x(i) + "," + y(baseline[i] || 0);
    }
    if (baseline.length === 0) {
      for (let i = vals.length - 1; i >= 0; i--) d += "L" + x(i) + "," + y(0);
    }
    d += "Z";
    return d;
  };

  const baseline1 = labels.map(() => 0);
  const baseline2 = labels.map((_, i) => series.scope1[i]);
  const baseline3 = labels.map((_, i) => series.scope1[i] + series.scope2[i]);

  // y-axis ticks
  const ticks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  return (
    <svg className="trend-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {/* gridlines */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PAD_L} y1={y(t)} x2={W-PAD_R} y2={y(t)} stroke="var(--fe-border-subtle, #EAEBF6)" strokeWidth="1"/>
          <text x={PAD_L - 6} y={y(t) + 4} fontSize="10" fill="var(--fe-fg-muted)" textAnchor="end">{Math.round(t)}</text>
        </g>
      ))}
      {/* stack areas */}
      <path d={buildPath(series.scope1, baseline1)} fill="#F35151" opacity="0.85"
        style={onScopeClick ? {cursor:"pointer"} : null}
        onClick={onScopeClick ? () => onScopeClick(1) : undefined}>
        {onScopeClick && <title>Deep dive: Scope 1</title>}
      </path>
      <path d={buildPath(series.scope2, baseline2)} fill="#AD6EFF" opacity="0.85"
        style={onScopeClick ? {cursor:"pointer"} : null}
        onClick={onScopeClick ? () => onScopeClick(2) : undefined}>
        {onScopeClick && <title>Deep dive: Scope 2</title>}
      </path>
      <path d={buildPath(series.scope3, baseline3)} fill="#5A4DFF" opacity="0.85"
        style={onScopeClick ? {cursor:"pointer"} : null}
        onClick={onScopeClick ? () => onScopeClick(3) : undefined}>
        {onScopeClick && <title>Deep dive: Scope 3</title>}
      </path>
      {/* x-axis labels */}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={H - 8} fontSize="10" fill="var(--fe-fg-muted)" textAnchor="middle">{l}</text>
      ))}
      {/* reporting period label — whole series covers FY 2024/25 */}
      <text x={PAD_L + 6} y={PAD_T + 12} fontSize="10" fill="var(--fe-primary-700)" fontWeight="500">FY 2024/25</text>
    </svg>
  );
}

Object.assign(window, { Trends, BoardActionsMenu });
