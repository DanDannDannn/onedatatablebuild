// Bulk Import — 4-step wizard
// Step 1: Upload file (with template download)
// Step 2: Map columns (required / additional, split into recommended + others)
// Steps 3 & 4: placeholder continuation screens

// ----- App-side field catalogue (what the Forward Earth app expects) --------
// Based on "Upstream scope 3 - Spend data" template
const APP_FIELDS = {
  required: [
    { key: "start_date",       label: "Start date",        hint: "DD.MM.YYYY",                example: "15.01.2025" },
    { key: "end_date",         label: "End date",          hint: "DD.MM.YYYY",                example: "31.12.2025" },
    { key: "location",         label: "Location",          hint: "Name on Company page",       example: "London Office" },
    { key: "currency",         label: "Currency",          hint: "ISO 4217 code",             example: "USD" },
    { key: "price",            label: "Price",             hint: "Numeric, positive",         example: "100" },
    { key: "emission_source",  label: "Emission source",   hint: "Scope 3 category",          example: "Purchased Goods and Services" },
    { key: "factor_name",      label: "Emission factor name", hint: "From the library",       example: "Air transport services" },
  ],
  recommended: [
    { key: "supplier_name",    label: "Supplier name",     hint: "Name of the vendor",         example: "MetaMaterials Ltd." },
    { key: "description",      label: "Description",       hint: "What the spend is for",      example: "Specialized manufacturing equipment" },
  ],
  optional: [
    { key: "additional_desc",  label: "Additional description", hint: "Extra detail",           example: "High-efficiency solar panels" },
    { key: "notes",            label: "Notes",             hint: "Free-form notes",            example: "Post-install training included" },
  ],
};
const ALL_APP_FIELDS = [...APP_FIELDS.required, ...APP_FIELDS.recommended, ...APP_FIELDS.optional];
const FIELD_BY_KEY = Object.fromEntries(ALL_APP_FIELDS.map(f => [f.key, f]));

// ----- Simulated uploaded-file headers --------------------------------------
// When the user "uploads" the template, we pretend to parse these columns out of it.
// Includes a couple of ambiguous extra headers to test the "others, please double check" path.
const SIMULATED_HEADERS = [
  "Start date",
  "End date",
  "Supplier name",
  "Description",
  "Location",
  "Price",
  "Currency",
  "Additional description",
  "Notes",
  "Emission source",
  "Emission factor name",
  "Cost center",
  "PO number",
  "Invoice ID",
];

// Auto-match headers to app fields by normalised string equality / containment.
function autoMatch(headers) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const byNorm = {};
  ALL_APP_FIELDS.forEach(f => { byNorm[norm(f.label)] = f.key; });
  // a few aliases
  const aliases = {
    "emissionsource": "emission_source",
    "emissionfactor": "factor_name",
    "emissionfactorname": "factor_name",
    "supplier": "supplier_name",
    "vendor": "supplier_name",
    "desc": "description",
    "additionaldescription": "additional_desc",
    "additionaldesc": "additional_desc",
    "startdate": "start_date",
    "enddate": "end_date",
  };
  const mapping = {};         // headerName -> fieldKey
  headers.forEach(h => {
    const n = norm(h);
    const hit = byNorm[n] || aliases[n];
    if (hit && !Object.values(mapping).includes(hit)) mapping[h] = hit;
  });
  return mapping;
}

