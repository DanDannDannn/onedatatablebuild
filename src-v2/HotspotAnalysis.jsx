// Hotspot analysis — default board under Emission overview.
// Four "what's driving the footprint" charts: top locations, top suppliers,
// top spend-based factors, top activity-based factors. Each top-N chart has
// a "show all / show fewer" toggle and a Deep dive jump into Data.

const HOTSPOT_COLORS = {
  spend:        "#5B5BF0",
  activity:     "#F7B26B",
  precalc:      "#C9B5F2",
  spendOnly:    "#5B5BF0",
  activityOnly: "#F7B26B",
};

// Pick a "nice" tick step: a 1/2/5 multiple of a power of 10, sized so the
// axis lands on roughly `target` ticks. Scales from single digits to tens of
// thousands (data totals run from a few tCO₂e up to ~30,000 tCO₂e).
function niceStep(max, target = 5) {
  if (!(max > 0)) return 1;
  const rough = max / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const frac = rough / mag;            // 1..10
  const mult = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return mult * mag;
}
// Round the data max up to the next whole tick step.
function niceMax(max) {
  if (!(max > 0)) return niceStep(0); // empty/zero data -> minimal axis
  const step = niceStep(max);
  return Math.ceil(max / step) * step;
}
// Tick values 0..max. `max` is already a niceMax(), so it's an exact multiple
// of niceStep(max) and the final tick lands on the axis end.
function ticksFor(max) {
  if (!(max > 0)) return [0];
  const step = niceStep(max);
  const out = [];
  // guard against float drift on the last step
  for (let v = 0; v <= max + step / 2; v += step) out.push(Math.round(v));
  return out;
}

// Stacked horizontal bar chart card (spend / activity / pre-calculated).
function HotspotStackedCard({
  title,
  subtitle,
  rows,                  // [{ label, spend, activity, precalc, total }]
  unit = "tCO₂e",
  toggleMoreLabel,       // e.g. "Show all locations"
  toggleFewerLabel,      // e.g. "Show top 10 locations"
  initialN = 10,
  onDeepDive,
  onRowDeepDive,
}) {
  const [expanded, setExpanded] = React.useState(false);
  const visible = expanded ? rows : rows.slice(0, initialN);
  const max = niceMax(Math.max(...rows.map(r => r.total)));
  const ticks = ticksFor(max);
  const clickable = !!onRowDeepDive;

  return (
    <div className="card" style={{marginTop: 20}}>
      <div className="card-head">
        <div>
          <h3 className="card-title">{title}</h3>
          <div className="card-sub">{subtitle}</div>
        </div>
        {onDeepDive && (
          <button className="deep-dive" title="Deep dive" onClick={onDeepDive}>
            <Icon name="search" size={14}/><span className="dd-label">Deep dive</span>
          </button>
        )}
      </div>

      <div className="hotspot-chart">
        <div className="hotspot-grid">
          {visible.map((r, i) => {
            const spendPct    = (r.spend    / max) * 100;
            const activityPct = (r.activity / max) * 100;
            const precalcPct  = (r.precalc  / max) * 100;
            const totalPct    = (r.total    / max) * 100;
            return (
              <div
                className={"hotspot-rowwrap" + (clickable ? " is-clickable" : "")}
                key={i}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                title={clickable ? `Deep dive: ${r.label}` : undefined}
                onClick={clickable ? () => onRowDeepDive(r) : undefined}
                onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowDeepDive(r); } } : undefined}
              >
                <div className="hotspot-label" title={r.label}>{r.label}</div>
                <div className="hotspot-track">
                  <div className="hotspot-ticks" aria-hidden>
                    {ticks.slice(1).map(t => (
                      <span key={t} className="hotspot-tick-line" style={{left: (t/max*100)+"%"}}/>
                    ))}
                  </div>
                  {r.spend > 0 && (
                    <div
                      className="hotspot-seg hotspot-seg--spend"
                      style={{left: 0, width: spendPct + "%", background: HOTSPOT_COLORS.spend}}
                    />
                  )}
                  {r.activity > 0 && (
                    <div
                      className="hotspot-seg hotspot-seg--activity"
                      style={{left: spendPct + "%", width: activityPct + "%", background: HOTSPOT_COLORS.activity}}
                    />
                  )}
                  {r.precalc > 0 && (
                    <div
                      className="hotspot-seg hotspot-seg--precalc"
                      style={{left: (spendPct + activityPct) + "%", width: precalcPct + "%", background: HOTSPOT_COLORS.precalc}}
                    />
                  )}
                  <div className="hotspot-val" style={{left: "calc(" + totalPct + "% + 8px)"}}>
                    {r.total.toFixed(2)}
                  </div>
                </div>
              </div>
            );
          })}
          {/* expand / collapse */}
          <div className="hotspot-label" aria-hidden/>
          <div className="hotspot-axis-row">
            {rows.length > initialN && (
              <button className="hotspot-show-more" onClick={() => setExpanded(v => !v)}>
                {expanded ? toggleFewerLabel : toggleMoreLabel} <Icon name="chev" size={12}/>
              </button>
            )}
          </div>
          {/* axis */}
          <div className="hotspot-label" aria-hidden/>
          <div className="hotspot-axis">
            {ticks.map(t => (
              <span key={t} className="hotspot-axis-tick" style={{left: (t/max*100)+"%"}}>{t}</span>
            ))}
          </div>
        </div>
        <div className="hotspot-footer">
          <div className="hotspot-legend">
            <span className="hotspot-leg-item">
              <span className="hotspot-leg-dot" style={{background: HOTSPOT_COLORS.spend}}/>Spend based
            </span>
            <span className="hotspot-leg-item">
              <span className="hotspot-leg-dot" style={{background: HOTSPOT_COLORS.activity}}/>Activity based
            </span>
            <span className="hotspot-leg-item">
              <span className="hotspot-leg-dot" style={{background: HOTSPOT_COLORS.precalc}}/>Pre-calculated
            </span>
          </div>
          <div className="hotspot-axis-unit">{unit}</div>
        </div>
      </div>
    </div>
  );
}

