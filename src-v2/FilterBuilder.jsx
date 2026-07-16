// Filter builder — a query-builder popover for the All-data grid.
//
// Replaces the inline filter-pill row. The "Filter" trigger opens a box of
// condition rows: [remove] [And/Or] [Column] [Operator] [Value], plus
// "Add filter" and "Remove all". Rows are combined left-to-right with a single
// group connective (And/Or), matching the Notion/MUI pattern.
//
// A rule is: { id, conn: 'and'|'or', col, op, value }. Rules with no column or
// an empty value (for value-taking operators) are inert — they don't filter.
//
// The component is controlled: `rules` in, `onChange(nextRules)` out.

// ── Operator vocab, keyed off column type ───────────────────────────────────
function fbOpsFor(col, numericKeys, colConfig) {
  if (colConfig && colConfig[col] && colConfig[col].options) {
    return [{ k: "is", l: "is" }, { k: "is_not", l: "is not" }];
  }
  if (numericKeys && numericKeys.has && numericKeys.has(col)) {
    return [{ k: "eq", l: "equals" }, { k: "gt", l: "greater than" }, { k: "lt", l: "less than" }];
  }
  return [
    { k: "contains", l: "contains" }, { k: "equals", l: "equals" },
    { k: "starts", l: "starts with" }, { k: "empty", l: "is empty" }, { k: "nempty", l: "is not empty" },
  ];
}
function fbDefaultOp(col, numericKeys, colConfig) { return fbOpsFor(col, numericKeys, colConfig)[0].k; }
function fbOpNeedsValue(op) { return op !== "empty" && op !== "nempty"; }

// ── Pure matchers ───────────────────────────────────────────────────────────
function fbMatchRule(rule, e, getVal) {
  if (!rule || !rule.col) return true;
  if (fbOpNeedsValue(rule.op) && (rule.value == null || rule.value === "")) return true;
  const cell = getVal(e, rule.col);
  const cs = cell == null ? "" : String(cell);
  const v = rule.value == null ? "" : String(rule.value);
  // "Data 2" experiment: an aggregated cell reads "multiple, v1, v2" — option
  // filters then match by membership, so "is v1" still finds the parent row.
  const parts = cs.startsWith("multiple, ") ? ["multiple", ...cs.slice(10).split(", ")] : null;
  switch (rule.op) {
    case "is":       return parts ? parts.includes(v) : cs === v;
    case "is_not":   return parts ? !parts.includes(v) : cs !== v;
    case "contains": return cs.toLowerCase().includes(v.toLowerCase());
    case "equals":   return cs.toLowerCase() === v.toLowerCase();
    case "starts":   return cs.toLowerCase().startsWith(v.toLowerCase());
    case "empty":    return cs === "";
    case "nempty":   return cs !== "";
    // Non-summable aggregates ("multiple, v1, v2") match numerically when ANY
    // sub-value meets the criteria (parts[0] is the "multiple" marker — skip it).
    case "eq":       return parts ? parts.slice(1).some(p => parseFloat(p) === parseFloat(v)) : parseFloat(cs) === parseFloat(v);
    case "gt":       return parts ? parts.slice(1).some(p => parseFloat(p) >  parseFloat(v)) : parseFloat(cs) >  parseFloat(v);
    case "lt":       return parts ? parts.slice(1).some(p => parseFloat(p) <  parseFloat(v)) : parseFloat(cs) <  parseFloat(v);
    default:         return true;
  }
}
function evalFilterRules(rules, e, getVal) {
  if (!rules || !rules.length) return true;
  let acc = fbMatchRule(rules[0], e, getVal);
  for (let i = 1; i < rules.length; i++) {
    const m = fbMatchRule(rules[i], e, getVal);
    acc = rules[i].conn === "or" ? (acc || m) : (acc && m);
  }
  return acc;
}
function fbRuleActive(r) {
  if (!r || !r.col) return false;
  return !fbOpNeedsValue(r.op) || (r.value != null && r.value !== "");
}
function activeRuleCount(rules) { return (rules || []).filter(fbRuleActive).length; }

// ── Legacy {col: value} ⇄ rules bridges (keep saved views / presets working) ─
function rulesFromColFilters(cf, optionCols, numericKeys) {
  const set = optionCols instanceof Set ? optionCols : new Set(optionCols || []);
  return Object.entries(cf || {}).map(([col, value]) => {
    const op = (numericKeys && numericKeys.has && numericKeys.has(col)) ? "eq" : set.has(col) ? "is" : "contains";
    return { id: fbRid(), conn: "and", col, op, value: String(value) };
  });
}
function colFiltersFromRules(rules) {
  const out = {};
  (rules || []).forEach(r => {
    if (!fbRuleActive(r)) return;
    if (["is", "equals", "contains", "eq"].includes(r.op)) out[r.col] = r.value;
  });
  return out;
}
function fbRid() { return "r" + Math.random().toString(36).slice(2, 8); }

