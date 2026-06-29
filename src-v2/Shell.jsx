// Active brand logo for the sidebar. Default Forward Earth uses the inline
// lockup; partner themes render their own logo asset (with a text fallback).
function SidebarBrand({ themeId }) {
  const themes = window.FWE_THEMES || [];
  const t = themes.find(x => x.id === themeId) || themes[0];
  if (!t || t.id === "default") return <LogoFull height={22} color="#181615" />;
  if (t.logo) {
    return <img src={"ds/" + t.logo} alt={t.name}
      style={{ height: 24, maxWidth: 150, objectFit: "contain", objectPosition: "left", display: "block" }} />;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {t.mark && <img src={"ds/" + t.mark} alt="" style={{ height: 24, width: 24, objectFit: "contain" }} />}
      <span style={{ fontFamily: t.font, fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>{t.name}</span>
    </span>
  );
}

// Brand theme switcher — mirrors the Forward Earth DS v2 picker. Cyclable via ⌥⇧T.
function BrandSwitcher({ themeId, setThemeId }) {
  const themes = window.FWE_THEMES || [];
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  if (!themes.length) return null;
  const cur = themes.find(t => t.id === themeId) || themes[0];
  return (
    <div className="brand-switch" ref={ref}>
      <button type="button" className="brand-switch__btn" title={`Brand theme: ${cur.name} (⌥⇧T to cycle)`} onClick={() => setOpen(o => !o)}>
        <span className="brand-switch__dot" style={{ background: cur.accent }} />
        <Icon name="chev" size={13} />
      </button>
      {open && (
        <div className="brand-switch__menu" role="menu">
          <div className="brand-switch__hd">Brand theme</div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {themes.map(t => (
              <div key={t.id} role="menuitem"
                className={"brand-switch__item" + (t.id === themeId ? " is-active" : "")}
                onClick={() => { setThemeId(t.id); setOpen(false); }}>
                <span className="brand-switch__sw" style={{ background: t.accent }} />
                <span className="brand-switch__nm" style={{ fontFamily: t.font }}>{t.name}</span>
                {t.id === themeId && <Icon name="check" size={15} style={{ color: "var(--fe-accent-primary)" }} />}
              </div>
            ))}
          </div>
          <div className="brand-switch__foot">Press <span className="brand-switch__kbd">⌥⇧T</span> to cycle</div>
        </div>
      )}
    </div>
  );
}

// Sidebar for the prototype: Analyse / Collect / Manage
function Sidebar({ route, setRoute, needsReviewCount, onCreateReport, reports = [], themeId, setThemeId }) {
  // `stub: true` items aren't wired into routes — clicking fires a toast
  // so the rest of the nav feels real without us actually building those pages.
  // Table-only build: keep the app shell, but Data is the only reachable page.
  const NAV = [
    { section: "Collect", items: [
      { key: "data",   label: "Data",        icon: "collect" },
    ]},
  ];

  const stubClick = (label) => {
    window.dispatchEvent(new CustomEvent("fe-toast", {
      detail: `${label} — not built in this prototype`,
    }));
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <SidebarBrand themeId={themeId} />
        <BrandSwitcher themeId={themeId} setThemeId={setThemeId} />
      </div>

      <div className="sidebar-nav">
        {NAV.map(group => (
          <React.Fragment key={group.section}>
            <div className="sidebar-section-label">{group.section}</div>
            {group.items.map(it => (
              <div
                key={it.key}
                className={`nav-item ${route === it.key ? "active" : ""} ${it.stub ? "nav-stub" : ""}`}
                onClick={() => it.stub ? stubClick(it.label) : setRoute(it.key)}
                title={it.stub ? `${it.label} — not built in this prototype` : it.label}
              >
                <Icon name={it.icon} size={18} />
                <span>{it.label}</span>
                {it.stub && <span className="stub-dot" aria-hidden="true" />}
                {it.count ? <span className={`count ${it.alert ? "alert" : ""}`}>{it.count}</span> : null}
              </div>
            ))}
            {group.section === "Analyse" && (
              <>
                {reports.map(r => (
                  <div
                    key={r.id}
                    className={`nav-item nav-report ${route === `report:${r.id}` ? "active" : ""}`}
                    onClick={() => setRoute(`report:${r.id}`)}
                    title={r.name}
                  >
                    <Icon name="document" size={18} />
                    <span style={{overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{r.name}</span>
                    {r.standard && <span className="count" title={r.standard}>{r.standard.split(" ")[0]}</span>}
                  </div>
                ))}
                <div
                  className="nav-item nav-action"
                  onClick={onCreateReport}
                  title="Create a custom report board"
                >
                  <Icon name="plus" size={18} />
                  <span>New board</span>
                </div>
              </>
            )}
          </React.Fragment>
        ))}
      </div>

      <SidebarAccount />
    </aside>
  );
}

// Sticky account pill at the bottom of the sidebar — replaces the topbar
// account chrome (avatar + bell + settings gear).
function SidebarAccount() {
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

  const stub = (label) => {
    window.dispatchEvent(new CustomEvent("fe-toast", {
      detail: `${label} — not built in this prototype`,
    }));
    setOpen(false);
  };

  return (
    <div className="sidebar-account" ref={ref}>
      <button
        type="button"
        className={"sidebar-account__pill" + (open ? " is-open" : "")}
        onClick={() => setOpen(o => !o)}
      >
        <span className="sidebar-account__avatar" aria-hidden>JW</span>
        <span className="sidebar-account__who">
          <span className="sidebar-account__name">Johannes Weber</span>
          <span className="sidebar-account__role">Acme Industries · Admin</span>
        </span>
        <span className="sidebar-account__chev" aria-hidden>
          <Icon name="chev" size={14}/>
        </span>
      </button>
      {open && (
        <div className="sidebar-account__menu" role="menu">
          <button type="button" className="sidebar-account__item" onClick={() => stub("Notifications")}>
            <Icon name="bell" size={14}/><span>Notifications</span>
            <span className="sidebar-account__pip" aria-hidden/>
          </button>
          <button type="button" className="sidebar-account__item" onClick={() => stub("Account settings")}>
            <Icon name="settings" size={14}/><span>Account settings</span>
          </button>
          <button type="button" className="sidebar-account__item" onClick={() => stub("Help & support")}>
            <Icon name="info" size={14}/><span>Help &amp; support</span>
          </button>
          <div className="sidebar-account__sep"/>
          <button type="button" className="sidebar-account__item sidebar-account__item--danger" onClick={() => stub("Sign out")}>
            <Icon name="arrowRight" size={14}/><span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}

function Topbar() { return null; }

Object.assign(window, { Sidebar, Topbar });
