// Data-grid toolbar controls: multi-level Sort, Group, Density, the Columns
// panel (show/hide + drag reorder + pin + EF group), and the view dirty cluster.
// All are controlled components driven by AllData's working state.

// Small popover button shell — a trigger button + an anchored panel with a
// click-away scrim. `badge` shows an active-count pill on the trigger.
function ToolButton({ icon, label, active, badge, children, panelClass = "", title }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span className="tb-wrap">
      <button
        type="button"
        className={"tb-btn" + (active ? " on" : "")}
        aria-haspopup="true" aria-expanded={open}
        title={title || label}
        onClick={() => setOpen(o => !o)}
      >
        <Icon name={icon} size={15}/>
        <span className="tb-btn-label">{label}</span>
        {badge ? <span className="tb-badge">{badge}</span> : null}
      </button>
      {open && (
        <>
          <div className="tb-scrim" onClick={() => setOpen(false)}/>
          <div className={"tb-pop " + panelClass} role="dialog" onClick={(e) => e.stopPropagation()}>
            {typeof children === "function" ? children(() => setOpen(false)) : children}
          </div>
        </>
      )}
    </span>
  );
}

// ── Multi-level Sort ────────────────────────────────────────────────────────
function SortControl({ sort, colOptions, onChange }) {
  const used = new Set(sort.map(s => s.key));
  const firstUnused = colOptions.find(c => !used.has(c.k));
  const labelOf = (k) => (colOptions.find(c => c.k === k) || {}).label || k;
  const setLevel = (i, patch) => onChange(sort.map((s, j) => j === i ? { ...s, ...patch } : s));
  const removeLevel = (i) => onChange(sort.filter((_, j) => j !== i));
  const addLevel = () => { if (firstUnused) onChange([...sort, { key: firstUnused.k, dir: "asc" }]); };

  return (
    <ToolButton icon="sort" label="Sort" active={sort.length > 0} badge={sort.length || null}>
      <div className="tb-pop-head">
        <span>Sort</span>
        {sort.length > 0 && <button className="tb-link" onClick={() => onChange([])}>Clear all</button>}
      </div>
      {sort.length === 0 && <div className="tb-empty">No sorts applied to this view.</div>}
      <div className="sort-levels">
        {sort.map((s, i) => (
          <div className="sort-level" key={i}>
            <span className="sort-rank">{i === 0 ? "Sort by" : "then by"}</span>
            <select className="tb-select" value={s.key} onChange={(e) => setLevel(i, { key: e.target.value })}>
              {colOptions.filter(c => c.k === s.key || !used.has(c.k)).map(c => (
                <option key={c.k} value={c.k}>{c.label}</option>
              ))}
            </select>
            <div className="seg-toggle" role="group" aria-label={`Direction for ${labelOf(s.key)}`}>
              <button className={s.dir === "asc" ? "on" : ""} onClick={() => setLevel(i, { dir: "asc" })}>Asc</button>
              <button className={s.dir === "desc" ? "on" : ""} onClick={() => setLevel(i, { dir: "desc" })}>Desc</button>
            </div>
            <button className="tb-icon-btn" title="Remove" aria-label="Remove sort" onClick={() => removeLevel(i)}>
              <Icon name="close" size={13}/>
            </button>
          </div>
        ))}
      </div>
      {firstUnused && (
        <button className="tb-add" onClick={addLevel}><Icon name="plus" size={13}/>Add sort</button>
      )}
    </ToolButton>
  );
}

// ── Group by ────────────────────────────────────────────────────────────────
function GroupControl({ group, options, onChange }) {
  return (
    <ToolButton icon="group" label="Group" active={!!group} badge={group ? 1 : null}>
      {(close) => (
        <>
          <div className="tb-pop-head"><span>Group rows by</span></div>
          <div className="tb-radio-list">
            <button className={"tb-radio" + (!group ? " on" : "")} onClick={() => { onChange(null); close(); }}>
              <span className="tb-radio-dot"/>None
            </button>
            {options.map(o => (
              <button key={o.k} className={"tb-radio" + (group === o.k ? " on" : "")} onClick={() => { onChange(o.k); close(); }}>
                <span className="tb-radio-dot"/>{o.label}
              </button>
            ))}
          </div>
          <div className="tb-pop-foot-note">Grouping is saved into this view — change it and Save to keep it.</div>
        </>
      )}
    </ToolButton>
  );
}

