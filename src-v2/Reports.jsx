// Reports — custom report boards user can build by pulling charts/sections
// from the Analyse pages. State lives in localStorage so it survives reload.
//
// Schema:
//   {
//     id: "r_xxx", name: "Q1 board for SBTi", standard: "SBTi" | null,
//     createdAt: ISO,
//     items: [
//       { id: "item_xxx", source: "overview" | "quality" | "trends",
//         sectionId: "totals" | ..., label: "Totals & scope donut",
//         addedAt: ISO }
//     ]
//   }
//
// Charts/sections are referenced by source-page sectionId; the report board
// re-renders the live section content from those pages so data stays fresh.

const FE_REPORTS_KEY = "fe-reports-v1";
const FE_ACTIVE_REPORT_KEY = "fe-active-report";

const REPORTING_STANDARDS = [
  "GHG Protocol",
  "SBTi (Science Based Targets)",
  "CSRD / ESRS E1",
  "CDP Climate",
  "TCFD",
  "ISO 14064",
  "SECR (UK)",
  "Internal review",
];

function loadReports() {
  try { return JSON.parse(localStorage.getItem(FE_REPORTS_KEY) || "[]"); }
  catch { return []; }
}
function saveReports(list) {
  localStorage.setItem(FE_REPORTS_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("fe-reports-changed"));
}

