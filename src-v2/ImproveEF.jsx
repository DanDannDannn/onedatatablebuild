// Improve EF · synthetic PCF — SCCF-side mock, product-style.
//
// Two sidebar pages, one per whiteboard option (no exploration chrome — the
// page looks and behaves like the product's Data surface):
//   Option 1 (#improve-ef-1) — low EF match signalled via the data-entry
//     STATUS chip; the "Improve emission factor" CTA lives only inside the
//     entry-detail modal.
//   Option 2 (#improve-ef-2) — a new "EF confidence" COLUMN carries the
//     signal (inserted after the EF name); the CTA appears inline on the
//     table row on hover, in a right-frozen cell.
// The grid mirrors the Data page's default entry-orientation columns
// (DataGridModel ENTRY_VISIBLE order) and scrolls horizontally like it.
// Shared behaviour: CTA → AI wizard hand-off dialog → entry status
// "Improving EF…", the Calculation section on the detail modal is replaced by
// a progress panel → after a few seconds the improved synthetic EF lands:
// special name + "Synthetic EF" flag, status back, confidence high again.

const IEF_IMPROVE_MS = 6000; // simulated AI processing time

// Compact row spec:
// [desc, supplier, bu, consV, consU, ef, src, year, basis, conf, co2t, s3, act, user, input, imp, files]
const IEF_BASE = [
  ["Stainless steel fasteners — Q1 replenishment", "Meridian Components GmbH", "Operations DE", "48,200", "EUR", "Fabricated metal products, EU average", "EXIOBASE", "2019", "spend-based", 0.42, "27.96", "3.1 Purchased goods and services", "Purchased goods & services", "Johannes Weber", "Bulk import", "IMP-2026-014", 1],
  ["Injection-moulded housings, ABS", "Polyform S.r.l.", "Operations IT", "31,900", "EUR", "Plastic products, EU average", "EXIOBASE", "2019", "spend-based", 0.61, "11.05", "3.1 Purchased goods and services", "Purchased goods & services", "Marta Ruiz", "Bulk import", "IMP-2026-014", 0],
  ["Corrugated packaging, recycled", "PackNord AB", "Operations SE", "12,400", "kg", "Corrugated board, 70% recycled", "ecoinvent", "2024", "activity-based", 0.93, "8.12", "3.1 Purchased goods and services", "Purchased goods & services", "Anna Keller", "Bulk import", "IMP-2026-014", 2],
  ["Road freight, inbound EU", "TransCargo GmbH", "Logistics", "184,000", "t·km", "Lorry 16–32t, EURO 6", "GLEC", "2025", "activity-based", 0.88, "19.70", "3.4 Upstream transportation and distribution", "Upstream transport", "Tom Berger", "Bulk import", "IMP-2026-011", 1],
  ["Aluminium extrusions, 6060", "Nordal Extrusion AS", "Operations NO", "9,850", "kg", "Aluminium extrusion, EU mix", "ecoinvent", "2024", "activity-based", 0.95, "63.40", "3.1 Purchased goods and services", "Purchased goods & services", "Johannes Weber", "Bulk import", "IMP-2026-014", 1],
  ["Steel sheet, hot-rolled", "Voss Stahl GmbH", "Operations DE", "28,300", "kg", "Steel hot-rolled coil, EU", "worldsteel", "2024", "activity-based", 0.96, "71.60", "3.1 Purchased goods and services", "Purchased goods & services", "Anna Keller", "Bulk import", "IMP-2026-014", 2],
  ["IT hardware — laptop refresh", "TechSource BV", "Shared services", "86,500", "EUR", "Computers and peripherals, EU average", "EXIOBASE", "2019", "spend-based", 0.77, "21.63", "3.2 Capital goods", "Capital goods", "Tom Berger", "Manual entry", "—", 1],
  ["Business flights, Q1", "Concur travel export", "Sales", "412,000", "pax·km", "Air travel, short-haul economy", "DEFRA", "2025", "activity-based", 0.94, "63.50", "3.6 Business travel", "Business travel", "Marta Ruiz", "Bulk import", "IMP-2026-009", 0],
  ["Waste to landfill, mixed", "EnviroServ GmbH", "Operations DE", "8,900", "kg", "Municipal waste to landfill", "DEFRA", "2025", "activity-based", 0.92, "4.10", "3.5 Waste generated in operations", "Waste in operations", "Johannes Weber", "Manual entry", "—", 1],
  ["Electronic components, PCBs", "Shenzhen ElecParts Ltd", "Operations DE", "54,700", "EUR", "Electronic components, global average", "EXIOBASE", "2019", "spend-based", 0.64, "16.40", "3.1 Purchased goods and services", "Purchased goods & services", "Anna Keller", "Bulk import", "IMP-2026-014", 0],
  ["Wooden pallets, softwood", "PalletPoint OY", "Logistics", "6,300", "kg", "Sawnwood, softwood, kiln-dried", "ecoinvent", "2024", "activity-based", 0.90, "3.10", "3.1 Purchased goods and services", "Purchased goods & services", "Tom Berger", "Bulk import", "IMP-2026-011", 0],
  ["Solvent-based coatings", "ChemCoat S.p.A.", "Operations IT", "3,850", "kg", "Paint, solvent-borne", "ecoinvent", "2024", "activity-based", 0.87, "9.60", "3.1 Purchased goods and services", "Purchased goods & services", "Marta Ruiz", "Bulk import", "IMP-2026-014", 2],
  ["Copper wire, 2.5mm", "CuproTech GmbH", "Operations DE", "4,120", "kg", "Copper wire, EU mix", "ecoinvent", "2024", "activity-based", 0.94, "17.40", "3.1 Purchased goods and services", "Purchased goods & services", "Johannes Weber", "Bulk import", "IMP-2026-014", 1],
  ["Machined brass fittings", "Ottone S.r.l.", "Operations IT", "22,600", "EUR", "Fabricated metal products, EU average", "EXIOBASE", "2019", "spend-based", 0.66, "9.90", "3.1 Purchased goods and services", "Purchased goods & services", "Anna Keller", "Bulk import", "IMP-2026-014", 0],
  ["Warehouse rent & utilities", "LogisPark AG", "Logistics", "38,000", "EUR", "Real estate services, spend-based", "EXIOBASE", "2019", "spend-based", 0.71, "6.20", "3.8 Upstream leased assets", "Leased assets", "Tom Berger", "Manual entry", "—", 1],
  ["Marketing print materials", "PrintHouse BV", "Marketing", "9,700", "EUR", "Printing services, spend-based", "EXIOBASE", "2019", "spend-based", 0.74, "2.90", "3.1 Purchased goods and services", "Purchased goods & services", "Marta Ruiz", "Manual entry", "—", 0],
  ["Glass bottles, 330ml", "VetriPack S.p.A.", "Operations IT", "31,000", "kg", "Container glass, EU average", "FEVE", "2024", "activity-based", 0.93, "26.70", "3.1 Purchased goods and services", "Purchased goods & services", "Johannes Weber", "Bulk import", "IMP-2026-014", 2],
  ["Sea freight, inbound APAC", "OceanLink Shipping", "Logistics", "2,140,000", "t·km", "Container ship, deep-sea", "GLEC", "2025", "activity-based", 0.90, "22.90", "3.4 Upstream transportation and distribution", "Upstream transport", "Anna Keller", "Bulk import", "IMP-2026-011", 1],
  ["Office paper, A4", "Papyra GmbH", "Shared services", "2,150", "kg", "Paper, woodfree uncoated", "ecoinvent", "2024", "activity-based", 0.91, "2.02", "3.1 Purchased goods and services", "Purchased goods & services", "Tom Berger", "Manual entry", "—", 0],
  ["Cleaning services, Q1", "CleanCo Services", "Facilities", "14,200", "EUR", "Facility services, spend-based", "EXIOBASE", "2019", "spend-based", 0.68, "3.98", "3.1 Purchased goods and services", "Purchased goods & services", "Marta Ruiz", "Manual entry", "—", 0],
];