// =============================================================================
// Main component
// =============================================================================
function BulkImport({ onFinish }) {
  const readJSON = (k, fallback) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  };
  const [step, setStep] = React.useState(() => Number(localStorage.getItem("fe-import-step") || 1));
  const [fileName, setFileName] = React.useState(() => localStorage.getItem("fe-import-file") || "");
  const [importType, setImportType] = React.useState(() => localStorage.getItem("fe-import-type") || "");
  const [headers, setHeaders] = React.useState(() => readJSON("fe-import-headers", []));
  const [mapping, setMapping] = React.useState(() => readJSON("fe-import-mapping", {}));
  const [removedHeaders, setRemovedHeaders] = React.useState(() => readJSON("fe-import-removed", []));
  const [otherRenames, setOtherRenames] = React.useState(() => readJSON("fe-import-renames", {}));

  React.useEffect(() => { localStorage.setItem("fe-import-step", String(step)); }, [step]);
  React.useEffect(() => { localStorage.setItem("fe-import-file", fileName); }, [fileName]);
  React.useEffect(() => { localStorage.setItem("fe-import-type", importType); }, [importType]);
  React.useEffect(() => { localStorage.setItem("fe-import-headers", JSON.stringify(headers)); }, [headers]);
  React.useEffect(() => { localStorage.setItem("fe-import-mapping", JSON.stringify(mapping)); }, [mapping]);
  React.useEffect(() => { localStorage.setItem("fe-import-removed", JSON.stringify(removedHeaders)); }, [removedHeaders]);
  React.useEffect(() => { localStorage.setItem("fe-import-renames", JSON.stringify(otherRenames)); }, [otherRenames]);

  // Hydrate simulated parse on reload: if we're past step 1 with a filename but the
  // headers state got lost, re-run the "parse" so the map step has data to show.
  React.useEffect(() => {
    if (step > 1 && fileName && headers.length === 0) {
      const hs = [...SIMULATED_HEADERS];
      setHeaders(hs);
      setMapping(m => Object.keys(m).length ? m : autoMatch(hs));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset wizard (used by close 'X')
  const reset = () => {
    setStep(1); setFileName(""); setImportType("");
    setHeaders([]); setMapping({}); setRemovedHeaders([]); setOtherRenames({});
  };

  // "Upload" — pretend to parse simulated headers
  const onFileChosen = (name) => {
    setFileName(name);
    const hs = [...SIMULATED_HEADERS];
    setHeaders(hs);
    setMapping(autoMatch(hs));
    setRemovedHeaders([]);
    setOtherRenames({});
  };

  return (
    <div className="bi-page">
      {step > 1 && fileName && (
        <div className="bi-filebar">
          <div>
            <div className="bi-filebar-name">{fileName}</div>
            <div className="bi-filebar-meta">
              <span>Created by: <b>Johannes Weber</b></span>
              <span>Import type: <b>{importType || "Upstream scope 3 – Spend data"}</b></span>
              <span>Start date: <b>22/04/2026</b></span>
            </div>
          </div>
          <button className="bi-close" onClick={reset} title="Cancel import">
            <Icon name="close" size={18}/>
          </button>
        </div>
      )}

      <div className="bi-steps">
        {[
          { n: 1, k: "upload",  label: "Upload file" },
          { n: 2, k: "map",     label: "Map columns" },
          { n: 3, k: "verify",  label: "Verify data" },
        ].map(s => (
          <div key={s.n} className={`bi-step ${s.n === step ? "current" : ""} ${s.n < step ? "done" : ""}`}
               onClick={() => { if (s.n < step) setStep(s.n); }}>
            <span className="bi-step-marker">
              {s.n < step ? <Icon name="check" size={13}/> : <span className="bi-step-n">{s.n}</span>}
            </span>
            <span className="bi-step-label">{s.label}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <UploadStep
          importType={importType} setImportType={setImportType}
          fileName={fileName}
          onFile={onFileChosen}
          onContinue={() => setStep(2)}
          onCancel={reset}
        />
      )}
      {step === 2 && (
        <MapStep
          headers={headers}
          mapping={mapping} setMapping={setMapping}
          removedHeaders={removedHeaders} setRemovedHeaders={setRemovedHeaders}
          otherRenames={otherRenames} setOtherRenames={setOtherRenames}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <VerifyStep
          fileName={fileName}
          onBack={() => setStep(2)}
          onFinish={() => {
            reset();
            window.dispatchEvent(new CustomEvent("fe-toast", {detail: "Import complete · 847 activity records created"}));
            onFinish && onFinish();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// STEP 1 — Upload file
// =============================================================================
const IMPORT_TYPES = [
  "Upstream scope 3 – Spend data (large dataset)",
  "Upstream scope 3 – Activity data",
  "Stationary combustion (natural gas, fuels)",
  "Mobile combustion (fleet fuel, logistics)",
  "Purchased electricity",
  "Employee commuting",
  "Business travel",
  "Waste generated in operations",
];

function UploadStep({ importType, setImportType, fileName, onFile, onContinue, onCancel }) {
  const [dragOver, setDragOver] = React.useState(false);
  const [typeOpen, setTypeOpen] = React.useState(false);
  const ready = !!importType && !!fileName;

  return (
    <>
      <div className="bi-head">
        <h1 className="bi-title">Start new import</h1>
      </div>

      <div className="bi-grid bi-grid-70-30">
        {/* LEFT 70% — Select import type + Upload, one card */}
        <div className="bi-card">
          <div className="bi-card-title">Select import type</div>
          <div className="bi-select">
            <button className={"bi-select-btn " + (importType ? "filled" : "")} onClick={() => setTypeOpen(v => !v)}>
              <span>{importType || "Import type"}</span>
              <Icon name="chev" size={14}/>
            </button>
            {typeOpen && (
              <>
                <div className="bi-overlay" onClick={() => setTypeOpen(false)}/>
                <div className="bi-select-menu">
                  {IMPORT_TYPES.map(t => (
                    <div key={t} className={"bi-select-item " + (t === importType ? "active" : "")}
                         onClick={() => { setImportType(t); setTypeOpen(false); }}>
                      {t}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="bi-upload-section">
            <div className="bi-card-title">Upload filled template</div>
            <p className="bi-card-help">Fill in the template with your data, then upload it here (.csv or .xlsx)</p>
            <label className={`bi-drop ${dragOver ? "over" : ""} ${fileName ? "has-file" : ""}`}
                   onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                   onDragLeave={() => setDragOver(false)}
                   onDrop={e => {
                     e.preventDefault(); setDragOver(false);
                     const f = e.dataTransfer.files?.[0];
                     if (f) onFile(f.name);
                   }}>
              <input type="file" accept=".csv,.xlsx" style={{display:"none"}}
                     onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f.name); }}/>
              {fileName ? (
                <div className="bi-file-pill">
                  <div className="bi-file-icon"><Icon name="collect" size={20}/></div>
                  <div>
                    <div className="bi-file-name">{fileName}</div>
                    <div className="bi-file-meta">Ready to map</div>
                  </div>
                  <button className="bi-file-remove" onClick={e => { e.preventDefault(); onFile(""); }}><Icon name="close" size={14}/></button>
                </div>
              ) : (
                <div className="bi-drop-inner">
                  <div className="bi-drop-icon"><Icon name="upload" size={28}/></div>
                  <div className="bi-drop-label"><u>Drag or upload</u> your file</div>
                  <div className="bi-drop-hint">CSV, XLSX up to 90MB</div>
                  <button className="bi-drop-browse" onClick={e => { e.preventDefault(); e.currentTarget.parentElement.querySelector("input[type=file]").click(); }}>
                    Browse files
                  </button>
                  <button className="bi-drop-demo" onClick={e => { e.preventDefault(); onFile("Data-Validation-spend-based-large-dataset-2025-10-06.xlsx"); }}>
                    Use demo file
                  </button>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* RIGHT 30% — Download template + Help articles, one card */}
        <div className="bi-card bi-side-card">
          <div className="bi-card-title">Don't have a template?</div>
          <p className="bi-card-help">Download the template to see which columns to include and how to format them.</p>
          <button className="btn secondary small bi-side-dl"
                  disabled={!importType}
                  title={importType ? "Download template" : "Pick an import type first"}
                  onClick={() => window.dispatchEvent(new CustomEvent("fe-toast", {detail: "Template downloaded"}))}>
            <Icon name="arrowDown" size={14}/>Download template
          </button>

          <div className="bi-side-div"/>

          <div className="bi-help-title">Help with this step</div>
          {[
            { t: "How to prepare your file for import", d: "Make sure your file is correctly formatted to avoid errors during import." },
            { t: "How to import data in bulk",          d: "Step-by-step process for importing spend or activity data." },
            { t: "Choosing the right import type",       d: "Pick the template that matches your source data." },
          ].map((a, i) => (
            <div key={i} className="bi-help-item bi-help-item-stack">
              <div className="bi-help-row">
                <div className="bi-help-icon"><Icon name="collect" size={14}/></div>
                <div style={{flex:1, minWidth:0}}>
                  <div className="bi-help-t">{a.t}</div>
                  <div className="bi-help-d">{a.d}</div>
                </div>
              </div>
              <button className="bi-help-link bi-help-link-bottom"><Icon name="plus" size={12}/>Read article</button>
            </div>
          ))}
        </div>
      </div>

      <FooterBar
        left={
          <button className="btn danger-ghost" onClick={onCancel}>Cancel</button>
        }
        right={
        <button className={"btn primary " + (ready ? "" : "disabled")}
                disabled={!ready} onClick={onContinue}>
          Continue to map columns <Icon name="arrowRight" size={14}/>
        </button>
      }/>
    </>
  );
}

// =============================================================================
// STEP 2 — Map columns
// =============================================================================
function MapStep({ headers, mapping, setMapping, removedHeaders, setRemovedHeaders, otherRenames, setOtherRenames, onBack, onContinue }) {
  // "Used" header -> field key
  const usedHeaders = new Set(Object.keys(mapping).filter(h => mapping[h] && !removedHeaders.includes(h)));
  const usedFields  = new Set(Object.values(mapping).filter(Boolean).map(v => v));

  // Active headers (not removed)
  const activeHeaders = headers.filter(h => !removedHeaders.includes(h));

  // Headers that AREN'T mapped to a known app field (candidates for "additional")
  const unmappedHeaders = activeHeaders.filter(h => !mapping[h]);

  // Status pill: required field coverage
  const reqCount = APP_FIELDS.required.length;
  const reqMapped = APP_FIELDS.required.filter(f => usedFields.has(f.key)).length;

  // Additional columns = headers currently mapped to recommended/optional fields + any unmapped extras
  const recHeaders   = [...usedHeaders].filter(h => APP_FIELDS.recommended.some(f => f.key === mapping[h]));
  const optHeaders   = [...usedHeaders].filter(h => APP_FIELDS.optional.some(f => f.key === mapping[h]));
  const otherHeaders = unmappedHeaders; // headers we couldn't auto-match

  const additionalCount = recHeaders.length + optHeaders.length + otherHeaders.length;

  // --- handlers
  const setHeaderField = (headerName, fieldKey) => {
    setMapping(m => {
      const next = { ...m };
      // If another header currently maps to fieldKey, clear it (one-to-one)
      Object.keys(next).forEach(h => { if (next[h] === fieldKey && h !== headerName) next[h] = null; });
      next[headerName] = fieldKey || null;
      return next;
    });
  };
  const removeHeader = (headerName) => {
    setRemovedHeaders(rs => [...new Set([...rs, headerName])]);
    setMapping(m => ({ ...m, [headerName]: null }));
  };
  const restoreHeader = (headerName) => {
    setRemovedHeaders(rs => rs.filter(h => h !== headerName));
  };

  const canContinue = reqMapped === reqCount;

  return (
    <>
      <div className="bi-head">
        <h1 className="bi-title">Map columns</h1>
        <div className="bi-head-sub">Match columns from your file to Forward Earth fields. Required fields must all be mapped before continuing.</div>
      </div>

      <div className="bi-map-grid">
        <div className="bi-map-main">
          {/* ---- Required columns ---- */}
          <section className="bi-sec">
            <header className="bi-sec-head">
              <div>
                <h2 className="bi-sec-title">Required columns</h2>
                <div className="bi-sec-sub">All fields must be mapped to a column from your file.</div>
              </div>
              <span className={`bi-sec-pill ${reqMapped === reqCount ? "ok" : "warn"}`}>
                {reqMapped === reqCount ? <Icon name="check" size={12}/> : <Icon name="warn" size={12}/>}
                {reqMapped}/{reqCount} mapped
              </span>
            </header>
            <div className="bi-map-rows">
              {APP_FIELDS.required.map(f => {
                const currentHeader = Object.keys(mapping).find(h => mapping[h] === f.key && !removedHeaders.includes(h)) || "";
                return (
                  <MapRow key={f.key} field={f} required
                          currentHeader={currentHeader}
                          headers={headers.filter(h => !removedHeaders.includes(h))}
                          usedHeaders={usedHeaders} usedFields={usedFields}
                          onPick={(h) => {
                            // clear old mapping for this field, set new
                            setMapping(m => {
                              const next = { ...m };
                              Object.keys(next).forEach(k => { if (next[k] === f.key) next[k] = null; });
                              if (h) next[h] = f.key;
                              return next;
                            });
                          }}/>
                );
              })}
            </div>
          </section>

          {/* ---- Additional columns ---- */}
          <section className="bi-sec">
            <header className="bi-sec-head">
              <div>
                <h2 className="bi-sec-title">Additional columns <span className="bi-sec-count">({additionalCount})</span></h2>
                <div className="bi-sec-sub">Optional fields from your file. Remove any that don't belong with the <b>✕</b> button.</div>
              </div>
            </header>

            {/* Recommended (already-matched) */}
            <div className="bi-subsec">
              <div className="bi-subsec-head">
                <Icon name="sparkle" size={14}/>
                <span>We recommend mapping these</span>
              </div>
              {APP_FIELDS.recommended.map(f => {
                const currentHeader = Object.keys(mapping).find(h => mapping[h] === f.key && !removedHeaders.includes(h)) || "";
                return (
                  <MapRow key={f.key} field={f} recommended
                          currentHeader={currentHeader}
                          headers={headers.filter(h => !removedHeaders.includes(h))}
                          usedHeaders={usedHeaders} usedFields={usedFields}
                          onPick={(h) => {
                            setMapping(m => {
                              const next = { ...m };
                              Object.keys(next).forEach(k => { if (next[k] === f.key) next[k] = null; });
                              if (h) next[h] = f.key;
                              return next;
                            });
                          }}/>
                );
              })}
              {APP_FIELDS.optional.map(f => {
                const currentHeader = Object.keys(mapping).find(h => mapping[h] === f.key && !removedHeaders.includes(h)) || "";
                if (!currentHeader) return null; // only show optional if user already mapped something
                return (
                  <MapRow key={f.key} field={f}
                          currentHeader={currentHeader}
                          headers={headers.filter(h => !removedHeaders.includes(h))}
                          usedHeaders={usedHeaders} usedFields={usedFields}
                          onPick={(h) => {
                            setMapping(m => {
                              const next = { ...m };
                              Object.keys(next).forEach(k => { if (next[k] === f.key) next[k] = null; });
                              if (h) next[h] = f.key;
                              return next;
                            });
                          }}
                          removable onRemove={() => setHeaderField(currentHeader, null)}/>
                );
              })}
            </div>

            {/* Others — headers that exist in the file but we don't recognise */}
            {otherHeaders.length > 0 && (
              <div className="bi-subsec">
                <div className="bi-subsec-head">
                  <Icon name="info" size={14}/>
                  <span>Others — additional columns from your file</span>
                  <span className="bi-subsec-hint">We'll keep these as extra columns on each row. Rename if you'd like a different label, or remove any that don't belong.</span>
                </div>
                {otherHeaders.map(h => (
                  <OtherRow key={h} headerName={h}
                            displayName={otherRenames[h] ?? h}
                            onRename={(name) => setOtherRenames(r => ({ ...r, [h]: name }))}
                            onRemove={() => removeHeader(h)}/>
                ))}
              </div>
            )}

            {/* Removed stack */}
            {removedHeaders.length > 0 && (
              <div className="bi-removed">
                <span className="bi-removed-label">Removed:</span>
                {removedHeaders.map(h => (
                  <button key={h} className="bi-removed-chip" onClick={() => restoreHeader(h)}>
                    {h} <span>↶ restore</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="bi-map-side">
          <HelpCard articles={[
            { t: "Importing your file", d: "Learn more about the data import process." },
            { t: "Column mapping tips", d: "How auto-matching works and how to resolve tricky headers." },
          ]}/>

          <div className="bi-map-summary">
            <div className="bi-map-summary-head">Summary</div>
            <div className="bi-map-summary-row"><span>File columns</span><b>{headers.length}</b></div>
            <div className="bi-map-summary-row"><span>Mapped</span><b>{usedHeaders.size}</b></div>
            <div className="bi-map-summary-row"><span>Unmapped</span><b>{otherHeaders.length}</b></div>
            <div className="bi-map-summary-row"><span>Removed</span><b>{removedHeaders.length}</b></div>
          </div>
        </aside>
      </div>

      <FooterBar
        left={<button className="btn secondary" onClick={onBack}>Back</button>}
        right={
          <button className={"btn primary " + (canContinue ? "" : "disabled")} disabled={!canContinue} onClick={onContinue}>
            Continue to assign factors <Icon name="arrowRight" size={14}/>
          </button>
        }
        note={canContinue ? null : `Map ${reqCount - reqMapped} more required column${reqCount - reqMapped === 1 ? "" : "s"} to continue`}
      />
    </>
  );
}

// A single map-row: Forward Earth field on the left, header selector on the right
function MapRow({ field, required, recommended, currentHeader, headers, usedHeaders, usedFields, onPick, removable, onRemove }) {
  const [open, setOpen] = React.useState(false);
  const placeholder = required ? "Please select" : recommended ? "Please select (recommended)" : "Please select";
  return (
    <div className="bi-map-row">
      <div className="bi-map-field">
        <div className="bi-map-field-name">
          {field.label}
          {required && <span className="bi-req">*</span>}
        </div>
        <div className="bi-map-field-hint">{field.hint}{field.example ? ` · e.g. "${field.example}"` : ""}</div>
      </div>
      <div className="bi-map-arrow"><Icon name="chevRight" size={14}/></div>
      <div className="bi-map-picker">
        <button className={`bi-picker ${currentHeader ? "filled" : ""} ${recommended && !currentHeader ? "hint" : ""}`}
                onClick={() => setOpen(v => !v)}>
          <span>{currentHeader || placeholder}</span>
          <Icon name="chev" size={12}/>
        </button>
        {open && (
          <>
            <div className="bi-overlay" onClick={() => setOpen(false)}/>
            <div className="bi-picker-menu">
              <div className="bi-picker-empty" onClick={() => { onPick(""); setOpen(false); }}>
                <span>— no column —</span>
              </div>
              {headers.map(h => {
                const isUsed = usedHeaders.has(h) && h !== currentHeader;
                return (
                  <div key={h} className={"bi-picker-item " + (h === currentHeader ? "active " : "") + (isUsed ? "used" : "")}
                       onClick={() => { onPick(h); setOpen(false); }}>
                    <span>{h}</span>
                    {isUsed && <span className="bi-picker-tag">in use</span>}
                    {h === currentHeader && <Icon name="check" size={14}/>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div className="bi-map-action">
        {removable && currentHeader && <button className="bi-map-x" title="Remove mapping" onClick={onRemove}><Icon name="close" size={14}/></button>}
      </div>
    </div>
  );
}

// An "other" row — an unmatched header that becomes an additional column.
// Right side shows an editable display name (defaulting to the header name).
function OtherRow({ headerName, displayName, onRename, onRemove }) {
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(displayName);
  const inputRef = React.useRef(null);
  React.useEffect(() => { setVal(displayName); }, [displayName]);
  React.useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    const next = val.trim() || headerName;
    onRename(next);
    setVal(next);
    setEditing(false);
  };
  const cancel = () => { setVal(displayName); setEditing(false); };

  return (
    <div className="bi-map-row other">
      <div className="bi-map-field">
        <div className="bi-map-field-name bi-map-header">{headerName}</div>
        <div className="bi-map-field-hint">Column from your file</div>
      </div>
      <div className="bi-map-arrow"><Icon name="chevRight" size={14}/></div>
      <div className="bi-map-picker">
        <div className={`bi-other-name ${editing ? "editing" : ""}`}
             onClick={() => !editing && setEditing(true)}>
          {editing ? (
            <input
              ref={inputRef}
              className="bi-other-input"
              value={val}
              autoFocus
              onChange={e => setVal(e.target.value)}
              onBlur={commit}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); commit(); }
                if (e.key === "Escape") { e.preventDefault(); cancel(); }
              }}
            />
          ) : (
            <>
              <span className="bi-other-label">{displayName}</span>
              <span className="bi-other-edit" title="Rename additional column">
                <Icon name="pencil" size={12}/>
              </span>
            </>
          )}
        </div>
        <div className="bi-other-help">Additional column name — edit if you'd like it to appear differently.</div>
      </div>
      <div className="bi-map-action">
        <button className="bi-map-x" title="Remove column" onClick={onRemove}><Icon name="close" size={14}/></button>
      </div>
    </div>
  );
}

// =============================================================================
// Shared UI bits
// =============================================================================
function FooterBar({ left, right, note }) {
  return (
    <div className="bi-footer">
      <div className="bi-footer-left">{left}</div>
      <div className="bi-footer-right">
        {note && <span className="bi-footer-note">{note}</span>}
        {right}
      </div>
    </div>
  );
}

function HelpCard({ articles }) {
  return (
    <div className="bi-help">
      <div className="bi-help-title">Help with this step</div>
      {articles.map((a, i) => (
        <div key={i} className="bi-help-item">
          <div className="bi-help-icon"><Icon name="collect" size={14}/></div>
          <div style={{flex:1}}>
            <div className="bi-help-t">{a.t}</div>
            <div className="bi-help-d">{a.d}</div>
          </div>
          <button className="bi-help-link"><Icon name="plus" size={12}/>Read article</button>
        </div>
      ))}
    </div>
  );
}

function PlaceholderStep({ title, blurb, onBack, onContinue, finalLabel }) {
  return (
    <>
      <div className="bi-head">
        <h1 className="bi-title">{title}</h1>
        <div className="bi-head-sub">{blurb}</div>
      </div>
      <div className="bi-card" style={{textAlign:"center", padding:"48px 24px"}}>
        <div style={{display:"inline-flex", width:56, height:56, borderRadius:"50%", background:"var(--fe-primary-100, rgba(99,102,241,0.08))", color:"var(--fe-primary-600)", alignItems:"center", justifyContent:"center", marginBottom:16}}>
          <Icon name="sparkle" size={24}/>
        </div>
        <h3 className="card-title">This step is coming next</h3>
        <div className="card-sub" style={{marginTop:6}}>This prototype focuses on steps 1 & 2. Continue to see how the flow completes.</div>
      </div>
      <FooterBar
        left={<button className="btn secondary" onClick={onBack}>Back</button>}
        right={<button className="btn primary" onClick={onContinue}>{finalLabel || "Continue"} <Icon name="arrowRight" size={14}/></button>}
      />
    </>
  );
}

// =============================================================================
// Bulk Imports Home — log of past uploads + CTA to start a new import
// =============================================================================
function BulkImportHome({ onViewEntries }) {
  const [mode, setMode] = React.useState(() => localStorage.getItem("fe-import-mode") || "log");
  React.useEffect(() => { localStorage.setItem("fe-import-mode", mode); }, [mode]);

  // Past imports — derive from BATCHES, enrich with row counts from ENTRIES
  const entries = window.ENTRIES || [];
  const batches = (window.BATCHES || []).map(b => {
    const rows = entries.filter(e => e.batchId === b.id);
    const failed = rows.filter(e => e.entry_status === "processing" || e.entry_status === "attention").length;
    const imported = rows.length - failed;
    const status = b.source === "erp" ? "completed" : (failed > 0 ? "partial" : "completed");
    return {
      ...b,
      rowCount: rows.length || Math.floor(20 + Math.random() * 120),
      imported: imported || rows.length,
      failed,
      status,
    };
  }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // Add a demo "in progress" row at top (pretend an upload is processing)
  const demoInProgress = {
    id: "B-2026-04", label: "April 2026 spend data",
    source: "xlsx", date: "2026-04-22",
    uploadedBy: "Johannes Weber",
    fileName: "Q1-2026-spend-data.xlsx",
    rowCount: 847, imported: 0, failed: 0,
    status: "processing",
  };
  const allBatches = [demoInProgress, ...batches];

  if (mode === "wizard") {
    return (
      <div>
        <div className="bi-crumb">
          <button className="link-btn" onClick={() => setMode("log")}>
            <Icon name="chev" size={12} style={{transform:"rotate(90deg)"}}/>
            Back to imports
          </button>
        </div>
        <BulkImport onFinish={() => setMode("log")} />
      </div>
    );
  }

  return (
    <div className="bi-home">
      <div className="bi-home-head">
        <div>
          <h1 className="page-title">Imports</h1>
          <div className="page-subtitle">Upload spreadsheets, PDF invoices, or scanned bills — we'll detect the format and extract the data. Even a single row works here.</div>
        </div>
        <button className="btn primary" onClick={() => { localStorage.removeItem("fe-import-step"); localStorage.removeItem("fe-import-file"); localStorage.removeItem("fe-import-type"); setMode("wizard"); }}>
          <Icon name="plus" size={14}/>New import
        </button>
      </div>

      <BulkImportLogFilters allBatches={allBatches}>
        {(filtered, sort, onSort, colFilters, onColFilter) => (
          <div className="bi-log wide">
            <div className="bi-log-head">
              <div><SortableHeader label="File / Batch" colKey="name" sort={sort} onSort={onSort}
                      filterValue={colFilters.name} onFilter={(v)=>onColFilter("name",v)}
                      placeholder="Filter filename or ID…"/></div>
              <div><SortableHeader label="Import type" colKey="source" sort={sort} onSort={onSort}
                      filterValue={colFilters.source} onFilter={(v)=>onColFilter("source",v)}
                      filterOptions={[
                        {k:"xlsx",l:"Spend data (XLSX)"},
                        {k:"csv",l:"Spend data (CSV)"},
                        {k:"erp",l:"ERP connector"},
                        {k:"manual",l:"Manual entry"},
                      ]}/></div>
              <div><SortableHeader label="Uploaded by" colKey="uploadedBy" sort={sort} onSort={onSort}
                      filterValue={colFilters.uploadedBy} onFilter={(v)=>onColFilter("uploadedBy",v)}
                      filterOptions={[...new Set(allBatches.map(b=>b.uploadedBy))].sort().map(u=>({k:u,l:u}))}/></div>
              <div><SortableHeader label="Date" colKey="date" sort={sort} onSort={onSort}
                      filterValue={colFilters.date} onFilter={(v)=>onColFilter("date",v)}
                      filterOptions={[
                        {k:"last30",l:"Last 30 days"},
                        {k:"q1",l:"Q1 2026"},
                        {k:"q2",l:"Q2 2026"},
                        {k:"2026",l:"2026"},
                        {k:"2025",l:"2025"},
                      ]}/></div>
              <div style={{textAlign:"right"}}>
                <SortableHeader label="Rows" colKey="rowCount" align="right" sort={sort} onSort={onSort}
                      filterValue={colFilters.rowCount} onFilter={(v)=>onColFilter("rowCount",v)}
                      placeholder="e.g. 500"/></div>
              <div><SortableHeader label="Status" colKey="status" sort={sort} onSort={onSort}
                      filterValue={colFilters.status} onFilter={(v)=>onColFilter("status",v)}
                      filterOptions={[
                        {k:"completed",l:"Completed"},
                        {k:"processing",l:"Processing"},
                        {k:"partial",l:"Partial"},
                      ]}/></div>
              <div><span style={{color:"var(--fe-fg-muted)"}}>File</span></div>
              <div><span style={{color:"var(--fe-fg-muted)"}}>Entries</span></div>
              <div/>
            </div>
            {filtered.map(b => (
              <div key={b.id} className="bi-log-row">
                <div>
                  <div className="bi-log-file">
                    <div className="bi-log-fileicon"><Icon name="collect" size={16}/></div>
                    <div>
                      <div className="bi-log-name">{b.fileName || b.label}</div>
                      <div className="bi-log-sub">{b.id}</div>
                    </div>
                  </div>
                </div>
                <div className="bi-log-muted">{
                  b.source === "manual" ? "Manual entry" :
                  b.source === "erp" ? "ERP connector" :
                  b.source === "xlsx" ? "Spend data (XLSX)" :
                  "Spend data (CSV)"
                }</div>
                <div className="bi-log-muted">{b.uploadedBy}</div>
                <div className="bi-log-muted">{b.date}</div>
                <div style={{textAlign:"right"}}>
                  <div>{b.rowCount.toLocaleString()}</div>
                </div>
                <div>
                  {b.status === "processing" && (
                    <span className="bi-log-pill proc"><span className="bi-spinner"/>Processing</span>
                  )}
                  {b.status === "completed" && (
                    <span className="bi-log-pill ok"><Icon name="check" size={11}/>Completed</span>
                  )}
                  {b.status === "partial" && (
                    <span className="bi-log-pill warn"><Icon name="warn" size={11}/>Partial</span>
                  )}
                </div>
                <div>
                  {b.source === "manual" || b.source === "erp" ? (
                    <span className="bi-log-muted" style={{fontSize:11}}>—</span>
                  ) : (
                    <button className="bi-log-link" title={`Download ${b.fileName || b.label}`}
                            onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("fe-toast", {detail: `Downloading ${b.fileName || b.label}…`})); }}>
                      <Icon name="arrowDown" size={13}/>Download
                    </button>
                  )}
                </div>
                <div>
                  {b.status === "processing" ? (
                    <span className="bi-log-muted" style={{fontSize:11}}>Pending</span>
                  ) : (
                    <button className="bi-log-link" title={`View activity data for ${b.id}`}
                            onClick={(e) => { e.stopPropagation(); onViewEntries?.(b.id); }}>
                      <Icon name="arrowRight" size={13}/>View entries ({b.rowCount.toLocaleString()})
                    </button>
                  )}
                </div>
                <div style={{textAlign:"right"}}>
                  <button className="bi-log-action" title="More"><Icon name="dots" size={16}/></button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="bi-log-empty">No imports match these filters.</div>
            )}
          </div>
        )}
      </BulkImportLogFilters>
    </div>
  );
}

// Filter bar for the bulk imports log
function BulkImportLogFilters({ allBatches, children }) {
  const [status, setStatus] = React.useState("all");
  const [uploadedBy, setUploadedBy] = React.useState("all");
  const [dateRange, setDateRange] = React.useState("all"); // all | last30 | q1 | q2 | 2026 | 2025
  const [q, setQ] = React.useState("");

  // Column-level sort + filter state (from per-header menus)
  const [sort, setSort] = React.useState(null);
  const [colFilters, setColFilters] = React.useState({});
  const setColFilter = (k, v) => setColFilters(f => {
    const next = { ...f };
    if (!v || v === "all" || v === "") delete next[k]; else next[k] = v;
    return next;
  });
  const handleSort = (key, dir) => setSort(key ? { key, dir } : null);

  const uploaders = Array.from(new Set(allBatches.map(b => b.uploadedBy))).sort();

  const now = new Date("2026-04-22");
  const matchesDateKey = (d, key) => {
    const dt = new Date(d);
    if (key === "last30") return (now - dt) / 86400000 <= 30;
    if (key === "q1")   return dt.getFullYear() === 2026 && dt.getMonth() <= 2;
    if (key === "q2")   return dt.getFullYear() === 2026 && dt.getMonth() >= 3 && dt.getMonth() <= 5;
    if (key === "2026") return dt.getFullYear() === 2026;
    if (key === "2025") return dt.getFullYear() === 2025;
    return true;
  };

  const inDateRange = (b) => dateRange === "all" || matchesDateKey(b.date, dateRange);

  const batchGet = (b, key) => {
    switch (key) {
      case "name":       return b.fileName || b.label || "";
      case "source":     return b.source;
      case "uploadedBy": return b.uploadedBy;
      case "date":       return b.date;
      case "rowCount":   return b.rowCount;
      case "status":     return b.status;
      default: return "";
    }
  };

  let filtered = allBatches.filter(b => {
    if (status !== "all" && b.status !== status) return false;
    if (uploadedBy !== "all" && b.uploadedBy !== uploadedBy) return false;
    if (!inDateRange(b)) return false;
    if (q && !(b.fileName || b.label || "").toLowerCase().includes(q.toLowerCase()) && !b.id.toLowerCase().includes(q.toLowerCase())) return false;
    // Per-column filters from header menus
    for (const [k, v] of Object.entries(colFilters)) {
      if (!v) continue;
      if (k === "date") { if (!matchesDateKey(b.date, v)) return false; continue; }
      if (k === "name") {
        const needle = String(v).toLowerCase();
        if (!(b.fileName || b.label || "").toLowerCase().includes(needle) &&
            !b.id.toLowerCase().includes(needle)) return false;
        continue;
      }
      if (k === "rowCount") {
        const n = Number(String(v).replace(/[^0-9]/g, ""));
        if (!isNaN(n) && n > 0 && b.rowCount < n) return false;
        continue;
      }
      if (String(batchGet(b, k)) !== String(v)) return false;
    }
    return true;
  });

  if (sort) {
    filtered = [...filtered].sort((a, b) => cmpBy(a, b, (x) => batchGet(x, sort.key), sort.dir));
  }

  return (
    <>
      <div className="bi-filterbar">
        <div className="bi-filter-search">
          <Icon name="search" size={14}/>
          <input placeholder="Search filename or batch ID…" value={q} onChange={e => setQ(e.target.value)}/>
        </div>
        <div className="bi-filter-chips">
          {[
            {k:"all", l:"All statuses"},
            {k:"completed", l:"Completed"},
            {k:"processing", l:"Processing"},
            {k:"partial", l:"Partial"},
          ].map(o => (
            <button key={o.k} className={"bi-chip " + (status === o.k ? "on" : "")} onClick={() => setStatus(o.k)}>{o.l}</button>
          ))}
        </div>
        <FilterDropdown
          icon="users"
          label={uploadedBy === "all" ? "Uploaded by" : uploadedBy}
          active={uploadedBy !== "all"}
          options={[{k:"all", l:"Anyone"}, ...uploaders.map(u => ({k:u, l:u}))]}
          value={uploadedBy}
          onChange={setUploadedBy}
        />
        <FilterDropdown
          icon="calendar"
          label={
            dateRange === "all" ? "Date" :
            dateRange === "last30" ? "Last 30 days" :
            dateRange === "q1" ? "Q1 2026" :
            dateRange === "q2" ? "Q2 2026" :
            dateRange === "2026" ? "2026" : "2025"
          }
          active={dateRange !== "all"}
          options={[
            {k:"all", l:"Any time"},
            {k:"last30", l:"Last 30 days"},
            {k:"q1", l:"Q1 2026"},
            {k:"q2", l:"Q2 2026"},
            {k:"2026", l:"2026"},
            {k:"2025", l:"2025"},
          ]}
          value={dateRange}
          onChange={setDateRange}
        />
        <div className="bi-filter-count">{filtered.length} of {allBatches.length}</div>
      </div>
      {children(filtered, sort, handleSort, colFilters, setColFilter)}
    </>
  );
}

// Small dropdown pill used in the log filterbar
function FilterDropdown({ icon, label, active, options, value, onChange }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="bi-fd">
      <button className={"bi-fd-btn " + (active ? "on" : "")} onClick={() => setOpen(v => !v)}>
        <Icon name={icon} size={13}/>
        <span>{label}</span>
        <Icon name="chev" size={11}/>
      </button>
      {open && (
        <>
          <div className="bi-overlay" onClick={() => setOpen(false)}/>
          <div className="bi-fd-menu">
            {options.map(o => (
              <div key={o.k} className={"bi-fd-item " + (o.k === value ? "active" : "")}
                   onClick={() => { onChange(o.k); setOpen(false); }}>
                <span>{o.l}</span>
                {o.k === value && <Icon name="check" size={13}/>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// STEP 3 — Verify data
// =============================================================================
// Flow: (a) scanning → (b) issues report with download-to-fix → (c) re-upload
// corrected file → (d) all good, finalise.
function VerifyStep({ fileName, onBack, onFinish }) {
  // phases: "scanning" | "issues" | "fixing" | "rescanning" | "clean"
  const [phase, setPhase] = React.useState("scanning");
  const [progress, setProgress] = React.useState(0);
  const [fixFileName, setFixFileName] = React.useState("");

  // Simulated scan totals
  const TOTAL_ROWS = 847;
  const ISSUES = [
    { key:"date_fmt",      severity:"error",   count:23,
      label:"Invalid date format",
      hint:"Dates must be DD.MM.YYYY. Found values like “15/01/2025” and “Jan 15, 25”." },
    { key:"currency",      severity:"error",   count:8,
      label:"Unknown currency code",
      hint:"Values “GBX”, “EURO”, “usd$” are not valid ISO 4217 codes." },
    { key:"price_neg",     severity:"error",   count:3,
      label:"Negative or zero price",
      hint:"Price must be a positive number. Found values ≤ 0." },
    { key:"missing_src",   severity:"warn",    count:41,
      label:"Missing emission source",
      hint:"We'll try to infer scope 3 category from supplier name — review after import." },
    { key:"dup_invoice",   severity:"warn",    count:6,
      label:"Duplicate invoice IDs",
      hint:"Rows share the same Invoice ID within this import. Confirm these aren't re-submissions." },
  ];
  const errorCount = ISSUES.filter(i => i.severity === "error").reduce((s,i)=>s+i.count,0);
  const warnCount  = ISSUES.filter(i => i.severity === "warn").reduce((s,i)=>s+i.count,0);
  const cleanCount = TOTAL_ROWS - errorCount - warnCount;

  // Scanning progress animation
  React.useEffect(() => {
    if (phase !== "scanning" && phase !== "rescanning") return;
    setProgress(0);
    const startedAt = Date.now();
    const target = phase === "scanning" ? 2200 : 1400;
    const iv = setInterval(() => {
      const p = Math.min(100, ((Date.now() - startedAt) / target) * 100);
      setProgress(p);
      if (p >= 100) {
        clearInterval(iv);
        setPhase(phase === "scanning" ? "issues" : "clean");
      }
    }, 80);
    return () => clearInterval(iv);
  }, [phase]);

  const onFixFileChosen = (name) => {
    setFixFileName(name);
    setPhase("rescanning");
  };

  // --- Render
  if (phase === "scanning" || phase === "rescanning") {
    return (
      <>
        <div className="bi-head">
          <h1 className="bi-title">Verifying your data</h1>
          <div className="bi-head-sub">
            {phase === "scanning"
              ? `Checking ${TOTAL_ROWS.toLocaleString()} rows against the Forward Earth data schema. This takes a few seconds.`
              : "Re-checking your corrected file…"}
          </div>
        </div>
        <div className="bi-scan">
          <div className="bi-scan-ring"><span className="bi-spinner big"/></div>
          <div className="bi-scan-label">
            {phase === "scanning" ? "Validating rows…" : "Re-validating…"}
          </div>
          <div className="bi-scan-bar"><div className="bi-scan-fill" style={{width: progress + "%"}}/></div>
          <div className="bi-scan-meta">
            <span>{Math.round(progress)}%</span>
            <span>·</span>
            <span>{Math.round((progress/100) * TOTAL_ROWS).toLocaleString()} / {TOTAL_ROWS.toLocaleString()} rows</span>
          </div>
          <ul className="bi-scan-checks">
            <li className={progress > 25 ? "done" : ""}><Icon name={progress > 25 ? "check" : "clock"} size={13}/> Column types and required fields</li>
            <li className={progress > 50 ? "done" : ""}><Icon name={progress > 50 ? "check" : "clock"} size={13}/> Date, currency & numeric formats</li>
            <li className={progress > 75 ? "done" : ""}><Icon name={progress > 75 ? "check" : "clock"} size={13}/> Duplicate detection</li>
            <li className={progress >= 100 ? "done" : ""}><Icon name={progress >= 100 ? "check" : "clock"} size={13}/> Schema consistency</li>
          </ul>
        </div>
      </>
    );
  }

  if (phase === "clean") {
    return (
      <>
        <div className="bi-head">
          <h1 className="bi-title">Looks good — ready to import</h1>
          <div className="bi-head-sub">All {TOTAL_ROWS.toLocaleString()} rows passed validation. Finish the import to create activity records. You'll match emission factors next, over on the Calculations page.</div>
        </div>
        <div className="bi-clean">
          <div className="bi-clean-icon"><Icon name="check" size={32}/></div>
          <div className="bi-clean-stats">
            <div><b>{TOTAL_ROWS.toLocaleString()}</b><span>Rows ready</span></div>
            <div><b>0</b><span>Errors</span></div>
            <div><b>0</b><span>Warnings</span></div>
          </div>
          <div className="bi-clean-next">
            <div className="bi-clean-next-t">What happens next</div>
            <ol>
              <li>Activity records are created for all {TOTAL_ROWS.toLocaleString()} rows.</li>
              <li>The AI matching engine suggests an emission factor for each one.</li>
              <li>Review and confirm suggestions on the <b>Calculations</b> page.</li>
            </ol>
          </div>
        </div>
        <FooterBar
          left={<button className="btn secondary" onClick={onBack}>Back</button>}
          right={<button className="btn primary" onClick={onFinish}>Finish import · create 847 entries <Icon name="arrowRight" size={14}/></button>}
        />
      </>
    );
  }

  // phase === "issues"
  return (
    <>
      <div className="bi-head">
        <h1 className="bi-title">We found issues in {errorCount + warnCount} rows</h1>
        <div className="bi-head-sub">
          Download the annotated file below — rows with issues are highlighted and commented. Fix them in Excel, then re-upload to continue.
        </div>
      </div>

      <div className="bi-verify-summary">
        <div className="bi-vstat">
          <div className="bi-vstat-num ok">{cleanCount.toLocaleString()}</div>
          <div className="bi-vstat-lbl">Ready to import</div>
        </div>
        <div className="bi-vstat">
          <div className="bi-vstat-num warn">{warnCount.toLocaleString()}</div>
          <div className="bi-vstat-lbl">Warnings</div>
        </div>
        <div className="bi-vstat">
          <div className="bi-vstat-num err">{errorCount.toLocaleString()}</div>
          <div className="bi-vstat-lbl">Errors — must fix</div>
        </div>
        <div className="bi-vstat total">
          <div className="bi-vstat-num">{TOTAL_ROWS.toLocaleString()}</div>
          <div className="bi-vstat-lbl">Total rows</div>
        </div>
      </div>

      <div className="bi-map-grid">
        <div className="bi-map-main">
          <section className="bi-sec">
            <header className="bi-sec-head">
              <div>
                <h2 className="bi-sec-title">Issues found</h2>
                <div className="bi-sec-sub">Grouped by type. The downloadable file lists the specific row numbers for each issue.</div>
              </div>
              <button className="btn primary small" onClick={() => window.dispatchEvent(new CustomEvent("fe-toast", {detail: "Annotated file downloaded"}))}>
                <Icon name="arrowDown" size={14}/> Download file to fix
              </button>
            </header>
            <div className="bi-issues">
              {ISSUES.map(iss => (
                <div key={iss.key} className={`bi-issue ${iss.severity}`}>
                  <div className="bi-issue-icon">
                    <Icon name={iss.severity === "error" ? "warn" : "info"} size={16}/>
                  </div>
                  <div className="bi-issue-body">
                    <div className="bi-issue-head">
                      <span className="bi-issue-label">{iss.label}</span>
                      <span className={`bi-issue-count ${iss.severity}`}>{iss.count} row{iss.count === 1 ? "" : "s"}</span>
                    </div>
                    <div className="bi-issue-hint">{iss.hint}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bi-sec">
            <header className="bi-sec-head">
              <div>
                <h2 className="bi-sec-title">Upload corrected file</h2>
                <div className="bi-sec-sub">After fixing the highlighted rows, upload the updated file here. We'll re-validate automatically.</div>
              </div>
            </header>
            <label className={`bi-drop ${fixFileName ? "has-file" : ""}`}
                   onDragOver={e => e.preventDefault()}
                   onDrop={e => {
                     e.preventDefault();
                     const f = e.dataTransfer.files?.[0];
                     if (f) onFixFileChosen(f.name);
                   }}>
              <input type="file" accept=".csv,.xlsx" style={{display:"none"}}
                     onChange={e => { const f = e.target.files?.[0]; if (f) onFixFileChosen(f.name); }}/>
              <div className="bi-drop-inner">
                <div className="bi-drop-icon"><Icon name="upload" size={28}/></div>
                <div className="bi-drop-label"><u>Drag or upload</u> your corrected file</div>
                <div className="bi-drop-hint">CSV, XLSX · replaces the previous version</div>
                <button className="bi-drop-browse" onClick={e => { e.preventDefault(); e.currentTarget.parentElement.querySelector("input[type=file]").click(); }}>
                  Browse files
                </button>
                <button className="bi-drop-demo" onClick={e => { e.preventDefault(); onFixFileChosen(fileName.replace(/\.(xlsx|csv)/i, "-fixed.$1")); }}>
                  Use demo fixed file
                </button>
              </div>
            </label>
          </section>
        </div>

        <aside className="bi-map-side">
          <HelpCard articles={[
            { t: "How to fix common issues", d: "Date formats, currency codes, duplicates — and how we detect them." },
            { t: "Why do we verify data?",   d: "Clean input means reliable calculations and audit-ready reports." },
          ]}/>
          <div className="bi-map-summary">
            <div className="bi-map-summary-head">File</div>
            <div className="bi-map-summary-row"><span>Name</span><b style={{fontSize:12, textAlign:"right", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{fileName}</b></div>
            <div className="bi-map-summary-row"><span>Total rows</span><b>{TOTAL_ROWS.toLocaleString()}</b></div>
            <div className="bi-map-summary-row"><span>Blocked by errors</span><b style={{color:"#c62828"}}>{errorCount}</b></div>
          </div>
        </aside>
      </div>

      <FooterBar
        left={<button className="btn secondary" onClick={onBack}>Back</button>}
        right={<button className="btn primary" onClick={() => setPhase("rescanning")}>
          <Icon name="refresh" size={14}/> Verify again
        </button>}
        note={`${errorCount} error${errorCount === 1 ? "" : "s"} must be fixed before import`}
      />
    </>
  );
}

window.BulkImport = BulkImport;
window.BulkImportHome = BulkImportHome;
window.MapStep = MapStep;