function useReports() {
  const [reports, setReports] = React.useState(loadReports);
  React.useEffect(() => {
    const h = () => setReports(loadReports());
    window.addEventListener("fe-reports-changed", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("fe-reports-changed", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  const createReport = ({ name, description, isReport, standard }) => {
    const id = "r_" + Math.random().toString(36).slice(2, 8);
    const r = {
      id,
      name: name || "Untitled board",
      description: description || null,
      isReport: !!isReport,
      standard: isReport ? (standard || null) : null,
      createdAt: new Date().toISOString(),
      items: [],
    };
    const next = [...loadReports(), r];
    saveReports(next);
    return r;
  };
  const deleteReport = (id) => saveReports(loadReports().filter(r => r.id !== id));
  const renameReport = (id, name) => saveReports(loadReports().map(r => r.id === id ? { ...r, name } : r));
  const addItem = (reportId, item) => {
    const next = loadReports().map(r => {
      if (r.id !== reportId) return r;
      // De-dup by (source, sectionId)
      if (r.items.some(i => i.source === item.source && i.sectionId === item.sectionId)) return r;
      const id = "item_" + Math.random().toString(36).slice(2, 8);
      return { ...r, items: [...r.items, { id, addedAt: new Date().toISOString(), ...item }] };
    });
    saveReports(next);
  };
  const removeItem = (reportId, itemId) => {
    const next = loadReports().map(r => r.id !== reportId ? r : { ...r, items: r.items.filter(i => i.id !== itemId) });
    saveReports(next);
  };
  const reorderItems = (reportId, fromIdx, toIdx) => {
    const next = loadReports().map(r => {
      if (r.id !== reportId) return r;
      const items = [...r.items];
      const [m] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, m);
      return { ...r, items };
    });
    saveReports(next);
  };
  return { reports, createReport, deleteReport, renameReport, addItem, removeItem, reorderItems };
}

// --- "Add to report" picker — small popover surfaced next to each section
// Props:
//   source, sectionId, label  — chart identity
//   origin: optional { label, onRemove } — when provided, the dropdown shows
//          a "Keep in {label}" checkbox; unchecking it calls onRemove() after
//          add (move semantics). When omitted, the dropdown is copy-only.
//   variant: "default" | "card" — "card" renders a slightly stronger button
//          intended for in-card placement (e.g. pinned AI insight cards)
//   buttonLabel: override the button text (e.g. "Copy to board")
//   align: "left" | "right" — dropdown alignment (default "right")
//   currentBoard: optional `{ label, isAdded, onAdd, onRemove }` — when set,
//          prepends a "Current board" row so a single dropdown can both pin
//          to the source page AND add to any report. `onRemove` is invoked
//          if the row is clicked while already added.
// Coerce any React node (string, number, fragment, element tree) into plain
// text. Stored labels MUST be plain strings — a React element carries circular
// fiber refs in dev builds and will throw inside JSON.stringify, silently
// dropping the localStorage write (this is what broke "add insight to board").
function nodeToText(node) {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  if (React.isValidElement(node)) return nodeToText(node.props && node.props.children);
  return "";
}

function AddToReportButton({ source, sectionId, label, origin, variant = "default", buttonLabel, align = "right", currentBoard, extraBoards = [] }) {
  const { reports, createReport, addItem } = useReports();
  // Always store/display a plain-text label, never a JSX element.
  const labelText = React.useMemo(() => nodeToText(label) || sectionId || "", [label, sectionId]);
  const [open, setOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(null); // reportId we just added to (for ✓ feedback)
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [keepOriginal, setKeepOriginal] = React.useState(true);
  const [pinFlash, setPinFlash] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const isInReport = (rid) => {
    const r = reports.find(x => x.id === rid);
    return r?.items.some(i => i.source === source && i.sectionId === sectionId);
  };

  const finalize = () => {
    if (origin && origin.onRemove && !keepOriginal) {
      // Move semantics — remove from origin after a brief delay so the user
      // sees the success state before the source disappears.
      setTimeout(() => { origin.onRemove(); }, 600);
    }
  };

  const add = (rid) => {
    addItem(rid, { source, sectionId, label: labelText });
    setAdding(rid);
    finalize();
    setTimeout(() => { setAdding(null); setOpen(false); }, 900);
  };
  const onCreate = ({ name, description, isReport, standard }) => {
    const r = createReport({ name: name.trim() || "Untitled board", description, isReport, standard });
    addItem(r.id, { source, sectionId, label: labelText });
    setAdding(r.id);
    finalize();
    setCreating(false);
    setTimeout(() => { setAdding(null); setOpen(false); }, 900);
  };

  return (
    <div className={"add-to-report" + (variant === "card" ? " add-to-report--card" : "") + (open ? " is-open" : "")} ref={ref}>
      <button
        type="button"
        className={"add-to-report__btn" + (variant === "card" ? " add-to-report__btn--card" : "")}
        onClick={() => setOpen(v => !v)}
        title="Add to a board"
      >
        <Icon name="plus" size={13}/>{buttonLabel || "Add to board"}
      </button>
      {open && (
        <div className={"add-to-report__menu add-to-report__menu--" + align} role="menu">
          <div className="add-to-report__head">Add “{labelText || sectionId}” to…</div>
          {reports.length === 0 && !currentBoard && !creating && (
            <div className="add-to-report__empty">No reports yet. Create one to get started.</div>
          )}
          {!creating && (
            <div className="add-to-report__list">
              {currentBoard && (() => {
                const already = !!currentBoard.isAdded;
                const justAdded = pinFlash;
                return (
                  <button
                    type="button"
                    className={"add-to-report__item add-to-report__item--current"
                      + (already && !justAdded ? " is-existing" : "")
                      + (justAdded ? " is-added" : "")}
                    onClick={() => {
                      if (already) {
                        currentBoard.onRemove && currentBoard.onRemove();
                        setOpen(false);
                      } else {
                        currentBoard.onAdd && currentBoard.onAdd();
                        setPinFlash(true);
                        setTimeout(() => { setPinFlash(false); setOpen(false); }, 900);
                      }
                    }}
                  >
                    <Icon name={already || justAdded ? "check" : "pin"} size={13}/>
                    <span className="add-to-report__name">
                      Current board <span className="add-to-report__current-sub">· {currentBoard.label}</span>
                    </span>
                    {already && !justAdded && <span className="add-to-report__tag">Pinned</span>}
                  </button>
                );
              })()}
              {extraBoards.map(b => (
                <button
                  type="button"
                  key={b.key}
                  className={"add-to-report__item" + (b.isAdded ? " is-existing" : "")}
                  onClick={() => { b.onToggle && b.onToggle(); setOpen(false); }}
                >
                  <Icon name={b.isAdded ? "check" : "plus"} size={13}/>
                  <span className="add-to-report__name">{b.label}</span>
                  <span className="add-to-report__std">Default board</span>
                  {b.isAdded && <span className="add-to-report__tag">Added</span>}
                </button>
              ))}
              {reports.map(r => {
                const already = isInReport(r.id);
                const justAdded = adding === r.id;
                return (
                  <button
                    type="button"
                    key={r.id}
                    className={"add-to-report__item " + (already ? "is-existing" : "") + (justAdded ? " is-added" : "")}
                    onClick={() => !already && add(r.id)}
                    disabled={already}
                  >
                    <Icon name={already || justAdded ? "check" : "plus"} size={13}/>
                    <span className="add-to-report__name">{r.name}</span>
                    {r.standard && <span className="add-to-report__std">{r.standard}</span>}
                    {already && <span className="add-to-report__tag">Added</span>}
                  </button>
                );
              })}
            </div>
          )}
          {creating ? null : (
            <button type="button" className="add-to-report__new" onClick={() => { setOpen(false); setCreating(true); }}>
              <Icon name="plus" size={13}/>Create new board…
            </button>
          )}
          {origin && origin.onRemove && (
            <label className="add-to-report__keep" title="Uncheck to move the chart instead of copying it">
              <input
                type="checkbox"
                checked={keepOriginal}
                onChange={e => setKeepOriginal(e.target.checked)}
              />
              <span className="add-to-report__keep-text">
                Keep in <strong>{origin.label}</strong>
              </span>
            </label>
          )}
        </div>
      )}
      {creating && (
        <CreateReportModal
          onClose={() => setCreating(false)}
          onCreate={onCreate}
          presetName={labelText ? `${labelText} — new board` : ""}
        />
      )}
    </div>
  );
}

// --- Create Report modal — name + reporting standard
function CreateReportModal({ onCreate, onClose, presetName }) {
  const [name, setName] = React.useState(presetName || "");
  const [description, setDescription] = React.useState("");
  const [isReport, setIsReport] = React.useState(false);
  const [standard, setStandard] = React.useState(REPORTING_STANDARDS[0] || "");

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      description: description.trim() || null,
      isReport,
      standard: isReport ? (standard || null) : null,
    });
  };

  return ReactDOM.createPortal((
    <div className="create-report__backdrop" onClick={onClose}>
      <div className="create-report__modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="create-report__close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={18}/>
        </button>
        <h2 className="create-report__title">Create a new board</h2>
        <p className="create-report__sub">
          Boards are custom views you can build by pulling charts and sections from
          your Analyse pages. Useful for assurance, audit, or sharing a focused view.
        </p>
        <form onSubmit={submit} className="create-report__form">
          <label className="create-report__label">
            Board name
            <input
              autoFocus
              className="create-report__input"
              placeholder="e.g. Q1 2026 — SBTi submission"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </label>
          <label className="create-report__label">
            Description
            <span className="create-report__optional">Optional</span>
            <textarea
              className="create-report__textarea"
              placeholder="What's this board for? Who's it shared with?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
            />
          </label>
          <label className="create-report__check">
            <input
              type="checkbox"
              className="create-report__check-box"
              checked={isReport}
              onChange={e => setIsReport(e.target.checked)}
            />
            <span className="create-report__check-body">
              <span className="create-report__check-title">For reporting</span>
              <span className="create-report__check-desc">
                Charts pinned to this board are auto-formatted to the selected reporting standard.
              </span>
            </span>
          </label>
          {isReport && (
            <label className="create-report__label create-report__label--nested">
              Reporting standard
              <select
                className="create-report__select"
                value={standard}
                onChange={e => setStandard(e.target.value)}
              >
                {REPORTING_STANDARDS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          )}
          <div className="create-report__actions">
            <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={!name.trim()}>
              Create board <Icon name="arrowRight" size={14}/>
            </button>
          </div>
        </form>
      </div>
    </div>
  ), document.body);
}

// --- Report board page — renders an existing report
function ReportBoard({ reportId, onJumpTo, calcs, entries, renderSection }) {
  const { reports, deleteReport, renameReport, removeItem, reorderItems } = useReports();
  const report = reports.find(r => r.id === reportId);
  const [renaming, setRenaming] = React.useState(false);
  const [draftName, setDraftName] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  if (!report) {
    return (
      <div className="card" style={{padding: 24, textAlign: "center"}}>
        <h2 className="page-title">Report not found</h2>
        <p className="page-subtitle">
          This report may have been deleted. <span className="link" onClick={() => onJumpTo("overview")}>Back to overview</span>.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          {renaming ? (
            <form onSubmit={e => { e.preventDefault(); renameReport(report.id, draftName.trim() || report.name); setRenaming(false); }}>
              <input
                autoFocus
                className="report-board__rename"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onBlur={() => { renameReport(report.id, draftName.trim() || report.name); setRenaming(false); }}
              />
            </form>
          ) : (
            <div className="page-head__titlerow">
              <h1
                className="page-title report-board__title"
                onClick={() => { setDraftName(report.name); setRenaming(true); }}
                title="Click to rename"
              >
                {report.name}
              </h1>
              {window.BoardActionsMenu && (
                <window.BoardActionsMenu
                  editLayoutActive={false}
                  onToggleEditLayout={() => onJumpTo("overview")}
                  canRename={true}
                  onRename={() => { setDraftName(report.name); setRenaming(true); }}
                  canDelete={true}
                  onDelete={() => setConfirmDelete(true)}
                />
              )}
            </div>
          )}
          <div className="page-subtitle">
            {report.isReport ? "Custom report" : "Custom board"}
            {report.isReport && report.standard ? <> · <span className="report-board__std">{report.standard}</span></> : null}
            {" · "}{report.items.length} {report.items.length === 1 ? "chart" : "charts"}
          </div>
          {report.description ? (
            <div className="report-board__desc">{report.description}</div>
          ) : null}
        </div>
        <div className="page-actions">
          <button className="btn secondary small" onClick={() => onJumpTo("overview")}>
            <Icon name="plus" size={14}/>Add more charts
          </button>
        </div>
      </div>

      {report.items.length === 0 ? (
        <div className="report-empty">
          <div className="report-empty__icon"><Icon name="sparkle" size={28}/></div>
          <h3 className="report-empty__title">Your report is empty</h3>
          <p className="report-empty__body">
            Open any Analyse page and look for the <strong>Add to board</strong> button on each
            section — pick this report from the dropdown and the chart will land here.
          </p>
          <div className="report-empty__actions">
            <button className="btn primary" onClick={() => onJumpTo("overview")}>
              <Icon name="arrowRight" size={14}/>Open Emission overview
            </button>
            <button className="btn secondary" onClick={() => onJumpTo("quality")}>
              Open Calculation quality
            </button>
            <button className="btn secondary" onClick={() => onJumpTo("trends")}>
              Open Trends
            </button>
          </div>
        </div>
      ) : (
        <div className="report-board__items">
          {report.items.map((item, idx) => {
            const rendered = renderSection ? renderSection(item, report) : null;
            return (
              <div key={item.id} className="report-item">
                <div className="report-item__chrome">
                  <div className="report-item__meta">
                    <span className="report-item__source">From {sourceLabel(item.source)}</span>
                    <span className="report-item__sep">·</span>
                    <span className="report-item__label">{item.label}</span>
                    {report.isReport && report.standard ? (
                      <span className="report-item__std" title={"Auto-formatted for " + report.standard}>
                        <Icon name="sparkle" size={11}/>
                        {report.standard}
                      </span>
                    ) : null}
                  </div>
                  <div className="report-item__actions">
                    <button
                      className="report-item__btn"
                      disabled={idx === 0}
                      onClick={() => reorderItems(report.id, idx, idx - 1)}
                      title="Move up"
                    >
                      <Icon name="chev" size={14} style={{transform: "rotate(180deg)"}}/>
                    </button>
                    <button
                      className="report-item__btn"
                      disabled={idx >= report.items.length - 1}
                      onClick={() => reorderItems(report.id, idx, idx + 1)}
                      title="Move down"
                    >
                      <Icon name="chev" size={14}/>
                    </button>
                    <button
                      className="report-item__btn"
                      onClick={() => onJumpTo(item.source)}
                      title={"Open in " + sourceLabel(item.source)}
                    >
                      <Icon name="arrowRight" size={13}/>
                    </button>
                    <button
                      className="report-item__btn danger"
                      onClick={() => removeItem(report.id, item.id)}
                      title="Remove from report"
                    >
                      <Icon name="close" size={14}/>
                    </button>
                  </div>
                </div>
                <div className="report-item__content">
                  {rendered || <ReportItemFallback item={item}/>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmDelete && (
        <div className="create-report__backdrop" onClick={() => setConfirmDelete(false)}>
          <div className="create-report__modal create-report__modal--small" onClick={e => e.stopPropagation()}>
            <h2 className="create-report__title">Delete this {report.isReport ? "report" : "board"}?</h2>
            <p className="create-report__sub">
              “{report.name}” will be removed permanently. The charts themselves stay on their original Analyse pages.
            </p>
            <div className="create-report__actions">
              <button className="btn secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn danger" onClick={() => { deleteReport(report.id); onJumpTo("overview"); }}>
                <Icon name="trash" size={14}/>Delete {report.isReport ? "report" : "board"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function sourceLabel(src) {
  return ({
    overview: "Emission overview",
    quality:  "Calculation quality",
    trends:   "Trends",
  })[src] || src;
}

function ReportItemFallback({ item }) {
  return (
    <div className="report-item__fallback">
      <p>Could not render this section. It may have been removed from the source page.</p>
      <p className="report-item__fallback-meta">Source: {sourceLabel(item.source)} · {item.sectionId}</p>
    </div>
  );
}

Object.assign(window, { useReports, CreateReportModal, ReportBoard, AddToReportButton, REPORTING_STANDARDS });
