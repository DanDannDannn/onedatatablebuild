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
  // Decorative nav (no real routes) restored to match the product shell. Only
  // "Data" is wired; the rest are stubs. `dot` shows the "not built" indicator
  // for the items the reference marks (Bulk import, Company settings, Users).
  const NAV = [
    { section: "Analyse", items: [
      { key: "overview",          label: "Home",              icon: "home",   stub: true },
      { key: "emission-overview", label: "Emission overview", icon: "chart",  stub: true },
      { key: "hotspot",           label: "Hotspot analysis",  icon: "chart",  stub: true },
      { key: "trends",            label: "Trends",            icon: "trends", stub: true },
    ]},
    { section: "Collect", items: [
      { key: "data",   label: "Data",        icon: "collect" },
      // Temporary experiment page: identical table, but "Multiple" cells carry
      // their underlying values so partial filters match the entry row.
      { key: "data2",  label: "Data 2 · filter test", icon: "collect" },
      { key: "improve-ef", label: "Improve EF · PCF mock", icon: "sparkle" },
      { key: "import", label: "Bulk import", icon: "upload", stub: true, dot: true },
    ]},
    { section: "Manage", items: [
      { key: "company", label: "Company settings", icon: "settings", stub: true, dot: true },
      { key: "users",   label: "Users",            icon: "users",    stub: true, dot: true },
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
                {it.dot && <span className="stub-dot" aria-hidden="true" />}
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
                  onClick={() => stubClick("New board")}
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

// Full-width top bar — matches the product chrome: a sidebar-collapse toggle on
// the left, then the active-company selector + account + settings on the right.
// (The account controls used to live in a sidebar pill; they moved up here.)
function Topbar() {
  const stub = (label) => window.dispatchEvent(new CustomEvent("fe-toast", {
    detail: `${label} — not built in this prototype`,
  }));
  const toggleSidebar = () => {
    const app = document.querySelector(".app");
    if (app) app.classList.toggle("fwe-sidebar-collapsed");
  };
  return (
    <header className="topbar">
      <button type="button" className="fwe-sidebar-toggle" onClick={toggleSidebar} title="Collapse sidebar" aria-label="Collapse sidebar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/>
        </svg>
      </button>
      <div className="fwe-topbar-spacer" />
      <div className="fwe-company-select" title="Switch active company" onClick={() => stub("Switch company")}>
        <span className="lbl">Active company</span>
        <span className="val">FWE Internal</span>
        <svg className="caret" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <button type="button" className="fwe-icon-btn" title="Account" aria-label="Account" onClick={() => stub("Account")}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </button>
      <button type="button" className="fwe-icon-btn" title="Settings" aria-label="Settings" onClick={() => stub("Settings")}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
    </header>
  );
}

Object.assign(window, { Sidebar, Topbar });