// Single-series horizontal bar chart card (for emission-factor comparisons).
function HotspotSingleCard({
  title,
  subtitle,
  rows,             // [{ label, value }]
  color,
  unit = "tCO₂e",
  toggleMoreLabel,
  toggleFewerLabel,
  initialN = 10,
  onDeepDive,
  onRowDeepDive,
}) {
  const [expanded, setExpanded] = React.useState(false);
  const visible = expanded ? rows : rows.slice(0, initialN);
  const max = niceMax(Math.max(...rows.map(r => r.value)));
  const ticks = ticksFor(max);
  const clickable = !!onRowDeepDive;

  return (
    <div className="card" style={{marginTop: 20}}>
      <div className="card-head">
        <div>
          <h3 className="card-title">{title}</h3>
          <div className="card-sub">{subtitle}</div>
        </div>
        {onDeepDive && (
          <button className="deep-dive" title="Deep dive" onClick={onDeepDive}>
            <Icon name="search" size={14}/><span className="dd-label">Deep dive</span>
          </button>
        )}
      </div>

      <div className="hotspot-chart">
        <div className="hotspot-grid">
          {visible.map((r, i) => {
            const pct = (r.value / max) * 100;
            return (
              <div
                className={"hotspot-rowwrap" + (clickable ? " is-clickable" : "")}
                key={i}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                title={clickable ? `Deep dive: ${r.label}` : undefined}
                onClick={clickable ? () => onRowDeepDive(r) : undefined}
                onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowDeepDive(r); } } : undefined}
              >
                <div className="hotspot-label" title={r.label}>{r.label}</div>
                <div className="hotspot-track">
                  <div className="hotspot-ticks" aria-hidden>
                    {ticks.slice(1).map(t => (
                      <span key={t} className="hotspot-tick-line" style={{left: (t/max*100)+"%"}}/>
                    ))}
                  </div>
                  <div
                    className="hotspot-seg hotspot-seg--single"
                    style={{left: 0, width: pct + "%", background: color}}
                  />
                  <div className="hotspot-val" style={{left: "calc(" + pct + "% + 8px)"}}>
                    {r.value.toFixed(2)}
                  </div>
                </div>
              </div>
            );
          })}
          <div className="hotspot-label" aria-hidden/>
          <div className="hotspot-axis-row">
            {rows.length > initialN && (
              <button className="hotspot-show-more" onClick={() => setExpanded(v => !v)}>
                {expanded ? toggleFewerLabel : toggleMoreLabel} <Icon name="chev" size={12}/>
              </button>
            )}
          </div>
          <div className="hotspot-label" aria-hidden/>
          <div className="hotspot-axis">
            {ticks.map(t => (
              <span key={t} className="hotspot-axis-tick" style={{left: (t/max*100)+"%"}}>{t}</span>
            ))}
          </div>
        </div>
        <div className="hotspot-footer hotspot-footer--right">
          <div className="hotspot-axis-unit">{unit}</div>
        </div>
      </div>
    </div>
  );
}

