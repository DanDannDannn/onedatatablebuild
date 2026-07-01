// Shared view-tab overflow: when the saved-view tabs don't fit on one line,
// fold the trailing ones into a right-aligned "N more ▾" dropdown instead of
// wrapping to a second row.
//
// useViewOverflow(rowRef, savedViews) → visN  (how many saved tabs to show)
//   • Measures against the row's PARENT width (stable, independent of how many
//     tabs are currently rendered) so there's no render→measure feedback loop.
//   • Caches each tab's measured width by id, so a tab that's currently folded
//     still has a known width when deciding whether it fits again on resize.
//   • Mark each saved-view tab wrapper with class "ovf-seg" + data-vid={id};
//     every other child of the row is treated as fixed chrome.
//
// ViewOverflowMenu({ items, isActive, dirtyId, onSelect }) → the dropdown.

function useViewOverflow(rowRef, savedViews) {
  const widthCache = React.useRef({});
  const [visN, setVisN] = React.useState(savedViews.length);
  const sig = savedViews.map(v => v.id + ":" + (v.name || "")).join("|");

  React.useLayoutEffect(() => {
    const row = rowRef.current;
    const bar = row && row.parentElement;
    if (!row || !bar) return;
    let raf = 0;

    const recompute = () => {
      const cs = getComputedStyle(row);
      const gap = parseFloat(cs.columnGap || cs.gap) || 8;
      // Cache widths of any saved tab currently laid out.
      row.querySelectorAll(".ovf-seg").forEach(s => {
        const id = s.getAttribute("data-vid");
        if (id && s.offsetWidth) widthCache.current[id] = s.offsetWidth;
      });
      // Sum fixed (non saved-tab, non overflow-button) chrome inside the row.
      let fixedW = 0;
      Array.from(row.children).forEach(ch => {
        if (ch.classList.contains("ovf-seg") || ch.classList.contains("view-overflow-wrap")) return;
        fixedW += ch.offsetWidth + gap;
      });
      // Sum any sibling chrome sharing the bar (e.g. the toolbar portaled onto
      // the same row) so tabs overflow before colliding with it.
      let outsideW = 0;
      Array.from(bar.children).forEach(ch => {
        if (ch === row) return;
        outsideW += ch.offsetWidth + gap;
      });
      const RESERVE = 124 + gap; // space the "N more" button needs
      const total = savedViews.length;
      const widthOf = (v) => widthCache.current[v.id] || 150;
      const countFit = (budget) => {
        let used = 0, n = 0;
        for (const v of savedViews) {
          const w = widthOf(v) + gap;
          if (used + w <= budget) { used += w; n++; } else break;
        }
        return n;
      };
      const avail = bar.clientWidth - fixedW - outsideW;
      let n = countFit(avail);
      if (n < total) n = countFit(avail - RESERVE);
      n = Math.max(0, Math.min(total, n));
      setVisN(prev => (prev === n ? prev : n));
    };

    recompute();
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(recompute); });
    ro.observe(bar);
    ro.observe(row);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return visN;
}

// Split saved views into [visible, hidden], guaranteeing the active view stays
// visible (pull it into the last visible slot if it would otherwise be folded).
function splitViewsForOverflow(savedViews, visN, isActive) {
  const visible = savedViews.slice(0, visN);
  const hidden = savedViews.slice(visN);
  if (!hidden.length) return [visible, hidden];
  const actIdx = savedViews.findIndex(isActive);
  if (actIdx >= visN && visN > 0) {
    const act = savedViews[actIdx];
    const dropped = visible[visN - 1];
    return [
      [...visible.slice(0, visN - 1), act],
      [dropped, ...hidden.filter(v => v.id !== act.id)],
    ];
  }
  return [visible, hidden];
}

function ViewOverflowMenu({ items, isActive, dirtyId, onSelect }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="view-overflow-wrap">
      <button className="view-overflow" onClick={() => setOpen(o => !o)}
        aria-haspopup="menu" aria-expanded={open} title="More views">
        {items.length} more<Icon name="chev" size={12}/>
      </button>
      {open && (
        <>
          <div className="tb-scrim" onClick={() => setOpen(false)}/>
          <div className="view-overflow-menu" role="menu">
            {items.map(v => (
              <button key={v.id} className={"vom-item" + (isActive(v) ? " active" : "")} role="menuitem"
                onClick={() => { onSelect(v); setOpen(false); }}>
                <Icon name={v.icon || "filter"} size={14}/><span>{v.name}</span>
                {dirtyId === v.id && <span className="segment-dirty"/>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

Object.assign(window, { useViewOverflow, splitViewsForOverflow, ViewOverflowMenu });
