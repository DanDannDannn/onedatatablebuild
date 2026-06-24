// Manual entry — dedicated page for adding a single line item.
// Designed for onboarding and one-off entries. Form on the left,
// "what happens next" guidance on the right.

function ManualEntry({ onSubmitted, onJumpTo }) {
  const [form, setForm] = React.useState({
    activity: "",
    category: "electricity",
    amount: "",
    unit: "kWh",
    date: "2026-04-02",
    site: "",
    supplier: "",
    notes: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(null);

  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  const valid = form.activity && form.amount && form.date;

  const submit = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      const id = "ENT-" + Math.floor(Math.random() * 9000 + 1000);
      setSubmitted({ id, ...form });
      onSubmitted?.({ id, ...form });
    }, 1200);
  };

  if (submitted) {
    return (
      <div className="me-page">
        <div className="me-success">
          <div className="me-success-icon"><Icon name="check" size={28}/></div>
          <h2 className="me-success-title">Entry added</h2>
          <p className="me-success-sub">
            <b>{submitted.activity}</b> · {submitted.amount} {submitted.unit} · {submitted.date}
            <br/>We're matching an emission factor in the background.
          </p>
          <div className="me-success-actions">
            <button className="btn primary" onClick={() => { setSubmitted(null); setForm({...form, activity: "", amount: "", supplier: "", notes: ""}); }}>
              <Icon name="pencil" size={14}/>Add another
            </button>
            <button className="btn secondary" onClick={() => onJumpTo?.("calcs")}>
              View in Calculations<Icon name="arrowRight" size={14}/>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="me-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Manual entry</h1>
          <div className="page-subtitle">Add a single emissions data point — useful for one-offs, corrections, or items not in your invoices.</div>
        </div>
      </div>

      <div className="me-grid">
        <div className="card me-form">
          <div className="me-form-section">
            <div className="me-section-label">Activity</div>
            <div className="me-field">
              <label>What is this?<span className="me-req">*</span></label>
              <input
                type="text"
                placeholder="e.g. Office electricity – Berlin HQ"
                value={form.activity}
                onChange={e => set("activity", e.target.value)}
              />
              <div className="me-help">A short description so you can recognise it later.</div>
            </div>
            <div className="me-field">
              <label>Category</label>
              <select value={form.category} onChange={e => set("category", e.target.value)}>
                <option value="electricity">Electricity</option>
                <option value="natural_gas">Natural gas</option>
                <option value="diesel">Diesel</option>
                <option value="flight">Flight</option>
                <option value="purchased_goods">Purchased goods</option>
                <option value="waste">Waste</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="me-form-section">
            <div className="me-section-label">Quantity</div>
            <div className="me-field-row">
              <div className="me-field" style={{flex: 2}}>
                <label>Amount<span className="me-req">*</span></label>
                <input
                  type="number"
                  placeholder="0"
                  value={form.amount}
                  onChange={e => set("amount", e.target.value)}
                />
              </div>
              <div className="me-field" style={{flex: 1}}>
                <label>Unit</label>
                <select value={form.unit} onChange={e => set("unit", e.target.value)}>
                  <option>kWh</option>
                  <option>m³</option>
                  <option>L</option>
                  <option>kg</option>
                  <option>t</option>
                  <option>km</option>
                  <option>EUR</option>
                  <option>USD</option>
                </select>
              </div>
            </div>
            <div className="me-field">
              <label>Date<span className="me-req">*</span></label>
              <input type="date" value={form.date} onChange={e => set("date", e.target.value)}/>
            </div>
          </div>

          <div className="me-form-section">
            <div className="me-section-label">Context <span className="me-section-opt">optional</span></div>
            <div className="me-field-row">
              <div className="me-field" style={{flex: 1}}>
                <label>Site / business unit</label>
                <input type="text" placeholder="Berlin HQ" value={form.site} onChange={e => set("site", e.target.value)}/>
              </div>
              <div className="me-field" style={{flex: 1}}>
                <label>Supplier / vendor</label>
                <input type="text" placeholder="e.g. Vattenfall" value={form.supplier} onChange={e => set("supplier", e.target.value)}/>
              </div>
            </div>
            <div className="me-field">
              <label>Notes</label>
              <textarea rows={2} placeholder="Anything else worth noting (source document, who provided this, special context…)" value={form.notes} onChange={e => set("notes", e.target.value)}/>
            </div>
          </div>

          <div className="me-form-actions">
            <button className="btn ghost" onClick={() => setForm({activity: "", category: "electricity", amount: "", unit: "kWh", date: "2026-04-02", site: "", supplier: "", notes: ""})}>Reset</button>
            <button className="btn primary" disabled={!valid || submitting} onClick={submit}>
              {submitting ? <><Icon name="refresh" size={14} className="spin"/>Adding…</> : <>Add entry<Icon name="arrowRight" size={14}/></>}
            </button>
          </div>
        </div>

        <div className="me-side">
          <div className="card me-next">
            <div className="me-next-title">What happens next</div>
            <ol className="me-steps">
              <li>
                <span className="me-step-n">1</span>
                <div>
                  <div className="me-step-h">We store your entry</div>
                  <div className="me-step-d">It appears in <b>Activity data</b> with the source marked as <b>Manual</b>.</div>
                </div>
              </li>
              <li>
                <span className="me-step-n">2</span>
                <div>
                  <div className="me-step-h">AI matches an emission factor</div>
                  <div className="me-step-d">Based on category, region, and supplier — usually under a minute.</div>
                </div>
              </li>
              <li>
                <span className="me-step-n">3</span>
                <div>
                  <div className="me-step-h">You review the calculation</div>
                  <div className="me-step-d">Confirm the suggested factor or pick a different one.</div>
                </div>
              </li>
            </ol>
          </div>

          <div className="card me-tip">
            <div className="me-tip-icon"><Icon name="upload" size={18}/></div>
            <div>
              <div className="me-tip-title">Got a stack of items?</div>
              <div className="me-tip-body">Upload a spreadsheet, PDF invoice, or scanned bill — even a single row is fine.</div>
              <button className="link-btn" onClick={() => onJumpTo?.("import")}>Go to Imports<Icon name="arrowRight" size={13}/></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ManualEntry = ManualEntry;