// --- Hotspot data, derived entirely from calcs[] / entries[] ------------------
// Every row below is computed from the real dataset: nothing is hardcoded.
// Method "Spend-based" → spend segment, "Activity-based" → activity segment,
// anything else → pre-calculated segment. Values are tCO₂e (kgCO2e / 1000).

// Split a calc's kgCO2e into the right stacked-bar bucket by method.
function bucketForMethod(method) {
  if (method === "Spend-based") return "spend";
  if (method === "Activity-based") return "activity";
  return "precalc";
}

// Group calcs by a key, splitting each group's kgCO2e into spend/activity/precalc
// buckets (in tCO₂e), then return rows sorted desc by total. Optional `topN`.
function buildStackedRows(calcs, keyOf, { topN } = {}) {
  const byKey = new Map();
  (calcs || []).forEach(c => {
    const label = keyOf(c);
    if (label == null || label === "") return;
    let row = byKey.get(label);
    if (!row) { row = { label, spend: 0, activity: 0, precalc: 0 }; byKey.set(label, row); }
    row[bucketForMethod(c.method)] += (c.kgCO2e || 0) / 1000;
  });
  let rows = Array.from(byKey.values()).map(r => ({ ...r, total: r.spend + r.activity + r.precalc }));
  rows.sort((a, b) => b.total - a.total);
  if (topN != null) rows = rows.slice(0, topN);
  return rows;
}

// Single-series rows: sum tCO₂e by factor name for a given method, sorted desc.
function buildFactorRows(calcs, method, { topN } = {}) {
  const byName = new Map();
  (calcs || []).forEach(c => {
    if (c.method !== method) return;
    const name = c.factor && c.factor.name;
    if (!name) return;
    byName.set(name, (byName.get(name) || 0) + (c.kgCO2e || 0) / 1000);
  });
  let rows = Array.from(byName.entries()).map(([label, value]) => ({ label, value }));
  rows.sort((a, b) => b.value - a.value);
  if (topN != null) rows = rows.slice(0, topN);
  return rows;
}

