// Forward AI Copilot — conversational chat strip used atop Analyse pages.
//
// Each analyse page hands the copilot:
//   - page (string id used as localStorage namespace for pinned answers)
//   - suggestions: [{ q: "question text", answer: fn() => JSX }]
//
// Behavior:
//   - User clicks a suggested chip OR types a free-form question
//   - Loading shimmer → response renders inside the strip
//   - User can pin the response (stored in localStorage)
//   - Pinned answers are surfaced separately by <PinnedAnswers page="..." />
//   - Free-form questions get a generic "I'm a demo, try one of the suggestions" fallback

function FaiBrand({ soft = false, label = "Forward AI", iconOnly = false }) {
  return (
    <span className={"fai-brand" + (soft ? " soft" : "") + (iconOnly ? " icon-only" : "")} title={iconOnly ? label : undefined}>
      <Icon name="sparkle" size={12} />
      {!iconOnly && label}
    </span>
  );
}

// Return a copy of a carried-chart spec with only bar `i` highlighted — used
// when a user clicks a single bar to deep-dive into that slice.
function specWithHighlight(spec, i) {
  if (!spec || !Array.isArray(spec.rows)) return spec;
  return { ...spec, rows: spec.rows.map((r, j) => ({ ...r, highlight: j === i })) };
}
window.specWithHighlight = specWithHighlight;

// Consistent deep-dive affordance: a magnifier "Deep dive" button parked in the
// top-right corner of ANY chart (default cards, AI insight cards, AI chat
// charts). Icon-only at rest, expands its label on hover — identical to the
// dashboard card heads.
function ChartDeepDiveFrame({ onDeepDive, title, children }) {
  return (
    <div className="chart-dd-frame">
      {onDeepDive && (
        <button
          type="button"
          className="deep-dive deep-dive--corner"
          title={title || "Open full breakdown in the data table"}
          onClick={(e) => { e.stopPropagation(); onDeepDive(); }}
        >
          <Icon name="search" size={14}/><span className="dd-label">Deep dive</span>
        </button>
      )}
      {children}
    </div>
  );
}

// Small confidence indicator shown on every insight. Level is computed upstream
// from the emission-factor matching quality of the underlying calculations.
function ConfidenceChip({ confidence, size }) {
  if (!confidence || !confidence.level) return null;
  const label = confidence.level === "high" ? "High confidence"
    : confidence.level === "medium" ? "Medium confidence"
    : "Low confidence";
  return (
    <span
      className={"conf-chip conf-chip--" + confidence.level + (size === "sm" ? " conf-chip--sm" : "")}
      title={typeof confidence.score === "number"
        ? `Confidence in this insight · avg EF-match ${Math.round(confidence.score * 100)}%`
        : "Confidence in this insight, based on emission-factor matching quality"}
    >
      <span className="conf-chip__dot" aria-hidden="true"/>{label}
    </span>
  );
}
Object.assign(window, { ConfidenceChip });

// --- Pinning store -------------------------------------------------------
const FAI_PIN_KEY = (page) => `fai-pinned-${page}`;
function getPinned(page) {
  try {
    return JSON.parse(localStorage.getItem(FAI_PIN_KEY(page)) || "[]");
  } catch { return []; }
}
function setPinned(page, arr) {
  localStorage.setItem(FAI_PIN_KEY(page), JSON.stringify(arr));
  window.dispatchEvent(new CustomEvent("fai-pins-changed", { detail: { page } }));
}

