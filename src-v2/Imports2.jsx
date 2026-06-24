// =============================================================================
// IMPORTS v2 — Reimagined data ingestion → insights flow
//
// Phases:
//   1. Upload         — multi-file (Excel/CSV/PDF/scans), auto-detect format
//   2. Map columns    — reuses the rich v1 MapStep (custom rename, others, etc.)
//   3. Repair data    — sample preview + transformation steps in one view
//   4. Submit         — quick confirmation
// =============================================================================

// ---------- Simulated input file headers (parse result) -----------------------
const I2_HEADERS = [
  "Vehicle ID", "Facility Code", "Fuel Type", "Volume", "Unit",
  "Date", "Period",
  "Driver Name", "Cost Center", "Notes",
];
function i2AutoMatch(headers) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases = {
    date: "start_date", invoicedate: "start_date", startdate: "start_date",
    period: "end_date", endofperiod: "end_date", enddate: "end_date",
    facilitycode: "location", facility: "location", office: "location", location: "location", site: "location",
    volume: "price", price: "price", amount: "price", netamount: "price",
    unit: "currency", currency: "currency", currencycode: "currency",
    fueltype: "emission_source", category: "emission_source", emissionsource: "emission_source",
    vendor: "supplier_name", supplier: "supplier_name", suppliername: "supplier_name",
    notes: "description", description: "description", desc: "description",
  };
  const mapping = {};
  headers.forEach((h) => {
    const n = norm(h);
    const hit = aliases[n];
    if (hit && !Object.values(mapping).includes(hit)) mapping[h] = hit;
  });
  return mapping;
}

// ---------- Simulated transformation report ---------------------------------
const I2_REPORT = {
  rowsTotal: 22784,
  rowsClean: 22784,
  rowsAttention: 0,
  missing: [
    {
      id: "m-supplier",
      field: "Supplier name",
      issue: "Could not extract from 47 PDF invoices",
      affected: 47,
      severity: "high",
      example: "Page 2 of acme-invoice-feb-2026.pdf — vendor field blank",
    },
    {
      id: "m-period",
      field: "Period end date",
      issue: "Date format unrecognized in 12 rows",
      affected: 12,
      severity: "high",
      example: "Row 1,847: \"31.04.2025\" (April only has 30 days)",
    },
    {
      id: "m-cost-center",
      field: "Cost center",
      issue: "Empty in 184 rows",
      affected: 184,
      severity: "low",
      example: "Optional field — entries default to \"Unassigned\" if left empty",
    },
  ],
  steps: [
    {
      id: "fuel",
      title: "Fuel name standardization",
      summary: "Standardized 5 fuel type variants to match emission factor database",
      affected: 22784,
      mappingsLabel: "Fuel Type mappings",
      why: "Ensure all fuel types match our emission factor database for accurate GHG calculations",
      mappings: [
        { from: "Diesel fuel",      to: "Diesel",        rows: 4621 },
        { from: "Premium gasoline", to: "Gasoline",      rows: 4487 },
        { from: "Biodiesel",        to: "Biodiesel B20", rows: 4556 },
        { from: "Blue fuel",        to: "Diesel",        rows: 4612 },
        { from: "Regular gas",      to: "Gasoline",      rows: 4508 },
      ],
    },
    {
      id: "units",
      title: "Unit conversion",
      summary: "Converted mixed volume units to liters",
      affected: 22784,
      mappingsLabel: "Unit conversions",
      why: "Standardize all volumes to liters to enable consistent emissions calculations",
      mappings: [
        { from: "Gallons",      to: "Liters", rows: 13567, factor: "×3.78541" },
        { from: "Cubic meters", to: "Liters", rows: 1384,  factor: "×1000" },
        { from: "Liters",       to: "Liters", rows: 7833,  factor: "×1" },
      ],
    },
    {
      id: "dates",
      title: "Date format standardization",
      summary: "Converted 3 different date formats to ISO 8601",
      affected: 22784,
      mappingsLabel: "Date format conversions",
      why: "Ensure consistent date handling and enable proper period-based analysis",
      mappings: [
        { from: "DD-MMM-YYYY (e.g., \"01-Jan-2025\")", to: "YYYY-MM-DD", rows: 8921, undeletable: true },
        { from: "YYYY-MM-DD (e.g., \"2025-01-02\")",   to: "YYYY-MM-DD", rows: 6347, undeletable: true },
        { from: "MM/DD/YYYY (e.g., \"01/03/2025\")",   to: "YYYY-MM-DD", rows: 7516, undeletable: true },
      ],
    },
    {
      id: "locations",
      title: "Location mapping",
      summary: "Mapped location codes and full names to business units",
      affected: 22784,
      mappingsLabel: "Location mappings",
      why: "Match facility identifiers to your business unit hierarchy so emissions roll up correctly.",
      mappings: [
        { from: "SLC-01",  to: "Salt Lake Manufacturing", rows: 2457 },
        { from: "BER-HQ",  to: "Berlin HQ Building",      rows: 1823 },
        { from: "SEA-OFF", to: "Seattle Office Complex",  rows: 2104 },
        { from: "LON-TWR", to: "London Office Tower",     rows: 1967 },
        { from: "NYC-WH",  to: "NYC Distribution Center", rows: 2341 },
        { from: "Tokyo Business Center", to: "Tokyo Business Center", rows: 1678 },
        { from: "Paris Regional Hub",    to: "Paris Regional Hub",    rows: 1891 },
        { from: "SYD-DC",  to: "Sydney Distribution",     rows: 1542 },
        { from: "MEX-PLANT", to: "Mexico City Plant",     rows: 1389 },
        { from: "TOR-OFF", to: "Toronto Office",          rows: 1213 },
      ],
    },
  ],
};

// ---------- Sample rows (matches reference image style) ----------------------
const I2_SAMPLE = [
  { facility: "Salt Lake Manufacturing", category: "Diesel",        consumption: "290.1 L", period: "2025-01-01", status: "valid" },
  { facility: "Berlin HQ Building",      category: "Gasoline",      consumption: "288.8 L", period: "2025-01-02", status: "valid" },
  { facility: "Seattle Office Complex",  category: "Biodiesel B20", consumption: "216.7 L", period: "2025-01-03", status: "valid" },
  { facility: "London Office Tower",     category: "Diesel",        consumption: "329.3 L", period: "2025-01-04", status: "valid" },
  { facility: "NYC Distribution Center", category: "Gasoline",      consumption: "174.4 L", period: "2025-01-05", status: "valid" },
];

// =============================================================================
// SHELL — phase router + persistent file bar
// =============================================================================
function ImportsV2({ onFinish, onBackToLog, editingFromBatch, onViewEntries }) {
  // phase: upload | map | repair | done
  const [phase, setPhase] = React.useState(() => localStorage.getItem("fe-i2-phase") || "upload");
  const [files, setFiles] = React.useState(() => {
    // If reopening to edit an existing batch, seed a synthetic file
    if (editingFromBatch) {
      const fileNames = {
        "B-2026-Q1":   { name: "Q1 travel (SAP Concur)",     size: "Live sync" },
        "B-2026-FUEL": { name: "fleet-fuel-q1.xlsx",         size: "3.2 MB" },
        "B-2026-PG":   { name: "spend-q1-2026.csv",          size: "1.4 MB" },
        "B-2026-02":   { name: "electricity-feb-2026.pdf",   size: "12.8 MB" },
      };
      return [fileNames[editingFromBatch.batchId] || { name: "imported-file.xlsx", size: "—" }];
    }
    try { return JSON.parse(localStorage.getItem("fe-i2-files") || "[]"); } catch { return []; }
  });
  const [importType, setImportType] = React.useState(() => localStorage.getItem("fe-i2-type") || "");

  // Column mapping state (reused from v1 MapStep)
  const [mapping, setMapping] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("fe-i2-mapping") || "null") || i2AutoMatch(I2_HEADERS); }
    catch { return i2AutoMatch(I2_HEADERS); }
  });
  const [removedHeaders, setRemovedHeaders] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("fe-i2-removed") || "[]"); } catch { return []; }
  });
  const [otherRenames, setOtherRenames] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("fe-i2-others") || "{}"); } catch { return {}; }
  });

  const [report, setReport] = React.useState(I2_REPORT);

  React.useEffect(() => { localStorage.setItem("fe-i2-phase", phase); }, [phase]);
  React.useEffect(() => { localStorage.setItem("fe-i2-files", JSON.stringify(files)); }, [files]);
  React.useEffect(() => { localStorage.setItem("fe-i2-type", importType); }, [importType]);
  React.useEffect(() => { localStorage.setItem("fe-i2-mapping", JSON.stringify(mapping)); }, [mapping]);
  React.useEffect(() => { localStorage.setItem("fe-i2-removed", JSON.stringify(removedHeaders)); }, [removedHeaders]);
  React.useEffect(() => { localStorage.setItem("fe-i2-others", JSON.stringify(otherRenames)); }, [otherRenames]);

  const reset = () => {
    setPhase("upload"); setFiles([]);
    setMapping(i2AutoMatch(I2_HEADERS));
    setRemovedHeaders([]);
    setOtherRenames({});
    ["fe-i2-phase","fe-i2-files","fe-i2-mapping","fe-i2-removed","fe-i2-others"].forEach(k => localStorage.removeItem(k));
  };

  return (
    <div className="i2-page">
      {editingFromBatch && phase !== "done" && (
        <div className="i2-edit-banner">
          <div className="i2-edit-banner-icon"><Icon name="warn" size={14}/></div>
          <div className="i2-edit-banner-body">
            <b>Editing existing batch {editingFromBatch.batchId}</b>
            <span>Changes will reset downstream entries and emission calculations on submit.</span>
          </div>
          <button className="btn ghost small" onClick={onBackToLog}>Cancel edit</button>
        </div>
      )}

      {/* Persistent file bar (after upload) */}
      {phase !== "upload" && phase !== "done" && files.length > 0 && (
        <I2FileBar files={files} importType={importType} onCancel={reset} onBackToLog={onBackToLog}/>
      )}

      <I2Stepper phase={phase} setPhase={setPhase}/>

      {phase === "upload" && (
        <I2Upload
          files={files} setFiles={setFiles}
          importType={importType} setImportType={setImportType}
          onContinue={() => setPhase("map")}
          onBackToLog={onBackToLog}
        />
      )}
      {phase === "map" && (
        <I2MapColumns
          headers={I2_HEADERS}
          mapping={mapping} setMapping={setMapping}
          removedHeaders={removedHeaders} setRemovedHeaders={setRemovedHeaders}
          otherRenames={otherRenames} setOtherRenames={setOtherRenames}
          onBack={() => setPhase("upload")}
          onContinue={() => setPhase("repair")}
        />
      )}
      {phase === "repair" && (
        <I2Repair
          files={files} report={report} setReport={setReport}
          onBack={() => setPhase("map")}
          onSubmit={() => setPhase("done")}
        />
      )}
      {phase === "done" && (
        <I2Done report={report} files={files}
                onNew={reset}
                onView={() => {
                  const batchId = editingFromBatch?.batchId || null;
                  reset();
                  if (onViewEntries) onViewEntries(batchId);
                  else onFinish && onFinish();
                }}/>
      )}
    </div>
  );
}

