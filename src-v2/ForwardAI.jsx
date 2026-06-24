// Forward AI — full-page conversation tab.
//
// Layout: left rail of saved threads + main reading pane.
// Avoids "support chat" tropes (no avatars, no bubbles) — each turn is
// presented as an analyst-notebook block: a small caption with the
// question, a rich answer card below, generous spacing.

// Bring in store helpers from AIThreads.jsx (Babel script scopes are isolated).
const {
  useThreads, useActiveThread,
  createThread, addTurn, markTurnDone,
  renameThread, deleteThread, deleteTurn,
  setActiveThreadId,
  groupThreads, relativeTime,
} = window;

// --- Shared turn renderer ---------------------------------------------------
// Renders one (question → answer) pair. `suggestions` is the catalog of
// rich answer renderers keyed by `key`. Free-form turns get a generic
// "still learning" body.
function FaiTurnView({
  turn,
  suggestions = [],
  threadId,
  onPin,                 // (turn, target) => void
  onDeleteTurn,          // (turn) => void
  pinnedTargets = [],    // [{ key: "overview" | board key, label, isPinned }]
}) {
  const matched = turn.key ? suggestions.find(s => s.key === turn.key) : null;

  return (
    <article className="fai-turn">
      <header className="fai-turn__q">
        <span className="fai-turn__q-marker" aria-hidden>You asked</span>
        <h3 className="fai-turn__q-text">{turn.q}</h3>
        {onDeleteTurn && (
          <button
            type="button"
            className="fai-turn__delete"
            onClick={() => onDeleteTurn(turn)}
            title="Remove this turn"
            aria-label="Remove this turn"
          >
            <Icon name="close" size={14}/>
          </button>
        )}
      </header>

      <div className="fai-turn__a">
        {turn.status === "thinking" ? (
          <div className="fai-thinking" aria-label="Thinking">
            <span></span><span></span><span></span>
          </div>
        ) : matched ? (
          <>
            {matched.text && matched.chart ? (
              <div className="fai-msg-slide">
                <div className="fai-msg-slide__text">{matched.text()}</div>
                <div className="fai-msg-slide__chart">{matched.chart()}</div>
              </div>
            ) : matched.text ? (
              <div className="fai-msg-slide fai-msg-slide--text-only">
                <div className="fai-msg-slide__text">{matched.text()}</div>
              </div>
            ) : (
              matched.answer && matched.answer()
            )}
            {onPin && pinnedTargets.length > 0 && (
              <div className="fai-turn__actions">
                {pinnedTargets.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    className={"fai-action " + (t.isPinned ? "pinned" : "")}
                    onClick={() => onPin(turn, t)}
                    disabled={t.isPinned}
                    title={t.isPinned ? ("Pinned to " + t.label) : ("Pin to " + t.label)}
                  >
                    <Icon name={t.isPinned ? "check" : "pin"} size={12}/>
                    {t.isPinned ? "Pinned to " + t.label : "Pin to " + t.label}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="fai-freeform">
            <p>
              Working on a tailored response for <em>"{turn.q}"</em>. As we continue
              chatting, the insights above will adapt — I'll re-prioritise, swap out
              charts, and pull new examples from your data based on what you ask next.
            </p>
            <p className="fai-freeform__hint">
              <Icon name="sparkle" size={11}/>
              Free-form responses use the same data context as the suggested questions.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

// --- Composer (used both inline in a thread, and on the empty state) -------
function FaiComposer({ placeholder, onSubmit, autoFocus, large }) {
  const [v, setV] = React.useState("");
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);
  const submit = (e) => {
    e?.preventDefault?.();
    if (!v.trim()) return;
    onSubmit(v.trim());
    setV("");
  };
  return (
    <form
      className={"fai-composer" + (large ? " fai-composer--large" : "")}
      onSubmit={submit}
    >
      <div className="fai-composer__sparkle"><Icon name="sparkle" size={18}/></div>
      <input
        ref={inputRef}
        className="fai-composer__input"
        placeholder={placeholder}
        value={v}
        onChange={(e) => setV(e.target.value)}
      />
      <button
        type="submit"
        className="fai-composer__send"
        disabled={!v.trim()}
        aria-label="Send"
      >
        <Icon name="send" size={14}/>
      </button>
    </form>
  );
}

// --- Empty state for the Forward AI page -----------------------------------
function FaiEmptyState({ suggestions, onAsk, hasThreads }) {
  // Show only the first 6 suggestions in the empty state (don't overwhelm).
  const six = suggestions.slice(0, 6);
  return (
    <div className="fai-empty">
      <div className="fai-empty__hero">
        <div className="fai-empty__logo">
          <Icon name="sparkle" size={28}/>
        </div>
        <h2 className="fai-empty__title">Forward AI</h2>
        <p className="fai-empty__sub">
          Ask about your footprint, hotspots, trends, or what just changed.
          Every conversation is saved so you can pick it back up later.
        </p>
        <div className="fai-empty__composer">
          <FaiComposer
            placeholder="Ask Forward AI…"
            onSubmit={onAsk}
            autoFocus
            large
          />
        </div>
        {six.length > 0 && (
          <div className="fai-empty__chips">
            {six.map((s, i) => (
              <button
                key={i}
                type="button"
                className="fai-empty__chip"
                onClick={() => onAsk(s.q, s.key)}
              >
                <Icon name="sparkle" size={12}/>
                {s.q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Thread list rail -------------------------------------------------------
function FaiThreadRail({ threads, activeId, onSelect, onNew, query, setQuery }) {
  const filtered = !query.trim()
    ? threads
    : threads.filter(t => {
        const q = query.toLowerCase();
        if (t.title.toLowerCase().includes(q)) return true;
        return t.turns.some(tu => (tu.q || "").toLowerCase().includes(q));
      });
  const groups = groupThreads(filtered);

  const Group = ({ label, items }) => items.length === 0 ? null : (
    <div className="fai-rail__group">
      <div className="fai-rail__group-label">{label}</div>
      {items.map(t => (
        <button
          key={t.id}
          type="button"
          className={"fai-rail__item" + (t.id === activeId ? " fai-rail__item--active" : "")}
          onClick={() => onSelect(t.id)}
        >
          <div className="fai-rail__item-title">{t.title}</div>
          <div className="fai-rail__item-meta">
            <span>{relativeTime(t.updatedAt)}</span>
            <span aria-hidden>·</span>
            <span>{t.turns.length} {t.turns.length === 1 ? "turn" : "turns"}</span>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <aside className="fai-rail">
      <div className="fai-rail__head">
        <button type="button" className="fai-rail__new" onClick={onNew}>
          <Icon name="plus" size={14}/>
          <span>New thread</span>
        </button>
      </div>
      <div className="fai-rail__search">
        <Icon name="search" size={14}/>
        <input
          placeholder="Search threads…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="fai-rail__scroll">
        {filtered.length === 0 ? (
          <div className="fai-rail__empty">
            {query.trim() ? "No matches." : "No threads yet — ask a question to begin."}
          </div>
        ) : (
          <>
            <Group label="Today"     items={groups.today}/>
            <Group label="This week" items={groups.week}/>
            <Group label="Earlier"   items={groups.older}/>
          </>
        )}
      </div>
    </aside>
  );
}

// --- Forward AI page --------------------------------------------------------
function ForwardAI({ suggestions = [], onJumpTo }) {
  const threads     = useThreads();
  const activeId    = useActiveThread();
  const active      = threads.find(t => t.id === activeId) || null;
  const [query, setQuery] = React.useState("");

  // Auto-select the most-recent thread ONCE on load. After that we never
  // re-select automatically — so hitting "New thread" (which clears the active
  // id) lands on the empty composer + suggestions instead of bouncing back to
  // the latest thread.
  const didAutoSelect = React.useRef(false);
  React.useEffect(() => {
    if (didAutoSelect.current) return;
    if (activeId) { didAutoSelect.current = true; return; }
    if (threads.length > 0) {
      didAutoSelect.current = true;
      setActiveThreadId(threads[0].id);
    }
  }, [activeId, threads.length]);

  // Scroll to bottom of thread when a new turn is appended.
  const paneRef = React.useRef(null);
  React.useEffect(() => {
    if (!active || !paneRef.current) return;
    paneRef.current.scrollTop = paneRef.current.scrollHeight;
  }, [active?.turns.length, active?.id]);

  const askInActive = (q, key = null) => {
    const matched = suggestions.find(s => s.q === q || s.key === key);
    const useKey = key || (matched ? matched.key : null);
    if (!active) {
      const t = createThread({ firstQ: q, firstKey: useKey });
      setTimeout(() => markTurnDone(t.id, t.turns[0].id), 900);
    } else {
      const turn = addTurn(active.id, { q, key: useKey });
      if (turn) setTimeout(() => markTurnDone(active.id, turn.id), 900);
    }
  };

  const startNewThread = () => {
    setActiveThreadId(null);
  };

  const renameActive = () => {
    if (!active) return;
    const next = prompt("Rename thread", active.title);
    if (next != null && next.trim()) renameThread(active.id, next.trim());
  };

  const deleteActive = () => {
    if (!active) return;
    if (confirm("Delete this thread? This can't be undone.")) deleteThread(active.id);
  };

  // Suggestions that haven't been asked yet in this thread
  const followups = active
    ? suggestions.filter(s => !active.turns.find(tu => tu.key === s.key)).slice(0, 4)
    : [];

  return (
    <div className="fai-page">
      <div className="fai-page__head">
        <div>
          <h1 className="page-title">Forward AI</h1>
          <div className="page-subtitle">
            Your saved conversations · per-user history · auto-named from the first question
          </div>
        </div>
      </div>

      <div className="fai-layout">
        <FaiThreadRail
          threads={threads}
          activeId={activeId}
          onSelect={(id) => setActiveThreadId(id)}
          onNew={startNewThread}
          query={query}
          setQuery={setQuery}
        />

        <main className="fai-main" ref={paneRef}>
          {!active ? (
            <FaiEmptyState
              suggestions={suggestions}
              onAsk={askInActive}
              hasThreads={threads.length > 0}
            />
          ) : (
            <>
              <header className="fai-thread__head">
                <div className="fai-thread__meta">
                  <h2 className="fai-thread__title">{active.title}</h2>
                  <div className="fai-thread__sub">
                    Started {relativeTime(active.createdAt)} · {active.turns.length} {active.turns.length === 1 ? "turn" : "turns"}
                  </div>
                </div>
                <div className="fai-thread__actions">
                  <button type="button" className="btn secondary small" onClick={renameActive}>
                    <Icon name="pencil" size={14}/>Rename
                  </button>
                  <button type="button" className="btn secondary small" onClick={deleteActive}>
                    <Icon name="trash" size={14}/>Delete
                  </button>
                </div>
              </header>

              <div className="fai-thread__turns">
                {active.turns.map(turn => (
                  <FaiTurnView
                    key={turn.id}
                    turn={turn}
                    suggestions={suggestions}
                    threadId={active.id}
                    onDeleteTurn={(t) => deleteTurn(active.id, t.id)}
                  />
                ))}
              </div>

              <div className="fai-thread__foot">
              {followups.length > 0 && (
                <div className="fai-thread__followups">
                  <span className="fai-thread__followups-label">Try next</span>
                  {followups.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      className="fai-empty__chip"
                      onClick={() => askInActive(s.q, s.key)}
                    >
                      <Icon name="sparkle" size={12}/>
                      {s.q}
                    </button>
                  ))}
                </div>
              )}

              <div className="fai-thread__composer">
                <FaiComposer
                  placeholder="Continue this thread — ask a follow-up…"
                  onSubmit={(q) => askInActive(q)}
                />
              </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

Object.assign(window, { ForwardAI, FaiTurnView, FaiComposer });