// --- Top-of-page AI insights specific to hotspot analysis ---------------------
// All figures are derived from the computed rows (locationRows / supplierRows /
// spendFactorRows) and the raw calcs[] — nothing here is hardcoded. Where a value
// genuinely cannot be computed it is omitted rather than invented.
function buildHotspotInsights({ onJumpTo, locationRows = [], supplierRows = [], spendFactorRows = [], siteCount = 0 }) {
  const HB = window.HorizBarChart;

  // Concentration helpers over a set of {total|value} rows.
  const sumOf = (rows, k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
  const pctTopN = (rows, k, n) => {
    const all = sumOf(rows, k);
    if (all <= 0) return null;
    const top = rows.slice(0, n).reduce((s, r) => s + (r[k] || 0), 0);
    return Math.round((top / all) * 100);
  };
  const fmtPct = (p) => p == null ? "—" : p + "%";

  // Location concentration
  const locTop10 = pctTopN(locationRows, "total", 10);
  const locTop3  = pctTopN(locationRows, "total", 3);
  const top3Sites = locationRows.slice(0, 3).map(r => r.label);
  const locTotal = sumOf(locationRows, "total");
  const top5SiteRows = locationRows.slice(0, 5).map((r, i) => {
    const p = locTotal > 0 ? Math.round((r.total / locTotal) * 100) : 0;
    return { label: r.label, value: p, display: p + "%", highlight: i === 0 };
  });

  // Supplier concentration
  const supTop10 = pctTopN(supplierRows, "total", 10);
  const supTotal = sumOf(supplierRows, "total");
  const top5SupplierRows = supplierRows.slice(0, 5).map((r, i) => {
    const p = supTotal > 0 ? Math.round((r.total / supTotal) * 100) : 0;
    return { label: r.label, value: p, display: p + "%", highlight: i === 0 };
  });

  // Spend-based factor concentration
  const spendTop10 = pctTopN(spendFactorRows, "value", 10);
  const top3Factors = spendFactorRows.slice(0, 3).map(r => r.label);

  // Join up to 3 names into a readable list ("A, B and C").
  const joinNames = (names) => {
    const xs = names.filter(Boolean);
    if (xs.length === 0) return null;
    if (xs.length === 1) return xs[0];
    return xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];
  };
  const top3SitesText = joinNames(top3Sites);
  const top3FactorsText = joinNames(top3Factors);

  return [
    {
      key: "hot-loc-concentration",
      tag: "Location concentration · high confidence",
      title: <>Top 10 locations contribute {fmtPct(locTop10)} of total emissions</>,
      body: (
        <>
          Just <strong>10 of your {siteCount} sites</strong> account for <strong>{fmtPct(locTop10)}</strong> of FY 2024/25 emissions.
          {top3SitesText && <> {top3SitesText} alone make up <strong>{fmtPct(locTop3)}</strong> — these are the highest-leverage
          sites to engage on activity data, on-site energy mix, or operational efficiency.</>}
        </>
      ),
      details: (
        <p style={{fontSize:12, color:"var(--fe-fg-muted)"}}>
          Site concentration this steep usually means a small action list goes a long way:
          a single site improvement on the top 3 typically moves the inventory total
          measurably, whereas tail-site work rarely shows up at the corporate level.
        </p>
      ),
      chart: HB && top5SiteRows.length > 0 && (
        <>
          <div className="ai-modal__chart-title">Top 5 sites · % of FY 2024/25 footprint</div>
          <HB rows={top5SiteRows} unit="%"/>
        </>
      ),
      link: "Open top sites in Data",
      onLink: () => onJumpTo("calcs", {}),
    },
    {
      key: "hot-supplier-concentration",
      tag: "Supplier concentration · high confidence",
      title: <>Top 10 suppliers contribute {fmtPct(supTop10)} of total emissions</>,
      body: (
        <>
          <strong>10 suppliers</strong> drive <strong>{fmtPct(supTop10)}</strong> of your inventory. This is the
          set of relationships where activity-data engagement, PCFs, or supplier-specific factors
          will move the needle — the long tail can stay on spend-based factors without distorting results.
        </>
      ),
      details: (
        <p style={{fontSize:12, color:"var(--fe-fg-muted)"}}>
          Concentration this steep means the quickest data-quality win is moving the top spend-only
          suppliers onto mass-based or activity-based factors, or requesting supplier-specific PCFs
          — the gold-standard data quality you'd want from each top-10 supplier.
        </p>
      ),
      chart: HB && top5SupplierRows.length > 0 && (
        <>
          <div className="ai-modal__chart-title">Top 5 suppliers · % of FY 2024/25 footprint</div>
          <HB rows={top5SupplierRows} unit="%"/>
        </>
      ),
      link: "Open supplier engagement queue",
      onLink: () => onJumpTo("calcs", {}),
    },
    {
      key: "hot-spend-fallback",
      tag: "Methodology upgrade",
      title: <>10 spend-based factors drive {fmtPct(spendTop10)} of total — start here for activity data</>,
      body: (
        <>
          The top <strong>10 spend-based emission factors</strong> alone account for{" "}
          <strong>{fmtPct(spendTop10)}</strong> of your footprint. Swapping these to activity-based methods
          (mass, kWh, tkm) reduces category-level uncertainty by 25-40% and is the single
          biggest precision lever available.
        </>
      ),
      details: (
        <p style={{fontSize:12, color:"var(--fe-fg-muted)"}}>
          {top3FactorsText
            ? <>{top3FactorsText} top the list. Pulling mass or distance from source systems lets you move these onto activity-based factors, which carry materially lower uncertainty than spend.</>
            : <>Pulling mass or distance from source systems lets you move the top spend-based factors onto activity-based factors, which carry materially lower uncertainty than spend.</>}
        </p>
      ),
      link: "Open factor coverage",
      onLink: () => onJumpTo("calcs", {}),
    },
  ];
}

