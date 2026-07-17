// Small shared components

// Reporting period options used by the global Period filter on Data pages.
// Each option has a key, label, and a [start, end] ISO-date window. The
// dataset is synthetic Q1 2026, so options below center on that window.
const PERIOD_OPTIONS = [
  { k: "fy_2024_25", l: "FY 2024/25",  range: ["2024-10-01", "2025-09-30"] },
  { k: "q1_2026", l: "Q1 2026",       range: ["2026-01-01", "2026-03-31"] },
  { k: "q4_2025", l: "Q4 2025",       range: ["2025-10-01", "2025-12-31"] },
  { k: "h1_2026", l: "H1 2026",       range: ["2026-01-01", "2026-06-30"] },
  { k: "fy_2026", l: "FY 2026",       range: ["2026-01-01", "2026-12-31"] },
  { k: "fy_2025", l: "FY 2025",       range: ["2025-01-01", "2025-12-31"] },
  { k: "ytd",     l: "Year to date",  range: ["2026-01-01", "2026-12-31"] },
  { k: "all",     l: "All time",      range: null },
];

// Returns true if the entry/calc's start_date or end_date overlaps the period.
// An entry overlaps the window if it isn't entirely before or entirely after it.
function inPeriod(row, periodKey) {
  if (!periodKey || periodKey === "all") return true;
  const opt = PERIOD_OPTIONS.find(o => o.k === periodKey);
  if (!opt || !opt.range) return true;
  const [from, to] = opt.range;
  const s = row.start_date || row.end_date;
  const e = row.end_date   || row.start_date;
  if (!s && !e) return true;
  // overlap test: !(end < from || start > to)
  if (e && e < from) return false;
  if (s && s > to)   return false;
  return true;
}

function ScopeBadge({ scope, compact }) {
  return <span className={`scope-badge scope-${scope}`}><span className="dot"></span>{compact ? scope : `Scope ${scope}`}</span>;
}

// Calculation lifecycle: pending → suggested → confirmed
// Entry lifecycle: draft → ready → processing → calculated (or failed)
const STATUS_LABELS = {
  // Calculations
  pending:    "Pending",
  suggested:  "Suggested",
  confirmed:  "Confirmed",
  // Entries — merged lifecycle (precedence: failed > processing > draft > ready > approved)
  draft:      "Draft",
  ready:      "Ready to submit",
  processing: "Processing",
  approved:   "Approved",
  calculated: "Calculated",
  failed:     "Calculation failed",
};
const STATUS_ICONS = {
  pending:    "clock",
  suggested:  "sparkle",
  confirmed:  "check",
  draft:      "pencil",
  ready:      "arrowUp",
  processing: "clock",
  approved:   "check",
  calculated: "check",
  failed:     "warn",
};

