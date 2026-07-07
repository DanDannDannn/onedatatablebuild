// Improve EF · synthetic PCF — SCCF-side process mock.
//
// Compares the two whiteboarded options for handling Scope 3 data entries with
// a low EF match, staged end to end:
//   Option 1 — the LOW MATCH is signalled via the data-entry STATUS; the
//              "Improve EF" CTA lives only inside the entry-detail page.
//   Option 2 — a new "EF confidence" COLUMN carries the signal; the CTA
//              appears inline on the table row on hover.
// Shared stages: Indication → CTA → AI process (shared wizard, out of scope
// here) → Progress (status on detail page, Calculation section hidden) →
// Aftermath (synthetic EF with flag, status back; opt 2 confidence high).

const IEF_STAGES = [
  { key: "indication", label: "Indication" },
  { key: "cta",        label: "CTA" },
  { key: "ai",         label: "AI process" },
  { key: "progress",   label: "Progress" },
  { key: "aftermath",  label: "Aftermath" },
];

// The protagonist entry (low EF match → improved synthetic EF) + supporting rows.
const IEF_HERO = {
  id: "DE-2026-0421",
  desc: "Stainless steel fasteners — Q1 replenishment",
  supplier: "Meridian Components GmbH",
  bu: "Operations DE",
  cons: "48,200 EUR",
  efBefore: { name: "Fabricated metal products, EU average", meta: "EXIOBASE · 2019 · spend-based · 0.58 kgCO₂e/EUR" },
  efAfter:  { name: "Stainless steel fasteners, EU supplier mix", meta: "Forward Earth synthetic v1 · 2026 · 0.31 kgCO₂e/EUR" },
  confBefore: 0.42, confAfter: 0.91,
  co2Before: "27.96 t", co2After: "14.94 t",
};
const IEF_ROWS = [
  { id: "DE-2026-0417", desc: "Injection-moulded housings, ABS", supplier: "Polyform S.r.l.", bu: "Operations IT",
    cons: "31,900 EUR", ef: "Plastic products, EU average", efMeta: "EXIOBASE · 2019 · spend-based", conf: 0.61, co2: "11.05 t", low: true },
  { id: "DE-2026-0398", desc: "Corrugated packaging, recycled", supplier: "PackNord AB", bu: "Operations SE",
    cons: "12,400 kg", ef: "Corrugated board, 70% recycled", efMeta: "ecoinvent · 2024 · activity-based", conf: 0.93, co2: "8.12 t" },
  { id: "DE-2026-0388", desc: "Road freight, inbound EU", supplier: "TransCargo GmbH", bu: "Logistics",
    cons: "184,000 t·km", ef: "Lorry 16–32t, EURO 6", efMeta: "GLEC · 2025 · activity-based", conf: 0.88, co2: "19.70 t" },
  { id: "DE-2026-0375", desc: "Aluminium extrusions, 6060", supplier: "Nordal Extrusion AS", bu: "Operations NO",
    cons: "9,850 kg", ef: "Aluminium extrusion, EU mix", efMeta: "ecoinvent · 2024 · activity-based", conf: 0.95, co2: "63.40 t" },
];

// ── Small shared bits ────────────────────────────────────────────────────────
function IefChip({ kind }) {
  // Chips reuse the product's status-chip palette (extras-v2).
  if (kind === "submitted")  return <span className="status-chip st-de_submitted">Submitted</span>;
  if (kind === "lowmatch")   return <span className="status-chip st-cs_sug_low"><Icon name="warn" size={12}/>Low EF match</span>;
  if (kind === "improving")  return <span className="status-chip st-cs_processing"><Icon name="clock" size={12} className="ic"/>Improving EF…</span>;
  return null;
}
function IefConf({ v, spinning }) {
  if (spinning) return (
    <span className="conf-inline"><span className="ief-spin"><Icon name="refresh" size={12}/></span>Improving…</span>
  );
  const pct = Math.round(v * 100);
  const level = v < 0.6 ? "low" : v < 0.8 ? "med" : "";
  return (
    <span className={`conf-inline ${level}`}>
      <span>{pct}%</span>
      <span className="m"><div style={{ width: pct + "%" }} /></span>
    </span>
  );
}
function IefSynthFlag() {
  return <span className="ief-synth"><Icon name="sparkle" size={11}/>Synthetic EF</span>;
}