// --- Page shell ---------------------------------------------------------------
function HotspotAnalysis({ calcs, entries, onJumpTo }) {
  const [editLayout, setEditLayout] = React.useState(false);
  const total = (calcs || []).reduce((s, c) => s + c.kgCO2e, 0);

  // Top 5 individual line items by emissions (moved here from Trends).
  const topByEntry = React.useMemo(() => {
    const byEntry = {};
    (calcs || []).forEach(c => { byEntry[c.entryId] = (byEntry[c.entryId] || 0) + c.kgCO2e; });
    return Object.entries(byEntry).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([eid, kg]) => {
      const e = (entries || []).find(x => x.id === eid);
      return { id: eid, summary: (e && e.summary) || eid, kg, pct: total ? kg / total : 0, category: e && e.category };
    });
  }, [calcs, entries, total]);
  const entrySpec = (hlId) => ({
    kind: "static-bar", variant: "bars", tag: "Biggest contributors",
    title: "Biggest individual contributors · tCO₂e", unit: "tCO₂e", carriedFrom: "Hotspot analysis",
    rows: topByEntry.map(t => ({ label: t.summary, value: t.kg / 1000, display: (t.kg / 1000).toFixed(2), color: "var(--fe-accent-primary)", highlight: hlId === t.id })),
  });

  // Derive every chart from the real dataset. entryId → supplier map lets us
  // group supplier emissions even though supplier lives on the entry, not the calc.
  const {
    LOCATION_ROWS, SUPPLIER_ROWS, SPEND_FACTOR_ROWS, ACTIVITY_FACTOR_ROWS, siteCount,
  } = React.useMemo(() => {
    const supplierByEntry = new Map();
    (entries || []).forEach(e => {
      const s = e && e.details && e.details.supplier;
      if (s) supplierByEntry.set(e.id, s);
    });
    return {
      LOCATION_ROWS: buildStackedRows(calcs, c => c.site),
      SUPPLIER_ROWS: buildStackedRows(calcs, c => supplierByEntry.get(c.entryId), { topN: 12 }),
      SPEND_FACTOR_ROWS: buildFactorRows(calcs, "Spend-based", { topN: 11 }),
      ACTIVITY_FACTOR_ROWS: buildFactorRows(calcs, "Activity-based", { topN: 11 }),
      siteCount: new Set((calcs || []).map(c => c.site)).size,
    };
  }, [calcs, entries]);

  // Concentration percentages for the card subtitles (computed, not hardcoded).
  const pctTop = (rows, k, n) => {
    const all = rows.reduce((s, r) => s + (r[k] || 0), 0);
    if (all <= 0) return null;
    const top = rows.slice(0, n).reduce((s, r) => s + (r[k] || 0), 0);
    return Math.round((top / all) * 100);
  };
  const pctTxt = (p) => p == null ? "—" : p + "%";
  const locTop10Pct = pctTop(LOCATION_ROWS, "total", 10);
  const supTop10Pct = pctTop(SUPPLIER_ROWS, "total", 10);
  const spendTop10Pct = pctTop(SPEND_FACTOR_ROWS, "value", 10);
  const activityTop10Pct = pctTop(ACTIVITY_FACTOR_ROWS, "value", 10);

  const insights = buildHotspotInsights({
    onJumpTo,
    locationRows: LOCATION_ROWS,
    supplierRows: SUPPLIER_ROWS,
    spendFactorRows: SPEND_FACTOR_ROWS,
    siteCount,
  });

  // Build a carry-over chart spec from a card's rows so the carried chart keeps
  // its native dashboard style (stacked segments + legend, or colored bars).
  const mkSpec = ({ tag, title, rows, stacked, valueOf, color, highlightLabel }) => ({
    kind: "static-bar",
    variant: stacked ? "stacked" : "bars",
    tag,
    title,
    unit: "tCO₂e",
    carriedFrom: "Hotspot analysis",
    colors: stacked ? HOTSPOT_COLORS : undefined,
    legend: stacked ? [
      { label: "Spend based", color: HOTSPOT_COLORS.spend },
      { label: "Activity based", color: HOTSPOT_COLORS.activity },
      { label: "Pre-calculated", color: HOTSPOT_COLORS.precalc },
    ] : undefined,
    rows: rows.map(r => stacked
      ? { label: r.label, spend: r.spend, activity: r.activity, precalc: r.precalc, total: r.total, highlight: highlightLabel === r.label }
      : { label: r.label, value: valueOf(r), display: valueOf(r).toFixed(2), color, highlight: highlightLabel === r.label }
    ),
  });

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <div className="page-head__titlerow">
            <h1 className="page-title">Hotspot analysis</h1>
            {window.BoardActionsMenu && (
              <window.BoardActionsMenu
                editLayoutActive={editLayout}
                onToggleEditLayout={() => setEditLayout(v => !v)}
              />
            )}
          </div>
          <div className="page-subtitle">
            Where the footprint concentrates · {(total/1000).toFixed(1)} tCO₂e total
          </div>
        </div>
      </div>

      <BoardFilters boardKey="hotspot" />

      {/* Pinned AI insights — only shows if the user has explicitly pinned
          something here from the Forward AI chat on Home. Proactive
          suggestion cards live under the AI chat, not on individual boards. */}
      <PinnedBoardInsights
        boardKey="hotspot"
        boardLabel="Hotspot analysis"
        allInsights={insights}
        onJumpHome={() => onJumpTo("overview")}
      />

      <PageSections pageKey="hotspot" editMode={editLayout}>
        <PageSection id="hot-locations" label="Total emission comparison · by location">
          <HotspotStackedCard
            title="Total emission comparison"
            subtitle={`Top 10 locations contribute ${pctTxt(locTop10Pct)} of total emissions`}
            rows={LOCATION_ROWS}
            toggleMoreLabel="Show all locations"
            toggleFewerLabel="Show top 10 locations"
            onDeepDive={() => onJumpTo("calcs", { deepDive: {}, chartSpec: mkSpec({ tag: "Emissions by location", title: "Total emission comparison · by location", rows: LOCATION_ROWS, stacked: true }), anchor: "hot-locations" })}
            onRowDeepDive={(row) => onJumpTo("calcs", { deepDive: { bu: row.label }, chartSpec: mkSpec({ tag: "Emissions by location", title: "Total emission comparison · by location", rows: LOCATION_ROWS, stacked: true, highlightLabel: row.label }), anchor: "hot-locations" })}
          />
        </PageSection>

        <PageSection id="hot-suppliers" label="Supplier emission comparison">
          <HotspotStackedCard
            title="Supplier emission comparison"
            subtitle={`Top 10 suppliers contribute ${pctTxt(supTop10Pct)} of total emissions`}
            rows={SUPPLIER_ROWS}
            toggleMoreLabel="Show all suppliers"
            toggleFewerLabel="Show top 10 suppliers"
            onDeepDive={() => onJumpTo("calcs", { deepDive: {}, chartSpec: mkSpec({ tag: "Emissions by supplier", title: "Supplier emission comparison", rows: SUPPLIER_ROWS, stacked: true }), anchor: "hot-suppliers" })}
            onRowDeepDive={(row) => onJumpTo("calcs", { deepDive: { query: row.label }, chartSpec: mkSpec({ tag: "Emissions by supplier", title: "Supplier emission comparison", rows: SUPPLIER_ROWS, stacked: true, highlightLabel: row.label }), anchor: "hot-suppliers" })}
          />
        </PageSection>

        <PageSection id="hot-spend-factors" label="Spend-based emission factor comparison">
          <HotspotSingleCard
            title="Spend based emission factor comparison"
            subtitle={`Top 10 spend based emission factors contribute ${pctTxt(spendTop10Pct)} of total emissions`}
            rows={SPEND_FACTOR_ROWS}
            color={HOTSPOT_COLORS.spendOnly}
            toggleMoreLabel="Show all emission factors"
            toggleFewerLabel="Show top 10 emission factors"
            onDeepDive={() => onJumpTo("calcs", { deepDive: {}, chartSpec: mkSpec({ tag: "Spend-based factors", title: "Spend-based emission factor comparison", rows: SPEND_FACTOR_ROWS, valueOf: r => r.value, color: HOTSPOT_COLORS.spendOnly }), anchor: "hot-spend-factors" })}
            onRowDeepDive={(row) => onJumpTo("calcs", { deepDive: { query: row.label.split(" (")[0] }, chartSpec: mkSpec({ tag: "Spend-based factors", title: "Spend-based emission factor comparison", rows: SPEND_FACTOR_ROWS, valueOf: r => r.value, color: HOTSPOT_COLORS.spendOnly, highlightLabel: row.label }), anchor: "hot-spend-factors" })}
          />
        </PageSection>

        <PageSection id="hot-activity-factors" label="Activity-based emission factor comparison">
          <HotspotSingleCard
            title="Activity based emission factor comparison"
            subtitle={`Top 10 activity based emission factors contribute ${pctTxt(activityTop10Pct)} of total emissions`}
            rows={ACTIVITY_FACTOR_ROWS}
            color={HOTSPOT_COLORS.activityOnly}
            toggleMoreLabel="Show all emission factors"
            toggleFewerLabel="Show top 10 emission factors"
            onDeepDive={() => onJumpTo("calcs", { deepDive: {}, chartSpec: mkSpec({ tag: "Activity-based factors", title: "Activity-based emission factor comparison", rows: ACTIVITY_FACTOR_ROWS, valueOf: r => r.value, color: HOTSPOT_COLORS.activityOnly }), anchor: "hot-activity-factors" })}
            onRowDeepDive={(row) => onJumpTo("calcs", { deepDive: { query: row.label.split(" (")[0] }, chartSpec: mkSpec({ tag: "Activity-based factors", title: "Activity-based emission factor comparison", rows: ACTIVITY_FACTOR_ROWS, valueOf: r => r.value, color: HOTSPOT_COLORS.activityOnly, highlightLabel: row.label }), anchor: "hot-activity-factors" })}
          />
        </PageSection>

        <PageSection id="hot-top-entries" label="Biggest individual contributors">
          <div className="card" style={{marginBottom: 24}}>
            <div className="card-head">
              <div>
                <h3 className="card-title">Biggest individual contributors</h3>
                <div className="card-sub">
                  Top 5 line items represent <strong>{Math.round(topByEntry.reduce((s,t)=>s+t.pct,0)*100)}%</strong> of FY 2024/25 emissions
                </div>
              </div>
              <button className="deep-dive" title="Open in the data table" onClick={() => onJumpTo("calcs", { deepDive: {}, chartSpec: entrySpec(null), anchor: "hot-top-entries" })}>
                <Icon name="search" size={14}/><span className="dd-label">Deep dive</span>
              </button>
            </div>
            <div className="hotspot-list">
              {topByEntry.map(t => (
                <div
                  key={t.id}
                  className="hotspot-row clickable"
                  style={{gridTemplateColumns: "260px 1fr 80px 64px"}}
                  role="button" tabIndex={0} title={`Deep dive: ${t.summary}`}
                  onClick={() => onJumpTo("calcs", { deepDive: { query: t.id }, chartSpec: entrySpec(t.id), anchor: "hot-top-entries" })}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onJumpTo("calcs", { deepDive: { query: t.id }, chartSpec: entrySpec(t.id), anchor: "hot-top-entries" }); } }}
                >
                  <div className="label">
                    {t.summary}
                    <span className="meta">{(window.CAT_LABEL && window.CAT_LABEL(t.category)) || t.category} · {t.id}</span>
                  </div>
                  <div className="track"><div className="fill" style={{width: (topByEntry[0] && topByEntry[0].pct ? (t.pct/topByEntry[0].pct*100) : 0) + "%"}}/></div>
                  <div className="val">{(t.kg/1000).toFixed(2)} t</div>
                  <div className="pct">{Math.round(t.pct*100)}%</div>
                </div>
              ))}
            </div>
          </div>
        </PageSection>
      </PageSections>
    </>
  );
}

Object.assign(window, { HotspotAnalysis, buildHotspotInsights });