// ── Density ───────────────────────────────────────────────────────────────
function DensityControl({ density, onChange }) {
  const OPTS = [
    { k: "comfortable", label: "Comfortable" },
    { k: "compact",     label: "Compact" },
    { k: "condensed",   label: "Condensed" },
  ];
  return (
    <ToolButton icon="rows" label="Density" title="Row density">
      {(close) => (
        <>
          <div className="tb-pop-head"><span>Row density</span></div>
          <div className="tb-radio-list">
            {OPTS.map(o => (
              <button key={o.k} className={"tb-radio" + (density === o.k ? " on" : "")} onClick={() => { onChange(o.k); close(); }}>
                <span className="tb-radio-dot"/>{o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </ToolButton>
  );
}

// ── Columns panel: show/hide + drag reorder + pin + EF group ────────────────
function ColToggle({ label, on, onToggle, hint }) {
  return (
    <button type="button" className={"col-toggle" + (on ? " on" : "")} onClick={onToggle} role="switch" aria-checked={on}>
      <span className="col-switch" aria-hidden="true"><span className="col-switch-knob"/></span>
      <span className="col-toggle-label">{label}</span>
      {hint ? <span className="col-toggle-hint">{hint}</span> : null}
    </button>
  );
}

// Columns panel — simplified: a "Find column" search + a flat list of on/off
// toggle switches (incl. the leading checkbox-selection column). Pinning and
// reordering live on the column-header menu, not here.
function ColumnsPanel({ columns, onChange, defaultOrder, selectionOn, onToggleSelection }) {
  const { order, visible } = columns;
  const visSet = new Set(visible);
  const [q, setQ] = React.useState("");
  const colOf = (k) => window.DATA_COL_BY_KEY[k];
  const setVisible = (next) => onChange({ ...columns, visible: next });
  const toggle = (k) => setVisible(visSet.has(k) ? visible.filter(x => x !== k) : [...visible, k]);
  const query = q.trim().toLowerCase();
  const match = (label) => !query || label.toLowerCase().includes(query);
  const rows = order.filter(k => colOf(k) && match(colOf(k).label));
  const showSelection = typeof onToggleSelection === "function" && match("checkbox selection");

  return (
    <ToolButton icon="columns" label="Columns" badge={visible.length} panelClass="cols-panel">
      <div className="cols-find">
        <Icon name="search" size={15}/>
        <input className="cols-find-input" type="text" placeholder="Find column"
               value={q} onChange={(e) => setQ(e.target.value)} autoFocus/>
      </div>
      <div className="cols-list">
        {showSelection && (
          <ColToggle label="Checkbox selection" on={!!selectionOn} onToggle={onToggleSelection}/>
        )}
        {rows.map(k => (
          <ColToggle key={k} label={colOf(k).label} on={visSet.has(k)} onToggle={() => toggle(k)}/>
        ))}
        {rows.length === 0 && !showSelection && <div className="cols-empty">No columns match “{q}”</div>}
      </div>
      <div className="cols-foot">
        <button className="tb-link" onClick={() => setVisible(window.DATA_COLUMNS.map(c => c.k))}>Show all</button>
        <button className="tb-link" onClick={() => setVisible([])}>Hide all</button>
      </div>
    </ToolButton>
  );
}

// ── View dirty cluster: ● Modified — Save / Save as new / Reset ─────────────
function ViewDirtyCluster({ dirty, view, onSave, onSaveAsNew, onReset }) {
  if (!dirty) return null;
  return (
    <span className="view-dirty" role="status">
      <span className="view-dirty-dot" aria-hidden="true"/>
      <span className="view-dirty-label">Modified</span>
      <button className="vd-btn primary" onClick={onSave} title={`Save changes to “${view.name}”`}>
        <Icon name="check" size={13}/>Save
      </button>
      <button className="vd-btn" onClick={onSaveAsNew} title="Save these changes as a new view">Save as new</button>
      <button className="vd-btn ghost" onClick={onReset} title="Discard changes">Reset</button>
    </span>
  );
}

Object.assign(window, { ToolButton, SortControl, GroupControl, DensityControl, ColumnsPanel, ViewDirtyCluster });