// Improved (synthetic) EF for the two low-match entries, keyed by row index.
const IEF_AFTER = {
  0: { ef: "Stainless steel fasteners, EU supplier mix", val: "0.31", unit: "kgCO₂e/EUR",
       src: "Forward Earth synthetic v1", year: "2026", basis: "AI-deconstructed",
       co2: "14,942 kg", co2t: "14.94", conf: 0.91, delta: "−47%",
       note: "Built from 4 deconstructed components (steel wire rod, forming, plating, transport)." },
  1: { ef: "ABS injection-moulded housings, EU mix", val: "0.22", unit: "kgCO₂e/EUR",
       src: "Forward Earth synthetic v1", year: "2026", basis: "AI-deconstructed",
       co2: "7,018 kg", co2t: "7.02", conf: 0.89, delta: "−36%",
       note: "Built from 3 deconstructed components (ABS granulate, injection moulding, transport)." },
};

const IEF_ENTRIES = IEF_BASE.map((r, i) => {
  const [desc, supplier, bu, consV, consU, ef, src, year, basis, conf, co2t, s3, act, user, input, imp, files] = r;
  const spend = consU === "EUR";
  const day = String(3 + ((i * 7) % 25)).padStart(2, "0");
  return {
    id: "DE-2026-0" + (421 - i * 2),
    desc, supplier, bu, consV, consU,
    cons: consV + " " + consU,
    consType: spend ? "Spend data" : "Material/service data",
    cat: s3, act, user, input, imp, files,
    start: "2026-01-01", end: "2026-03-31",
    updated: "2026-04-" + day, created: "2026-04-01",
    lca: basis === "spend-based" ? "Cradle-to-gate" : (consU === "t·km" || consU === "pax·km" ? "Well-to-wheel" : "Cradle-to-gate"),
    low: conf < 0.62,
    before: { ef, src, year, basis, conf, co2t,
              val: spend ? "0.58" : "—", unit: spend ? "kgCO₂e/EUR" : "kgCO₂e/" + consU,
              co2: (Number(co2t.replace(",", "")) * 1000).toLocaleString() + " kg" },
    after: IEF_AFTER[i] || null,
  };
});

