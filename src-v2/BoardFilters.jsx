// Board filters — pill-row of filter controls displayed at the top of each
// default board (Home / Emission overview / Hotspot / Trends).
//
// This is presentational scaffolding for the prototype: dropdowns open menus
// you can pick from but values don't yet flow into the charts. They live
// per-board in localStorage so the user can see their selection persist as
// they navigate between boards.

const BUSINESS_UNITS = [
  "All business units",
  "Supply chain",
  "Finance",
  "Operations",
  "Commercial",
];

function useBoardFilters(boardKey) {
  const storageKey = "fe-board-filters-v2-" + boardKey;
  const [state, setState] = React.useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (stored) return stored;
    } catch {}
    return {
      businessUnit: "All business units",
      startDate: "01.10.2024",
      endDate: "30.09.2025",
    };
  });
  const update = (patch) => {
    setState(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };
  return [state, update];
}

// --- Floating-label pill control ---------------------------------------------
function BFilterShell({ label, children, asButton, onClick }) {
  const Comp = asButton ? "button" : "div";
  return (
    <Comp className={"bfilter" + (asButton ? " bfilter--button" : "")} onClick={onClick} type={asButton ? "button" : undefined}>
      <span className="bfilter__label">{label}</span>
      <span className="bfilter__body">{children}</span>
    </Comp>
  );
}

function BFilterSelect({ label, value, options, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="bfilter" ref={ref}>
      <span className="bfilter__label">{label}</span>
      <button
        type="button"
        className="bfilter__body bfilter__body--select"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="bfilter__value">{value}</span>
        <span className="bfilter__chev" aria-hidden>
          <Icon name="chev" size={16}/>
        </span>
      </button>
      {open && (
        <div className="bfilter__menu" role="listbox">
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={opt === value}
              className={"bfilter__opt" + (opt === value ? " bfilter__opt--active" : "")}
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              {opt}
              {opt === value && <Icon name="check" size={14}/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BFilterDate({ label, value, onChange }) {
  // Date is presented in DD.MM.YYYY; native input expects YYYY-MM-DD.
  const toISO = (v) => {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v || "");
    if (!m) return "";
    return m[3] + "-" + m[2] + "-" + m[1];
  };
  const fromISO = (v) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
    if (!m) return "";
    return m[3] + "." + m[2] + "." + m[1];
  };
  const inputRef = React.useRef(null);
  const open = () => {
    if (!inputRef.current) return;
    if (typeof inputRef.current.showPicker === "function") {
      inputRef.current.showPicker();
    } else {
      inputRef.current.focus();
      inputRef.current.click();
    }
  };
  return (
    <div className="bfilter bfilter--date">
      <span className="bfilter__label">{label}</span>
      <div className="bfilter__body bfilter__body--date">
        <span className="bfilter__value">{value}</span>
        <button type="button" className="bfilter__cal" onClick={open} aria-label={"Open " + label}>
          <Icon name="calendar" size={18}/>
        </button>
        <input
          ref={inputRef}
          type="date"
          className="bfilter__date-input"
          value={toISO(value)}
          onChange={(e) => {
            const v = fromISO(e.target.value);
            if (v) onChange(v);
          }}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

// --- The bar ----------------------------------------------------------------
function BoardFilters({ boardKey, hidden }) {
  const [filters, update] = useBoardFilters(boardKey);
  if (hidden) return null;
  return (
    <div className="board-filters" data-edit-skip="true">
      <BFilterSelect
        label="Business Unit"
        value={filters.businessUnit}
        options={BUSINESS_UNITS}
        onChange={(v) => update({ businessUnit: v })}
      />
      <BFilterDate
        label="Start date"
        value={filters.startDate}
        onChange={(v) => update({ startDate: v })}
      />
      <BFilterDate
        label="End date"
        value={filters.endDate}
        onChange={(v) => update({ endDate: v })}
      />
    </div>
  );
}

Object.assign(window, { BoardFilters });
