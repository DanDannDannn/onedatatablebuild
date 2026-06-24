// Page sections — orderable + reportable layout primitive.
// Wrap a page's stacked sections in <PageSections> and tag each with
// <PageSection id label>. Each section can be:
//   - reordered (in Edit-layout mode)
//   - added to a custom report (via the "Add to report" affordance)
//
// When rendered inside a ReportRenderContext (i.e. on the Report board),
// PageSections filters to only the sections in `ctx.sectionIds` and strips
// any decorations so the section content renders naked.

const ReportRenderContext = React.createContext(null);

function PageSections({ pageKey, editMode, children }) {
  const reportCtx = React.useContext(ReportRenderContext);
  const inReport = reportCtx && reportCtx.source === pageKey;

  // Flatten children recursively so PageSections inside fragments (e.g. used as
  // conditional groups via `{cond && <>...</>}`) are still discovered.
  const flatten = (children) => {
    const out = [];
    React.Children.forEach(children, (c) => {
      if (!c) return;
      if (c.type && c.type.displayName === "PageSection") {
        out.push(c);
      } else if (c.props && c.props.children !== undefined) {
        // Recurse into fragments and other wrappers
        out.push(...flatten(c.props.children));
      }
    });
    return out;
  };
  const sectionEls = flatten(children);
  const defaultIds = sectionEls.map(s => s.props.id);
  const STORAGE_KEY = `fe-section-order-${pageKey}`;

  const sanitize = (arr) => {
    if (!Array.isArray(arr)) return null;
    const known = arr.filter(id => defaultIds.includes(id));
    // For any default IDs not in stored order, splice them in at their
    // natural default position (rather than always appending — which would
    // push freshly-renamed sections to the bottom).
    const result = [...known];
    defaultIds.forEach((id, defIdx) => {
      if (!result.includes(id)) {
        // Find the next default ID that exists in result; insert before it.
        let insertAt = result.length;
        for (let j = defIdx + 1; j < defaultIds.length; j++) {
          const idx = result.indexOf(defaultIds[j]);
          if (idx !== -1) { insertAt = idx; break; }
        }
        result.splice(insertAt, 0, id);
      }
    });
    return result;
  };

  const [order, setOrder] = React.useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      const fixed = sanitize(stored);
      if (fixed && fixed.length) return fixed;
    } catch {}
    return defaultIds;
  });

  React.useEffect(() => {
    if (inReport) return; // don't persist while rendering inside a report
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  }, [order, STORAGE_KEY, inReport]);

  const move = (id, dir) => {
    setOrder(prev => {
      const next = [...prev];
      const idx = next.indexOf(id);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const reset = () => setOrder(defaultIds);

  // When rendering inside a report, only render the requested section(s)
  // and strip all decoration. Preserve order: render in the order of reportCtx.sectionIds.
  if (inReport) {
    return (
      <>
        {reportCtx.sectionIds.map(sid => {
          const sec = sectionEls.find(s => s.props.id === sid);
          if (!sec) return null;
          const childContent = sec.props.children;
          if (!childContent) return null;
          return (
            <div key={sid} className="page-section report-mode" data-section-id={sid} data-page-source={pageKey}>
              <div className="page-section__content">{childContent}</div>
            </div>
          );
        })}
      </>
    );
  }

  return (
    <div className={"page-sections" + (editMode ? " is-editing" : "")}>
      {sectionEls.map((sec) => {
        const { id, label } = sec.props;
        const childContent = sec.props.children;
        if (childContent === null || childContent === false || childContent === undefined) return null;
        const orderIdx = order.indexOf(id);
        const safeIdx = orderIdx < 0 ? 9000 : orderIdx;
        return (
          <div
            key={id}
            className="page-section"
            data-section-id={id}
            data-page-source={pageKey}
            style={{order: safeIdx}}
          >
            {editMode ? (
              <div className="page-section__chrome">
                <span className="page-section__label">{label || id}</span>
                <div className="page-section__moves">
                  <button
                    type="button"
                    className="page-section__btn"
                    onClick={() => move(id, -1)}
                    disabled={orderIdx <= 0}
                    aria-label="Move section up"
                    title="Move up"
                  >
                    <Icon name="chev" size={14} style={{transform: "rotate(180deg)"}}/>
                  </button>
                  <button
                    type="button"
                    className="page-section__btn"
                    onClick={() => move(id, 1)}
                    disabled={orderIdx >= order.length - 1 || orderIdx < 0}
                    aria-label="Move section down"
                    title="Move down"
                  >
                    <Icon name="chev" size={14}/>
                  </button>
                </div>
              </div>
            ) : (sec.props.noAddToReport ? null : (
              <div className="page-section__hover-bar">
                <AddToReportButton source={pageKey} sectionId={id} label={label || id}/>
              </div>
            ))}
            <div className="page-section__content">{childContent}</div>
          </div>
        );
      })}
      {editMode && (
        <div className="page-section__reset-row" style={{order: 9999}}>
          <button type="button" className="page-section__reset" onClick={reset}>
            <Icon name="refresh" size={12}/> Reset to default order
          </button>
        </div>
      )}
    </div>
  );
}

// Marker component
function PageSection({ children }) { return children || null; }
PageSection.displayName = "PageSection";

// EditLayoutButton — drop into a page's page-actions area
function EditLayoutButton({ active, onToggle }) {
  return (
    <button
      type="button"
      className={"btn small " + (active ? "primary" : "secondary")}
      onClick={onToggle}
      title={active ? "Done editing layout" : "Rearrange page layout"}
    >
      <Icon name={active ? "check" : "pencil"} size={16}/>
      {active ? "Done" : "Edit layout"}
    </button>
  );
}

Object.assign(window, { PageSections, PageSection, EditLayoutButton, ReportRenderContext });