// =============================================================================
// File bar (persistent across phases)
// =============================================================================
function I2FileBar({ files, importType, onCancel, onBackToLog }) {
  const total = files.reduce((s, f) => s + (f.rows || 0), 0);
  return (
    <div className="i2-filebar">
      <button className="i2-filebar-back" onClick={onBackToLog} title="Back to imports list">
        <Icon name="chev" size={14} style={{transform:"rotate(90deg)"}}/>
      </button>
      <div className="i2-filebar-files">
        {files.slice(0, 3).map(f => (
          <span key={f.name} className="i2-filebar-pill">
            <I2FileIcon kind={f.kind} size={14}/>
            <span className="i2-filebar-name">{f.name}</span>
          </span>
        ))}
        {files.length > 3 && <span className="i2-filebar-more">+{files.length - 3}</span>}
      </div>
      <div className="i2-filebar-meta">
        <span><span className="i2-mu">Type</span> {importType}</span>
        <span className="i2-dot">·</span>
        <span><span className="i2-mu">Rows</span> {total.toLocaleString()}</span>
        <span className="i2-dot">·</span>
        <span><span className="i2-mu">By</span> Johannes Weber</span>
      </div>
      <button className="i2-filebar-cancel" onClick={onCancel} title="Cancel import">
        <Icon name="close" size={16}/>
      </button>
    </div>
  );
}

