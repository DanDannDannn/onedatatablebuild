// Overview page — totals, scope breakdown, sparkline, review queue
// Scope 3 categories — each row has its emission key (where data lives) and
// an `intent` flag indicating whether the category is in scope for reporting:
//   "planned"  → material / will report, but no data this period
//   "excluded" → not material for this business, will not report
const SCOPE3_CATS = [
  ["3.1",  "Purchased Goods and Services",                                       "purchased_goods", "planned"],
  ["3.2",  "Capital Goods",                                                       "capital_goods",     "planned"],
  ["3.3",  "Fuel- and Energy-Related Activities Not Included in Scope 1 or 2",    null,                "planned"],
  ["3.4",  "Upstream Transportation and Distribution",                            "upstream_transport","planned"],
  ["3.5",  "Waste Generated in Operations",                                       "waste",             "planned"],
  ["3.6",  "Business Travel",                                                     "business_travel",   "planned"],
  ["3.7",  "Employee Commuting",                                                  null,             "planned"],
  ["3.8",  "Upstream Leased Assets",                                              null,             "excluded"],
  ["3.9",  "Downstream Transportation and Distribution",                          null,             "excluded"],
  ["3.10", "Processing of Sold Products",                                         null,             "excluded"],
  ["3.11", "Use of Sold Products",                                                null,             "excluded"],
  ["3.12", "End-of-Life Treatment of Sold Products",                              null,             "excluded"],
  ["3.13", "Downstream Leased Assets",                                            null,             "excluded"],
  ["3.14", "Franchises",                                                          null,             "excluded"],
  ["3.15", "Investments",                                                         null,             "excluded"],
];

const CAT_LABEL_MAP = {
  // Real Scope 3 categories present in the dataset
  purchased_goods:    "Purchased goods & services",
  capital_goods:      "Capital goods",
  upstream_transport: "Upstream transport & distribution",
  waste:              "Waste generated in operations",
  business_travel:    "Business travel",
  // Legacy keys kept as a fallback for any older deep links
  electricity:        "Electricity",
  natural_gas:        "Natural gas",
  diesel:             "Diesel / fleet",
  flight:             "Business travel — air",
};

window.CAT_LABEL_MAP = CAT_LABEL_MAP;
// Shared label resolver (other pages reference window.CAT_LABEL). Falls back to
// the raw key so unknown categories still render something readable.
if (!window.CAT_LABEL) window.CAT_LABEL = (k) => CAT_LABEL_MAP[k] || k;