const iefToast = (msg) => window.dispatchEvent(new CustomEvent("fe-toast", { detail: msg }));

// phase: "before" | "improving" | "after"
const iefCalc = (e, phase) => (phase === "after" && e.after) ? e.after : e.before;

// The workflow status ("Submitted") is never replaced — the EF-quality /
// progress signal renders as a second chip beside it.
function IefStatusChip({ entry, phase, option }) {
  const submitted = <span className="status-chip st-de_submitted">Submitted</span>;
  const extra = phase === "improving"
    ? <span className="status-chip st-cs_processing"><Icon name="clock" size={12} className="ic"/>Improving EF…</span>
    : (option === 1 && entry.low && phase === "before")
      ? <span className="status-chip st-cs_sug_low"><Icon name="warn" size={12}/>Low EF match</span>
      : null;
  return <span className="ief-chips">{submitted}{extra}</span>;
}

// Confidence as a Low / Med / High pill (percentages stay in the detail view).
function IefConf({ v, spinning }) {
  if (spinning) return (
    <span className="conf-inline"><span className="ief-spin"><Icon name="refresh" size={12}/></span>Improving…</span>
  );
  const level = v < 0.6 ? "low" : v < 0.8 ? "med" : "high";
  const label = level === "low" ? "Low" : level === "med" ? "Med" : "High";
  return <span className={`ief-confpill ${level}`}>{label}</span>;
}

function IefSynthFlag() {
  return <span className="ief-synth"><Icon name="sparkle" size={11}/>Synthetic EF</span>;
}