// ── V2: two independent lifecycle columns ───────────────────────────────────
// Data entry (the record's human workflow): Draft → Ready to submit →
//   Submitted, with Failed for calculation failures (precedence: failed first).
// Calculation (the engine outcome): no calculation → processing →
//   review pending → confirmed.
Object.assign(STATUS_LABELS, {
  de_draft: "Draft", de_ready: "Ready to submit", de_submitted: "Submitted", de_failed: "Failed",
  cs_none: "No calculation", cs_processing: "Processing",
  cs_sug_high: "Suggested · high confidence", cs_sug_low: "Suggested · low confidence", cs_confirmed: "Confirmed",
});
Object.assign(STATUS_ICONS, {
  de_draft: "pencil", de_ready: "arrowUp", de_submitted: "check", de_failed: "warn",
  cs_none: null, cs_processing: "clock",
  cs_sug_high: "sparkle", cs_sug_low: "sparkle", cs_confirmed: "check",
});
function entryWorkflow(e, mine) {
  if (e.entry_status === "failed" || (mine || []).some(c => c.status === "failed")) return "de_failed";
  if (e.entry_status === "draft") return "de_draft";
  if (e.entry_status === "ready" || !mine || mine.length === 0) return "de_ready";
  return "de_submitted"; // submitted — calcs may still be processing / under review
}
// Two shapes of multi-calc entry:
//  · "additive"    — one activity split into parts (gas, commute, materials…);
//                    the entry total is the SUM of its calculations.
//  · "alternative" — the same activity estimated by mutually-exclusive methods
//                    (e.g. electricity location-based vs market-based); the calcs
//                    are A-or-B, so there is NO meaningful sum (total shows "—").
function calcsAreAlternative(entry, mine) {
  if (entry && entry.calc_relation === "alternative") return true;
  const ms = (mine || []).map(c => String((c && (c.scope2_method || c.method)) || "").toLowerCase());
  return ms.some(m => m.includes("location")) && ms.some(m => m.includes("market"));
}
// Entry-level total in kgCO₂e — the sum for additive entries, or null when the
// calculations are mutually-exclusive alternatives (caller renders "—").
function entryTotalKg(entry, mine) {
  if (!mine || mine.length === 0) return 0;
  if (calcsAreAlternative(entry, mine)) return null;
  return mine.reduce((s, c) => s + c.kgCO2e, 0);
}
// CONF_THRESHOLD: a suggested calc at/above this AI confidence is "high".
const CONF_THRESHOLD = 0.8;
function calcWorkflow(e, mine) {
  if (!mine || mine.length === 0) return "cs_none";
  if (e.entry_status === "failed" || mine.some(c => c.status === "pending")) return "cs_processing";
  const suggested = mine.filter(c => c.status === "suggested");
  if (suggested.length) {
    // Roll up to the weakest suggestion: any low-confidence match flags the
    // whole entry as low confidence (needs a closer look).
    const anyLow = suggested.some(c => c.confidence == null || c.confidence < CONF_THRESHOLD);
    return anyLow ? "cs_sug_low" : "cs_sug_high";
  }
  return "cs_confirmed";
}
function StatusChip({ status }) {
  return (
    <span className={`status-chip st-${status}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function Confidence({ value, showLabel = true, inline = true }) {
  const pct = Math.round(value * 100);
  const level = value < 0.6 ? "low" : value < 0.8 ? "med" : "";
  if (inline) {
    return (
      <span className={`conf-inline ${level}`}>
        {showLabel && <span>{pct}%</span>}
        <span className="m"><div style={{width: pct + "%"}} /></span>
      </span>
    );
  }
  return (
    <div className="ai-bar-track"><div className={`ai-bar-fill ${level}`} style={{width: pct + "%"}} /></div>
  );
}

function fmtKg(kg) {
  if (kg == null) return "—";
  if (kg >= 1000) return (kg/1000).toFixed(2) + " t";
  if (kg >= 100)  return kg.toFixed(0);
  if (kg >= 10)   return kg.toFixed(1);
  return kg.toFixed(2);
}
function fmtKgSmart(kg) {
  if (kg == null) return "—";
  return kg.toLocaleString(undefined, {maximumFractionDigits: kg < 10 ? 2 : kg < 100 ? 1 : 0});
}

function CatLabel({ cat }) {
  const m = {
    electricity: "Electricity",
    natural_gas: "Natural gas",
    diesel: "Diesel (fleet)",
    flight: "Business flight",
    purchased_goods: "Purchased goods & services",
    capital_goods: "Capital goods",
    upstream_transport: "Upstream transport",
    waste: "Waste in operations",
    business_travel: "Business travel",
  };
  return <span>{m[cat] || cat}</span>;
}

// Tri-state checkbox used in table header
function HeaderCheckbox({ checked, indeterminate, onChange }) {
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return <input ref={ref} type="checkbox" className="fe-cb" checked={!!checked} onChange={onChange}/>;
}

// Contextual toolbar shown when rows are selected
function BulkToolbar({ count, onClear, onStatus, onAssign, onCategory, onDelete, onExport, kind="entries" }) {
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [assignOpen, setAssignOpen] = React.useState(false);

  const STATUSES = kind === "calcs"
    ? [["confirmed","Confirm"], ["suggested","Send for review"], ["pending","Re-queue for AI match"]]
    : [["ready","Mark ready"], ["processing","Resubmit for calculation"], ["failed","Mark failed"]];

  return (
    <div className="bulk-toolbar" role="toolbar" aria-label="Bulk actions">
      <span className="count"><span className="n">{count}</span> selected</span>
      <span className="divider"/>

      <div className="popover-wrap">
        <button onClick={() => { setStatusOpen(v => !v); setAssignOpen(false); }}>
          <Icon name="check" size={16}/>Change status<Icon name="arrowDown" size={14}/>
        </button>
        {statusOpen && (
          <>
            <div style={{position:"fixed", inset:0, zIndex:30}} onClick={() => setStatusOpen(false)}/>
            <div className="popover">
              <div className="p-head">Set status for {count} rows</div>
              {STATUSES.map(([k, label]) => (
                <div key={k} className="p-item" onClick={() => { onStatus?.(k); setStatusOpen(false); }}>
                  <Icon name="check" size={14} style={{color:"var(--fe-fg-muted)"}}/>{label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="popover-wrap">
        <button onClick={() => { setAssignOpen(v => !v); setStatusOpen(false); }}>
          <Icon name="users" size={16}/>Reassign<Icon name="arrowDown" size={14}/>
        </button>
        {assignOpen && (
          <>
            <div style={{position:"fixed", inset:0, zIndex:30}} onClick={() => setAssignOpen(false)}/>
            <div className="popover">
              <div className="p-head">Assign {count} rows to</div>
              {(window.USERS || []).map(u => (
                <div key={u} className="p-item" onClick={() => { onAssign?.(u); setAssignOpen(false); }}>
                  <Icon name="users" size={14} style={{color:"var(--fe-fg-muted)"}}/>{u}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {onCategory && (
        <button onClick={onCategory}><Icon name="filter" size={16}/>Edit category</button>
      )}
      <button onClick={onExport}><Icon name="arrowDown" size={16}/>Export</button>
      <span className="divider"/>
      <button className="danger" onClick={onDelete}><Icon name="close" size={16}/>Delete</button>

      <button className="clear" onClick={onClear} title="Clear selection" aria-label="Clear selection"><Icon name="close" size={16}/></button>
    </div>
  );
}

// FilterPill — Notion-style filter chip.
// `value` controls the visual: when set, pill renders as the active blue style with key·value
// and a chevron (clicking opens a popover to change value), and a hover ✕ to remove.
// When unset, pill renders as a neutral "+ <label>" trigger that opens the same popover.
//
// Props:
//   icon          Icon name to show inside the pill (e.g. "filter", "users")
//   label         Facet label (e.g. "Scope", "Business unit")
//   value         Current value or null/"" when not applied
//   options       [{k, l}] list of choices for the popover
//   onChange(k)   Called with chosen key when user picks an option
//   onClear()     Called when user clicks the hover ✕
//   triggerLabel  Optional label for the inactive trigger (defaults to label)
//   renderValue   Optional fn(value, options) → ReactNode for custom display
function FilterPill({ icon = "filter", label, value, options, onChange, onClear, triggerLabel, renderValue }) {
  const [open, setOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const isActive = value !== null && value !== undefined && value !== "" && value !== "all";
  const opt = options?.find(o => String(o.k) === String(value));
  const display = isActive
    ? (renderValue ? renderValue(value, options) : (opt?.l || String(value)))
    : null;

  return (
    <span className="fp-wrap">
      <span
        className={`fp ${isActive ? "active" : "trigger"}`}
        onClick={() => setOpen(v => !v)}
      >
        {isActive ? (
          <>
            <Icon name={icon} size={12} className="fp-ic"/>
            <span className="fp-key">{label}</span>
            <span className="fp-val">{display}</span>
            <Icon name="chev" size={10} className="fp-chev"/>
            <button className="fp-x" aria-label="Remove filter"
                    onClick={(e) => { e.stopPropagation(); setOpen(false); onClear?.(); }}>
              ✕
            </button>
          </>
        ) : (
          <>
            <Icon name={icon} size={13} className="fp-ic"/>
            <span className="fp-trigger-label">{triggerLabel || label}</span>
            <Icon name="chev" size={10} className="fp-chev"/>
          </>
        )}
      </span>
      {open && (
        <>
          <div style={{position:"fixed", inset:0, zIndex:25}} onClick={() => { setOpen(false); setMenuOpen(false); }}/>
          <div className="popover fp-pop">
            {/* Header: "<Field> is" with overflow menu */}
            <div className="fp-pop-head">
              <span className="fp-pop-field">{label}</span>
              <span className="fp-pop-op">
                is <Icon name="chev" size={10}/>
              </span>
              <span className="fp-pop-spacer"/>
              <button className="fp-pop-more" aria-label="More"
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}>
                <span className="fp-pop-dots">⋯</span>
              </button>
              {menuOpen && (
                <div className="fp-pop-menu" onClick={(e) => e.stopPropagation()}>
                  <div className="fp-pop-menu-item danger"
                       onClick={() => { setMenuOpen(false); setOpen(false); onClear?.(); }}>
                    <Icon name="trash" size={13}/>Delete filter
                  </div>
                </div>
              )}
            </div>

            {/* Options list */}
            <div className="fp-pop-list">
              {options?.map(o => {
                const selected = String(o.k) === String(value);
                return (
                  <div key={o.k}
                       className={`fp-pop-row ${selected ? "selected" : ""}`}
                       onClick={() => { onChange?.(o.k); setOpen(false); }}>
                    <span className={`fp-pop-check-box ${selected ? "on" : ""}`}>
                      {selected && <Icon name="check" size={11}/>}
                    </span>
                    <span className="fp-pop-row-label">{o.l}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </span>
  );
}

// AddFilterButton — "+ Filter" trigger that opens a menu of available facets.
// `facets` is [{k, label, icon}] of facets that aren't currently applied.
function AddFilterButton({ facets, onAdd }) {
  const [open, setOpen] = React.useState(false);
  if (!facets || facets.length === 0) return null;
  return (
    <span className="fp-wrap">
      <span className="fp add-filter" onClick={() => setOpen(v => !v)}>
        <span style={{fontWeight: 500, fontSize: 13, color: "var(--fe-fg-muted)"}}>+ Filter</span>
      </span>
      {open && (
        <>
          <div style={{position:"fixed", inset:0, zIndex:25}} onClick={() => setOpen(false)}/>
          <div className="popover fp-pop">
            <div className="p-head">Add filter</div>
            {facets.map(f => (
              <div key={f.k} className="p-item" onClick={() => { onAdd?.(f.k); setOpen(false); }}>
                <Icon name={f.icon || "filter"} size={13} style={{color:"var(--fe-fg-muted)"}}/>
                <span className="fp-pop-label">{f.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </span>
  );
}

// Pagination — count summary + page buttons. Mirrors the product's table footer.
// `total` is the full filtered row count; the parent slices its rows by page.
function Pagination({ page, pageSize, total, onPage }) {
  if (!total) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(Math.max(1, page), totalPages);
  const start = (cur - 1) * pageSize + 1;
  const end = Math.min(cur * pageSize, total);
  const pages = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (cur <= 4)                return [1, 2, 3, 4, 5, "…", totalPages];
    if (cur >= totalPages - 3)   return [1, "…", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "…", cur - 1, cur, cur + 1, "…", totalPages];
  })();
  return (
    <div className="pagination">
      <span className="pagination__count">
        {start.toLocaleString()}—{end.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="pagination__nav">
        <button className="pagination__arrow" disabled={cur <= 1} onClick={() => onPage(cur - 1)} aria-label="Previous page">
          <Icon name="chevLeft" size={16}/>
        </button>
        {pages.map((p, i) => p === "…"
          ? <span key={"dots" + i} className="pagination__dots">…</span>
          : <button key={p} className={`pagination__page ${p === cur ? "active" : ""}`} onClick={() => onPage(p)} aria-current={p === cur ? "page" : undefined}>{p}</button>
        )}
        <button className="pagination__arrow" disabled={cur >= totalPages} onClick={() => onPage(cur + 1)} aria-label="Next page">
          <Icon name="chevRight" size={16}/>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { ScopeBadge, StatusChip, Confidence, STATUS_LABELS, entryWorkflow, calcWorkflow, calcsAreAlternative, entryTotalKg, fmtKg, fmtKgSmart, CatLabel, HeaderCheckbox, BulkToolbar, FilterPill, AddFilterButton, Pagination, PERIOD_OPTIONS, inPeriod });
