// Data page — saved-views store (v2).
//
// A view now owns a full state bundle, not just a filter snapshot:
//   {
//     id, name, icon, kind:"alldata",
//     builtin: bool,          // the permanent "All data" default (can reset, can't delete)
//     desc: string,
//     state: { filters:{period,query,colFilters}, sort:[{key,dir}…],
//              columns:{order, visible, pinned} },
//     createdAt,
//   }
//
// The two shipped views (All data + Calculations) are seeded on first load via
// seedDataViews(); thereafter the list is whatever the user has saved.

const FE_DATA_VIEWS_KEY = "fe-data-views-v7";
const FE_DATA_VIEWS_EVT = "fe-data-views-changed";

function loadDataViews() {
  try {
    const raw = localStorage.getItem(FE_DATA_VIEWS_KEY);
    if (raw == null) {
      const seeded = window.seedDataViews ? window.seedDataViews() : [];
      localStorage.setItem(FE_DATA_VIEWS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const v = JSON.parse(raw);
    if (!Array.isArray(v) || v.length === 0) {
      const seeded = window.seedDataViews ? window.seedDataViews() : [];
      localStorage.setItem(FE_DATA_VIEWS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    // One-time migration: drop the legacy auto-pinned first column ("id") from
    // any cached view that still carries exactly the old default pin. Columns
    // are now pinned only when the user chooses to.
    if (!localStorage.getItem(FE_DATA_VIEWS_KEY + "-nopin")) {
      v.forEach(view => {
        const cols = view.state && view.state.columns;
        if (cols && Array.isArray(cols.pinned) && cols.pinned.length === 1 && cols.pinned[0] === "id") {
          cols.pinned = [];
        }
      });
      localStorage.setItem(FE_DATA_VIEWS_KEY, JSON.stringify(v));
      localStorage.setItem(FE_DATA_VIEWS_KEY + "-nopin", "1");
    }
    return v;
  } catch {
    return window.seedDataViews ? window.seedDataViews() : [];
  }
}
function saveDataViews(arr) {
  localStorage.setItem(FE_DATA_VIEWS_KEY, JSON.stringify(arr));
  window.dispatchEvent(new CustomEvent(FE_DATA_VIEWS_EVT));
}
function rid() { return "v_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }

function getDataView(id) { return loadDataViews().find(v => v.id === id) || null; }

// Create a new view from a state bundle. Returns the created view.
// `chartContext` is set for kind:"deepdive" views — a pinned chart deep-dive that
// re-applies its chartSpec + bu/scope/category/query filters when reopened.
function createDataView({ name, kind, state, icon = "filter", desc, chartContext }) {
  const v = {
    id: rid(),
    name: name && name.trim() ? name.trim() : "New view",
    icon, kind: kind || "alldata",
    builtin: false,
    desc: desc || "",
    state: kind === "deepdive" ? null : (state || (window.defaultViewState ? window.defaultViewState("entry") : null)),
    chartContext: chartContext || null,
    createdAt: new Date().toISOString(),
  };
  saveDataViews([...loadDataViews(), v]);
  return v;
}
function deleteDataView(id) {
  saveDataViews(loadDataViews().filter(v => v.id !== id || v.builtin));
}
function renameDataView(id, name) {
  saveDataViews(loadDataViews().map(v => v.id === id ? { ...v, name: (name && name.trim()) || v.name } : v));
}
// Overwrite a view's saved state bundle ("Save" on a dirty view).
function updateDataViewState(id, state) {
  saveDataViews(loadDataViews().map(v => v.id === id ? { ...v, state } : v));
}
// Reset a builtin view to its factory state.
function resetDataView(id) {
  const orientation = id === "v-calcs" ? "calc" : "entry";
  saveDataViews(loadDataViews().map(v => v.id === id
    ? { ...v, state: window.defaultViewState ? window.defaultViewState(orientation) : v.state }
    : v));
}

function useDataViews() {
  const [views, setViews] = React.useState(loadDataViews);
  React.useEffect(() => {
    const h = () => setViews(loadDataViews());
    window.addEventListener(FE_DATA_VIEWS_EVT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(FE_DATA_VIEWS_EVT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return views;
}

Object.assign(window, {
  loadDataViews, saveDataViews, getDataView, createDataView, deleteDataView,
  renameDataView, updateDataViewState, resetDataView, useDataViews,
});