// --- Forward AI copilot ---------------------------------------------------
function AICopilot({ page, suggestions = [], placeholder = "Ask Forward AI about your footprint…", onOpenForwardAI, onJumpTo, boardTargets = [], pageLabel }) {
  const [input, setInput] = React.useState("");
  const [convo, setConvo] = React.useState([]); // [{ id, q, key, status: 'thinking'|'done', pinned }]
  const [pinned, setPinnedState] = React.useState(() => getPinned(page).map(p => p.key));
  // Track the thread this Home strip is writing to (so each new ask appends
  // to the same thread rather than spawning a new one each time).
  const [threadId, setThreadId] = React.useState(null);
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    // Auto-scroll the convo to the bottom when a new turn arrives.
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [convo.length, convo.at?.(-1)?.status]);

  // Refresh pinned-keys snapshot when storage changes
  React.useEffect(() => {
    const h = () => setPinnedState(getPinned(page).map(p => p.key));
    window.addEventListener("fai-pins-changed", h);
    return () => window.removeEventListener("fai-pins-changed", h);
  }, [page]);

  const ask = (q, key = null) => {
    const matched = suggestions.find(s => s.q === q || s.key === key);
    const useKey = key || (matched ? matched.key : `q-${Date.now()}`);
    const id = `m-${Date.now()}`;
    setConvo(prev => [...prev, { id, q, key: useKey, status: "thinking", matched }]);
    setInput("");

    // Mirror into the thread store so the conversation continues in Forward AI.
    // Only for the Home strip (page === "overview"); other pages are legacy.
    let activeThreadId = threadId;
    let activeTurnId = null;
    if (page === "overview" && window.createThread && window.addTurn) {
      if (!activeThreadId) {
        const t = window.createThread({ firstQ: q, firstKey: matched ? matched.key : null });
        activeThreadId = t.id;
        activeTurnId = t.turns[0].id;
        setThreadId(activeThreadId);
      } else {
        const turn = window.addTurn(activeThreadId, { q, key: matched ? matched.key : null });
        activeTurnId = turn?.id || null;
      }
    }

    // Simulate AI thinking
    setTimeout(() => {
      setConvo(prev => prev.map(m => m.id === id ? { ...m, status: "done" } : m));
      if (activeThreadId && activeTurnId && window.markTurnDone) {
        window.markTurnDone(activeThreadId, activeTurnId);
      }
    }, 900);
  };

  const pin = (msg) => {
    const existing = getPinned(page);
    if (existing.find(p => p.key === msg.key)) return;
    const next = [...existing, {
      key: msg.key,
      q: msg.q,
      pinnedAt: new Date().toISOString(),
    }];
    setPinned(page, next);
    setPinnedState(next.map(p => p.key));
  };

  const dismiss = (id) => setConvo(prev => prev.filter(m => m.id !== id));

  const unpin = (key) => {
    const next = getPinned(page).filter(p => p.key !== key);
    setPinned(page, next);
    setPinnedState(next.map(p => p.key));
  };

  // Per-bar deep-dive handler for an answer's chart: clicking a bar filters the
  // table to that slice (row.dd) and carries the chart with that bar lit.
  const barClickFor = (s, anchor) => (s && s.deepDive && onJumpTo)
    ? (row, i) => onJumpTo("calcs", {
        deepDive: (row && row.dd) || s.deepDive.filter || {},
        chartSpec: specWithHighlight(s.deepDive.spec, i),
        anchor,
      })
    : undefined;

  // Shared board-picker for a chat answer — mirrors the insight card's
  // "Add to board" (current board + default boards + custom reports + new).
  const renderAddToBoard = (m) => (
    <AddToReportButton
      source={page}
      sectionId={`ai:${m.key}`}
      label={(m.matched && m.matched.q) || m.q}
      variant="card"
      buttonLabel="Add to board"
      align="left"
      currentBoard={{
        label: pageLabel || "this board",
        isAdded: pinned.includes(m.key),
        onAdd: () => pin(m),
        onRemove: () => unpin(m.key),
      }}
      extraBoards={boardTargets.map(t => ({
        key: t.key,
        label: t.label,
        isAdded: getBoardPins(t.key).includes(m.key),
        onToggle: () => togglePinToBoard(t.key, m.key),
      }))}
    />
  );

  const onSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    ask(input.trim());
  };

  return (
    <section className="fai-copilot" aria-label="Forward AI copilot">
      <div className="fai-copilot__head">
        <div className="fai-copilot__sparkle">
          <Icon name="sparkle" size={18} />
        </div>
        <form className="fai-copilot__input-wrap" onSubmit={onSubmit} style={{flex: 1}}>
          <input
            className="fai-copilot__input"
            placeholder={placeholder}
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <button type="submit" className="fai-copilot__send" disabled={!input.trim()} aria-label="Send">
            <Icon name="send" size={14} />
          </button>
        </form>
      </div>

      {suggestions.length > 0 && convo.length === 0 && (
        <div className="fai-copilot__suggest">
          {suggestions.map((s, i) => (
            <button key={i} className="fai-copilot__chip" onClick={() => ask(s.q, s.key)}>
              <Icon name="sparkle" size={11} className="fai-copilot__chip-icon" />
              {s.q}
            </button>
          ))}
        </div>
      )}

      {convo.length > 0 && (
        <div className="fai-copilot__convo">
          <div className="fai-copilot__scroll" ref={scrollRef}>
          {convo.map((m) => (
            <React.Fragment key={m.id}>
              <div className="fai-msg-user">{m.q}</div>
              <div className="fai-msg-ai">
                <div className="fai-msg-ai__avatar"><Icon name="sparkle" size={14}/></div>
                <div className="fai-msg-ai__body">
                  {m.status === "thinking" ? (
                    <div className="fai-thinking" aria-label="Thinking">
                      <span></span><span></span><span></span>
                    </div>
                  ) : m.matched ? (
                    <>
                      {m.matched.text && m.matched.chart ? (
                        <div className="fai-msg-slide">
                          <div className="fai-msg-slide__text">{m.matched.text()}</div>
                          <div className="fai-msg-slide__chart">
                            <ChartDeepDiveFrame
                              onDeepDive={m.matched.deepDive && onJumpTo
                                ? () => onJumpTo("calcs", { deepDive: m.matched.deepDive.filter || {}, chartSpec: m.matched.deepDive.spec, anchor: "ai-copilot" })
                                : null}
                            >
                              {m.matched.chart(barClickFor(m.matched, "ai-copilot"))}
                            </ChartDeepDiveFrame>
                          </div>
                        </div>
                      ) : m.matched.text ? (
                        <div className="fai-msg-slide fai-msg-slide--text-only">
                          <div className="fai-msg-slide__text">{m.matched.text()}</div>
                        </div>
                      ) : (
                        m.matched.answer && m.matched.answer()
                      )}
                      <div className="fai-msg-ai__actions">
                        {renderAddToBoard(m)}
                        <button className="fai-action" onClick={() => dismiss(m.id)}>
                          <Icon name="close" size={12}/>
                          Dismiss
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="fai-freeform">
                        <p>
                          Working on a tailored response for{" "}
                          <em>"{m.q}"</em>. As we continue chatting, the insights above
                          will adapt — I'll re-prioritise, swap out charts, and pull
                          new examples from your Q1 2026 data based on what you ask next.
                        </p>
                        <p className="fai-freeform__hint">
                          <Icon name="sparkle" size={11}/>
                          Free-form responses use the same data context as the suggested
                          questions — refine below or ask a sharper follow-up.
                        </p>
                      </div>
                      <div className="fai-msg-ai__actions">
                        {renderAddToBoard(m)}
                        <button className="fai-action" onClick={() => dismiss(m.id)}>
                          <Icon name="close" size={12}/>Dismiss
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </React.Fragment>
          ))}
          </div>
          {convo.length > 0 && (
            <div className="fai-copilot__suggest" style={{padding: 0}}>
              {suggestions
                .filter(s => !convo.find(m => m.key === s.key))
                .slice(0, 4)
                .map((s, i) => (
                  <button key={i} className="fai-copilot__chip" onClick={() => ask(s.q, s.key)}>
                    <Icon name="sparkle" size={11} className="fai-copilot__chip-icon" />
                    {s.q}
                  </button>
                ))}
            </div>
          )}
          {convo.length > 0 && (
            <form
              className="fai-copilot__followup"
              onSubmit={(e) => {
                e.preventDefault();
                if (!input.trim()) return;
                ask(input.trim());
              }}
            >
              <div className="fai-copilot__followup-icon">
                <Icon name="sparkle" size={14}/>
              </div>
              <input
                className="fai-copilot__followup-input"
                placeholder="Ask a follow-up — refine, drill in, compare…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button
                type="submit"
                className="fai-copilot__followup-send"
                disabled={!input.trim()}
                aria-label="Send follow-up"
              >
                <Icon name="send" size={12}/>
              </button>
            </form>
          )}
          {convo.length > 0 && page === "overview" && onOpenForwardAI && (
            <div className="fai-copilot__threadlink">
              <button
                type="button"
                className="fai-copilot__threadlink-btn"
                onClick={() => onOpenForwardAI(threadId)}
                title="Open this conversation in Forward AI"
              >
                Continue in Forward AI <Icon name="arrowRight" size={12}/>
              </button>
              <span className="fai-copilot__threadlink-hint">
                Full history &amp; multi-thread view available in Forward AI.
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// --- Pinned answers surface — renders pinned cards above proactive cards ---
function PinnedAnswers({ page, suggestions = [], onJumpTo }) {
  const [pins, setPins] = React.useState(() => getPinned(page));
  React.useEffect(() => {
    const h = () => setPins(getPinned(page));
    window.addEventListener("fai-pins-changed", h);
    return () => window.removeEventListener("fai-pins-changed", h);
  }, [page]);

  if (pins.length === 0) return null;

  const remove = (key) => {
    const next = getPinned(page).filter(p => p.key !== key);
    setPinned(page, next);
  };

  return (
    <div style={{display:"flex", flexDirection:"column", gap: 12, marginBottom: 24}}>
      {pins.map(p => {
        const s = suggestions.find(x => x.key === p.key);
        if (!s) return null;
        return (
          <div key={p.key} className="ai-card pinned" style={{padding: "16px 18px"}}>
            <div className="ai-card__head">
              <FaiBrand soft label="Pinned from Forward AI"/>
              <span style={{color:"var(--fe-fg-muted)"}}>
                · {new Date(p.pinnedAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}
              </span>
              <button className="ai-card__dismiss" onClick={() => remove(p.key)} title="Unpin">
                <Icon name="close" size={14}/>
              </button>
            </div>
            <div className="ai-card__title" style={{fontSize:13, fontWeight:500, color:"var(--fe-fg-muted)", marginBottom:4}}>
              “{s.q}”
            </div>
            <div className="ai-card__body" style={{color:"var(--fe-fg)"}}>
              {s.text && s.chart ? (
                <div className="fai-msg-slide">
                  <div className="fai-msg-slide__text">{s.text()}</div>
                  <div className="fai-msg-slide__chart">
                    <ChartDeepDiveFrame
                      onDeepDive={s.deepDive && onJumpTo
                        ? () => onJumpTo("calcs", { deepDive: s.deepDive.filter || {}, chartSpec: s.deepDive.spec, anchor: "ai-insights" })
                        : null}
                    >
                      {s.chart(
                        (s.deepDive && onJumpTo)
                          ? (row, i) => onJumpTo("calcs", {
                              deepDive: (row && row.dd) || s.deepDive.filter || {},
                              chartSpec: specWithHighlight(s.deepDive.spec, i),
                              anchor: "ai-insights",
                            })
                          : undefined
                      )}
                    </ChartDeepDiveFrame>
                  </div>
                </div>
              ) : s.text ? (
                <div className="fai-msg-slide fai-msg-slide--text-only">
                  <div className="fai-msg-slide__text">{s.text()}</div>
                </div>
              ) : (
                s.answer && s.answer()
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Proactive AI insight cards (3-up grid) -------------------------------
// Each card: { title, icon ('warn'|'sparkle'|'trends'|...), body (JSX), link?, onLink? }
function AICardsGrid({ cards }) {
  if (!cards || cards.length === 0) return null;
  return (
    <div className="ai-cards-grid">
      {cards.map((c, i) => (
        <div key={i} className="ai-card">
          <div className="ai-card__head">
            <FaiBrand soft />
            {c.tag && <span>· {c.tag}</span>}
          </div>
          <div className="ai-card__title">{c.title}</div>
          <div className="ai-card__body">{c.body}</div>
          {c.link && (
            <div className="ai-card__actions">
              <span className="ai-card__link" onClick={c.onLink}>
                {c.link}
                <Icon name="arrowRight" size={12}/>
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { AICopilot, PinnedAnswers, AICardsGrid, FaiBrand });

// --- Multi-board pinning store -------------------------------------------
// AI insights can be pinned to one OR many "boards" — the source page (Home)
// plus the user's two default boards (Emission overview, Trends) plus any
// custom report board. Storage is per-board so each board surface can read
// its own pin list independently.
const FAI_BOARD_PINS = (boardKey) => `fai-board-pins-${boardKey}`;
function getBoardPins(boardKey) {
  try { return JSON.parse(localStorage.getItem(FAI_BOARD_PINS(boardKey)) || "[]"); }
  catch { return []; }
}
function setBoardPins(boardKey, keys) {
  localStorage.setItem(FAI_BOARD_PINS(boardKey), JSON.stringify(keys));
  window.dispatchEvent(new CustomEvent("fai-board-pins-changed", { detail: { boardKey } }));
}
function togglePinToBoard(boardKey, insightKey) {
  const cur = getBoardPins(boardKey);
  const next = cur.includes(insightKey) ? cur.filter(k => k !== insightKey) : [...cur, insightKey];
  setBoardPins(boardKey, next);
  return next.includes(insightKey);
}

// --- AI insights board ----------------------------------------------------
// Hot insight cards that expand into a slide-style modal (text + chart + CTAs).
// Each insight: { key, tag, title, body, details?, chart, link, onLink }
// Pinning persists keys in localStorage; pinned insights render as expanded
// cards above the grid.
//
// boardTargets: optional [{key, label}] — additional pin destinations shown
// in the modal footer ("Save to Emission overview", "Save to Trends", …).
function AIInsightsBoard({ pageKey = "default", insights = [], boardTargets = [] }) {
  const pageLabel = ({
    overview: "Home",
    "emission-overview": "Emission overview",
    quality:  "Calculation quality",
    trends:   "Trends",
  })[pageKey] || "this page";
  const STORAGE_KEY = `fai-pinned-insights-${pageKey}`;
  const [openIdx, setOpenIdx] = React.useState(null);
  const [pinnedKeys, setPinnedKeys] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  });

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedKeys));
  }, [pinnedKeys, STORAGE_KEY]);

  // Esc closes modal
  React.useEffect(() => {
    if (openIdx == null) return;
    const onKey = (e) => { if (e.key === "Escape") setOpenIdx(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIdx]);

  const pin   = (key) => setPinnedKeys(prev => prev.includes(key) ? prev : [...prev, key]);
  const unpin = (key) => setPinnedKeys(prev => prev.filter(k => k !== key));

  // Per-board pin state (Emission overview, Trends, etc.) — read fresh each render
  const [boardTick, setBoardTick] = React.useState(0);
  React.useEffect(() => {
    const h = () => setBoardTick(t => t + 1);
    window.addEventListener("fai-board-pins-changed", h);
    return () => window.removeEventListener("fai-board-pins-changed", h);
  }, []);
  const isPinnedToBoard = (boardKey, insightKey) => getBoardPins(boardKey).includes(insightKey);

  const open = openIdx != null ? insights[openIdx] : null;
  const isOpenPinned = open && pinnedKeys.includes(open.key);

  const pinnedInsights = pinnedKeys
    .map(k => insights.find(i => i.key === k))
    .filter(Boolean);

  return (
    <>
      <div className="ai-cards-grid">
        {insights
          .filter(ins => !pinnedKeys.includes(ins.key))
          .filter(ins => (ins.confidence?.level || "low") !== "low")
          .map((ins, i) => {
          const realIdx = insights.findIndex(x => x.key === ins.key);
          return (
            <div
              key={ins.key}
              role="button"
              tabIndex={0}
              className="ai-card ai-card--clickable"
              onClick={() => setOpenIdx(realIdx)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenIdx(realIdx); } }}
            >
              <div className="ai-card__head">
                <FaiBrand soft iconOnly />
                {ins.tag && <span className="ai-card__tag">{ins.tag}</span>}
                <ConfidenceChip confidence={ins.confidence} size="sm"/>
              </div>
              <div className="ai-card__title">{ins.title}</div>
              <div className="ai-card__actions">
                <span className="ai-card__link">
                  Expand insight <Icon name="arrowRight" size={12}/>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pinned board — sits BELOW the suggestions grid */}
      {pinnedInsights.length > 0 && (
        <div className="ai-pinned-stack">
          {pinnedInsights.map(ins => (
            <div key={ins.key} className="ai-insight-pinned">
              <div className="ai-insight-pinned__topbar">
                <AddToReportButton
                  source={pageKey}
                  sectionId={`ai:${ins.key}`}
                  label={ins.title}
                  variant="card"
                  align="right"
                  origin={{ label: pageLabel, onRemove: () => unpin(ins.key) }}
                />
                <button
                  className="ai-insight-pinned__close"
                  onClick={() => unpin(ins.key)}
                  title="Remove from page"
                  aria-label="Remove from page"
                >
                  <Icon name="close" size={16}/>
                </button>
              </div>
              <div className="ai-insight-pinned__head">
                <div className="ai-insight-pinned__meta">
                  <span className="ai-insight-pinned__pill"><Icon name="pin" size={9}/>Pinned</span>
                  <span className="ai-insight-pinned__tag">{ins.tag}</span>
                <ConfidenceChip confidence={ins.confidence} size="sm"/>
                </div>
                <h3 className="ai-insight-pinned__title">{ins.title}</h3>
              </div>
              <div className="ai-insight-pinned__body">
                <div className="ai-insight-pinned__text">
                  <div className="ai-insight-pinned__lede">{ins.body}</div>
                  {ins.details && <div className="ai-insight-pinned__details">{ins.details}</div>}
                </div>
                <div className="ai-insight-pinned__chart">
                  <ChartDeepDiveFrame onDeepDive={ins.onLink || null}>{ins.chart}</ChartDeepDiveFrame>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="ai-modal-backdrop" onClick={() => setOpenIdx(null)}>
          <div className="ai-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="ai-modal-title">
            <button className="ai-modal__close" onClick={() => setOpenIdx(null)} title="Close" aria-label="Close">
              <Icon name="close" size={18}/>
            </button>
            <div className="ai-modal__head">
              <div className="ai-modal__meta">
                <FaiBrand soft />
                <span>· {open.tag}</span>
                <ConfidenceChip confidence={open.confidence}/>
              </div>
              <h2 id="ai-modal-title" className="ai-modal__title">{open.title}</h2>
            </div>
            <div className={"ai-modal__body" + (open.chart ? "" : " no-chart")}>
              <div className="ai-modal__text">
                <div className="ai-modal__lede">{open.body}</div>
                {open.details && <div className="ai-modal__details">{open.details}</div>}
              </div>
              {open.chart && (
                <div className="ai-modal__chart">
                  <ChartDeepDiveFrame onDeepDive={open.onLink ? () => { open.onLink(); setOpenIdx(null); } : null}>
                    {open.chart}
                  </ChartDeepDiveFrame>
                </div>
              )}
            </div>
            {open.confidence && (
              <div className={"ai-modal__conf ai-modal__conf--" + open.confidence.level}>
                <div className="ai-modal__conf-icon"><Icon name="sparkle" size={14}/></div>
                <div className="ai-modal__conf-body">
                  <div className="ai-modal__conf-head">
                    <span className="ai-modal__conf-label">Why this confidence</span>
                    <ConfidenceChip confidence={open.confidence}/>
                  </div>
                  <p className="ai-modal__conf-basis">{open.confidence.basis}</p>
                </div>
              </div>
            )}
            <div className="ai-modal__footer">
              <AddToReportButton
                source={pageKey}
                sectionId={`ai:${open.key}`}
                label={open.title}
                variant="card"
                buttonLabel="Add to board"
                align="left"
                currentBoard={{
                  label: pageLabel,
                  isAdded: isOpenPinned,
                  onAdd: () => pin(open.key),
                  onRemove: () => unpin(open.key),
                }}
                extraBoards={boardTargets.map(t => ({
                  key: t.key,
                  label: t.label,
                  isAdded: isPinnedToBoard(t.key, open.key),
                  onToggle: () => togglePinToBoard(t.key, open.key),
                }))}
              />
              <div style={{flex: 1}}/>
              {open.confidence && open.confidence.reviewAction && open.confidence.lowCount > 0 && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => { open.confidence.reviewAction(); setOpenIdx(null); }}
                >
                  <Icon name="filter" size={14}/>
                  Review {open.confidence.lowCount} low-confidence {open.confidence.lowCount === 1 ? "factor" : "factors"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// --- Horizontal bar chart (used inside insight modals/pinned cards) ------
// When `onBarClick` is provided, each bar becomes a button that deep-dives to
// the dataset behind it (the parent decides the filter from the row).
function HorizBarChart({ rows = [], unit = "t", onBarClick, onSelect, selectedLabel }) {
  const max = Math.max(...rows.map(r => r.value), 0.0001);
  const selectable = typeof onSelect === "function";
  const clickable = !!onBarClick || selectable;
  const hasSelection = selectable && selectedLabel != null && selectedLabel !== "";
  return (
    <div className={"ai-hbar-chart" + (clickable ? " is-clickable" : "") + (selectable ? " is-selectable" : "")}>
      {rows.map((r, i) => {
        const isSel = hasSelection && r.label === selectedLabel;
        const dimStyle = hasSelection && !isSel ? { opacity: 0.4 } : null;
        const inner = (
          <>
            <div className="ai-hbar-label" title={r.label}>{r.label}</div>
            <div className="ai-hbar-track">
              <div className="ai-hbar-fill" style={{width: Math.max(2, r.value/max*100) + "%", ...(r.color ? {background: r.color} : null)}}/>
            </div>
            <div className="ai-hbar-val">{r.display || (r.value.toFixed(1) + " " + unit)}</div>
          </>
        );
        const cls = "ai-hbar-row" + (r.highlight ? " is-highlight" : "") + (isSel ? " is-selected" : "");
        const handlePick = selectable ? () => onSelect(isSel ? null : r.label) : () => onBarClick(r, i);
        const pickTitle = selectable
          ? (isSel ? `Clear filter · ${r.label}` : `Filter table to ${r.label}`)
          : `Deep dive: ${r.label}`;
        return clickable ? (
          <button
            key={i}
            type="button"
            className={cls + " ai-hbar-row--btn"}
            style={dimStyle}
            title={pickTitle}
            onClick={(e) => { e.stopPropagation(); handlePick(); }}
          >
            {inner}
          </button>
        ) : (
          <div key={i} className={cls}>{inner}</div>
        );
      })}
    </div>
  );
}

// --- Diverging bar chart (positive vs negative deltas, centered on zero) ---
function DeltaBarChart({ rows = [], unit = "t", onBarClick }) {
  const max = Math.max(...rows.map(r => Math.abs(r.value)), 0.0001);
  const clickable = !!onBarClick;
  return (
    <div className={"ai-dbar-chart" + (clickable ? " is-clickable" : "")}>
      {rows.map((r, i) => {
        const pct = Math.max(2, Math.abs(r.value) / max * 50); // 50% = half the track
        const positive = r.value >= 0;
        const inner = (
          <>
            <div className="ai-dbar-label" title={r.label}>{r.label}</div>
            <div className="ai-dbar-track">
              <div className="ai-dbar-axis" aria-hidden="true"/>
              <div
                className="ai-dbar-fill"
                style={{
                  width: pct + "%",
                  left: positive ? "50%" : (50 - pct) + "%",
                }}
              />
            </div>
            <div className="ai-dbar-val">
              {r.display || ((positive ? "+" : "−") + Math.abs(r.value).toFixed(1) + " " + unit)}
            </div>
          </>
        );
        const cls = "ai-dbar-row" + (positive ? " is-up" : " is-down");
        return clickable ? (
          <button
            key={i}
            type="button"
            className={cls + " ai-dbar-row--btn"}
            title={`Deep dive: ${r.label}`}
            onClick={(e) => { e.stopPropagation(); onBarClick(r, i); }}
          >
            {inner}
          </button>
        ) : (
          <div key={i} className={cls}>{inner}</div>
        );
      })}
    </div>
  );
}

// --- Carried-over chart — renders in the SOURCE chart's native dashboard
// style (colored single bars, stacked segments, axis ticks + legend) so a
// chart looks the same after it's deep-dived into the data table. Driven by a
// serializable `spec.variant` ("bars" | "stacked") + per-row data, so it also
// survives being saved as a view (no functions stored). ---
// A "nice" axis step that scales with magnitude so the axis always lands on
// ~5 round ticks, whether the max is 20 or 20,000. Without this the step was
// capped at 100, so a supplier chart maxing near 3,300 drew ~34 overlapping
// tick labels.
function carriedStep(max, target = 5) {
  if (!(max > 0)) return 5;
  const raw = max / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}
function carriedNiceMax(m) {
  if (m <= 0) return 20;
  const step = carriedStep(m);
  return Math.ceil(m / step) * step;
}
function carriedTicks(max) {
  const step = carriedStep(max);
  const out = [];
  for (let v = 0; v <= max + step * 1e-6; v += step) out.push(Math.round(v));
  return out;
}
function CarriedChart({ spec, rows, onSelect, selectedLabel }) {
  const data = rows || [];
  if (data.length === 0) return null;
  const stacked = spec.variant === "stacked";
  const colors = spec.colors || {};
  const totalOf = (r) => stacked ? (r.total != null ? r.total : (r.spend || 0) + (r.activity || 0) + (r.precalc || 0)) : (r.value || 0);
  const max = carriedNiceMax(Math.max(...data.map(totalOf), 1));
  const ticks = carriedTicks(max);
  const hasHighlight = data.some(r => r.highlight);
  const interactive = typeof onSelect === "function";
  const hasSelection = interactive && selectedLabel != null && selectedLabel !== "";
  return (
    <div className={"hotspot-chart carried-chart" + (interactive ? " carried-chart--interactive" : "")}>
      <div className="hotspot-grid">
        {data.map((r, i) => {
          const total = totalOf(r);
          const totalPct = total / max * 100;
          const isSel = hasSelection && r.label === selectedLabel;
          // When a bar is selected, dim the rest; otherwise fall back to the
          // snapshot's own highlight dimming.
          const dimStyle = hasSelection
            ? (isSel ? null : { opacity: 0.32 })
            : (hasHighlight && !r.highlight ? { opacity: 0.45 } : null);
          const onPick = interactive ? () => onSelect(isSel ? null : r.label) : undefined;
          const rowProps = interactive ? {
            role: "button",
            tabIndex: 0,
            onClick: onPick,
            onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(); } },
            title: isSel ? `Clear filter · ${r.label}` : `Filter table to ${r.label}`,
          } : {};
          return (
            <React.Fragment key={i}>
              <div className={"hotspot-label" + (r.highlight ? " is-hl" : "") + (isSel ? " is-selected" : "")} title={r.label} style={dimStyle} {...rowProps}>{r.label}</div>
              <div className={"hotspot-track" + (isSel ? " is-selected" : "")} style={dimStyle} {...rowProps}>
                <div className="hotspot-ticks" aria-hidden>
                  {ticks.slice(1).map(t => (
                    <span key={t} className="hotspot-tick-line" style={{left: (t/max*100)+"%"}}/>
                  ))}
                </div>
                {stacked ? (
                  <>
                    {r.spend > 0 && <div className="hotspot-seg hotspot-seg--spend" style={{left: 0, width: (r.spend/max*100)+"%", background: colors.spend || "#5B5BF0"}}/>}
                    {r.activity > 0 && <div className="hotspot-seg hotspot-seg--activity" style={{left: (r.spend/max*100)+"%", width: (r.activity/max*100)+"%", background: colors.activity || "#F7B26B"}}/>}
                    {r.precalc > 0 && <div className="hotspot-seg hotspot-seg--precalc" style={{left: ((r.spend+r.activity)/max*100)+"%", width: (r.precalc/max*100)+"%", background: colors.precalc || "#C9B5F2"}}/>}
                  </>
                ) : (
                  <div className="hotspot-seg hotspot-seg--single" style={{left: 0, width: totalPct+"%", background: r.color || "var(--fe-accent-primary)"}}/>
                )}
                <div className="hotspot-val" style={{left: "calc(" + totalPct + "% + 8px)"}}>{r.display || total.toFixed(2)}</div>
              </div>
            </React.Fragment>
          );
        })}
        <div className="hotspot-label" aria-hidden/>
        <div className="hotspot-axis">
          {ticks.map(t => (
            <span key={t} className="hotspot-axis-tick" style={{left: (t/max*100)+"%"}}>{t.toLocaleString()}</span>
          ))}
        </div>
      </div>
      {(spec.legend && spec.legend.length > 0) ? (
        <div className="hotspot-footer">
          <div className="hotspot-legend">
            {spec.legend.map((l, i) => (
              <span key={i} className="hotspot-leg-item"><span className="hotspot-leg-dot" style={{background: l.color}}/>{l.label}</span>
            ))}
          </div>
          <div className="hotspot-axis-unit">{spec.unit || "tCO₂e"}</div>
        </div>
      ) : (
        <div className="hotspot-footer hotspot-footer--right">
          <div className="hotspot-axis-unit">{spec.unit || "tCO₂e"}</div>
        </div>
      )}
    </div>
  );
}

// --- Coverage dot grid (used for Scope 3 category coverage) ---
function CoverageDotGrid({ items = [] }) {
  return (
    <div className="ai-cov-grid">
      {items.map((it, i) => (
        <div key={i} className={"ai-cov-cell " + (it.covered ? "covered" : "missing")}
             title={`${it.num} · ${it.name} — ${it.covered ? "Reported" : "Not yet"}`}>
          <div className="ai-cov-num">{it.num}</div>
          <div className="ai-cov-state">
            {it.covered ? "Reported" : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { AIInsightsBoard, HorizBarChart, DeltaBarChart, CarriedChart, CoverageDotGrid });

// --- Pinned-to-this-board insights surface --------------------------------
// Used on Emission overview / Trends pages to render AI insights that were
// pinned to those boards from Home. Reads `fai-board-pins-{boardKey}` and
// looks up the insight defs in the provided catalog.
function PinnedBoardInsights({ boardKey, boardLabel, allInsights = [], onJumpHome, editMode = false }) {
  const [pinned, setPinned] = React.useState(() => getBoardPins(boardKey));
  React.useEffect(() => {
    const h = (e) => {
      if (!e.detail || e.detail.boardKey === boardKey) {
        setPinned(getBoardPins(boardKey));
      }
    };
    window.addEventListener("fai-board-pins-changed", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("fai-board-pins-changed", h);
      window.removeEventListener("storage", h);
    };
  }, [boardKey]);

  const pinnedInsights = pinned.map(k => allInsights.find(i => i.key === k)).filter(Boolean);
  if (pinnedInsights.length === 0) return null;

  const remove = (key) => setBoardPins(boardKey, getBoardPins(boardKey).filter(k => k !== key));
  // Reorder a pinned insight within the board. Operates on the live, persisted
  // key order so it stays in sync with whatever Home pinned most recently.
  const move = (key, dir) => {
    const cur = getBoardPins(boardKey);
    const idx = cur.indexOf(key);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= cur.length) return;
    const next = [...cur];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setBoardPins(boardKey, next);
  };

  return (
    <div className={"board-pinned-stack" + (editMode ? " is-editing" : "")}>
      <div className="board-pinned-header">
        <span className="board-pinned-eyebrow">
          <Icon name="sparkle" size={12}/>
          Pinned from Forward AI
        </span>
        <span className="board-pinned-count">
          {pinnedInsights.length} insight{pinnedInsights.length === 1 ? "" : "s"} saved to {boardLabel || "this board"}
          {editMode ? " · drag order with the arrows" : ""}
        </span>
      </div>
      <div className="ai-pinned-stack">
        {pinnedInsights.map((ins, idx) => (
          <div key={ins.key} className={"ai-insight-pinned" + (editMode ? " ai-insight-pinned--editing" : "")}>
            {editMode && (
              <div className="ai-insight-pinned__chrome">
                <span className="ai-insight-pinned__chrome-label">
                  <Icon name="pin" size={11}/> Pinned insight
                </span>
                <div className="ai-insight-pinned__moves">
                  <button
                    type="button"
                    className="ai-insight-pinned__move"
                    onClick={() => move(ins.key, -1)}
                    disabled={idx === 0}
                    aria-label="Move insight up"
                    title="Move up"
                  >
                    <Icon name="chev" size={14} style={{transform: "rotate(180deg)"}}/>
                  </button>
                  <button
                    type="button"
                    className="ai-insight-pinned__move"
                    onClick={() => move(ins.key, 1)}
                    disabled={idx >= pinnedInsights.length - 1}
                    aria-label="Move insight down"
                    title="Move down"
                  >
                    <Icon name="chev" size={14}/>
                  </button>
                  <button
                    type="button"
                    className="ai-insight-pinned__move ai-insight-pinned__move--danger"
                    onClick={() => remove(ins.key)}
                    aria-label="Remove from board"
                    title="Remove from board"
                  >
                    <Icon name="close" size={14}/>
                  </button>
                </div>
              </div>
            )}
            <div className="ai-insight-pinned__topbar" style={editMode ? {display:"none"} : undefined}>
              <button
                className="ai-insight-pinned__close"
                onClick={() => remove(ins.key)}
                title="Remove from board"
                aria-label="Remove from board"
              >
                <Icon name="close" size={16}/>
              </button>
            </div>
            <div className="ai-insight-pinned__head">
              <div className="ai-insight-pinned__meta">
                <span className="ai-insight-pinned__pill"><Icon name="pin" size={9}/>Pinned</span>
                <span className="ai-insight-pinned__tag">{ins.tag}</span>
                <ConfidenceChip confidence={ins.confidence} size="sm"/>
              </div>
              <h3 className="ai-insight-pinned__title">{ins.title}</h3>
            </div>
            <div className="ai-insight-pinned__body">
              <div className="ai-insight-pinned__text">
                <div className="ai-insight-pinned__lede">{ins.body}</div>
                {ins.details && <div className="ai-insight-pinned__details">{ins.details}</div>}
              </div>
              <div className="ai-insight-pinned__chart">
                <ChartDeepDiveFrame onDeepDive={ins.onLink || null}>{ins.chart}</ChartDeepDiveFrame>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { PinnedBoardInsights, getBoardPins, setBoardPins, togglePinToBoard });

// --- Board insight card ---------------------------------------------------
// Read-only render of an AI insight inside a custom report board (the report
// board stores items as { source, sectionId: "ai:<key>" } and resolves the
// live insight def via window.getHomeInsightByKey).
function BoardInsightCard({ insight, fallbackLabel }) {
  if (!insight) {
    return (
      <div className="report-item__fallback">
        <p>This Forward AI insight is no longer available on its source page.</p>
        {fallbackLabel && <p className="report-item__fallback-meta">{fallbackLabel}</p>}
      </div>
    );
  }
  const ins = insight;
  return (
    <div className="ai-insight-pinned ai-insight-pinned--board">
      <div className="ai-insight-pinned__head">
        <div className="ai-insight-pinned__meta">
          <span className="ai-insight-pinned__tag">{ins.tag}</span>
                <ConfidenceChip confidence={ins.confidence} size="sm"/>
        </div>
        <h3 className="ai-insight-pinned__title">{ins.title}</h3>
      </div>
      <div className="ai-insight-pinned__body">
        <div className="ai-insight-pinned__text">
          <div className="ai-insight-pinned__lede">{ins.body}</div>
          {ins.details && <div className="ai-insight-pinned__details">{ins.details}</div>}
        </div>
        {ins.chart && (
          <div className="ai-insight-pinned__chart">
            <ChartDeepDiveFrame onDeepDive={ins.onLink || null}>{ins.chart}</ChartDeepDiveFrame>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { BoardInsightCard });