// ── Mini data table ──────────────────────────────────────────────────────────
// `option` 1|2 · `stage` key · onCta fires when a CTA inside the mock is used.
function IefTable({ option, stage, onCta }) {
  const showConfCol = option === 2;
  const after = stage === "aftermath";
  const progress = stage === "progress";
  const ctaStage = option === 2 && stage === "cta";

  const heroStatus = after ? "submitted"
    : progress ? "improving"
    : option === 1 ? "lowmatch" : "submitted";

  const heroEf = after
    ? <>{IEF_HERO.efAfter.name} <IefSynthFlag/><span className="sub">{IEF_HERO.efAfter.meta}</span></>
    : progress
      ? <span style={{ color: "var(--fe-fg-subtle)" }}>—<span className="sub">Regenerating…</span></span>
      : <>{IEF_HERO.efBefore.name}<span className="sub">{IEF_HERO.efBefore.meta}</span></>;

  return (
    <div className="ief-tablewrap">
      <table className="ief-table">
        <thead>
          <tr>
            <th>Data entry ID</th>
            <th>Status</th>
            <th>Description</th>
            <th className="num">Consumption</th>
            <th>Emission factor</th>
            {showConfCol && <th className="new-col">EF confidence<span className="newtag">NEW</span></th>}
            <th className="num">CO₂e emission</th>
            {ctaStage && <th className="ief-cta-cell" aria-hidden="true"></th>}
          </tr>
        </thead>
        <tbody>
          <tr className={"hero" + (ctaStage ? " force-hover" : "")}>
            <td>{IEF_HERO.id}</td>
            <td><IefChip kind={heroStatus}/></td>
            <td>{IEF_HERO.desc}<span className="sub">{IEF_HERO.supplier}</span></td>
            <td className="num">{IEF_HERO.cons}</td>
            <td>{heroEf}</td>
            {showConfCol && (
              <td>
                {progress
                  ? <IefConf spinning/>
                  : <IefConf v={after ? IEF_HERO.confAfter : IEF_HERO.confBefore}/>}
              </td>
            )}
            <td className="num">
              {after
                ? <>{IEF_HERO.co2After}<span className="sub"><span className="ief-strike">{IEF_HERO.co2Before}</span> <span className="ief-delta">−47%</span></span></>
                : progress ? "—" : IEF_HERO.co2Before}
            </td>
            {ctaStage && (
              <td className="ief-cta-cell">
                <button type="button" className="ief-rowcta" onClick={onCta}>
                  <Icon name="sparkle" size={12}/>Improve EF
                </button>
              </td>
            )}
          </tr>
          {IEF_ROWS.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td><IefChip kind={option === 1 && r.low ? "lowmatch" : "submitted"}/></td>
              <td>{r.desc}<span className="sub">{r.supplier}</span></td>
              <td className="num">{r.cons}</td>
              <td>{r.ef}<span className="sub">{r.efMeta}</span></td>
              {showConfCol && <td><IefConf v={r.conf}/></td>}
              <td className="num">{r.co2}</td>
              {ctaStage && (
                <td className="ief-cta-cell">
                  {r.low && (
                    <button type="button" className="ief-rowcta"
                      onClick={() => window.dispatchEvent(new CustomEvent("fe-toast", { detail: "In the mock, follow " + IEF_HERO.id + " — the highlighted row" }))}>
                      <Icon name="sparkle" size={12}/>Improve EF
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Mini entry-detail modal ──────────────────────────────────────────────────
function IefDetail({ option, stage, onCta }) {
  const progress = stage === "progress";
  const after = stage === "aftermath";
  const status = after ? "submitted" : progress ? "improving" : option === 1 ? "lowmatch" : "submitted";
  const ef = after ? IEF_HERO.efAfter : IEF_HERO.efBefore;

  return (
    <div className="ief-modal">
      <div className="ief-modal__head">
        <h4>{IEF_HERO.desc}&nbsp; | &nbsp;{IEF_HERO.bu}</h4>
        <IefChip kind={status}/>
        <span className="x"><Icon name="close" size={16}/></span>
      </div>
      <div className="ief-modal__body">
        <div className="ief-card">
          <h5>General information</h5>
          <div className="ief-fgrid">
            <div className="ief-f"><span className="lab">Business activity</span><div className="ctl">Purchased goods &amp; services</div></div>
            <div className="ief-f"><span className="lab">Business unit</span><div className="ctl">{IEF_HERO.bu}</div></div>
            <div className="ief-f"><span className="lab">Supplier name</span><div className="ctl">{IEF_HERO.supplier}</div></div>
            <div className="ief-f"><span className="lab">Price</span><div className="ctl">{IEF_HERO.cons}</div></div>
          </div>
        </div>

        {progress ? (
          <div className="ief-processing">
            <div className="ief-spinner" aria-hidden/>
            <div className="big">Generating an improved emission factor…</div>
            <div className="why">
              Forward AI is deconstructing this line item into components and building
              a synthetic EF. This can take a few minutes — you can leave this page.
            </div>
          </div>
        ) : (
          <div className="ief-card">
            <h5>
              Calculation
              {after && <span className="flag"><IefSynthFlag/></span>}
            </h5>
            <div className="ief-fgrid">
              <div className="ief-f full"><span className="lab">Emission factor name</span>
                <div className={"ctl" + (after ? " hl" : "")}>
                  {after && <Icon name="sparkle" size={13} style={{ color: "var(--fe-accent-primary)", flex: "0 0 auto" }}/>}
                  {ef.name}
                </div>
              </div>
              <div className="ief-f"><span className="lab">Emission factor value</span><div className="ctl">{after ? "0.31" : "0.58"}</div></div>
              <div className="ief-f"><span className="lab">Emission factor unit</span><div className="ctl">kgCO₂e/EUR</div></div>
              <div className="ief-f"><span className="lab">Emission factor source</span><div className="ctl">{after ? "Forward Earth synthetic v1" : "EXIOBASE"}</div></div>
              <div className="ief-f"><span className="lab">Emission factor year</span><div className="ctl">{after ? "2026" : "2019"}</div></div>
              <div className="ief-f"><span className="lab">CO₂e emission</span><div className="ctl">{after ? "14,942" : "27,956"} kg</div></div>
              <div className="ief-f"><span className="lab">Scope 3 category</span><div className="ctl">3.1 Purchased goods and services</div></div>
            </div>
            {after ? (
              <div className="ief-match ok">
                <Icon name="check" size={15} className="ic"/>
                <span><b>Emission factor improved.</b> Built from 4 deconstructed components
                  (steel wire rod, forming, plating, transport). Confidence {Math.round(IEF_HERO.confAfter * 100)}%.
                  The previous spend-based factor is kept in the audit log.</span>
              </div>
            ) : (
              <div className="ief-match">
                <Icon name="warn" size={15} className="ic"/>
                <span><b>Low EF match ({Math.round(IEF_HERO.confBefore * 100)}%).</b> Matched to a broad,
                  spend-based sector average — the product is more specific than the factor.</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="ief-modal__foot">
        {stage === "cta" && option === 1 ? (
          <>
            <button className="fwe-btn-secondary" style={{ height: 36, fontSize: 13 }}>Swap factor manually</button>
            <button className="fwe-btn-primary" style={{ height: 36, fontSize: 13 }} onClick={onCta}>
              <Icon name="sparkle" size={14}/>Improve emission factor
            </button>
          </>
        ) : progress ? (
          <button className="fwe-btn-secondary" style={{ height: 36, fontSize: 13 }}>Cancel improvement</button>
        ) : after ? (
          <>
            <button className="fwe-btn-secondary" style={{ height: 36, fontSize: 13 }}>View previous factor</button>
            <button className="fwe-btn-primary" style={{ height: 36, fontSize: 13 }}><Icon name="check" size={14}/>Confirm calculation</button>
          </>
        ) : (
          <button className="fwe-btn-secondary" style={{ height: 36, fontSize: 13 }}>Unsubmit</button>
        )}
      </div>
    </div>
  );
}

// ── Shared AI wizard placeholder ─────────────────────────────────────────────
function IefWizard({ onDone }) {
  return (
    <div className="ief-wizard">
      <div className="ief-wizard-top">
        <span className="lbl">Shared UX pattern</span>
        <span className="ief-entrybadge"><Icon name="sparkle" size={13}/>SCCF entry point · “Improve EF”</span>
        <span className="ief-entrybadge dim">PCF entry point · “Deconstruct with AI”</span>
      </div>
      <div className="ief-wizard-steps">
        <div className="ief-wstep">
          <span className="k">Step 1</span>
          <span className="t">Context</span>
          <span className="d">(Public) context on the line item, add guidance for the AI…</span>
        </div>
        <span className="ief-warrow"><Icon name="arrowRight" size={16}/></span>
        <div className="ief-wstep">
          <span className="k">Step 2</span>
          <span className="t">Review</span>
          <span className="d">Summary of the deconstruction, component list.</span>
        </div>
        <span className="ief-warrow"><Icon name="arrowRight" size={16}/></span>
        <div className="ief-wstep">
          <span className="k">Step 3</span>
          <span className="t">Apply and confirm</span>
          <span className="d">Summary, save EF, success.</span>
        </div>
      </div>
      <div className="ief-wizard-note">
        <Icon name="info" size={14}/>
        The wizard itself is designed separately (shared with the PCF flow) — this mock only hands off to it and picks up afterwards.
        <span style={{ flex: 1 }}/>
        <button className="fwe-btn-primary" style={{ height: 34, fontSize: 13 }} onClick={onDone}>
          <Icon name="check" size={14}/>User confirms in step 3 → processing starts
        </button>
      </div>
    </div>
  );
}

// ── Annotations per option × stage ───────────────────────────────────────────
const IEF_NOTES = {
  1: {
    indication: {
      sees: [
        "Entries with a weak, spend-based EF match carry a dedicated entry status: “Low EF match” (amber, warning icon).",
        "It reuses the existing status column — no new columns, works with status filters and saved views out of the box.",
      ],
      notes: [
        "The chip competes with the workflow statuses (Draft / Submitted…): one column now mixes workflow state and data-quality state.",
        "An entry can be both “Submitted” and “low match” — this option forces a precedence decision.",
      ],
      questions: ["Which status wins when workflow state and EF-quality state collide? Does “Low EF match” replace or coexist with “Submitted”?"],
    },
    cta: {
      sees: [
        "The CTA lives only inside the data-entry detail page, in the footer next to the existing actions.",
        "The calculation card shows the low-match callout explaining why the factor is weak.",
      ],
      notes: [
        "One deliberate place for the action keeps the table calm; discovery depends on the user opening the entry.",
      ],
      questions: [
        "Does the user still need to “Unsubmit” the data entry first, then edit the EF by generating one? Or can Improve EF run on a submitted entry? (from the whiteboard)",
      ],
    },
    progress: {
      sees: [
        "Entry status flips to “Improving EF…” — visible on the detail page (and in the status column).",
        "The Calculation section is gone while the EF is regenerated, replaced by a progress panel.",
      ],
      notes: ["The async job may take minutes — the user can leave; the status chip is the recall signal."],
      questions: ["Need to think through the design with the status change and the missing Calculation section — what happens to totals and exports while it runs? (from the whiteboard)"],
    },
    aftermath: {
      sees: [
        "The new emission factor has a special name and a “Synthetic EF” flag, in the table and in the calculation card.",
        "The data entry status changes back (e.g. Submitted); the low-match chip is gone.",
        "Emission value updates; the previous factor stays available for audit.",
      ],
      notes: ["Provenance: the flag plus the audit log keep the AI-generated factor traceable — trust is the product."],
      questions: [],
    },
  },
  2: {
    indication: {
      sees: [
        "A new “EF confidence” column carries the signal: score + bar, amber when low.",
        "The status column stays purely workflow (Submitted) — quality and workflow don't mix.",
      ],
      notes: [
        "The confidence score already exists on calculations (threshold 0.8) — this promotes it to a first-class, sortable, filterable column.",
        "Users can sort by confidence to build a “worst matches first” worklist.",
      ],
      questions: ["Column real estate: the table is already dense — is confidence in the default view or opt-in via column settings?"],
    },
    cta: {
      sees: [
        "Hovering a low-confidence row reveals an inline “Improve EF” button — trigger without opening the entry.",
        "The highlighted row shows the hover state; try hovering the other amber row.",
      ],
      notes: [
        "Fast for bulk triage, and it invites a future bulk action (“Improve 12 low-confidence EFs”).",
        "Hover-only affordances need a keyboard/touch fallback — e.g. also expose the action in the row menu and the detail page.",
      ],
      questions: ["Same open question as option 1: does this work on submitted entries or does it force an unsubmit round-trip?"],
    },
    progress: {
      sees: [
        "Same as option 1 on the detail page: status “Improving EF…”, Calculation section hidden.",
        "In the table, the confidence cell shows the in-flight state.",
      ],
      notes: ["Status change and confidence cell must not disagree — one source of truth for the job state."],
      questions: ["Same whiteboard flag: status change × missing Calculation section needs a deliberate design."],
    },
    aftermath: {
      sees: [
        "New emission factor with special name + “Synthetic EF” flag, same as option 1.",
        "Data entry status changed back.",
        "The confidence score is high again (91%) — the column itself closes the loop and proves the improvement.",
      ],
      notes: ["The before/after confidence delta is the clearest success feedback of the two options."],
      questions: [],
    },
  },
  ai: {
    sees: [
      "Both entry points (SCCF “Improve EF”, PCF “Deconstruct with AI”) land in the same 3-step wizard: Context → Review → Apply and confirm.",
    ],
    notes: ["Out of scope for this mock — designed once, shared across SCCF and PCF."],
    questions: [],
  },
};

// ── Page ─────────────────────────────────────────────────────────────────────
function ImproveEFPage() {
  const [option, setOption] = React.useState(1);
  const [stageIx, setStageIx] = React.useState(0);
  const stage = IEF_STAGES[stageIx].key;

  const notes = stage === "ai" ? IEF_NOTES.ai : IEF_NOTES[option][stage];
  const go = (ix) => setStageIx(Math.max(0, Math.min(IEF_STAGES.length - 1, ix)));

  // Which surfaces does each stage show?
  const showTable  = stage === "indication" || stage === "cta" && option === 2 || stage === "progress" || stage === "aftermath";
  const showDetail = stage === "cta" && option === 1 || stage === "progress" || stage === "aftermath";

  const hint =
    stage === "indication" ? (option === 1 ? "The amber status chips carry the signal — follow the highlighted row." : "The new EF confidence column carries the signal — follow the highlighted row.")
    : stage === "cta" ? (option === 1 ? "Click “Improve emission factor” in the detail footer to continue." : "The highlighted row shows the hover state — click “Improve EF” to continue.")
    : stage === "ai" ? "Click the confirm button to hand back from the shared wizard."
    : stage === "progress" ? "Status is the recall signal; the Calculation section is hidden while the job runs."
    : "The synthetic EF is flagged, the status is back to normal" + (option === 2 ? ", and confidence is high again." : ".");

  return (
    <div className="ief-root" data-screen-label="FE · Improve EF mock">
      <div className="ief-head">
        <span className="ief-kicker">Synthetic PCF · SCCF flow · design exploration</span>
        <h2 className="ief-title">Improving low-match emission factors</h2>
        <p className="ief-sub">
          Some Scope 3 data entries are matched to a weak, spend-based emission factor.
          The user needs to spot them, trigger the AI improvement flow (“Improve EF”),
          and get a better synthetic EF back. Two options, staged end to end — switch
          options and step through the stages.
        </p>
      </div>

      <div className="ief-options" role="tablist" aria-label="Design options">
        <button type="button" role="tab" aria-selected={option === 1}
          className={"ief-option" + (option === 1 ? " on" : "")} onClick={() => setOption(1)}>
          <span className="t"><span className="n">1</span>Entry status</span>
          <span className="d">The low match is signalled through the data-entry status; the CTA lives inside the entry detail page only.</span>
        </button>
        <button type="button" role="tab" aria-selected={option === 2}
          className={"ief-option" + (option === 2 ? " on" : "")} onClick={() => setOption(2)}>
          <span className="t"><span className="n">2</span>EF confidence column</span>
          <span className="d">A new “EF confidence” column carries the signal; the CTA appears inline on the table row on hover.</span>
        </button>
      </div>

      <div className="ief-stepper" role="tablist" aria-label="Flow stages">
        {IEF_STAGES.map((s, i) => (
          <React.Fragment key={s.key}>
            {i > 0 && <span className="ief-step-arrow"><Icon name="arrowRight" size={14}/></span>}
            <button type="button" role="tab" aria-selected={i === stageIx}
              className={"ief-step" + (i === stageIx ? " on" : i < stageIx ? " done" : "")}
              onClick={() => go(i)}>
              <span className="num">{i < stageIx ? <Icon name="check" size={12}/> : i + 1}</span>
              {s.label}
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="ief-stage">
        <div className="ief-canvas">
          {stage === "ai" ? (
            <div className="ief-surface">
              <span className="ief-surface-label"><Icon name="sparkle" size={12}/>Shared AI wizard (out of scope)</span>
              <IefWizard onDone={() => go(3)}/>
            </div>
          ) : (
            <>
              {showTable && (
                <div className="ief-surface">
                  <span className="ief-surface-label"><Icon name="rows" size={12}/>Data table</span>
                  <IefTable option={option} stage={stage} onCta={() => go(2)}/>
                </div>
              )}
              {showDetail && (
                <div className="ief-surface">
                  <span className="ief-surface-label"><Icon name="document" size={12}/>Data entry detail</span>
                  <IefDetail option={option} stage={stage} onCta={() => go(2)}/>
                </div>
              )}
            </>
          )}

          <div className="ief-stagenav">
            <button className="fwe-btn-secondary" style={{ height: 34, fontSize: 13 }}
              disabled={stageIx === 0} onClick={() => go(stageIx - 1)}>
              ← Previous stage
            </button>
            <span className="spacer"/>
            <span className="ief-hint"><span className="pulse" aria-hidden/>{hint}</span>
            <span className="spacer"/>
            <button className="fwe-btn-primary" style={{ height: 34, fontSize: 13 }}
              disabled={stageIx === IEF_STAGES.length - 1} onClick={() => go(stageIx + 1)}>
              Next stage →
            </button>
          </div>
        </div>

        <div className="ief-notes">
          <div className="ief-note">
            <h6><Icon name="eye" size={13}/>What the user sees</h6>
            <ul>{notes.sees.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
          {notes.notes.length > 0 && (
            <div className="ief-note">
              <h6><Icon name="info" size={13}/>Design notes</h6>
              <ul>{notes.notes.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
          {notes.questions.length > 0 && (
            <div className="ief-note q">
              <h6><Icon name="warn" size={13}/>Open questions</h6>
              <ul>{notes.questions.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
        </div>
      </div>

      <div className="ief-compare">
        <table>
          <thead>
            <tr>
              <th style={{ width: 150 }}></th>
              <th>Option 1 · Entry status</th>
              <th>Option 2 · EF confidence column</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="dim-label">Indication</td>
              <td>“Low EF match” status on the data entry. Reuses the status column; mixes workflow and quality state.</td>
              <td>New “EF confidence” column with score + bar. Keeps status purely workflow; sortable worklist; costs a column.</td>
            </tr>
            <tr>
              <td className="dim-label">CTA</td>
              <td>Inside the data-entry detail page only. Deliberate, but discovery needs an open entry.</td>
              <td>Inline on the table row on hover (plus detail page). Fast triage; needs keyboard/touch fallback.</td>
            </tr>
            <tr>
              <td className="dim-label">Progress</td>
              <td colSpan={2}>Shared: entry status “Improving EF…” shown on the detail page; the Calculation section is hidden while the job runs. Open: status change × hidden calculation needs a deliberate design (totals, exports).</td>
            </tr>
            <tr>
              <td className="dim-label">Aftermath</td>
              <td>New EF gets a special name + “Synthetic EF” flag; entry status changes back.</td>
              <td>Same, plus the confidence score is high again — the column itself proves the improvement.</td>
            </tr>
            <tr>
              <td className="dim-label">Best when</td>
              <td>Low-match entries are rare and handled one by one during review.</td>
              <td>Low matches are common and analysts triage them as a batch, sorted by confidence.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.ImproveEFPage = ImproveEFPage;
