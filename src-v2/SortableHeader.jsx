// Shared sortable + filterable column header.
//
// Adds (vs the original): a derived/editable marker glyph, a multi-sort rank
// badge, and Pin + Hide actions in the header menu — matching MUI X column
// header menus (sort / filter / hide / pin). Shift-clicking the header adds the
// column as a secondary sort instead of replacing the sort.

function SortableHeader({
  label, colKey, sort, onSort,
  align = "left",
  filterValue, onFilter, filterOptions, placeholder,
  disableFilter, disableSort,
  sortRank, colKind, editable,
  pinned, onPin, onHide,
}) {
  const [open, setOpen] = React.useState(false);
  const active = sort?.key === colKey;
  const dir = active ? sort.dir : null;
  const filtered = filterValue && filterValue !== "all" && filterValue !== "";

  const toggleSort = (e) => {
    if (disableSort) return;
    e.stopPropagation();
    const additive = e.shiftKey;
    if (!active) onSort(colKey, "asc", additive);
    else if (dir === "asc") onSort(colKey, "desc", additive);
    else onSort(null, null, additive);
  };

  return (
    <div className={"sh " + (align === "right" ? "right " : "") + (active ? "active " : "") + (filtered ? "filtered " : "")}
         onClick={toggleSort}
         title={disableSort ? label : `Click to sort · Shift-click to add a secondary sort`}>
      <span className="sh-label">{label}</span>
      {sortRank && <span className="sh-rank" title={`Sort priority ${sortRank}`}>{sortRank}</span>}
      {!disableSort && (
        <span className="sh-sort-ind">
          {active
            ? <Icon name={dir === "asc" ? "arrowUp" : "arrowDown"} size={11}/>
            : <span className="sh-sort-idle"><Icon name="arrowUp" size={9}/><Icon name="arrowDown" size={9}/></span>}
        </span>
      )}
      {pinned && <span className="sh-pinned" title="Pinned left" aria-hidden="true"><Icon name="pin" size={11}/></span>}
      <button className={"sh-menu " + (filtered ? "on" : "")}
              onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
              title="Column options" aria-label={`Options for ${label}`}>
        <Icon name="dots" size={13}/>
      </button>
      {open && (
        <>
          <div className="sh-overlay" onClick={(e) => { e.stopPropagation(); setOpen(false); }}/>
          <div className="sh-pop" onClick={(e) => e.stopPropagation()}>
            {!disableSort && (
              <>
                <div className="sh-pop-sect">Sort</div>
                <div className={"sh-pop-item " + (active && dir === "asc" ? "active" : "")}
                     onClick={() => { onSort(colKey, "asc", false); setOpen(false); }}>
                  <Icon name="arrowUp" size={13}/><span>Sort ascending</span>
                </div>
                <div className={"sh-pop-item " + (active && dir === "desc" ? "active" : "")}
                     onClick={() => { onSort(colKey, "desc", false); setOpen(false); }}>
                  <Icon name="arrowDown" size={13}/><span>Sort descending</span>
                </div>
                <div className="sh-pop-item"
                     onClick={() => { onSort(colKey, dir === "desc" ? "desc" : "asc", true); setOpen(false); }}>
                  <Icon name="sort" size={13}/><span>Add to sort</span>
                </div>
                {active && (
                  <div className="sh-pop-item muted" onClick={() => { onSort(null, null, false); setOpen(false); }}>
                    <Icon name="close" size={13}/><span>Clear sort</span>
                  </div>
                )}
              </>
            )}
            {(onPin || onHide) && (
              <>
                <div className="sh-pop-div"/>
                {onPin && (
                  <div className="sh-pop-item" onClick={() => { onPin(); setOpen(false); }}>
                    <Icon name="pin" size={13}/><span>{pinned ? "Unpin column" : "Pin to left"}</span>
                  </div>
                )}
                {onHide && (
                  <div className="sh-pop-item" onClick={() => { onHide(); setOpen(false); }}>
                    <Icon name="eyeSlash" size={13}/><span>Hide column</span>
                  </div>
                )}
              </>
            )}
            {!disableFilter && (
              <>
                <div className="sh-pop-div"/>
                <div className="sh-pop-sect">Filter</div>
                {filterOptions ? (
                  <div className="sh-pop-scroll">
                    <div className={"sh-pop-item " + ((!filterValue || filterValue === "all") ? "active" : "")}
                         onClick={() => { onFilter("all"); setOpen(false); }}>
                      <span>All</span>{(!filterValue || filterValue === "all") && <Icon name="check" size={12}/>}
                    </div>
                    {filterOptions.map(o => (
                      <div key={o.k} className={"sh-pop-item " + (filterValue === o.k ? "active" : "")}
                           onClick={() => { onFilter(o.k); setOpen(false); }}>
                        <span>{o.l}</span>{filterValue === o.k && <Icon name="check" size={12}/>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="sh-pop-input">
                    <Icon name="search" size={12}/>
                    <input autoFocus type="text" placeholder={placeholder || `Filter ${label.toLowerCase()}…`}
                      value={filterValue || ""} onChange={(e) => onFilter(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setOpen(false); }}/>
                    {filterValue && <button className="sh-pop-clear" onClick={() => onFilter("")} title="Clear"><Icon name="close" size={11}/></button>}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Shared comparator — handles strings, numbers, null-ish (empties last).
function cmpBy(a, b, getter, dir) {
  const av = getter(a); const bv = getter(b);
  const aEmpty = av === null || av === undefined || av === "" || av === "—";
  const bEmpty = bv === null || bv === undefined || bv === "" || bv === "—";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  let r;
  if (typeof av === "number" && typeof bv === "number") r = av - bv;
  else r = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
  return dir === "desc" ? -r : r;
}

Object.assign(window, { SortableHeader, cmpBy });