// ── AI wizard hand-off dialog (the wizard itself is a shared pattern, out of
//    scope here — this dialog stands in for it and skips ahead on confirm) ──
function IefWizardDialog({ entry, onCancel, onConfirm }) {
  React.useEffect(() => {
    const onKey = (ev) => { if (ev.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <>
      <div className="fwe-scrim" style={{ zIndex: 1400 }} onClick={onCancel}/>
      <div className="ief-wizdlg" role="dialog" aria-modal="true">
        <div className="ief-wizdlg__head">
          <Icon name="sparkle" size={18} style={{ color: "var(--fe-accent-primary)" }}/>
          <h3>Improve emission factor</h3>
          <button className="close" aria-label="Close" onClick={onCancel}><Icon name="close" size={16}/></button>
        </div>
        <p className="ief-wizdlg__sub">
          Forward AI deconstructs <b>{entry.desc}</b> into components and builds a
          synthetic emission factor to replace the current spend-based match.
        </p>
        <div className="ief-wizard-steps">
          <div className="ief-wstep"><span className="k">Step 1</span><span className="t">Context</span><span className="d">Line-item context, add guidance for the AI.</span></div>
          <span className="ief-warrow"><Icon name="arrowRight" size={14}/></span>
          <div className="ief-wstep"><span className="k">Step 2</span><span className="t">Review</span><span className="d">Deconstruction summary, component list.</span></div>
          <span className="ief-warrow"><Icon name="arrowRight" size={14}/></span>
          <div className="ief-wstep"><span className="k">Step 3</span><span className="t">Apply and confirm</span><span className="d">Summary, save EF, success.</span></div>
        </div>
        <div className="ief-wizdlg__note"><Icon name="info" size={13}/>The wizard is a shared pattern (also used by PCF “Deconstruct with AI”) and is designed separately — this mock skips ahead.</div>
        <div className="ief-wizdlg__foot">
          <button className="fwe-btn-secondary" style={{ height: 38, fontSize: 13 }} onClick={onCancel}>Cancel</button>
          <button className="fwe-btn-primary" style={{ height: 38, fontSize: 13 }} onClick={onConfirm}>
            <Icon name="sparkle" size={14}/>Apply and confirm
          </button>
        </div>
      </div>
    </>
  );
}

// ── Entry detail modal (product fwe-modal chrome, full-page content) ─────────
function IefDetailModal({ entry, phase, option, onClose, onImprove }) {
  React.useEffect(() => {
    const onKey = (ev) => { if (ev.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const c = iefCalc(entry, phase);
  const Ro = (label, value, opt) => (
    <div className="fwe-fld" key={label}>
      <span className="lab">{label}{opt && <span className="opt"> (optional)</span>}</span>
      <div className="control">{value}</div>
    </div>
  );
  const spend = entry.consType === "Spend data";

  // Option 1: the low-match signal + CTA sit in a banner at the TOP of the
  // modal (above the fold) — the full entry content follows below.
  const banner = option === 1 && entry.low && (
    phase === "before" ? (
      <div className="ief-banner">
        <Icon name="warn" size={17} className="ic"/>
        <span className="tx"><b>Low EF match ({Math.round(entry.before.conf * 100)}%).</b> Matched
          to a broad, spend-based sector average — the product is more specific than the factor.</span>
        <button className="fwe-btn-primary" style={{ height: 36, fontSize: 13, flex: "0 0 auto" }} onClick={onImprove}>
          <Icon name="sparkle" size={14}/>Improve emission factor
        </button>
      </div>
    ) : phase === "improving" ? (
      <div className="ief-banner busy">
        <span className="ief-spinner sm" aria-hidden/>
        <span className="tx"><b>Generating an improved emission factor…</b> This can take a few
          minutes — you can leave this page.</span>
      </div>
    ) : (
      <div className="ief-banner ok">
        <Icon name="check" size={17} className="ic"/>
        <span className="tx"><b>Emission factor improved.</b> Confidence is now {Math.round(c.conf * 100)}% —
          the previous factor is kept in the audit log.</span>
      </div>
    )
  );

  return (
    <>
      <div className="fwe-scrim" onClick={onClose}/>
      <div className="fwe-modal-wrap" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="fwe-modal">
          <div className="fwe-modal__head">
            <h2 className="trunc">{entry.desc}{"  |  "}{entry.bu}</h2>
            <IefStatusChip entry={entry} phase={phase} option={option}/>
            <button className="link-ic" title="Copy link to this entry" aria-label="Copy link to this entry"
              onClick={() => iefToast(`Link to ${entry.id} copied to clipboard`)}>
              <Icon name="link" size={17}/>
            </button>
            <button className="close" aria-label="Close" onClick={onClose}><Icon name="close" size={18}/></button>
          </div>

          <div className="fwe-modal__body">
            {banner}

            <section className="fwe-form-card">
              <h3 className="fwe-form-card__title">General information</h3>
              <div className="fwe-form-grid">
                {Ro("Business activity", entry.act)}
                {Ro("Business unit", entry.bu)}
                {Ro("User assigned", entry.user)}
                <div className="fwe-form-grid two">
                  {Ro("Start date", entry.start)}
                  {Ro("End date", entry.end)}
                </div>
              </div>
            </section>

            <section className="fwe-form-card">
              <h3 className="fwe-form-card__title">Data entry type</h3>
              <p className="fwe-form-card__sub">How the data in this entry was provided</p>
              <div className="fwe-form-grid">
                {Ro("Data input type", entry.input)}
                {Ro("Consumption data type", entry.consType)}
              </div>
            </section>

            <section className="fwe-form-card">
              <h3 className="fwe-form-card__title">Consumption details</h3>
              <div className="fwe-form-grid">
                {spend ? (
                  <div className="fwe-form-grid two">
                    {Ro("Currency", "EUR – Euro")}
                    {Ro("Price", entry.consV)}
                  </div>
                ) : (
                  <div className="fwe-form-grid two">
                    {Ro("Material/service quantity", entry.consV)}
                    {Ro("Material/service unit", entry.consU)}
                  </div>
                )}
                {Ro("Description", entry.desc, true)}
                {Ro("Supplier name", entry.supplier, true)}
              </div>
            </section>

            {phase === "improving" ? (
              <section className="fwe-form-card">
                <div className="ief-processing">
                  <div className="ief-spinner" aria-hidden/>
                  <div className="big">Generating an improved emission factor…</div>
                  <div className="why">
                    Forward AI is deconstructing this line item into components and building
                    a synthetic EF. This can take a few minutes — you can leave this page.
                  </div>
                </div>
              </section>
            ) : (
              <section className="fwe-form-card">
                <h3 className="fwe-form-card__title fwe-card-head">
                  <span>Calculation</span>
                  {phase === "after" && <IefSynthFlag/>}
                </h3>
                <div className="fwe-form-grid" style={{ marginTop: 14 }}>
                  {Ro("Emission factor name", phase === "after"
                    ? <><Icon name="sparkle" size={14} style={{ color: "var(--fe-accent-primary)", flex: "0 0 auto" }}/>{c.ef}</>
                    : c.ef)}
                </div>
                <div className="fwe-form-grid two" style={{ marginTop: 18 }}>
                  {Ro("Emission factor value", c.val)}
                  {Ro("Emission factor unit", c.unit)}
                  {Ro("Emission factor source", c.src)}
                  {Ro("Emission factor dataset", c.src)}
                  {Ro("Emission factor year", c.year)}
                  {Ro("Emission factor region", "Europe")}
                  {Ro("Emission factor LCA activity", entry.lca)}
                  {Ro("Scope", "3")}
                  {Ro("Scope 3 category", entry.cat)}
                </div>
                <div className="fwe-form-grid two" style={{ marginTop: 18 }}>
                  {Ro("CO₂e emission", c.co2)}
                  {Ro("CO₂e emission unit", "kgCO₂e")}
                </div>
                <div className="fwe-form-grid" style={{ marginTop: 18 }}>
                  {Ro("CO₂e calculation method", "GWP100")}
                </div>
                {entry.low && phase === "before" && option !== 1 && (
                  <div className="ief-match">
                    <Icon name="warn" size={15} className="ic"/>
                    <span><b>Low EF match ({Math.round(c.conf * 100)}%).</b> Matched to a broad,
                      spend-based sector average — the product is more specific than the factor.</span>
                  </div>
                )}
                {phase === "after" && (
                  <div className="ief-match ok">
                    <Icon name="check" size={15} className="ic"/>
                    <span><b>Emission factor improved.</b> {c.note} Confidence {Math.round(c.conf * 100)}%.
                      The previous spend-based factor is kept in the audit log.</span>
                  </div>
                )}
              </section>
            )}

            <section className="fwe-form-card">
              <h3 className="fwe-form-card__title">Attachments</h3>
              <p className="fwe-form-card__sub">Upload supporting documents (images or PDFs, max 2MB) as proof of your entries</p>
              <div className="fwe-dropzone">
                <div className="fwe-dropzone__drop">
                  <Icon name="upload" size={18}/>
                  <span>You can't add files to a submitted data entry</span>
                </div>
                <div className="fwe-dropzone__files">
                  <h4>Uploaded files</h4>
                  <p>{entry.files > 0 ? `${entry.files} file${entry.files > 1 ? "s" : ""} attached` : "Files have not been uploaded yet"}</p>
                </div>
              </div>
            </section>

            <section className="fwe-form-card">
              <h3 className="fwe-form-card__title">Notes</h3>
              <div className="fwe-fld">
                <span className="lab">Notes</span>
                <div className="control placeholder" style={{ minHeight: 84, alignItems: "flex-start" }}>—</div>
              </div>
            </section>
          </div>

          <div className="fwe-modal__foot">
            {phase === "improving" ? (
              <button className="fwe-btn-secondary" onClick={() => iefToast("Cancel improvement — would return the entry to its previous state")}>Cancel improvement</button>
            ) : phase === "after" ? (
              <>
                <button className="fwe-btn-secondary" onClick={() => iefToast("Would show the previous factor and the change log")}>View previous factor</button>
                <button className="fwe-btn-primary" onClick={() => { iefToast(`${entry.id} · calculation confirmed`); onClose(); }}>
                  <Icon name="check" size={16}/>Confirm calculation
                </button>
              </>
            ) : option === 1 && entry.low ? (
              <>
                <button className="fwe-btn-secondary" onClick={() => iefToast("Would open the manual factor picker")}>Swap factor manually</button>
                <button className="fwe-btn-primary" onClick={onImprove}>
                  <Icon name="sparkle" size={16}/>Improve emission factor
                </button>
              </>
            ) : (
              <button className="fwe-btn-danger" onClick={() => { iefToast(`${entry.id} unsubmitted`); onClose(); }}>Unsubmit</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
function ImproveEFPage({ option }) {
  const [phases, setPhases] = React.useState({});           // id → phase
  const [detailId, setDetailId] = React.useState(null);
  const [wizardId, setWizardId] = React.useState(null);
  const [deleted, setDeleted] = React.useState(() => new Set());
  const timers = React.useRef({});
  React.useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const phaseOf = (id) => phases[id] || "before";
  const copyRow = (id) => iefToast(`Link to ${id} copied to clipboard`);
  const deleteRow = (id) => {
    setDeleted(s => new Set(s).add(id));
    iefToast(`${id} deleted · Reset demo restores it`);
  };

  const startImprove = (id) => {
    const e = IEF_ENTRIES.find(x => x.id === id);
    setWizardId(null);
    setPhases(p => ({ ...p, [id]: "improving" }));
    iefToast(`${id} · generating improved EF — status set to Improving`);
    timers.current[id] = setTimeout(() => {
      setPhases(p => ({ ...p, [id]: "after" }));
      iefToast(`${id} · improved EF applied — confidence ${Math.round((e.after?.conf || 0.9) * 100)}%`);
    }, IEF_IMPROVE_MS);
  };

  const reset = () => {
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
    setPhases({}); setDetailId(null); setWizardId(null); setDeleted(new Set());
    iefToast("Demo reset — low-match entries restored");
  };

  const detail = detailId ? IEF_ENTRIES.find(e => e.id === detailId) : null;
  const wizard = wizardId ? IEF_ENTRIES.find(e => e.id === wizardId) : null;

  // Mirrors the Data page's default entry-orientation columns (ENTRY_VISIBLE).
  return (
    <div className="data-page-root" data-screen-label={`FE · Improve EF opt ${option}`}>
      <div className="page-head data-page-head">
        <div className="data-page-head-title">
          <h1 className="page-title">Data</h1>
          <div className="ief-caption">
            {option === 1
              ? "Improve EF · option 1 — low match shown via entry status, CTA in the entry detail"
              : "Improve EF · option 2 — EF confidence column, CTA inline on row hover"}
          </div>
        </div>
        <div className="data-header-right">
          <button className="btn secondary" style={{ whiteSpace: "nowrap" }} onClick={reset}>
            <Icon name="refresh" size={16}/>Reset demo
          </button>
          <button className="btn primary" style={{ whiteSpace: "nowrap" }} onClick={() => iefToast("Add data — not part of this mock")}>
            <Icon name="plus" size={18}/>Add data
          </button>
        </div>
      </div>

      <div className="ief-tablewrap">
        <table className="ief-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Supplier name</th>
              <th>Description</th>
              <th>Emission factor name</th>
              {option === 2 && <th className="new-col">EF confidence</th>}
              <th className="num">CO₂e emission</th>
              <th>CO₂e emission unit</th>
              <th className="num">Consumption value</th>
              <th>Consumption unit</th>
              <th>Business unit</th>
              <th>Data input type</th>
              <th>Consumption data type</th>
              <th>Scope</th>
              <th>Scope 3 category</th>
              <th>Business activity</th>
              <th>User assigned</th>
              <th>Start date</th>
              <th>End date</th>
              <th>Last updated</th>
              <th>Data entry ID</th>
              <th>Emission factor LCA activity</th>
              <th>Files</th>
              <th>Bulk import</th>
              <th>Created on</th>
              <th className="ief-act-cell" aria-hidden="true"></th>
            </tr>
          </thead>
          <tbody>
            {IEF_ENTRIES.filter(e => !deleted.has(e.id)).map(e => {
              const ph = phaseOf(e.id);
              const c = iefCalc(e, ph);
              return (
                <tr key={e.id} onClick={() => setDetailId(e.id)}>
                  <td><IefStatusChip entry={e} phase={ph} option={option}/></td>
                  <td>{e.supplier}</td>
                  <td>{e.desc}</td>
                  <td>
                    {ph === "improving"
                      ? <span style={{ color: "var(--fe-fg-subtle)" }}>Regenerating…</span>
                      : ph === "after" ? <>{c.ef} <IefSynthFlag/></> : c.ef}
                  </td>
                  {option === 2 && (
                    <td>{ph === "improving" ? <IefConf spinning/> : <IefConf v={c.conf}/>}</td>
                  )}
                  <td className="num">
                    {ph === "improving" ? "—"
                      : ph === "after"
                        ? <>{c.co2t} <span className="ief-strike">{e.before.co2t}</span> <span className="ief-delta">{c.delta}</span></>
                        : c.co2t}
                  </td>
                  <td>tCO₂e</td>
                  <td className="num">{e.consV}</td>
                  <td>{e.consU}</td>
                  <td>{e.bu}</td>
                  <td>{e.input}</td>
                  <td>{e.consType}</td>
                  <td><ScopeBadge scope={3}/></td>
                  <td>{e.cat}</td>
                  <td>{e.act}</td>
                  <td>{e.user}</td>
                  <td>{e.start}</td>
                  <td>{e.end}</td>
                  <td>{e.updated}</td>
                  <td>{e.id}</td>
                  <td>{e.lca}</td>
                  <td>{e.files || "—"}</td>
                  <td>{e.imp}</td>
                  <td>{e.created}</td>
                  <td className="ief-act-cell" onClick={(ev) => ev.stopPropagation()}>
                    <span className="ief-actions">
                      {option === 2 && e.low && ph === "before" && (
                        <button type="button" className="ief-rowcta" onClick={() => setWizardId(e.id)}>
                          <Icon name="sparkle" size={12}/>Improve EF
                        </button>
                      )}
                      <button type="button" className="ief-iconbtn" title="Copy link to row" aria-label="Copy link to row"
                        onClick={() => copyRow(e.id)}><Icon name="link" size={15}/></button>
                      <button type="button" className="ief-iconbtn danger" title="Delete entry" aria-label="Delete entry"
                        onClick={() => deleteRow(e.id)}><Icon name="trash" size={15}/></button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detail && (
        <IefDetailModal
          entry={detail}
          phase={phaseOf(detail.id)}
          option={option}
          onClose={() => setDetailId(null)}
          onImprove={() => setWizardId(detail.id)}
        />
      )}
      {wizard && (
        <IefWizardDialog
          entry={wizard}
          onCancel={() => setWizardId(null)}
          onConfirm={() => startImprove(wizard.id)}
        />
      )}
    </div>
  );
}

window.ImproveEFPage = ImproveEFPage;