// ── Component ────────────────────────────────────────────────────────────────
function FilterBuilder({ rules, onChange, cols, colConfig, numericKeys }) {
  const [open, setOpen] = React.useState(false);
  const count = activeRuleCount(rules);
  const groupConn = rules[1]?.conn || "and";

  const labelOf = (k) => (cols.find(c => c.k === k) || {}).label || k;
  const update = (i, patch) => onChange(rules.map((r, j) => j === i ? { ...r, ...patch } : r));
  const remove = (i) => onChange(rules.filter((_, j) => j !== i));
  const setConn = (c) => onChange(rules.map((r, j) => j === 0 ? r : { ...r, conn: c }));
  const add = () => {
    const col = (cols[0] && cols[0].k) || "id";
    onChange([...rules, { id: fbRid(), conn: groupConn, col, op: fbDefaultOp(col, numericKeys, colConfig), value: "" }]);
  };
  const changeCol = (i, col) => update(i, { col, op: fbDefaultOp(col, numericKeys, colConfig), value: "" });

  return (
    <span className="tb-wrap">
      <button
        type="button"
        className={"tb-btn" + (count ? " on" : "")}
        aria-haspopup="true" aria-expanded={open}
        title="Filter"
        onClick={() => setOpen(o => !o)}
      >
        <Icon name="filter" size={15}/>
        <span className="tb-btn-label">Filters</span>
        {count ? <span className="tb-badge">{count}</span> : null}
      </button>
      {open && (
        <>
          <div className="tb-scrim" onClick={() => setOpen(false)}/>
          <div className="tb-pop fb-pop" role="dialog" onClick={(e) => e.stopPropagation()}>
            {rules.length === 0 ? (
              <div className="fb-empty">
                <Icon name="filter" size={20}/>
                <p>No filters applied to this view.</p>
              </div>
            ) : (
              <div className="fb-list">
                {rules.map((r, i) => {
                  const ops = fbOpsFor(r.col, numericKeys, colConfig);
                  const cfg = colConfig[r.col];
                  const needsValue = fbOpNeedsValue(r.op);
                  return (
                    <div className="fb-row" key={r.id || i}>
                      <button className="fb-x" title="Remove condition" aria-label="Remove condition" onClick={() => remove(i)}>
                        <Icon name="close" size={16}/>
                      </button>
                      {i > 0 && (
                        <div className="fb-field fb-field-logic">
                          <label className="fb-cap fb-cap-ghost">And/Or</label>
                          {i === 1 ? (
                            <span className="fb-select-wrap">
                              <select className="fb-select" value={groupConn} onChange={(e) => setConn(e.target.value)}>
                                <option value="and">And</option>
                                <option value="or">Or</option>
                              </select>
                              <Icon name="chev" size={13}/>
                            </span>
                          ) : <span className="fb-conn-static">{groupConn === "or" ? "Or" : "And"}</span>}
                        </div>
                      )}
                      <div className="fb-field fb-field-col">
                        <label className="fb-cap">Columns</label>
                        <span className="fb-select-wrap">
                          <select className="fb-select" value={r.col} onChange={(e) => changeCol(i, e.target.value)}>
                            {cols.map(c => <option key={c.k} value={c.k}>{c.label}</option>)}
                          </select>
                          <Icon name="chev" size={13}/>
                        </span>
                      </div>
                      <div className="fb-field fb-field-op">
                        <label className="fb-cap">Operator</label>
                        <span className="fb-select-wrap">
                          <select className="fb-select" value={r.op} onChange={(e) => update(i, { op: e.target.value, ...(fbOpNeedsValue(e.target.value) ? {} : { value: "" }) })}>
                            {ops.map(o => <option key={o.k} value={o.k}>{o.l}</option>)}
                          </select>
                          <Icon name="chev" size={13}/>
                        </span>
                      </div>
                      <div className="fb-field fb-field-val">
                        <label className="fb-cap">Value</label>
                        {!needsValue ? (
                          <span className="fb-val-na">—</span>
                        ) : cfg && cfg.options ? (
                          <span className="fb-select-wrap">
                            <select className={"fb-select" + (r.value ? "" : " placeholder")} value={r.value || ""} onChange={(e) => update(i, { value: e.target.value })}>
                              <option value="" disabled>Filter value</option>
                              {cfg.options.map(o => <option key={o.k} value={o.k}>{o.l}</option>)}
                            </select>
                            <Icon name="chev" size={13}/>
                          </span>
                        ) : (
                          <input
                            className="fb-input"
                            type={numericKeys && numericKeys.has && numericKeys.has(r.col) ? "number" : "text"}
                            placeholder="Filter value"
                            value={r.value || ""}
                            onChange={(e) => update(i, { value: e.target.value })}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="fb-foot">
              <button className="fb-add" onClick={add}><Icon name="plus" size={15}/>Add filter</button>
              {rules.length > 0 && (
                <button className="fb-remove-all" onClick={() => { onChange([]); }}>
                  <Icon name="trash" size={15}/>Remove all
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </span>
  );
}

// Canonical set of option-based columns — the single source of truth shared by
// AllData (seeding) and DataGridModel (view-state normalization) so legacy
// {col: value} → rule conversion is identical on both sides.
const FB_OPTION_COLS = new Set([
  "business_unit","status","quality","calc_basis","scope","scope3_category",
  "user_assigned","data_input_type","ef_source","ef_year","ef_region","consumption_unit","co2e_unit",
]);

Object.assign(window, {
  FilterBuilder, evalFilterRules, activeRuleCount,
  rulesFromColFilters, colFiltersFromRules,
  fbOpsFor, fbDefaultOp, fbRuleActive, fbRid, FB_OPTION_COLS,
});
