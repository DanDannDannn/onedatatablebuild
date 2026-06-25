// Calculation Quality — second Analyse sub-page.
// Data-quality breakdowns and Scope 3 coverage.

function CalculationQuality({ calcs, entries, onJumpTo }) {
  // ---- derive quality stats from real calc data ----
  const total_n = calcs.length || 1;
  const pctOf = (n) => Math.round((n / total_n) * 100);
  const [qbOpen, setQbOpen] = React.useState(() => localStorage.getItem("fe-cq-qb-open") !== "0");
  const [editLayout, setEditLayout] = React.useState(false);
  React.useEffect(() => { localStorage.setItem("fe-cq-qb-open", qbOpen ? "1" : "0"); }, [qbOpen]);

  // EF matching confidence buckets (same logic as Overview)
  const ef_confirmed = calcs.filter(c => c.status === "confirmed").length;
  const ef_high      = calcs.filter(c => c.status === "suggested" && c.confidence >= 0.8).length;
  const ef_medium    = calcs.filter(c => c.status === "suggested" && c.confidence >= 0.6 && c.confidence < 0.8).length;
  const ef_low       = calcs.filter(c => c.status === "suggested" && c.confidence != null && c.confidence < 0.6).length;
  const ef_missing   = calcs.filter(c => c.status === "pending" || (c.status === "suggested" && c.confidence == null)).length;
  const efBuckets = [
    { key:"confirmed", label:"Confirmed",          n: ef_confirmed, pct: pctOf(ef_confirmed), color: "var(--fe-success-500)" },
    { key:"high",      label:"Suggested · high",   n: ef_high,      pct: pctOf(ef_high),      color: "var(--fe-primary-400)" },
    { key:"medium",    label:"Suggested · medium", n: ef_medium,    pct: pctOf(ef_medium),    color: "var(--fe-alert-300)"   },
    { key:"low",       label:"Suggested · low",    n: ef_low,       pct: pctOf(ef_low),       color: "var(--fe-alert-500)"   },
    { key:"missing",   label:"Missing / pending",  n: ef_missing,   pct: pctOf(ef_missing),   color: "var(--fe-error-500)"   },
  ];

  // Calculation method buckets
  const dq_activity = calcs.filter(c => /activity/i.test(c.method || "")).length;
  const dq_distance = calcs.filter(c => /distance/i.test(c.method || "")).length;
  const dq_location = calcs.filter(c => /location/i.test(c.method || "")).length;
  const dq_spend    = calcs.filter(c => /spend/i.test(c.method || "")).length;
  const dqBuckets = [
    { key:"activity", label:"Activity-based", n: dq_activity, pct: pctOf(dq_activity), color: "var(--fe-success-500)" },
    { key:"distance", label:"Distance-based", n: dq_distance, pct: pctOf(dq_distance), color: "var(--fe-primary-400)" },
    { key:"location", label:"Location-based", n: dq_location, pct: pctOf(dq_location), color: "var(--fe-primary-300)" },
    { key:"spend",    label:"Spend-based",    n: dq_spend,    pct: pctOf(dq_spend),    color: "var(--fe-alert-400)"   },
  ];

  // Toned variants for the Data Quality Score breakdown blocks (DqBucketBlock)
  const dq_other = total_n - dq_activity - dq_distance - dq_location - dq_spend;
  const efBucketsToned = [
    { key: "confirmed", label: "Confirmed",          n: ef_confirmed, pct: pctOf(ef_confirmed), tone: "ok" },
    { key: "high",      label: "Suggested · high",   n: ef_high,      pct: pctOf(ef_high),      tone: "high" },
    { key: "medium",    label: "Suggested · medium", n: ef_medium,    pct: pctOf(ef_medium),    tone: "med" },
    { key: "low",       label: "Suggested · low",    n: ef_low,       pct: pctOf(ef_low),       tone: "low" },
    { key: "missing",   label: "Missing / pending",  n: ef_missing,   pct: pctOf(ef_missing),   tone: "miss" },
  ];
  const dqBucketsToned = [
    { key: "activity", label: "Activity-based",     n: dq_activity,            pct: pctOf(dq_activity),            tone: "ok" },
    { key: "distance", label: "Distance-based",     n: dq_distance,            pct: pctOf(dq_distance),            tone: "high" },
    { key: "location", label: "Location-based",     n: dq_location,            pct: pctOf(dq_location),            tone: "high" },
    { key: "spend",    label: "Spend-based",        n: dq_spend,               pct: pctOf(dq_spend),               tone: "med" },
    { key: "other",    label: "Other / unspec.",    n: Math.max(dq_other, 0),  pct: pctOf(Math.max(dq_other, 0)),  tone: "miss" },
  ];

  // Scale stats for Data Quality Score card
  const uniqFactors = new Set(calcs.map(c => c.factor.id || c.factor.name)).size;
  const lineItems = entries.length; // one data entry = one line item
  const matBasedShare = Math.round((calcs.filter(c => c.scope !== 3 || c.factor.source?.includes("DEFRA")).length / (calcs.length||1)) * 100);
  const verifiedShare = Math.round(((ef_confirmed) / total_n) * 100);
  const qualityLabel = verifiedShare > 85 ? "Good" : verifiedShare > 60 ? "Fair" : "Poor";

  // Top metric tiles
  const activityShare = pctOf(dq_activity + dq_distance);
  const primaryDataShare = pctOf(calcs.filter(c => /activity/i.test(c.method) && c.confidence >= 0.85).length);
  const efMatchedShare = pctOf(ef_confirmed + ef_high);
  const lowConfidenceCount = ef_low + ef_missing;

  // Scope 3 category coverage
  const SCOPE3_CATS = [
    { num:"3.1",  name:"Purchased goods & services", key:"purchased_goods" },
    { num:"3.2",  name:"Capital goods",              key:"capital_goods" },
    { num:"3.3",  name:"Fuel & energy (WTT)",        key:null },
    { num:"3.4",  name:"Upstream transport",         key:"upstream_transport" },
    { num:"3.5",  name:"Waste in operations",        key:"waste" },
    { num:"3.6",  name:"Business travel",            key:"business_travel" },
    { num:"3.7",  name:"Employee commuting",         key:null },
    { num:"3.8",  name:"Upstream leased assets",     key:null },
    { num:"3.9",  name:"Downstream transport",       key:null },
    { num:"3.10", name:"Processing of sold products", key:null },
    { num:"3.11", name:"Use of sold products",        key:null },
    { num:"3.12", name:"End-of-life sold products",   key:null },
    { num:"3.13", name:"Downstream leased assets",    key:null },
    { num:"3.14", name:"Franchises",                  key:null },
    { num:"3.15", name:"Investments",                 key:null },
  ];
  // Mark covered categories based on what we actually have data for
  SCOPE3_CATS.forEach(cat => {
    cat.covered = cat.key ? calcs.some(c => c.category === cat.key) : false;
  });
  const coveredCount = SCOPE3_CATS.filter(c => c.covered).length;


  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Calculation quality</h1>
          <div className="page-subtitle">How accurate is your inventory · FY 2024/25</div>
        </div>
        <div className="page-actions">
          <EditLayoutButton active={editLayout} onToggle={() => setEditLayout(v => !v)}/>
          <button className="btn secondary small"><Icon name="calendar" size={16}/>FY 2024/25</button>
        </div>
      </div>

      <PageSections pageKey="quality" editMode={editLayout}>

      <PageSection id="dq-score" label="Data Quality Score">
      {/* Data Quality Score — hero score with collapsible breakdowns */}
      <div className={`dq-card dq-combined ${qbOpen ? "open" : "closed"}`} style={{marginBottom: 24}}>
        <div className="dq-head">
          <div className="dq-title">Data Quality Score</div>
          <span className={`dq-pill ${qualityLabel.toLowerCase()}`}>{qualityLabel}</span>
        </div>
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
        </div>

        {/* Overview metric tiles — always visible, integrated into the card */}
        <div className="dq-tiles">
          <DqTile
            label="EF matching"
            value={efMatchedShare}
            unit="%"
            sub={`${ef_confirmed + ef_high} of ${total_n} calculations confirmed or high-conf.`}
            tone={efMatchedShare > 80 ? "good" : "fair"}
          />
          <DqTile
            label="Activity-based share"
            value={activityShare}
            unit="%"
            sub={`${dq_activity + dq_distance} use activity / distance methods`}
            tone={activityShare > 60 ? "good" : "fair"}
          />
          <DqTile
            label="Primary data share"
            value={primaryDataShare}
            unit="%"
            sub="Supplier-specific factors or measured data"
            tone={primaryDataShare > 50 ? "good" : "poor"}
          />
          <DqTile
            label="Scope 3 coverage"
            value={coveredCount}
            unit=" / 15 cats"
            sub={`${15 - coveredCount} not yet reported`}
            tone={coveredCount > 10 ? "good" : "fair"}
          />
        </div>

        {qbOpen && (
          <div className="dq-breakdown">
            <DqBucketBlock title="Emission factor matching" subtitle={`${total_n} calculations`} buckets={efBucketsToned}/>
            <DqBucketBlock title="Calculation method" subtitle="Higher-quality methods at top" buckets={dqBucketsToned}/>
          </div>
        )}
        <button
          type="button"
          className="dq-detail-toggle"
          onClick={() => setQbOpen(v => !v)}
          aria-expanded={qbOpen}
        >
          {qbOpen ? "Hide breakdown" : "Show breakdown"}
          <span className="dq-detail-chev" aria-hidden="true"><Icon name="chev" size={14}/></span>
        </button>
      </div>
      </PageSection>

      <PageSection id="s3-coverage" label="Scope 3 coverage">
      {/* Scope 3 coverage matrix */}
      <div className="card" id="s3-coverage" style={{marginBottom: 24}}>
        <div className="card-head">
          <div>
            <h3 className="card-title">Scope 3 coverage</h3>
            <div className="card-sub">{coveredCount} of 15 categories reported · the rest need a justification</div>
          </div>
        </div>
        <div className="s3-coverage-grid">
          {SCOPE3_CATS.map(c => (
            <div key={c.num} className={"s3-cat " + (c.covered ? "covered" : "missing")}>
              <div className="s3-num">{c.num}</div>
              <div className="s3-name">{c.name}</div>
              <div className="s3-state">
                {c.covered
                  ? <><Icon name="check" size={12}/>Reported</>
                  : <span>Not yet</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      </PageSection>

      <PageSection id="methodology" label="Methodology documentation">
      {/* Methodology documentation */}
      <div className="card" style={{marginBottom: 32}}>
        <div className="card-head">
          <div>
            <h3 className="card-title">Methodology documentation</h3>
            <div className="card-sub">Required for CSRD / SBTi / GHG Protocol assurance</div>
          </div>
          <button className="btn secondary small"><Icon name="download" size={14}/>Export methodology doc</button>
        </div>
        <div className="methodology-list">
          {[
            { label: "Calculation approach (GHG Protocol)", state: "documented" },
            { label: "Emission factor sources & vintages",  state: "documented" },
            { label: "Organisational boundary",             state: "documented" },
            { label: "Operational boundary (scopes & categories)", state: "partial" },
            { label: "Data quality assessment",             state: "documented" },
            { label: "Materiality assessment",              state: "missing" },
            { label: "Recalculation policy",                state: "missing" },
            { label: "Assumptions & estimations log",       state: "partial" },
          ].map((m, i) => (
            <div key={i} className={"methodology-row " + m.state}>
              <div className="m-state-dot"/>
              <div className="m-label">{m.label}</div>
              <div className="m-state-text">{m.state}</div>
            </div>
          ))}
        </div>
      </div>
      </PageSection>
      </PageSections>
    </>
  );
}

// --- Tile component (reused across analyse pages) ---
function QualityTile({ label, value, unit, sub, tone = "" }) {
  return (
    <div className={"card qt-card qt-" + tone}>
      <div className="qt-label">{label}</div>
      <div className="qt-value">{value}<span className="qt-unit">{unit}</span></div>
      <div className="qt-sub">{sub}</div>
    </div>
  );
}

// Integrated tile used inside the combined Data Quality Score card.
// Sits in a sub-grid (no individual card chrome) and shares its border with siblings.
function DqTile({ label, value, unit, sub, tone = "" }) {
  return (
    <div className={"dq-tile tone-" + tone}>
      <div className="dq-tile-label">{label}</div>
      <div className="dq-tile-value">{value}<span className="dq-tile-unit">{unit}</span></div>
      <div className="dq-tile-sub">{sub}</div>
    </div>
  );
}

// --- Bucket bar block ---
function QualityBucketBlock({ buckets }) {
  const total = buckets.reduce((s,b) => s + b.pct, 0) || 100;
  return (
    <div className="qbb">
      <div className="qbb-stack">
        {buckets.filter(b => b.pct > 0).map(b => (
          <div key={b.key} className="qbb-seg"
            style={{width: (b.pct/total*100) + "%", background: b.color}}
            title={`${b.label}: ${b.n} (${b.pct}%)`}/>
        ))}
      </div>
      <div className="qbb-list">
        {buckets.map(b => (
          <div key={b.key} className="qbb-row">
            <span className="qbb-dot" style={{background: b.color}}/>
            <span className="qbb-label">{b.label}</span>
            <span className="qbb-n">{b.n}</span>
            <span className="qbb-pct">{b.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { CalculationQuality, QualityTile });