function Overview({ calcs, entries, onJumpTo, view = "home" }) {
  const [s3Open, setS3Open] = React.useState(() => localStorage.getItem("fe-s3-open") === "1");
  const [hm12Open, setHm12Open] = React.useState(() => localStorage.getItem("fe-hm12-open") === "1");
  const [hm3Open, setHm3Open] = React.useState(() => localStorage.getItem("fe-hm3-open") === "1");
  const [showEmptyS3, setShowEmptyS3] = React.useState(() => localStorage.getItem("fe-s3-show-empty") === "1");
  const [qbOpen, setQbOpen] = React.useState(() => localStorage.getItem("fe-ov-qb-open") === "1");
  React.useEffect(() => { localStorage.setItem("fe-ov-qb-open", qbOpen ? "1" : "0"); }, [qbOpen]);
  const [editLayout, setEditLayout] = React.useState(false);

  const total = calcs.reduce((s, c) => s + c.kgCO2e, 0);
  // No prior-period data exists in this dataset, so there is no QoQ baseline to
  // compare against. Keep these null and guard the delta UI so we never render a
  // fabricated change figure.
  const priorTotal = null;
  const deltaKg = priorTotal != null ? total - priorTotal : null;
  const deltaPct = priorTotal ? (deltaKg / priorTotal) * 100 : null;
  const byScope = [1, 2, 3].map(s => ({
    scope: s,
    kg: calcs.filter(c => c.scope === s).reduce((a, c) => a + c.kgCO2e, 0),
    color: s === 1 ? "#F35151" : s === 2 ? "#AD6EFF" : "#00BBA7",
  }));
  byScope.forEach(b => b.pct = total ? b.kg / total : 0);


  // Carry-over chart spec for the by-scope donut — travels to the data table.
  const scopeSpec = (highlightScope) => ({
    kind: "static-bar",
    variant: "bars",
    tag: "Emissions by scope",
    title: "Emissions by scope · tCO₂e",
    unit: "tCO₂e",
    carriedFrom: "Emission overview",
    legend: byScope.filter(b => b.kg > 0).map(b => ({ label: `Scope ${b.scope}`, color: b.color })),
    rows: byScope.filter(b => b.kg > 0).map(b => ({
      label: `Scope ${b.scope}`,
      value: b.kg / 1000,
      display: (b.kg / 1000).toFixed(2),
      color: b.color,
      highlight: highlightScope === b.scope,
    })),
  });

  const needsReview = calcs.filter(c => c.status === "pending" || c.status === "suggested").length;
  const verified = calcs.filter(c => c.status === "confirmed").length;
  const coverage = Math.round((verified / calcs.length) * 100);

  // Data quality synthesis
  const primaryActivity = Math.round((entries.filter(e => e.data_input_type !== "Manual entry").length / (entries.length||1)) * 100);
  const primaryFactor = Math.round((calcs.filter(c => c.factor.source && c.factor.source.toLowerCase().includes("supplier")).length / (calcs.length||1)) * 100);
  const spendBased = 85; // mock — spend-based majority
  const activityBased = 100 - spendBased + 20; // just for chart width, clamp 35
  const activityPct = 35;
  const qualityLabel = coverage > 85 ? "Good" : coverage > 60 ? "Fair" : "Poor";

  // Calculation scale metrics
  const uniqFactors = new Set(calcs.map(c => c.factor.id || c.factor.name)).size;
  const lineItems = entries.length; // one data entry = one line item
  const matBasedShare = Math.round((calcs.filter(c => c.scope !== 3 || c.factor.source?.includes("DEFRA")).length / (calcs.length||1)) * 100);

  // (Removed the seed sparkline + dead top-N rollups by business_activity /
  // business_unit — those fields don't exist in the real model and the
  // sparkline was a fabricated 7-point series that was never rendered.)

  // EF matching progress (5 buckets)
  const total_n = calcs.length || 1;
  const ef_confirmed   = calcs.filter(c => c.status === "confirmed").length;
  const ef_high        = calcs.filter(c => c.status === "suggested" && c.confidence >= 0.8).length;
  const ef_medium      = calcs.filter(c => c.status === "suggested" && c.confidence >= 0.6 && c.confidence < 0.8).length;
  const ef_low         = calcs.filter(c => c.status === "suggested" && c.confidence != null && c.confidence < 0.6).length;
  const ef_missing     = calcs.filter(c => c.status === "pending" || (c.status === "suggested" && c.confidence == null)).length;
  const pctOf = (n) => Math.round((n / total_n) * 100);
  const efBuckets = [
    { key: "confirmed", label: "Confirmed",          n: ef_confirmed, pct: pctOf(ef_confirmed), tone: "ok" },
    { key: "high",      label: "Suggested · high",   n: ef_high,      pct: pctOf(ef_high),      tone: "high" },
    { key: "medium",    label: "Suggested · medium", n: ef_medium,    pct: pctOf(ef_medium),    tone: "med" },
    { key: "low",       label: "Suggested · low",    n: ef_low,       pct: pctOf(ef_low),       tone: "low" },
    { key: "missing",   label: "Missing / pending",  n: ef_missing,   pct: pctOf(ef_missing),   tone: "miss" },
  ];

  // Data quality method split — buckets follow GHG Protocol method hierarchy
  // (activity > distance > location > spend), using the `method` field set in data.jsx
  const dq_activity = calcs.filter(c => /activity/i.test(c.method || "")).length;
  const dq_distance = calcs.filter(c => /distance/i.test(c.method || "")).length;
  const dq_location = calcs.filter(c => /location/i.test(c.method || "")).length;
  const dq_spend    = calcs.filter(c => /spend/i.test(c.method || "")).length;
  const dq_other    = total_n - dq_activity - dq_distance - dq_location - dq_spend;
  const dqBuckets = [
    { key: "activity", label: "Activity-based",     n: dq_activity,            pct: pctOf(dq_activity),            tone: "ok" },
    { key: "distance", label: "Distance-based",     n: dq_distance,            pct: pctOf(dq_distance),            tone: "high" },
    { key: "location", label: "Location-based",     n: dq_location,            pct: pctOf(dq_location),            tone: "high" },
    { key: "spend",    label: "Spend-based",        n: dq_spend,               pct: pctOf(dq_spend),               tone: "med" },
    { key: "other",    label: "Other / unspec.",    n: Math.max(dq_other, 0),  pct: pctOf(Math.max(dq_other, 0)),  tone: "miss" },
  ];

  // ---- Quality-tile metrics ----
  const efMatchedShare    = pctOf(ef_confirmed + ef_high);
  const activityShare     = pctOf(dq_activity + dq_distance);
  const primaryDataShare  = pctOf(calcs.filter(c => /activity/i.test(c.method || "") && c.confidence >= 0.85).length);
  const verifiedShareDQ   = pctOf(ef_confirmed);
  const qualityLabelDQ    = verifiedShareDQ > 85 ? "Good" : verifiedShareDQ > 60 ? "Fair" : "Poor";

  // ---- Scope 3 coverage matrix ----
  // A category is covered when its key matches a real calc category present
  // in the data (purchased_goods, capital_goods, upstream_transport, waste,
  // business_travel).
  const s3Present = new Set(calcs.map(c => c.category));
  const s3Coverage = SCOPE3_CATS.map(([num, name, key]) => ({
    num, name, covered: !!(key && s3Present.has(key)),
  }));
  const coveredCount = s3Coverage.filter(r => r.covered).length;

  // Combined Data Quality Score card — used on both Home and Emission overview.
  // Includes the header pill, the 3 coverage stats, an inline row of 4 quality
  // tiles, and the collapsible bucket breakdown.
  const dqCombinedCard = (
    <div className={`dq-card dq-combined dq-with-tiles ${qbOpen ? "open" : "closed"}`} style={{marginBottom: 24}}>
      <div className="dq-head">
        <div className="dq-title">Data Quality Score</div>
        <span className={`dq-pill ${qualityLabelDQ.toLowerCase()}`}>{qualityLabelDQ}</span>
        <button
          type="button"
          className="dq-toggle dq-toggle-corner"
          onClick={() => setQbOpen(v => !v)}
          aria-expanded={qbOpen}
          aria-label={qbOpen ? "Hide breakdown" : "Show breakdown"}
          title={qbOpen ? "Hide breakdown" : "Show breakdown"}
        >
          <span className="dq-chev" aria-hidden="true"><Icon name="chev" size={16}/></span>
        </button>
      </div>
      {/* Coverage stats stay visible even when collapsed — a condensed summary */}
      <div className="dq-coverage">
        <div className="dq-coverage-stat">
          <div className="dq-coverage-n">{lineItems.toLocaleString()}</div>
          <div className="dq-coverage-k">Line items processed</div>
        </div>
        <div className="dq-coverage-stat">
          <div className="dq-coverage-n">{uniqFactors}</div>
          <div className="dq-coverage-k">Emission factors used</div>
        </div>
        <div className="dq-coverage-stat">
          <div className="dq-coverage-n">{matBasedShare}<span className="dq-coverage-u">%</span></div>
          <div className="dq-coverage-k">Material-based approach</div>
        </div>
        <div className="dq-coverage-stat">
          <div className="dq-coverage-n">{efMatchedShare}<span className="dq-coverage-u">%</span></div>
          <div className="dq-coverage-k">EF matching · {ef_confirmed + ef_high} of {total_n} confirmed</div>
        </div>
      </div>
      {qbOpen && (
      <div className="dq-breakdown">
        <DqBucketBlock title="Emission factor matching" subtitle={`${total_n} calculations`} buckets={efBuckets}/>
        <DqBucketBlock title="Calculation method" subtitle="Higher-quality methods at top" buckets={dqBuckets}/>
      </div>
      )}
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <div className="page-head__titlerow">
            <h1 className="page-title">{view === "emission" ? "Emission overview" : "Home"}</h1>
            {view === "emission" && window.BoardActionsMenu && (
              <window.BoardActionsMenu
                editLayoutActive={editLayout}
                onToggleEditLayout={() => setEditLayout(v => !v)}
              />
            )}
          </div>
          <div className="page-subtitle">
            {view === "emission"
              ? <>GHG emissions · Reporting period FY 2024/25</>
              : <>{"\n"}</>}
          </div>
        </div>
      </div>

      <BoardFilters boardKey={view === "emission" ? "emission-overview" : "overview"} hidden={view !== "emission"} />

      <PageSections pageKey={view === "emission" ? "emission-overview" : "overview"} editMode={editLayout}>
      {view !== "emission" && (<>
      <PageSection id="activity-feed" label="Today's snapshot" noAddToReport>
        <div className="home-snapshot-row">
          <div className="home-snapshot-left">
            <ActivityFeed onJumpTo={onJumpTo} calcs={calcs} entries={entries}/>
          </div>
          <div className="home-snapshot-right">
            {dqCombinedCard}
          </div>
        </div>
      </PageSection>
      </>)}

      {view === "emission" && (<>
      <PageSection id="totals" label="Totals & scope donut">
      <div className="grid-2 ov-totals-row" style={{marginBottom: 20}}>
        <div className="calc-scale-hero">
          <div className="csh-metrics">
            <div className="csh-m">
              <div className="n">{(total/1000).toFixed(0)}<span className="u">t</span></div>
              <div className="d">CO₂e emissions calculated this reporting period</div>
            </div>
          </div>
          {deltaKg != null && (
            <div className={"csh-delta-block " + (deltaKg > 0 ? "up" : "down")}>
              <div className="csh-delta-row">
                <span className="csh-delta-arrow" aria-hidden>{deltaKg > 0 ? "▲" : "▼"}</span>
                <span className="csh-delta-abs">{deltaKg > 0 ? "+" : "−"}{Math.abs(deltaKg/1000).toFixed(1)} t</span>
                <span className="csh-delta-pct">{deltaKg > 0 ? "+" : "−"}{Math.abs(deltaPct).toFixed(1)}%</span>
              </div>
              <div className="csh-delta-base">vs prior period · {(priorTotal/1000).toFixed(1)} t</div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">Emissions by scope</h3>
              <div className="card-sub">FY 2024/25 · total {(total/1000).toFixed(1)} tCO₂e</div>
            </div>
            <button className="deep-dive" title="Open by-scope breakdown in the data table" onClick={() => onJumpTo("calcs", { deepDive: {}, chartSpec: scopeSpec(null), anchor: "totals" })}>
              <Icon name="search" size={14}/><span className="dd-label">Deep dive</span>
            </button>
          </div>
          <div className="donut-wrap" style={{marginTop: 16}}>
            {(() => {
              // SVG donut: 200x200 viewBox, r=80, stroke-width=24
              const C = 2 * Math.PI * 80;
              let offset = 0;
              return (
                <svg className="donut-svg" viewBox="0 0 200 200" width="140" height="140" aria-label="Emissions by scope donut chart">
                  <circle cx="100" cy="100" r="80" fill="none" stroke="var(--fe-bg-subtle, #F4F5F8)" strokeWidth="24"/>
                  {byScope.map(b => {
                    if (b.kg <= 0) return null;
                    const len = b.pct * C;
                    const dasharray = `${len} ${C - len}`;
                    const dashoffset = -offset;
                    const seg = (
                      <circle
                        key={b.scope}
                        cx="100" cy="100" r="80"
                        fill="none"
                        stroke={b.color}
                        strokeWidth="24"
                        strokeDasharray={dasharray}
                        strokeDashoffset={dashoffset}
                        transform="rotate(-90 100 100)"
                        style={{cursor:"pointer", transition:"stroke-width .15s ease"}}
                        onClick={() => onJumpTo("calcs", { deepDive: { scope: b.scope }, chartSpec: scopeSpec(b.scope), anchor: "totals" })}
                      >
                        <title>{`Scope ${b.scope}: ${(b.kg/1000).toFixed(2)} tCO₂e (${Math.round(b.pct*100)}%)`}</title>
                      </circle>
                    );
                    offset += len;
                    return seg;
                  })}
                  <text x="100" y="94" textAnchor="middle" className="donut-c-n" fill="var(--fe-fg-strong)">
                    {(total/1000).toFixed(0)}
                  </text>
                  <text x="100" y="116" textAnchor="middle" className="donut-c-u" fill="var(--fe-fg-muted)">
                    tCO₂e
                  </text>
                </svg>
              );
            })()}
            <div className="donut-legend">
              {byScope.map(b => (
                <button
                  key={b.scope}
                  type="button"
                  className="donut-leg-row"
                  onClick={() => onJumpTo("calcs", { deepDive: { scope: b.scope }, chartSpec: scopeSpec(b.scope), anchor: "totals" })}
                  title={`Deep dive: Scope ${b.scope}`}
                >
                  <span className="donut-leg-dot" style={{background: b.color}}/>
                  <div className="donut-leg-text">
                    <div className="donut-leg-k">Scope {b.scope}</div>
                    <div className="donut-leg-v">
                      <span className="donut-leg-n">{(b.kg/1000).toFixed(2)}</span>
                      <span className="donut-leg-u">tCO₂e</span>
                      <span className="donut-leg-pct">{Math.round(b.pct*100)}%</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      </PageSection>

      <PageSection id="dq-score" label="Data Quality Score">
      {dqCombinedCard}
      </PageSection>

      {/* Scope 1 & 2 breakdown — only render when the inventory actually has
          Scope 1 or 2 data. This dataset is 100% Scope 3, so it stays hidden. */}
      {calcs.some(c => c.scope === 1 || c.scope === 2) && (
      <PageSection id="scope-1-2-sources" label="Scope 1 & 2 breakdown by source">
      {(() => {
        const C1 = "#F35151";  // matches donut Scope 1
        const C2 = "#AD6EFF";  // matches donut Scope 2
        const rows = [
          { scope: 1, label: "Stationary combustion",       value: 45,  color: C1, cat: "natural_gas" },
          { scope: 1, label: "Mobile combustion",           value: 33,  color: C1, cat: "diesel" },
          { scope: 1, label: "Fugitive and process emissions", value: 33, color: C1, cat: null },
          { scope: 2, label: "Purchased electricity",       value: 150, color: C2, cat: "electricity" },
          { scope: 2, label: "Electricity — mobile",        value: 150, color: C2, cat: "electricity" },
          { scope: 2, label: "Purchased heat and steam",    value: 130, color: C2, cat: null },
        ];
        const max = 150;
        const niceMax = 150;
        const ticks = [0, 30, 60, 90, 120, 150];
        // Build the carry-over chart spec — the same bars travel to the data
        // table, with one bar highlighted when the user clicked into it.
        const spec = (highlightLabel) => ({
          kind: "static-bar",
          variant: "bars",
          tag: "Scope 1 & 2 by source",
          title: "Scope 1 & 2 breakdown by source · tCO₂e",
          unit: "tCO₂e",
          carriedFrom: "Emission overview",
          legend: [
            { label: "Scope 1", color: C1 },
            { label: "Scope 2", color: C2 },
          ],
          rows: rows.map(r => ({
            label: r.label,
            value: r.value,
            display: r.value.toFixed(2),
            color: r.color,
            highlight: highlightLabel === r.label,
          })),
        });
        // Whole-chart → carry the full breakdown, no narrowing filter.
        const openWhole = () => onJumpTo("calcs", { deepDive: {}, chartSpec: spec(null), anchor: "scope-1-2-sources" });
        // Single bar → filter the table to that source, carry chart w/ bar lit.
        const openBar = (r) => onJumpTo("calcs", {
          deepDive: { scope: r.scope, category: r.cat || null },
          chartSpec: spec(r.label),
          anchor: "scope-1-2-sources",
        });
        return (
          <div className="card" style={{marginTop: 20}}>
            <div className="card-head">
              <div>
                <h3 className="card-title">Scope 1 &amp; 2 breakdown by source</h3>
                <div className="card-sub">Q1 2026 · tCO₂e by source category</div>
              </div>
              <button className="deep-dive" title="Open full breakdown in the data table" onClick={openWhole}>
                <Icon name="search" size={14}/><span className="dd-label">Deep dive</span>
              </button>
            </div>
            <div className="s12-chart" style={{marginTop: 16}}>
              <div className="s12-grid">
                {rows.map((r, i) => (
                  <div
                    className="s12-rowwrap"
                    key={i}
                    role="button"
                    tabIndex={0}
                    title={`Deep dive: ${r.label}`}
                    onClick={() => openBar(r)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openBar(r); } }}
                  >
                    <div className="s12-label">{r.label}</div>
                    <div className="s12-track">
                      <div className="s12-ticks" aria-hidden>
                        {ticks.slice(1).map(t => (
                          <span key={t} className="s12-tick-line" style={{left: (t/niceMax*100)+"%"}}/>
                        ))}
                      </div>
                      <div
                        className="s12-fill"
                        style={{width: (r.value/niceMax*100)+"%", background: r.color}}
                      />
                      <div className="s12-val" style={{left: "calc(" + (r.value/niceMax*100) + "% + 8px)"}}>
                        {r.value}
                      </div>
                    </div>
                  </div>
                ))}
                {/* x-axis row */}
                <div className="s12-label" aria-hidden/>
                <div className="s12-axis">
                  {ticks.map(t => (
                    <span key={t} className="s12-axis-tick" style={{left: (t/niceMax*100)+"%"}}>{t}</span>
                  ))}
                </div>
              </div>
              <div className="s12-footer">
                <div className="s12-legend">
                  <span className="s12-leg-item">
                    <span className="s12-leg-dot" style={{background: C1}}/>Scope 1
                  </span>
                  <span className="s12-leg-item">
                    <span className="s12-leg-dot" style={{background: C2}}/>Scope 2
                  </span>
                </div>
                <div className="s12-axis-unit">tCO₂e</div>
              </div>
            </div>
          </div>
        );
      })()}
      </PageSection>
      )}

      <PageSection id="scope-3" label="Scope 3 by category">
      {/* Scope 3 emissions by category — collapsible */}
      {(() => {
        // Sum kg by scope-3 subcategory key. The SCOPE3_CATS key now maps
        // directly to the calc category (purchased_goods, capital_goods,
        // upstream_transport, waste, business_travel).
        const byS3 = {};
        calcs.forEach(c => {
          if (c.scope !== 3 || !c.category) return;
          byS3[c.category] = (byS3[c.category] || 0) + c.kgCO2e;
        });
        const rowsAll = SCOPE3_CATS.map(([num, name, key, intent]) => ({
          num, name, intent: intent || "planned",
          kg: key ? (byS3[key] || 0) : 0,
        }));
        const reportedRows = rowsAll.filter(r => r.kg > 0);
        const plannedRows  = rowsAll.filter(r => r.kg <= 0 && r.intent === "planned");
        const excludedRows = rowsAll.filter(r => r.kg <= 0 && r.intent === "excluded");
        const max = Math.max(...rowsAll.map(r => r.kg), 1);
        const totalS3 = rowsAll.reduce((s, r) => s + r.kg, 0);
        // Carry-over chart spec — the reported Scope 3 categories travel to the
        // data table, with the clicked category highlighted.
        const s3Spec = (highlightName) => ({
          kind: "static-bar",
          variant: "bars",
          tag: "Scope 3 by category",
          title: "Scope 3 emissions by category · tCO₂e",
          unit: "tCO₂e",
          carriedFrom: "Emission overview",
          rows: reportedRows.map(r => ({
            label: `${r.num} · ${r.name}`,
            value: r.kg / 1000,
            display: (r.kg / 1000).toFixed(2),
            color: "var(--fe-accent-primary)",
            highlight: highlightName === r.name,
          })),
        });
        const renderRow = (r) => {
          const calcCat = SCOPE3_CATS.find(x => x[0] === r.num)?.[2] || null;
          const go = () => {
            if (r.kg <= 0) return;
            onJumpTo("calcs", {
              deepDive: calcCat ? { category: calcCat } : { scope: 3 },
              chartSpec: s3Spec(r.name),
              anchor: "scope-3",
            });
          };
          return (
            <div className={"s3-row s3-row-" + r.intent + (r.kg > 0 ? " clickable" : "")} key={r.num} onClick={go} title={r.kg > 0 ? `Deep dive: ${r.name}` : ""}>
              <span className="s3-label"><span className="s3-num">{r.num}</span> {r.name}</span>
              <span className="s3-track">
                {r.kg > 0 ? (
                  <span className="s3-fill" style={{width: (r.kg/max*100)+"%"}}/>
                ) : (
                  <span className={"s3-tag s3-tag-" + r.intent}>
                    {r.intent === "planned" ? "Planned · no data this period" : "Not material · excluded"}
                  </span>
                )}
              </span>
              <span className="s3-val">{r.kg > 0 ? (r.kg/1000).toFixed(2)+" t" : <span className="s3-zero">—</span>}</span>
            </div>
          );
        };
        return (
          <div className="card" style={{marginTop: 20}}>
            <div className="s3-head-wrap">
              <button
                type="button"
                className="s3-head"
                onClick={() => { const n = !s3Open; setS3Open(n); localStorage.setItem("fe-s3-open", n ? "1" : "0"); }}
              >
                <div>
                  <h3 className="card-title">Scope 3 emissions by category</h3>
                  <div className="card-sub">
                    GHG Protocol · {reportedRows.length} reported, {plannedRows.length} planned, {excludedRows.length} excluded · {(totalS3/1000).toFixed(2)} tCO₂e
                  </div>
                </div>
                <span className={"s3-chev " + (s3Open ? "open" : "")} aria-hidden>▾</span>
              </button>
              <button className="deep-dive" title="Open Scope 3 breakdown in the data table" onClick={(e) => { e.stopPropagation(); onJumpTo("calcs", { deepDive: { scope: 3 }, chartSpec: s3Spec(null), anchor: "scope-3" }); }}>
                <Icon name="search" size={14}/><span className="dd-label">Deep dive</span>
              </button>
            </div>
            {s3Open && (
              <div className="s3-rows">
                {reportedRows.length > 0 && (
                  <>
                    <div className="s3-group-label">Reported · {reportedRows.length} categor{reportedRows.length === 1 ? "y" : "ies"} with data this period</div>
                    {reportedRows.map(renderRow)}
                  </>
                )}
                {plannedRows.length > 0 && (
                  <>
                    <div className="s3-group-label s3-group-planned">
                      In scope · awaiting data · {plannedRows.length} categor{plannedRows.length === 1 ? "y" : "ies"}
                    </div>
                    {plannedRows.map(renderRow)}
                  </>
                )}
                {excludedRows.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="s3-empty-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        const n = !showEmptyS3;
                        setShowEmptyS3(n);
                        localStorage.setItem("fe-s3-show-empty", n ? "1" : "0");
                      }}
                    >
                      {showEmptyS3
                        ? `Hide ${excludedRows.length} excluded categories`
                        : `Show ${excludedRows.length} excluded categories — not material for our business`}
                    </button>
                    {showEmptyS3 && excludedRows.map(renderRow)}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}
      </PageSection>
      </>)}

            </PageSections>
    </>
  );
}

// Data quality breakdown block — stacked bar + bucket rows
function DqBucketBlock({ title, subtitle, buckets }) {
  const totalPct = buckets.reduce((s, b) => s + b.pct, 0) || 1;
  return (
    <div className="dq-bb">
      <div className="dq-bb-head">
        <div className="dq-bb-title">{title}</div>
        {subtitle && <div className="dq-bb-sub">{subtitle}</div>}
      </div>
      <div className="dq-stack" role="img" aria-label={`${title} breakdown`}>
        {buckets.map(b => b.pct > 0 && (
          <div key={b.key} className={`dq-stack-seg tone-${b.tone}`}
               style={{flex: b.pct}}
               title={`${b.label}: ${b.n} (${b.pct}%)`}/>
        ))}
      </div>
      <div className="dq-bb-rows">
        {buckets.map(b => (
          <div key={b.key} className="dq-bb-row">
            <span className={`dq-dot tone-${b.tone}`} aria-hidden="true"/>
            <span className="dq-bb-k">{b.label}</span>
            <span className="dq-bb-n">{b.n.toLocaleString()}</span>
            <span className={`dq-bb-pct tone-${b.tone}`}>{b.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Simple horizontal-bar "Top N" card
function TopCard({ title, rows, color, onDeepDive, onRowDeepDive, showRawTooltip }) {
  const max = rows[0]?.pct || 1;
  const totalPct = rows.reduce((s, r) => s + r.pct, 0);
  return (
    <div className="card top-card">
      <div className="card-head" style={{display:"flex", justifyContent:"space-between", alignItems:"baseline"}}>
        <div style={{display:"flex", alignItems:"baseline", gap:10}}>
          <h3 className="card-title" style={{fontSize:14}}>{title}</h3>
          <div
            className="top-total"
            title="Sum of these 5 contributors as a share of this category's total emissions"
          >
            <span className="top-total-n">{Math.round(totalPct*100)}%</span>
            <span className="top-total-d"> share of category total</span>
          </div>
        </div>
        {onDeepDive && (
          <button className="deep-dive" onClick={onDeepDive} title="Deep dive"><Icon name="search" size={14}/><span className="dd-label">Deep dive</span></button>
        )}
      </div>
      <div className="top-rows">
        {rows.map((r, i) => {
          const tip = showRawTooltip && r._raw ? `${r.k} (${r._raw})` : r.k;
          return (
            <div className={"top-row " + (onRowDeepDive ? "clickable" : "")} key={i}
                 onClick={onRowDeepDive ? () => onRowDeepDive(r) : undefined}
                 title={onRowDeepDive ? `Deep dive — ${tip}` : tip}>
              <div className="top-label" title={tip}>{r.k}</div>
              <div className="top-track">
                <div className="top-fill" style={{width: (r.pct/max*100)+"%", background: color}}/>
              </div>
              <div className="top-pct">{Math.round(r.pct*100)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.Overview = Overview;
window.DqBucketBlock = DqBucketBlock;

// --- ActivityFeed --------------------------------------------------------
// Home page's "What's new today" feed: imports in flight, calc queue
// progress, and recent uploads. Activities are mocked but feel live (animated
// progress for in-flight items).
function ActivityFeed({ onJumpTo, calcs = [], entries = [] }) {
  // Animated progress for in-flight items (purely cosmetic — gives the feed
  // a "this is alive" pulse). Persists tick in localStorage so refreshes look
  // continuous rather than resetting.
  const [tick, setTick] = React.useState(() => {
    const t = parseFloat(localStorage.getItem("fe-home-feed-tick"));
    return Number.isFinite(t) ? t : 0;
  });
  React.useEffect(() => {
    const id = setInterval(() => {
      setTick(t => {
        const next = (t + 0.4) % 100;
        localStorage.setItem("fe-home-feed-tick", String(next));
        return next;
      });
    }, 1400);
    return () => clearInterval(id);
  }, []);

  // Active jobs (in flight)
  const importProgress = Math.min(98, 62 + (tick * 0.6) % 30);
  const calcProgress   = Math.min(99, 71 + (tick * 0.4) % 25);

  return (
    <div className="home-feed">
      <div className="home-feed-card">
      <div className="home-feed-eyebrow">
        <span className="home-feed-dot pulse"/>
        <span>Recent update</span>
      </div>
      <button type="button" className="home-feed-job" onClick={() => onJumpTo("data")}>
        <div className="home-feed-job-icon import"><Icon name="upload" size={14}/></div>
        <div className="home-feed-job-body">
          <div className="home-feed-job-title">Imported supplier spend (FY 2024/25)</div>
          <div className="home-feed-job-meta">
            <span>spend_fy2025_anon.csv</span><span>·</span>
            <span>{entries.length.toLocaleString()} rows · 100% processed</span>
          </div>
          <div className="home-feed-progress">
            <div className="home-feed-progress-fill" style={{width: "100%"}}/>
          </div>
        </div>
      </button>

      <button type="button" className="home-feed-job" onClick={() => onJumpTo("data")}>
        <div className="home-feed-job-icon calc"><Icon name="sparkle" size={14}/></div>
        <div className="home-feed-job-body">
          <div className="home-feed-job-title">AI matched emission factors</div>
          <div className="home-feed-job-meta">
            <span>{calcs.length.toLocaleString()} of {calcs.length.toLocaleString()} calculations matched</span><span>·</span>
            <span>100% confirmed</span>
          </div>
          <div className="home-feed-progress">
            <div className="home-feed-progress-fill" style={{width: "100%"}}/>
          </div>
        </div>
      </button>
      </div>
    </div>
  );
}
window.ActivityFeed = ActivityFeed;

// Full-width collapsible heatmap card — rows × months grid
function Heatmap({ title, subtitle, open, onToggle, onDeepDive, rows, cols, accent }) {
  const allKg = rows.flatMap(r => r.cells.map(c => c.kg));
  const max = Math.max(...allKg, 1);
  const colTotals = cols.map((_, ci) => rows.reduce((s, r) => s + (r.cells[ci]?.kg || 0), 0));
  const grand = colTotals.reduce((s, v) => s + v, 0);
  return (
    <div className="card hm-card" style={{marginTop: 20}}>
      <div className="s3-head-wrap">
        <button type="button" className="s3-head" onClick={onToggle}>
          <div>
            <h3 className="card-title">{title}</h3>
            <div className="card-sub">{subtitle} · {(grand/1000).toFixed(2)} tCO₂e</div>
          </div>
          <span className={"s3-chev " + (open ? "open" : "")} aria-hidden>▾</span>
        </button>
        {onDeepDive && (
          <button className="deep-dive" title="Deep dive" onClick={(e) => { e.stopPropagation(); onDeepDive(); }}>
            <Icon name="search" size={14}/><span className="dd-label">Deep dive</span>
          </button>
        )}
      </div>
      {open && (
        <div className="hm-grid" style={{"--hm-cols": cols.length, "--hm-accent": accent}}>
          <div className="hm-corner"/>
          {cols.map((c, i) => (
            <div className="hm-col-h" key={i}>
              <div className="hm-col-label">{c.label}</div>
              <div className="hm-col-total">{(colTotals[i]/1000).toFixed(2)} t</div>
            </div>
          ))}
          {rows.map((r, ri) => {
            const rowTotal = r.cells.reduce((s, c) => s + c.kg, 0);
            return (
              <React.Fragment key={ri}>
                <div className="hm-row-h">
                  <div className="hm-row-label" title={r.label}>{r.label}</div>
                  <div className="hm-row-total">{(rowTotal/1000).toFixed(2)} t</div>
                </div>
                {r.cells.map((c, ci) => {
                  const intensity = c.kg / max;
                  return (
                    <button
                      key={ci}
                      type="button"
                      className={"hm-cell " + (c.kg > 0 ? "filled" : "empty") + (c.onClick && c.kg > 0 ? " clickable" : "")}
                      onClick={c.onClick && c.kg > 0 ? c.onClick : undefined}
                      style={c.kg > 0 ? { "--hm-i": intensity } : undefined}
                      title={c.kg > 0 ? `${(c.kg/1000).toFixed(2)} tCO₂e` : "—"}
                    >
                      <span className="hm-cell-v">
                        {c.kg > 0 ? (c.kg/1000).toFixed(c.kg/1000 < 1 ? 2 : 1) : "—"}
                      </span>
                    </button>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
window.Heatmap = Heatmap;