// =============================================================================
// Stepper
// =============================================================================
function I2Stepper({ phase, setPhase }) {
  const steps = [
    { k: "upload", label: "Upload file" },
    { k: "map",    label: "Map columns" },
    { k: "repair", label: "Repair data" },
    { k: "done",   label: "Done" },
  ];
  const idx = steps.findIndex(s => s.k === phase);
  return (
    <div className="i2-stepper">
      {steps.map((s, i) => {
        const state = i < idx ? "done" : i === idx ? "current" : "todo";
        const clickable = i < idx;
        return (
          <React.Fragment key={s.k}>
            <button
              className={`i2-step ${state}`}
              onClick={() => clickable && setPhase(s.k)}
              disabled={!clickable && state !== "current"}
            >
              <span className="i2-step-num">
                {state === "done" ? <Icon name="check" size={12}/> : i + 1}
              </span>
              <span className="i2-step-label">{s.label}</span>
            </button>
            {i < steps.length - 1 && <div className={`i2-step-line ${i < idx ? "done" : ""}`}/>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// =============================================================================
// PHASE 1 — UPLOAD
// =============================================================================
const I2_IMPORT_TYPES = [
  "Upstream scope 3 – Spend data",
  "Upstream scope 3 – Activity data",
  "Stationary combustion (natural gas, fuels)",
  "Mobile combustion (fleet fuel, logistics)",
  "Purchased electricity",
  "Employee commuting",
  "Business travel",
];

function fileKindFromName(name) {
  const ext = name.toLowerCase().split(".").pop();
  if (["xlsx", "xls", "csv"].includes(ext)) return "sheet";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "tif", "tiff", "heic"].includes(ext)) return "scan";
  return "other";
}
function I2FileIcon({ kind, size = 18 }) {
  const colors = {
    sheet: { bg: "#E8F5EE", fg: "#03661A" },
    pdf:   { bg: "#FBE5E5", fg: "#9E2626" },
    scan:  { bg: "#EFE8FF", fg: "#5A14C0" },
    other: { bg: "#EBEBEE", fg: "#5E5E6E" },
  }[kind] || { bg: "#EBEBEE", fg: "#5E5E6E" };
  const label = { sheet: "XLS", pdf: "PDF", scan: "IMG", other: "FIL" }[kind] || "FIL";
  return (
    <span className="i2-file-icon" style={{background: colors.bg, color: colors.fg, width: size + 6, height: size + 6, fontSize: size <= 14 ? 9 : 10}}>
      {label}
    </span>
  );
}

// Per-import-type templates; `null` means no template needed.
const I2_TEMPLATES = {
  "Upstream scope 3 – Spend data":               { name: "spend-data-template.xlsx",        kind: "sheet" },
  "Upstream scope 3 – Activity data":            { name: "activity-data-template.xlsx",     kind: "sheet" },
  "Stationary combustion (natural gas, fuels)":  { name: "stationary-combustion.xlsx",      kind: "sheet" },
  "Mobile combustion (fleet fuel, logistics)":   { name: "fleet-fuel-template.xlsx",        kind: "sheet" },
  "Purchased electricity":                       { name: "electricity-bills-template.xlsx", kind: "sheet" },
  "Employee commuting":                          { name: "employee-commuting.xlsx",         kind: "sheet" },
  "Business travel":                             { name: "business-travel.xlsx",            kind: "sheet" },
};

function I2Upload({ files, setFiles, importType, setImportType, onContinue, onBackToLog }) {
  const [dragOver, setDragOver] = React.useState(false);
  const [typeOpen, setTypeOpen] = React.useState(false);

  const addFiles = (incoming) => {
    const next = incoming.map(name => {
      const kind = fileKindFromName(name);
      const rows = kind === "sheet" ? Math.floor(200 + Math.random() * 800)
                  : kind === "pdf" ? Math.floor(1 + Math.random() * 12)
                  : 1;
      const size = kind === "sheet" ? `${(0.4 + Math.random() * 4).toFixed(1)} MB`
                 : kind === "pdf" ? `${(0.1 + Math.random() * 1.2).toFixed(1)} MB`
                 : `${(0.3 + Math.random() * 2).toFixed(1)} MB`;
      return { name, kind, rows, size };
    });
    setFiles(fs => [...fs, ...next]);
  };
  const removeFile = (name) => setFiles(fs => fs.filter(f => f.name !== name));

  const totalRows = files.reduce((s, f) => s + (f.rows || 0), 0);
  const hasType = !!importType;
  const ready = hasType && files.length > 0;
  const template = importType ? I2_TEMPLATES[importType] : null;

  return (
    <div className="i2-content">
      <div className="i2-head">
        <h1 className="i2-title">Upload your file</h1>
        <p className="i2-sub">
          Tell us what kind of data you're bringing in, then drop it in. Spreadsheets, PDF invoices or scanned bills — mix file types in a single import.
        </p>
      </div>

      <div className="i2-stack">
        {/* STEP A — Pick a data type */}
        <section className={"i2-stage " + (hasType ? "done" : "active")}>
          <div className="i2-stage-num">1</div>
          <div className="i2-stage-body">
            <div className="i2-stage-title">What kind of data are you importing?</div>
            <div className="i2-stage-sub">We use this to know which fields to extract and which template to suggest.</div>
            <div className="i2-stage-content">
              <div className="i2-select i2-select-wide">
                <button className={"i2-select-btn " + (hasType ? "" : "placeholder")} onClick={() => setTypeOpen(v => !v)}>
                  <span>{importType || "e.g. Electricity bills"}</span>
                  <Icon name="chev" size={14}/>
                </button>
                {typeOpen && (
                  <>
                    <div className="i2-overlay" onClick={() => setTypeOpen(false)}/>
                    <div className="i2-select-menu">
                      {I2_IMPORT_TYPES.map(t => (
                        <div key={t} className={"i2-select-item " + (t === importType ? "active" : "")}
                             onClick={() => { setImportType(t); setTypeOpen(false); }}>
                          {t}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* STEP B — (only when type picked) Need a template? */}
        {hasType && (
          <section className="i2-stage compact">
            <div className="i2-stage-num">2</div>
            <div className="i2-stage-body">
              <div className="i2-stage-title">Need a template for {importType.toLowerCase()}?</div>
              <div className="i2-stage-sub">Optional — using our template makes column mapping faster for spreadsheet uploads. Skip it for PDFs &amp; scans.</div>
              <div className="i2-stage-content i2-tpl-row">
                {template && (
                  <div className="i2-tpl-card">
                    <I2FileIcon kind={template.kind} size={16}/>
                    <div className="i2-tpl-card-body">
                      <div className="i2-tpl-card-name">{template.name}</div>
                      <div className="i2-tpl-card-meta">Pre-formatted for {importType}</div>
                    </div>
                    <button className="btn secondary small"
                            onClick={() => window.dispatchEvent(new CustomEvent("fe-toast", {detail: `Downloaded ${template.name}`}))}>
                      <Icon name="arrowDown" size={13}/>Download
                    </button>
                  </div>
                )}
                <span className="i2-tpl-skip">or skip and bring your own format</span>
              </div>
            </div>
          </section>
        )}

        {/* STEP C — Drop files (gated until type chosen) */}
        <section className={"i2-stage " + (hasType ? "active" : "locked")}>
          <div className="i2-stage-num">{hasType ? 3 : <Icon name="lock" size={14}/>}</div>
          <div className="i2-stage-body">
            <div className="i2-stage-title">Drop your files</div>
            <div className="i2-stage-sub">{hasType ? "One or many — mix XLSX, PDFs and scanned images in a single batch." : "Pick a data type first."}</div>
            <div className="i2-stage-content">
              <label className={`i2-drop ${dragOver ? "over" : ""} ${files.length ? "has-files" : ""} ${hasType ? "" : "disabled"}`}
                     onDragOver={e => { if (!hasType) return; e.preventDefault(); setDragOver(true); }}
                     onDragLeave={() => setDragOver(false)}
                     onDrop={e => {
                       if (!hasType) return;
                       e.preventDefault(); setDragOver(false);
                       const names = Array.from(e.dataTransfer.files || []).map(f => f.name);
                       if (names.length) addFiles(names);
                     }}>
                <input type="file" multiple accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg" style={{display:"none"}}
                       disabled={!hasType}
                       onChange={e => {
                         const names = Array.from(e.target.files || []).map(f => f.name);
                         if (names.length) addFiles(names);
                       }}/>
                <div className="i2-drop-inner">
                  <div className="i2-drop-icon"><Icon name="upload" size={28}/></div>
                  <div className="i2-drop-headline">Drop files here</div>
                  <div className="i2-drop-sub">
                    or <button className="i2-link-inline" disabled={!hasType}
                                onClick={e => { e.preventDefault(); if (!hasType) return; e.currentTarget.closest("label").querySelector("input[type=file]").click(); }}>browse</button>
                  </div>
                  <div className="i2-drop-formats">
                    <span className="i2-fmt"><span className="i2-fmt-tag sheet">XLSX</span>Spreadsheets</span>
                    <span className="i2-fmt"><span className="i2-fmt-tag sheet">CSV</span></span>
                    <span className="i2-fmt"><span className="i2-fmt-tag pdf">PDF</span>Invoices</span>
                    <span className="i2-fmt"><span className="i2-fmt-tag scan">IMG</span>Scans (OCR)</span>
                  </div>
                  {hasType && (
                    <div className="i2-drop-demos">
                      <button className="i2-demo-btn" onClick={e => { e.preventDefault();
                        addFiles(["2025_fleet_fuels.xlsx"]); }}>
                        <span className="i2-demo-tag sheet">XLSX</span>
                        Try a spreadsheet
                      </button>
                      <button className="i2-demo-btn" onClick={e => { e.preventDefault();
                        addFiles(["acme-invoice-feb-2026.pdf", "metamaterials-jan.pdf", "primepack-mar.pdf"]); }}>
                        <span className="i2-demo-tag pdf">PDF</span>
                        Try 3 PDF invoices
                      </button>
                      <button className="i2-demo-btn" onClick={e => { e.preventDefault();
                        addFiles(["scanned-bill-jan.jpg", "scanned-bill-feb.jpg"]); }}>
                        <span className="i2-demo-tag scan">IMG</span>
                        Try scanned bills
                      </button>
                    </div>
                  )}
                </div>
              </label>

              {files.length > 0 && (
                <div className="i2-file-list">
                  <div className="i2-file-list-head">
                    <span>{files.length} file{files.length === 1 ? "" : "s"} ready</span>
                    <span className="i2-file-list-meta">{totalRows.toLocaleString()} rows estimated · {files.reduce((s,f) => s + parseFloat(f.size), 0).toFixed(1)} MB</span>
                  </div>
                  {files.map(f => (
                    <div key={f.name} className="i2-file-row">
                      <I2FileIcon kind={f.kind}/>
                      <div className="i2-file-row-body">
                        <div className="i2-file-row-name">{f.name}</div>
                        <div className="i2-file-row-meta">
                          <span>{f.kind === "sheet" ? "Spreadsheet" : f.kind === "pdf" ? "PDF invoice" : f.kind === "scan" ? "Scanned bill" : "File"}</span>
                          <span>·</span>
                          <span>{f.rows} {f.rows === 1 ? "row" : "rows"} est.</span>
                          <span>·</span>
                          <span>{f.size}</span>
                        </div>
                      </div>
                      <button className="i2-file-row-x" onClick={() => removeFile(f.name)} title="Remove">
                        <Icon name="close" size={14}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="i2-footer">
        <button className="btn secondary" onClick={() => onBackToLog && onBackToLog()}>Cancel</button>
        <div className="i2-footer-right">
          {!hasType && <span className="i2-footer-note">Pick a data type to continue</span>}
          {hasType && !files.length && <span className="i2-footer-note">Add at least one file to continue</span>}
          <button className={"btn primary " + (ready ? "" : "disabled")}
                  disabled={!ready}
                  onClick={onContinue}>
            Continue to map columns <Icon name="arrowRight" size={14}/>
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PHASE 2 — MAP COLUMNS  (reuses v1's MapStep verbatim)
// =============================================================================
function I2MapColumns({ headers, mapping, setMapping, removedHeaders, setRemovedHeaders, otherRenames, setOtherRenames, onBack, onContinue }) {
  // The v1 MapStep is exported on window via BulkImport.jsx's IIFE? It's not — it's defined locally.
  // We re-render the v1 file's MapStep by referencing it on window if available, otherwise inline a thin wrapper.
  if (typeof window.MapStep === "function") {
    return <window.MapStep
      headers={headers}
      mapping={mapping} setMapping={setMapping}
      removedHeaders={removedHeaders} setRemovedHeaders={setRemovedHeaders}
      otherRenames={otherRenames} setOtherRenames={setOtherRenames}
      onBack={onBack} onContinue={onContinue}
    />;
  }
  // Fallback: render inside a card with a friendly footer override (v1 footer goes elsewhere).
  return (
    <div className="i2-content i2-content-flush">
      <window.__I2MapStepFallback
        headers={headers}
        mapping={mapping} setMapping={setMapping}
        removedHeaders={removedHeaders} setRemovedHeaders={setRemovedHeaders}
        otherRenames={otherRenames} setOtherRenames={setOtherRenames}
        onBack={onBack} onContinue={onContinue}
      />
    </div>
  );
}

// =============================================================================
// PHASE 3 — REPAIR DATA  (sample + transformations on one page)
// =============================================================================
function I2Repair({ files, report, setReport, onBack, onSubmit }) {
  const fileLabel = files[0]?.name || "your file";
  const fileSize = files[0]?.size || "—";
  const fileKindLabel = (() => {
    const k = files[0]?.kind || "sheet";
    return k === "sheet" ? "Excel (XLSX)" : k === "pdf" ? "PDF document" : k === "scan" ? "Scanned image" : "File";
  })();

  const updateStep = (id, fn) => {
    setReport(r => ({ ...r, steps: r.steps.map(s => s.id === id ? fn(s) : s) }));
  };

  return (
    <div className="i2-content">
      {/* File header */}
      <div className="i2-rep-filehead">
        <div>
          <h1 className="i2-rep-filename">{fileLabel}</h1>
          <div className="i2-rep-fileinfo">{fileSize} · {fileKindLabel}</div>
        </div>
        <button className="i2-rep-close" onClick={onBack} title="Back to mapping">
          <Icon name="close" size={18}/>
        </button>
      </div>

      {/* Processing summary */}
      <div className="i2-rep-summary">
        <div className="i2-rep-summary-icon"><Icon name="document" size={18}/></div>
        <div className="i2-rep-summary-body">
          <div className="i2-rep-summary-label">File processing summary</div>
          <div className="i2-rep-summary-row">
            <span>Total rows in file: <b>{report.rowsTotal.toLocaleString()}</b></span>
            <span>Total created entries: <b className="ok">{report.rowsClean.toLocaleString()}</b></span>
          </div>
        </div>
      </div>

      {/* Sample data */}
      <section className="i2-rep-section">
        <h2 className="i2-rep-h2">Sample transformed data</h2>
        <div className="i2-rep-sub">Showing first 5 of {report.rowsTotal.toLocaleString()} rows</div>
        <div className="i2-rep-table">
          <div className="i2-rep-table-row head">
            <div>Facility</div>
            <div>Category</div>
            <div>Consumption</div>
            <div>Period</div>
            <div>Status</div>
          </div>
          {I2_SAMPLE.map((r, i) => (
            <div key={i} className="i2-rep-table-row">
              <div>{r.facility}</div>
              <div>{r.category}</div>
              <div>{r.consumption}</div>
              <div className="mono">{r.period}</div>
              <div><span className="i2-status-pill valid">Valid</span></div>
            </div>
          ))}
        </div>
      </section>

      {/* Missing data */}
      {report.missing && report.missing.length > 0 && (
        <section className="i2-rep-section">
          <h2 className="i2-rep-h2">Missing data <span className="i2-rep-h2-count">{report.missing.length}</span></h2>
          <div className="i2-rep-sub">Fields our extraction couldn't capture confidently. Add them manually or skip — entries will still be created.</div>
          <div className="i2-missing-list">
            {report.missing.map(m => (
              <I2MissingRow key={m.id} item={m}
                onResolve={() => setReport(r => ({...r, missing: r.missing.filter(x => x.id !== m.id)}))}/>
            ))}
          </div>
        </section>
      )}

      {/* Transformation steps */}
      <section className="i2-rep-section">
        <h2 className="i2-rep-h2">Transformation steps</h2>
        <div className="i2-tx-list">
          {report.steps.map((s, i) => (
            <I2TxStep
              key={s.id}
              n={i + 2 /* "1." was column mapping in the previous step */}
              step={s}
              defaultOpen={i === 0}
              onUpdate={(fn) => updateStep(s.id, fn)}
            />
          ))}
        </div>
      </section>

      {/* Offline edit escape hatch */}
      <I2OfflineEdit fileLabel={fileLabel} report={report} setReport={setReport}/>

      <div className="i2-footer">
        <button className="btn secondary" onClick={onBack}>Back</button>
        <div className="i2-footer-right">
          <span className="i2-footer-note">
            <Icon name="check" size={12} style={{verticalAlign:"-2px", marginRight:4, color:"var(--fe-success-700)"}}/>
            {report.rowsClean.toLocaleString()} entries ready
          </span>
          <button className="btn primary" onClick={onSubmit}>
            Submit {report.rowsTotal.toLocaleString()} entries <Icon name="arrowRight" size={14}/>
          </button>
        </div>
      </div>
    </div>
  );
}

function I2OfflineEdit({ fileLabel, report, setReport }) {
  // states: idle | uploading | applied
  const [state, setState] = React.useState("idle");
  const [uploadedName, setUploadedName] = React.useState("");
  const fileRef = React.useRef(null);

  const reportName = (() => {
    const base = (fileLabel || "transformation-report").replace(/\.[^.]+$/, "");
    return `${base}-transformation-report.xlsx`;
  })();

  const handleDownload = () => {
    window.dispatchEvent(new CustomEvent("fe-toast", {
      detail: `Downloaded ${reportName} · ${report.rowsTotal.toLocaleString()} rows`,
    }));
  };

  const handlePickFile = () => fileRef.current?.click();

  const handleFileChosen = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadedName(f.name);
    setState("uploading");
    // Simulate processing the corrected file
    setTimeout(() => {
      setState("applied");
      // Mark missing items as resolved (the corrected file is the source of truth now)
      setReport(r => ({ ...r, missing: [] }));
      window.dispatchEvent(new CustomEvent("fe-toast", {
        detail: `Applied corrections from ${f.name}`,
      }));
    }, 1400);
    // Reset input so the same file can be re-chosen
    e.target.value = "";
  };

  const handleReset = () => {
    setState("idle");
    setUploadedName("");
  };

  return (
    <section className="i2-offline">
      <div className="i2-offline-cards">
        {/* DOWNLOAD CARD */}
        <div className="i2-offline-card">
          <div className="i2-offline-card-icon"><Icon name="download" size={20}/></div>
          <div className="i2-offline-card-body">
            <div className="i2-offline-card-title">Prefer working in Excel?</div>
            <div className="i2-offline-card-desc">
              Download the transformation report, make your changes, and upload it back.
            </div>
            <button className="i2-offline-btn" onClick={handleDownload}>
              <Icon name="download" size={14}/>
              Download transformation report
            </button>
          </div>
        </div>

        {/* UPLOAD CARD */}
        <div className="i2-offline-card">
          <div className="i2-offline-card-icon"><Icon name="upload" size={20}/></div>
          <div className="i2-offline-card-body">
            <div className="i2-offline-card-title">Upload corrected file</div>
            <div className="i2-offline-card-desc">
              Upload your corrected transformation report to apply changes.
            </div>

            <input ref={fileRef} type="file" style={{display:"none"}}
                   accept=".xlsx,.xls,.csv"
                   onChange={handleFileChosen}/>

            {state === "idle" && (
              <button className="i2-offline-drop" onClick={handlePickFile}>
                <Icon name="upload" size={14}/>
                Attach corrected file
              </button>
            )}

            {state === "uploading" && (
              <div className="i2-offline-status uploading">
                <span className="i2-spin"/>
                <div className="i2-offline-status-body">
                  <div className="i2-offline-status-name">{uploadedName}</div>
                  <div className="i2-offline-status-sub">Validating rows and re-applying changes…</div>
                </div>
              </div>
            )}

            {state === "applied" && (
              <div className="i2-offline-status applied">
                <span className="i2-offline-check"><Icon name="check" size={12}/></span>
                <div className="i2-offline-status-body">
                  <div className="i2-offline-status-name">{uploadedName}</div>
                  <div className="i2-offline-status-sub">
                    Applied · transformations above are now driven by your file
                  </div>
                </div>
                <button className="i2-offline-status-x" onClick={handleReset} title="Undo">
                  <Icon name="close" size={13}/>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="i2-offline-foot">
        <Icon name="info" size={12}/>
        <span>
          When you upload a corrected file, it replaces the AI's repairs above.
          Your column mapping is preserved.
        </span>
      </div>
    </section>
  );
}

function I2MissingRow({ item, onResolve }) {
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState("");
  return (
    <div className={"i2-missing " + item.severity}>
      <div className="i2-missing-icon">
        <Icon name={item.severity === "high" ? "warn" : "info"} size={14}/>
      </div>
      <div className="i2-missing-body">
        <div className="i2-missing-head">
          <span className="i2-missing-field">{item.field}</span>
          <span className="i2-missing-affected">{item.affected.toLocaleString()} {item.affected === 1 ? "row" : "rows"}</span>
        </div>
        <div className="i2-missing-issue">{item.issue}</div>
        <div className="i2-missing-example">{item.example}</div>
        {editing && (
          <div className="i2-missing-fixrow">
            <input className="i2-missing-input" autoFocus
                   placeholder={`Provide a default for ${item.field.toLowerCase()}…`}
                   value={val} onChange={e => setVal(e.target.value)}
                   onKeyDown={e => { if (e.key === "Enter" && val.trim()) onResolve(); }}/>
            <button className="btn primary small" disabled={!val.trim()} onClick={() => onResolve()}>Apply to {item.affected.toLocaleString()}</button>
            <button className="btn secondary small" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        )}
      </div>
      {!editing && (
        <div className="i2-missing-actions">
          <button className="btn secondary small" onClick={() => setEditing(true)}>Add value</button>
          <button className="i2-missing-skip" onClick={onResolve}>Skip</button>
        </div>
      )}
    </div>
  );
}

function I2TxStep({ n, step, defaultOpen, onUpdate }) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  return (
    <div className={"i2-tx-step " + (open ? "open " : "")}>
      <button className="i2-tx-step-head" onClick={() => setOpen(o => !o)}>
        <div className="i2-tx-step-num">{n}.</div>
        <div className="i2-tx-step-body">
          <div className="i2-tx-step-title">{step.title}</div>
          <div className="i2-tx-step-summary">{step.summary}</div>
        </div>
        <div className="i2-tx-step-meta">
          <Icon name="chev" size={14} style={{transform: open ? "rotate(180deg)" : "none", transition: "transform 160ms ease"}}/>
        </div>
      </button>

      {open && (
        <div className="i2-tx-step-content">
          <div className="i2-tx-mappings">
            <div className="i2-tx-mappings-title">{step.mappingsLabel}</div>
            <div className="i2-tx-mappings-list">
              {step.mappings.map((m, i) => (
                <I2Mapping key={i} mapping={m}
                  onEdit={(next) => onUpdate(s => ({
                    ...s,
                    mappings: s.mappings.map((x, j) => j === i ? next : x),
                  }))}
                  onDelete={() => onUpdate(s => ({
                    ...s,
                    mappings: s.mappings.filter((_, j) => j !== i),
                  }))}
                />
              ))}
              <I2AddMapping onAdd={(m) => onUpdate(s => ({...s, mappings: [...s.mappings, m]}))}/>
            </div>
          </div>

          <div className="i2-tx-why">
            <div className="i2-tx-why-label">Why this transformation</div>
            <div className="i2-tx-why-text">{step.why}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function I2Mapping({ mapping, onEdit, onDelete }) {
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(mapping.to);

  const commit = () => {
    onEdit({ ...mapping, to: val.trim() || mapping.to });
    setEditing(false);
  };

  return (
    <div className={"i2-mapping " + (editing ? "editing " : "")}>
      <div className="i2-mapping-pair">
        <div className="i2-mapping-from">{mapping.from}</div>
        <div className="i2-mapping-arrow"><Icon name="arrowRight" size={16}/></div>
        <div className="i2-mapping-to">
          {editing ? (
            <input
              autoFocus
              className="i2-mapping-input"
              value={val}
              onChange={e => setVal(e.target.value)}
              onBlur={commit}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); commit(); }
                if (e.key === "Escape") { e.preventDefault(); setVal(mapping.to); setEditing(false); }
              }}
            />
          ) : (
            <span>{mapping.to}</span>
          )}
        </div>
        {mapping.factor && !editing
          ? <div className="i2-mapping-factor">Factor: {mapping.factor}</div>
          : <div className="i2-mapping-factor-empty"></div>}
      </div>
      <div className="i2-mapping-right">
        <div className="i2-mapping-rows">{mapping.rows.toLocaleString()} rows</div>
        <div className="i2-mapping-actions">
          {!mapping.undeletable && (
            <button className="i2-mapping-x edit" onClick={() => setEditing(e => !e)} title="Edit override">
              <Icon name="pencil" size={13}/>
            </button>
          )}
          <button className="i2-mapping-x" onClick={onDelete} title="Remove this mapping" disabled={mapping.undeletable && false}>
            <Icon name="trash" size={13}/>
          </button>
        </div>
      </div>
    </div>
  );
}

function I2AddMapping({ onAdd }) {
  const [open, setOpen] = React.useState(false);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const commit = () => {
    if (!from.trim() || !to.trim()) return;
    onAdd({ from: from.trim(), to: to.trim(), rows: 0, _userAdded: true });
    setFrom(""); setTo(""); setOpen(false);
  };
  if (!open) {
    return (
      <button className="i2-mapping-add" onClick={() => setOpen(true)}>
        <Icon name="plus" size={13}/> Add mapping
      </button>
    );
  }
  return (
    <div className="i2-mapping i2-mapping-new">
      <div className="i2-mapping-pair">
        <input className="i2-mapping-input from" autoFocus
               placeholder="From (raw value)"
               value={from} onChange={e => setFrom(e.target.value)}/>
        <div className="i2-mapping-arrow"><Icon name="arrowRight" size={16}/></div>
        <input className="i2-mapping-input"
               placeholder="To (standardized value)"
               value={to} onChange={e => setTo(e.target.value)}
               onKeyDown={e => { if (e.key === "Enter") commit(); }}/>
        <div className="i2-mapping-factor-empty"></div>
      </div>
      <div className="i2-mapping-right">
        <div className="i2-mapping-rows">—</div>
        <div className="i2-mapping-actions">
          <button className="i2-mapping-x save" onClick={commit} title="Save">
            <Icon name="check" size={13}/>
          </button>
          <button className="i2-mapping-x" onClick={() => { setOpen(false); setFrom(""); setTo(""); }} title="Cancel">
            <Icon name="close" size={13}/>
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PHASE 4 — DONE
// =============================================================================
function I2Done({ report, files, onNew, onView }) {
  return (
    <div className="i2-content i2-done">
      <div className="i2-done-card">
        <div className="i2-done-icon"><Icon name="check" size={32}/></div>
        <h1 className="i2-done-title">Import submitted</h1>
        <p className="i2-done-sub">
          {report.rowsTotal.toLocaleString()} entries are now in your data, ready to be calculated against emission factors.
        </p>
        <div className="i2-done-stats">
          <div><b>{report.rowsTotal.toLocaleString()}</b><span>Entries created</span></div>
          <div><b>{report.steps.length}</b><span>Transformations applied</span></div>
          <div><b>0</b><span>Rejected rows</span></div>
        </div>
        <div className="i2-done-next">
          <div className="i2-done-next-label">Next up</div>
          <ol className="i2-done-next-list">
            <li>The matching engine is now suggesting an emission factor for each entry.</li>
            <li>You'll be notified when suggestions are ready (typically within a minute).</li>
            <li>Confirm or override on the <b>Data</b> page.</li>
          </ol>
        </div>
        <div className="i2-done-actions">
          <button className="btn secondary" onClick={onNew}>Start another import</button>
          <button className="btn primary" onClick={onView}>
            View imported data <Icon name="arrowRight" size={14}/>
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// IMPORT DETAIL — historic batch, shown with the same 3-step progress
// =============================================================================
const I2_ROW_COUNT_BY_ID = {
  "B-2026-PG":   128462,
  "B-2026-Q1":    24817,
  "B-2026-FUEL":  86419,
  "B-2026-02":  1203544,
};
const I2_TYPE_BY_ID = {
  "B-2026-PG":   "Upstream scope 3 – Spend data",
  "B-2026-Q1":   "Business travel",
  "B-2026-FUEL": "Mobile combustion (fleet fuel, logistics)",
  "B-2026-02":   "Purchased electricity",
};
function I2ImportDetail({ batch, onBack, onViewEntries, onEditStep }) {
  const rowCount = I2_ROW_COUNT_BY_ID[batch.id] ?? batch.rowCount ?? 0;
  const dataType = I2_TYPE_BY_ID[batch.id] || "—";
  const transformsApplied = batch.status === "partial" ? 3 : 4;
  const sourceLabel = batch.source === "erp" ? "ERP connector"
    : batch.source === "csv" ? "CSV"
    : batch.source === "pdf" ? "PDF invoice"
    : "Spreadsheet";

  // Which stage is currently expanded (only one at a time, default: none)
  const [openStage, setOpenStage] = React.useState(null);
  // Edit confirmation modal: which stage is the user trying to edit?
  const [editTarget, setEditTarget] = React.useState(null);

  const stages = [
    {
      key: "upload",
      title: "Upload",
      sub: `${batch.fileName || batch.label} · ${sourceLabel}`,
      content: (
        <I2DetailUpload batch={batch} sourceLabel={sourceLabel} dataType={dataType} rowCount={rowCount}/>
      ),
      editLabel: "Replace file or change data type",
      // Editing upload nukes everything downstream
      resetWarning: {
        scope: "all downstream steps",
        affects: [
          { label: "Column mappings", count: "all" },
          { label: "Transformations", count: `${transformsApplied} applied` },
          { label: "Created entries", count: rowCount.toLocaleString() },
          { label: "Emission calculations", count: rowCount.toLocaleString() },
        ],
      },
    },
    {
      key: "map",
      title: "Map columns",
      sub: "All required fields matched automatically",
      content: <I2DetailMap batch={batch}/>,
      editLabel: "Re-map columns",
      resetWarning: {
        scope: "transformations and calculations",
        affects: [
          { label: "Transformations", count: `${transformsApplied} applied` },
          { label: "Created entries", count: rowCount.toLocaleString() },
          { label: "Emission calculations", count: rowCount.toLocaleString() },
        ],
      },
    },
    {
      key: "repair",
      title: "Repair data",
      sub: `${transformsApplied} transformations applied · ${rowCount.toLocaleString()} entries created${batch.status === "partial" ? " · some rows need attention" : ""}`,
      content: <I2DetailRepair batch={batch} rowCount={rowCount} transformsApplied={transformsApplied}/>,
      editLabel: "Edit transformations",
      resetWarning: {
        scope: "calculations only",
        affects: [
          { label: "Affected entries", count: rowCount.toLocaleString() },
          { label: "Emission calculations", count: rowCount.toLocaleString() },
        ],
      },
    },
  ];

  const editing = editTarget ? stages.find(s => s.key === editTarget) : null;

  return (
    <div className="i2-page">
      <button className="i2-detail-back" onClick={onBack}>
        <Icon name="chev" size={14} style={{transform:"rotate(90deg)"}}/> Back to imports
      </button>
      <div className="i2-content">
        <div className="i2-rep-filehead">
          <div>
            <h1 className="i2-rep-filename">{batch.fileName || batch.label}</h1>
            <div className="i2-rep-fileinfo">
              {batch.id} · {sourceLabel} · {dataType} · uploaded by {batch.uploadedBy} on {batch.date}
            </div>
          </div>
          <div>
            {batch.status === "completed" && <span className="i2-pill ok"><Icon name="check" size={11}/>Completed</span>}
            {batch.status === "partial" && <span className="i2-pill warn"><Icon name="warn" size={11}/>Partial</span>}
          </div>
        </div>

        <div className="i2-stack i2-detail-stack">
          {stages.map((s, i) => {
            const isOpen = openStage === s.key;
            const partial = batch.status === "partial" && s.key === "repair";
            return (
              <div key={s.key} className={"i2-stage done i2-detail-stage " + (isOpen ? "expanded " : "") + (partial ? "warn " : "")}>
                <button className="i2-detail-stage-head" onClick={() => setOpenStage(o => o === s.key ? null : s.key)}>
                  <div className="i2-stage-num">{partial ? "!" : "✓"}</div>
                  <div className="i2-stage-body">
                    <div className="i2-stage-title">
                      <span className="i2-detail-stage-step">Step {i + 1}</span>
                      {" "}{s.title}
                    </div>
                    <div className="i2-stage-sub">{s.sub}</div>
                  </div>
                  <div className="i2-detail-stage-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn ghost small" onClick={() => setEditTarget(s.key)}>
                      <Icon name="pencil" size={13}/> Edit
                    </button>
                    <button className="i2-detail-chev" onClick={() => setOpenStage(o => o === s.key ? null : s.key)}
                            aria-label={isOpen ? "Collapse" : "Expand"}>
                      <Icon name="chev" size={14} style={{transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 160ms ease"}}/>
                    </button>
                  </div>
                </button>
                {isOpen && (
                  <div className="i2-detail-stage-content">
                    {s.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="i2-footer">
          <button className="btn secondary" onClick={onBack}>Back</button>
          <button className="btn primary" onClick={() => onViewEntries?.(batch.id)}>
            View {rowCount.toLocaleString()} entries <Icon name="arrowRight" size={14}/>
          </button>
        </div>
      </div>

      {editing && (
        <I2EditConfirmModal
          stage={editing}
          batch={batch}
          onCancel={() => setEditTarget(null)}
          onConfirm={() => {
            setEditTarget(null);
            onEditStep?.(batch, editing.key);
          }}
        />
      )}
    </div>
  );
}

// ---- Stage detail content components ----------------------------------------
// Per-batch raw file manifests. Each item represents an original file we
// retained on upload — users can click to view/download for audit.
const I2_RAW_FILES_BY_ID = {
  "B-2026-Q1": null, // ERP sync — no raw file
  "B-2026-FUEL": [
    { name: "fleet-fuel-q1-2026.xlsx", size: "3.2 MB", kind: "xlsx", pages: null, rows: 86419 },
  ],
  "B-2026-PG": [
    { name: "spend-q1-2026.csv", size: "1.4 MB", kind: "csv", pages: null, rows: 128462 },
  ],
  // Electricity batch was uploaded as a stack of utility bill PDFs (one per site/month)
  "B-2026-02": [
    { name: "ConEd_HQ-NYC_Feb2026.pdf",          size: "1.8 MB", kind: "pdf", pages: 4 },
    { name: "ConEd_Brooklyn-DC_Feb2026.pdf",     size: "2.1 MB", kind: "pdf", pages: 6 },
    { name: "PG&E_SanFrancisco_Feb2026.pdf",     size: "1.4 MB", kind: "pdf", pages: 3 },
    { name: "PG&E_Sacramento-WH_Feb2026.pdf",    size: "1.6 MB", kind: "pdf", pages: 4 },
    { name: "EDF_Paris-Office_Feb2026.pdf",      size: "0.9 MB", kind: "pdf", pages: 2 },
    { name: "EDF_Lyon-Plant_Feb2026.pdf",        size: "1.2 MB", kind: "pdf", pages: 3 },
    { name: "BritishGas_London-HQ_Feb2026.pdf",  size: "1.1 MB", kind: "pdf", pages: 3 },
    { name: "BritishGas_Manchester_Feb2026.pdf", size: "0.8 MB", kind: "pdf", pages: 2 },
    { name: "EnBW_Stuttgart-Plant_Feb2026.pdf",  size: "0.7 MB", kind: "pdf", pages: 2 },
    { name: "EnBW_Munich-DC_Feb2026.pdf",        size: "0.9 MB", kind: "pdf", pages: 3 },
    { name: "TEPCO_Tokyo-Office_Feb2026.pdf",    size: "0.6 MB", kind: "pdf", pages: 2 },
    { name: "TEPCO_Yokohama-Plant_Feb2026.pdf",  size: "0.8 MB", kind: "pdf", pages: 3 },
    { name: "scanned-utility-batch-jan26.zip",   size: "8.4 MB", kind: "zip", pages: null, note: "47 scanned bills (OCR-extracted)" },
  ],
};

function I2RawFileIcon({ kind }) {
  const tone = kind === "pdf" ? "pdf" : kind === "csv" ? "csv" : kind === "xlsx" ? "xlsx" : "zip";
  const label = kind === "xlsx" ? "XLS" : kind.toUpperCase();
  return <span className={"i2-raw-fileicon i2-raw-fileicon-" + tone}>{label}</span>;
}

function I2DetailUpload({ batch, sourceLabel, dataType, rowCount }) {
  const rawFiles = I2_RAW_FILES_BY_ID[batch.id];
  const totalSize = rawFiles
    ? rawFiles.reduce((acc, f) => acc + parseFloat(f.size), 0).toFixed(1) + " MB"
    : "Live sync";
  const fileCount = rawFiles ? rawFiles.length : 0;

  // Show 8 PDFs by default; expandable when there are more
  const [showAll, setShowAll] = React.useState(false);
  const visible = !rawFiles ? [] : (showAll ? rawFiles : rawFiles.slice(0, 8));

  return (
    <div className="i2-detail-grid">
      <div className="i2-detail-meta">
        <div><span>Source</span><b>{sourceLabel}</b></div>
        <div><span>Data type</span><b>{dataType}</b></div>
        <div><span>{fileCount > 1 ? "Files uploaded" : "File size"}</span>
          <b>{fileCount > 1 ? `${fileCount} files · ${totalSize}` : totalSize}</b></div>
        <div><span>Rows imported</span><b>{rowCount.toLocaleString()}</b></div>
        <div><span>Uploaded by</span><b>{batch.uploadedBy}</b></div>
        <div><span>Uploaded on</span><b>{batch.date}</b></div>
      </div>

      {rawFiles && rawFiles.length > 0 && (
        <div className="i2-raw-files">
          <div className="i2-raw-files-head">
            <div className="i2-raw-files-title">
              {fileCount > 1 ? `Original files (${fileCount})` : "Original file"}
            </div>
            <div className="i2-raw-files-sub">
              Retained for audit · click any file to preview or download.
            </div>
          </div>
          <div className="i2-raw-files-list">
            {visible.map((f, i) => (
              <a key={i} className="i2-raw-file" href="#"
                 onClick={(e) => { e.preventDefault(); }}>
                <I2RawFileIcon kind={f.kind}/>
                <div className="i2-raw-file-body">
                  <div className="i2-raw-file-name">{f.name}</div>
                  <div className="i2-raw-file-meta">
                    {f.size}
                    {f.pages != null && <> · {f.pages} pages</>}
                    {f.rows != null && <> · {f.rows.toLocaleString()} rows</>}
                    {f.note && <> · {f.note}</>}
                  </div>
                </div>
                <div className="i2-raw-file-actions">
                  <span className="i2-raw-file-action" title="Preview">
                    <Icon name="eye" size={14}/>
                  </span>
                  <span className="i2-raw-file-action" title="Download">
                    <Icon name="download" size={14}/>
                  </span>
                </div>
              </a>
            ))}
          </div>
          {rawFiles.length > 8 && (
            <button className="i2-raw-files-more" onClick={() => setShowAll(s => !s)}>
              {showAll ? "Show fewer" : `Show all ${rawFiles.length} files`}
            </button>
          )}
        </div>
      )}

      {batch.source === "erp" ? (
        <div className="i2-detail-note">
          <Icon name="info" size={13}/>
          This batch was synced from your <b>SAP Concur</b> connector. Re-syncing will pull the latest period and replace this batch.
        </div>
      ) : (
        <div className="i2-detail-note">
          <Icon name="info" size={13}/>
          {fileCount > 1
            ? <>All {fileCount} original files are retained for audit. Replacing them will re-run extraction across the full batch.</>
            : <>The original file is retained for audit. Replacing it will re-run extraction from the new file.</>}
        </div>
      )}
    </div>
  );
}

function I2DetailMap({ batch }) {
  // Realistic per-batch mapping snapshots
  const mappingsByType = {
    "B-2026-Q1": [
      { from: "Trip ID",        to: "Reference" },
      { from: "Traveler",       to: "Employee" },
      { from: "Departure City", to: "Origin" },
      { from: "Arrival City",   to: "Destination" },
      { from: "Distance (km)",  to: "Distance" },
      { from: "Cabin Class",    to: "Travel class" },
      { from: "Trip Date",      to: "Activity date" },
      { from: "Cost Center",    to: "Cost center" },
    ],
    "B-2026-FUEL": [
      { from: "Vehicle ID",   to: "Asset" },
      { from: "Facility Code",to: "Site" },
      { from: "Fuel Type",    to: "Fuel" },
      { from: "Volume",       to: "Quantity" },
      { from: "Unit",         to: "Unit" },
      { from: "Date",         to: "Activity date" },
      { from: "Driver Name",  to: "— Skipped" },
      { from: "Cost Center",  to: "Cost center" },
      { from: "Notes",        to: "— Skipped" },
    ],
    "B-2026-PG": [
      { from: "PO Number",     to: "Reference" },
      { from: "Vendor Name",   to: "Supplier" },
      { from: "GL Account",    to: "Spend category" },
      { from: "Amount",        to: "Quantity" },
      { from: "Currency",      to: "Currency" },
      { from: "Invoice Date",  to: "Activity date" },
      { from: "Cost Center",   to: "Cost center" },
    ],
    "B-2026-02": [
      { from: "Site Code",      to: "Site" },
      { from: "Meter ID",       to: "Asset" },
      { from: "kWh Consumed",   to: "Quantity" },
      { from: "Period Start",   to: "Activity date" },
      { from: "Period End",     to: "End date" },
      { from: "Supplier",       to: "Supplier" },
      { from: "Tariff",         to: "— Skipped" },
    ],
  };
  const mappings = mappingsByType[batch.id] || mappingsByType["B-2026-FUEL"];
  return (
    <div className="i2-detail-grid">
      <div className="i2-detail-mapping-head">
        <span>File column</span>
        <span></span>
        <span>Mapped to</span>
      </div>
      <div className="i2-detail-mapping-list">
        {mappings.map((m, i) => (
          <div key={i} className={"i2-detail-mapping-row " + (m.to.startsWith("—") ? "skipped " : "")}>
            <span className="i2-detail-mapping-from">{m.from}</span>
            <Icon name="arrowRight" size={14}/>
            <span className="i2-detail-mapping-to">{m.to}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function I2DetailRepair({ batch, rowCount, transformsApplied }) {
  // Realistic per-batch transformation snapshots, with mappings
  const transformsByType = {
    "B-2026-Q1": [
      { title: "Cabin class normalization", summary: "Mapped 6 cabin variants to 4 standard classes",
        affected: 24817, why: "Cabin class drives the radiative-forcing multiplier; harmonized to GHG Protocol classes.",
        mappings: [
          { from: "Coach",          to: "Economy",         rows: 14823 },
          { from: "Y",              to: "Economy",         rows: 1442 },
          { from: "Premium Coach",  to: "Premium Economy", rows: 2107 },
          { from: "Business Class", to: "Business",        rows: 4892 },
          { from: "J",              to: "Business",        rows: 612 },
          { from: "First Class",    to: "First",           rows: 941 },
        ]},
      { title: "Distance unit conversion",  summary: "Miles → kilometers (×1.60934) on 4,212 rows",
        affected: 4212, why: "Distance must be in km to match DEFRA/UK BEIS factors.",
        mappings: [
          { from: "Miles",      to: "Kilometers", rows: 4212, factor: "×1.60934" },
          { from: "Kilometers", to: "Kilometers", rows: 20605, factor: "×1" },
        ]},
      { title: "Airport code expansion", summary: "IATA codes → city pairs for 19,304 trips",
        affected: 19304, why: "City pairs are needed to compute great-circle distance when distance is missing.",
        mappings: [
          { from: "JFK → LHR",  to: "New York → London",   rows: 1842 },
          { from: "SFO → NRT",  to: "San Francisco → Tokyo", rows: 1207 },
          { from: "CDG → BER",  to: "Paris → Berlin",      rows: 2941 },
          { from: "LAX → ORD",  to: "Los Angeles → Chicago", rows: 3628 },
        ]},
      { title: "Date format standardization", summary: "MM/DD/YYYY → ISO 8601 across all rows",
        affected: 24817, why: "ISO dates enable consistent period bucketing.",
        mappings: [
          { from: "MM/DD/YYYY",  to: "YYYY-MM-DD", rows: 18204 },
          { from: "DD-Mon-YYYY", to: "YYYY-MM-DD", rows: 6613 },
        ]},
    ],
    "B-2026-FUEL": [
      { title: "Fuel name standardization", summary: "Standardized 5 fuel type variants",
        affected: 22784, why: "Match emission factor database fuel taxonomy.",
        mappings: [
          { from: "Diesel fuel",      to: "Diesel",        rows: 4621 },
          { from: "Premium gasoline", to: "Gasoline",      rows: 4487 },
          { from: "Biodiesel",        to: "Biodiesel B20", rows: 4556 },
          { from: "Blue fuel",        to: "Diesel",        rows: 4612 },
          { from: "Regular gas",      to: "Gasoline",      rows: 4508 },
        ]},
      { title: "Unit conversion", summary: "Mixed volume units → liters",
        affected: 22784, why: "Liters required for emission factor application.",
        mappings: [
          { from: "Gallons",      to: "Liters", rows: 13567, factor: "×3.78541" },
          { from: "Cubic meters", to: "Liters", rows: 1384,  factor: "×1000" },
          { from: "Liters",       to: "Liters", rows: 7833,  factor: "×1" },
        ]},
      { title: "Date format standardization", summary: "3 date formats → ISO 8601",
        affected: 22784, why: "Period analysis requires consistent date format.",
        mappings: [
          { from: "DD-MMM-YYYY", to: "YYYY-MM-DD", rows: 8921 },
          { from: "YYYY-MM-DD",  to: "YYYY-MM-DD", rows: 6347 },
          { from: "MM/DD/YYYY",  to: "YYYY-MM-DD", rows: 7516 },
        ]},
      { title: "Location mapping", summary: "Facility codes → business units",
        affected: 22784, why: "Facility codes are mapped to BUs so emissions roll up correctly.",
        mappings: [
          { from: "SLC-01",  to: "Salt Lake Manufacturing", rows: 2457 },
          { from: "BER-HQ",  to: "Berlin HQ Building",      rows: 1823 },
          { from: "SEA-OFF", to: "Seattle Office Complex",  rows: 2104 },
          { from: "LON-TWR", to: "London Office Tower",     rows: 1967 },
          { from: "NYC-WH",  to: "NYC Distribution Center", rows: 2341 },
        ]},
    ],
    "B-2026-PG": [
      { title: "Currency normalization", summary: "Multi-currency → EUR (FX as of activity date)",
        affected: 84219, why: "Spend-based factors are EUR-denominated.",
        mappings: [
          { from: "USD", to: "EUR", rows: 39204, factor: "FX rate at txn date" },
          { from: "GBP", to: "EUR", rows: 12877, factor: "FX rate at txn date" },
          { from: "JPY", to: "EUR", rows: 8431,  factor: "FX rate at txn date" },
          { from: "EUR", to: "EUR", rows: 23707, factor: "×1" },
        ]},
      { title: "GL → spend category", summary: "Mapped 142 GL accounts to 18 spend categories",
        affected: 128462, why: "EXIOBASE spend factors are mapped at category level.",
        mappings: [
          { from: "6010 Office Supplies",      to: "Office equipment", rows: 4812 },
          { from: "6105 Cloud Hosting",        to: "IT services",      rows: 11240 },
          { from: "6200 Professional Services",to: "Consulting",       rows: 8731 },
          { from: "6310 Marketing",            to: "Advertising",      rows: 5621 },
        ]},
      { title: "Vendor deduplication", summary: "Merged 24 supplier name variants",
        affected: 47821, why: "Multiple spellings of the same supplier inflate vendor counts.",
        mappings: [
          { from: "AWS, Inc.",         to: "Amazon Web Services", rows: 8243 },
          { from: "AMZN Web Services", to: "Amazon Web Services", rows: 1144 },
          { from: "Microsoft Corp.",   to: "Microsoft",            rows: 6231 },
        ]},
    ],
    "B-2026-02": [
      { title: "Energy unit conversion", summary: "MWh / GJ → kWh on 312 rows",
        affected: 312, why: "kWh required for grid emission factor application.",
        mappings: [
          { from: "MWh", to: "kWh", rows: 184, factor: "×1000" },
          { from: "GJ",  to: "kWh", rows: 128, factor: "×277.778" },
          { from: "kWh", to: "kWh", rows: 1203232, factor: "×1" },
        ]},
      { title: "Site code mapping", summary: "Internal codes → business units",
        affected: 1203544, why: "Site codes mapped to BUs for roll-up.",
        mappings: [
          { from: "DE-FRA-01",  to: "Frankfurt Office", rows: 121847 },
          { from: "UK-LON-HQ",  to: "London HQ",        rows: 184302 },
          { from: "FR-PAR-OFF", to: "Paris Office",     rows: 96420 },
        ]},
      { title: "Period split", summary: "Long periods split into monthly buckets",
        affected: 14820, why: "Monthly periods enable accurate intensity reporting.",
        mappings: [
          { from: "Quarterly readings", to: "Monthly", rows: 14820 },
        ]},
      { title: "Date format standardization", summary: "DD-MM-YYYY → ISO 8601",
        affected: 1203544, why: "Consistent date format across the batch.",
        mappings: [
          { from: "DD-MM-YYYY", to: "YYYY-MM-DD", rows: 1203544 },
        ]},
    ],
  };
  const transforms = (transformsByType[batch.id] || transformsByType["B-2026-FUEL"]).slice(0, transformsApplied);

  // Sample preview rows
  const samplesByType = {
    "B-2026-Q1": {
      cols: ["Traveler", "Origin", "Destination", "Distance", "Class", "Date"],
      rows: [
        ["A. Schmidt",   "Berlin",        "London",    "1,107 km",  "Economy",  "2026-01-12"],
        ["M. Garcia",    "Madrid",        "New York",  "5,775 km",  "Business", "2026-01-18"],
        ["L. Tanaka",    "Tokyo",         "San Francisco", "8,272 km", "Premium Economy", "2026-02-03"],
        ["P. Dubois",    "Paris",         "Berlin",    "877 km",    "Economy",  "2026-02-14"],
        ["K. Andersson", "Stockholm",     "Amsterdam", "1,134 km",  "Economy",  "2026-03-02"],
      ],
    },
    "B-2026-FUEL": {
      cols: ["Facility", "Fuel", "Quantity", "Date"],
      rows: [
        ["Salt Lake Manufacturing", "Diesel",        "290.1 L",  "2026-01-01"],
        ["Berlin HQ Building",      "Gasoline",      "288.8 L",  "2026-01-02"],
        ["Seattle Office Complex",  "Biodiesel B20", "216.7 L",  "2026-01-03"],
        ["London Office Tower",     "Diesel",        "329.3 L",  "2026-01-04"],
        ["NYC Distribution Center", "Gasoline",      "174.4 L",  "2026-01-05"],
      ],
    },
    "B-2026-PG": {
      cols: ["Supplier", "Category", "Amount", "Date"],
      rows: [
        ["Amazon Web Services", "IT services",      "€41,820.50", "2026-01-08"],
        ["Microsoft",           "Software licenses","€18,200.00", "2026-01-12"],
        ["Deloitte",            "Consulting",       "€92,140.00", "2026-01-22"],
        ["WeWork",              "Real estate",      "€14,650.00", "2026-02-01"],
        ["Salesforce",          "IT services",      "€27,330.00", "2026-02-15"],
      ],
    },
    "B-2026-02": {
      cols: ["Site", "Quantity", "Period start", "Period end"],
      rows: [
        ["Frankfurt Office", "184,210 kWh", "2026-01-01", "2026-01-31"],
        ["London HQ",        "412,840 kWh", "2026-01-01", "2026-01-31"],
        ["Paris Office",     "96,420 kWh",  "2026-01-01", "2026-01-31"],
        ["Madrid Office",    "61,820 kWh",  "2026-01-01", "2026-01-31"],
        ["Stockholm Office", "44,210 kWh",  "2026-01-01", "2026-01-31"],
      ],
    },
  };
  const sample = samplesByType[batch.id] || samplesByType["B-2026-FUEL"];

  const [openTx, setOpenTx] = React.useState(null);
  const [showSample, setShowSample] = React.useState(true);

  return (
    <div className="i2-detail-grid">
      <div className="i2-detail-stats">
        <div><b>{rowCount.toLocaleString()}</b><span>Entries created</span></div>
        <div><b>{transformsApplied}</b><span>Transformations applied</span></div>
        <div><b>{batch.status === "partial" ? Math.floor(rowCount * 0.012).toLocaleString() : "0"}</b><span>Need attention</span></div>
      </div>

      {/* Sample preview */}
      <div className="i2-detail-sample">
        <button className="i2-detail-sample-head" onClick={() => setShowSample(s => !s)}>
          <span className="i2-detail-sample-title">Sample of created entries</span>
          <span className="i2-detail-sample-meta">{sample.rows.length} of {rowCount.toLocaleString()}</span>
          <Icon name="chev" size={14} style={{transform: showSample ? "rotate(180deg)" : "none", transition: "transform 160ms ease", color: "var(--fe-fg-muted)"}}/>
        </button>
        {showSample && (
          <div className="i2-detail-sample-table">
            <div className="i2-detail-sample-row head" style={{gridTemplateColumns: `repeat(${sample.cols.length}, 1fr)`}}>
              {sample.cols.map(c => <div key={c}>{c}</div>)}
            </div>
            {sample.rows.map((r, i) => (
              <div key={i} className="i2-detail-sample-row" style={{gridTemplateColumns: `repeat(${sample.cols.length}, 1fr)`}}>
                {r.map((cell, j) => <div key={j}>{cell}</div>)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transformations — expandable */}
      <div className="i2-detail-tx-list">
        {transforms.map((t, i) => {
          const isOpen = openTx === i;
          return (
            <div key={i} className={"i2-detail-tx-item " + (isOpen ? "open " : "")}>
              <button className="i2-detail-tx" onClick={() => setOpenTx(o => o === i ? null : i)}>
                <div className="i2-detail-tx-num">{i + 1}.</div>
                <div className="i2-detail-tx-textcol">
                  <div className="i2-detail-tx-title">{t.title}</div>
                  <div className="i2-detail-tx-sum">{t.summary}</div>
                </div>
                <div className="i2-detail-tx-meta">
                  {t.affected != null && <span className="i2-detail-tx-rows">{t.affected.toLocaleString()} rows</span>}
                  <Icon name="chev" size={13} style={{transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 160ms ease", color: "var(--fe-fg-muted)"}}/>
                </div>
              </button>
              {isOpen && (
                <div className="i2-detail-tx-body">
                  <div className="i2-detail-tx-mappings">
                    {(t.mappings || []).map((m, j) => (
                      <div key={j} className="i2-detail-tx-mapping">
                        <span className="i2-detail-tx-mapping-from">{m.from}</span>
                        <Icon name="arrowRight" size={13}/>
                        <span className="i2-detail-tx-mapping-to">{m.to}</span>
                        {m.factor && <span className="i2-detail-tx-mapping-factor">{m.factor}</span>}
                        <span className="i2-detail-tx-mapping-rows">{m.rows.toLocaleString()} rows</span>
                      </div>
                    ))}
                  </div>
                  {t.why && (
                    <div className="i2-detail-tx-why">
                      <div className="i2-detail-tx-why-label">Why this transformation</div>
                      <div>{t.why}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function I2EditConfirmModal({ stage, batch, onCancel, onConfirm }) {
  return (
    <div className="i2-modal-backdrop" onClick={onCancel}>
      <div className="i2-modal" onClick={(e) => e.stopPropagation()}>
        <div className="i2-modal-icon"><Icon name="warn" size={20}/></div>
        <h2 className="i2-modal-title">Edit "{stage.title}"?</h2>
        <p className="i2-modal-body">
          This batch is already processed. Editing this step will reset {stage.resetWarning.scope}, and you'll need to re-run the import to regenerate them.
        </p>
        <div className="i2-modal-affected">
          <div className="i2-modal-affected-label">What will be reset</div>
          <ul>
            {stage.resetWarning.affects.map((a, i) => (
              <li key={i}>
                <span>{a.label}</span>
                <b>{a.count}</b>
              </li>
            ))}
          </ul>
        </div>
        <div className="i2-modal-actions">
          <button className="btn secondary" onClick={onCancel}>Cancel</button>
          <button className="btn danger" onClick={onConfirm}>
            Reset and edit <Icon name="arrowRight" size={13}/>
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// HOME — landing page that hosts v2
// =============================================================================
function ImportsV2Home({ onViewEntries }) {
  const [mode, setMode] = React.useState(() => localStorage.getItem("fe-i2-mode") || "log");
  const [detailId, setDetailId] = React.useState(null);
  const [editingFromBatch, setEditingFromBatch] = React.useState(null); // { batchId, phase }
  React.useEffect(() => { localStorage.setItem("fe-i2-mode", mode); }, [mode]);

  const entries = window.ENTRIES || [];
  const batches = (window.BATCHES || [])
    .filter(b => b.source !== "manual")
    .map(b => {
      const rows = entries.filter(e => e.batchId === b.id);
      const failed = rows.filter(e => e.entry_status === "processing" || e.entry_status === "attention").length;
      return {
        ...b,
        rowCount: I2_ROW_COUNT_BY_ID[b.id] ?? (rows.length * 1000 + Math.floor(Math.random() * 90000) + 12000),
        failed,
        status: b.source === "erp" ? "completed" : (failed > 0 ? "partial" : "completed"),
      };
    }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (mode === "wizard") {
    return (
      <div>
        <ImportsV2
          editingFromBatch={editingFromBatch}
          onFinish={() => { setMode("log"); setEditingFromBatch(null); }}
          onBackToLog={() => { setMode("log"); setEditingFromBatch(null); }}
          onViewEntries={(batchId) => {
            setMode("log");
            setEditingFromBatch(null);
            onViewEntries?.(batchId);
          }}
        />
      </div>
    );
  }

  if (detailId) {
    const batch = batches.find(b => b.id === detailId);
    if (batch) {
      return <I2ImportDetail
        batch={batch}
        onBack={() => setDetailId(null)}
        onViewEntries={onViewEntries}
        onEditStep={(b, phase) => {
          // Reset wizard state and jump to the chosen phase
          ["fe-i2-phase","fe-i2-files","fe-i2-mapping","fe-i2-removed","fe-i2-others"].forEach(k => localStorage.removeItem(k));
          localStorage.setItem("fe-i2-phase", phase);
          setEditingFromBatch({ batchId: b.id, phase });
          setDetailId(null);
          setMode("wizard");
        }}
      />;
    }
  }

  return (
    <div className="i2-home">
      <div className="i2-home-head">
        <div>
          <h1 className="page-title">Imports</h1>
          <div className="page-subtitle">
            Drop spreadsheets, PDF invoices or scanned bills — we'll map columns, repair the data, and queue everything for your review.
          </div>
        </div>
        <button className="btn primary" onClick={() => {
          ["fe-i2-phase","fe-i2-files","fe-i2-mapping","fe-i2-removed","fe-i2-others"].forEach(k => localStorage.removeItem(k));
          setMode("wizard");
        }}>
          <Icon name="plus" size={14}/>New import
        </button>
      </div>

      <div className="i2-log">
        <div className="i2-log-head">
          <div>File / Batch</div>
          <div>Source</div>
          <div>Uploaded by</div>
          <div>Date</div>
          <div style={{textAlign:"right"}}>Rows</div>
          <div>Status</div>
          <div/>
        </div>
        {batches.map(b => (
          <div key={b.id} className="i2-log-row clickable" onClick={() => setDetailId(b.id)}>
            <div>
              <div className="i2-log-name">{b.fileName || b.label}</div>
              <div className="i2-log-sub">{b.id}</div>
            </div>
            <div className="i2-log-mu">{
              b.source === "erp" ? "ERP connector" :
              b.source === "xlsx" ? "Spreadsheet" :
              b.source === "pdf" ? "PDF invoice" :
              "CSV"
            }</div>
            <div className="i2-log-mu">{b.uploadedBy}</div>
            <div className="i2-log-mu">{b.date}</div>
            <div style={{textAlign:"right"}}>{(b.rowCount || 0).toLocaleString()}</div>
            <div>
              {b.status === "completed" && <span className="i2-pill ok"><Icon name="check" size={11}/>Completed</span>}
              {b.status === "partial" && <span className="i2-pill warn"><Icon name="warn" size={11}/>Partial</span>}
            </div>
            <div style={{textAlign:"right"}}>
              <button className="i2-log-link" onClick={(e) => { e.stopPropagation(); onViewEntries?.(b.id); }}>
                View entries <Icon name="arrowRight" size={12}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.ImportsV2 = ImportsV2;
window.ImportsV2Home = ImportsV2Home;
