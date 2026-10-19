import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FloorPlan, useFloorState, type FloorPlanHandle, type Mode, type Selection, type Floor } from 'd3-floorplan/react';
import { floors as initialFloors } from './data';

const modes: { id: Mode; label: string; hint: string; icon: string }[] = [
  { id: 'select', label: 'Select', hint: 'Drag zones, vertices and sensors. Right-click for options.', icon: '↖' },
  {
    id: 'drawZone',
    label: 'Draw zone',
    hint: 'Click to place points. Click the first point, double-click or press Enter to finish. Esc cancels.',
    icon: '⬠',
  },
  { id: 'placeSensor', label: 'Place sensor', hint: 'Click anywhere on the plan to drop a sensor.', icon: '◎' },
];

export function App() {
  const [floorIndex, setFloorIndex] = useState(0);
  const [allFloors, setAllFloors] = useState<Floor[]>(initialFloors);
  const state = useFloorState(initialFloors[0]);
  const { floor, setFloor, undo, redo, canUndo, canRedo, reset } = state;
  const [mode, setMode] = useState<Mode>('select');
  const [selection, setSelection] = useState<Selection>(null);
  const [zoom, setZoom] = useState(1);
  const [labels, setLabels] = useState(true);
  const [animate, setAnimate] = useState(true);
  const [editable, setEditable] = useState(true);
  const [showJson, setShowJson] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const planRef = useRef<FloorPlanHandle>(null);

  // Persist edits per floor so switching back restores them.
  useEffect(() => {
    setAllFloors((fs) => fs.map((f, i) => (i === floorIndex ? floor : f)));
  }, [floor, floorIndex]);

  function switchFloor(i: number) {
    if (i === floorIndex) return;
    setFloorIndex(i);
    setSelection(null);
    reset(allFloors[i]);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === 'v') setMode('select');
      else if (e.key === 'z') setMode('drawZone');
      else if (e.key === 's') setMode('placeSensor');
      else if (e.key === 'f') planRef.current?.zoomToFit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const json = useMemo(() => JSON.stringify(floor, null, 2), [floor]);
  const selectedZone = selection?.kind === 'zone' ? floor.zones.find((z) => z.id === selection.id) : undefined;
  const selectedSensor = selection?.kind === 'sensor' ? floor.sensors.find((s) => s.id === selection.id) : undefined;
  const selected = selectedZone ?? selectedSensor;

  function deleteSelected() {
    if (!selection) return;
    const sel = selection;
    setSelection(null);
    if (sel.kind === 'zone') state.removeZone(sel.id);
    else state.removeSensor(sel.id);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__logo" aria-hidden />
          <div>
            <h1>d3-floorplan</h1>
            <p>Interactive floor plans · D3 core · React · embeddable</p>
          </div>
        </div>
        <nav className="floors" aria-label="Floors">
          {allFloors.map((f, i) => (
            <button key={f.id} className={'tab' + (i === floorIndex ? ' tab--active' : '')} onClick={() => switchFloor(i)}>
              {i === floorIndex && (
                <motion.span layoutId="floor-pill" className="tab__pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
              )}
              <span className="tab__label">{f.name}</span>
            </button>
          ))}
        </nav>
        <div className="topbar__right">
          <a className="link" href="https://github.com/allnash/d3-floorplans" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <button className="icon-btn" title="Toggle theme" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? '☀︎' : '☾'}
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="canvas">
          <div className="toolbar" role="toolbar">
            <div className="segmented">
              {modes.map((m) => (
                <button
                  key={m.id}
                  className={'segmented__btn' + (mode === m.id ? ' segmented__btn--active' : '')}
                  onClick={() => setMode(m.id)}
                  title={m.hint}
                >
                  {mode === m.id && (
                    <motion.span layoutId="mode-pill" className="segmented__pill" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />
                  )}
                  <span className="segmented__icon">{m.icon}</span>
                  <span className="segmented__label">{m.label}</span>
                </button>
              ))}
            </div>
            <div className="toolbar__group">
              <button className="icon-btn" onClick={undo} disabled={!canUndo} title="Undo (⌘Z)">
                ↶
              </button>
              <button className="icon-btn" onClick={redo} disabled={!canRedo} title="Redo (⇧⌘Z)">
                ↷
              </button>
            </div>
            <div className="toolbar__group">
              <button className="icon-btn" onClick={() => planRef.current?.zoomBy(1 / 1.4)} title="Zoom out">
                −
              </button>
              <span className="zoom-readout">{Math.round(zoom * 100)}%</span>
              <button className="icon-btn" onClick={() => planRef.current?.zoomBy(1.4)} title="Zoom in">
                +
              </button>
              <button className="icon-btn" onClick={() => planRef.current?.zoomToFit()} title="Fit (F)">
                ⤢
              </button>
            </div>
            <div className="toolbar__group toolbar__toggles">
              <label>
                <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Labels
              </label>
              <label>
                <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} /> Animate
              </label>
              <label>
                <input type="checkbox" checked={editable} onChange={(e) => setEditable(e.target.checked)} /> Editable
              </label>
            </div>
          </div>

          <div className="plan-wrap">
            <FloorPlan
              ref={planRef}
              className="plan"
              floor={floor}
              onChange={setFloor}
              mode={mode}
              onModeChange={setMode}
              selection={selection}
              onSelectionChange={setSelection}
              onZoom={(t) => setZoom(t.k)}
              labels={labels}
              animate={animate}
              editable={editable}
            />
            <AnimatePresence>
              {mode !== 'select' && (
                <motion.div
                  key={mode}
                  className="hint"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.18 }}
                >
                  {modes.find((m) => m.id === mode)?.hint}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        <aside className="sidebar">
          <AnimatePresence mode="wait">
            {selection && selected ? (
              <motion.div
                key={selection.id}
                className="panel inspector"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.16 }}
              >
                <div className="panel__head">
                  <span className={'chip chip--' + selection.kind}>{selection.kind}</span>
                  <button className="icon-btn" onClick={() => setSelection(null)} title="Deselect (Esc)">
                    ×
                  </button>
                </div>
                <label className="field">
                  <span>Name</span>
                  <input
                    value={selected.name}
                    onChange={(e) =>
                      selection.kind === 'zone'
                        ? state.updateZone(selection.id, { name: e.target.value })
                        : state.updateSensor(selection.id, { name: e.target.value })
                    }
                  />
                </label>
                {selectedZone && (
                  <>
                    <label className="field">
                      <span>Colour</span>
                      <input
                        type="color"
                        value={selectedZone.color ?? '#38bdf8'}
                        onChange={(e) => state.updateZone(selectedZone.id, { color: e.target.value })}
                      />
                    </label>
                    <div className="field">
                      <span>Vertices</span>
                      <code>{selectedZone.points.length}</code>
                    </div>
                  </>
                )}
                {selectedSensor && (
                  <div className="field">
                    <span>Position</span>
                    <code>
                      {selectedSensor.x}, {selectedSensor.y}
                    </code>
                  </div>
                )}
                <button className="btn btn--danger" onClick={deleteSelected}>
                  Delete
                </button>
              </motion.div>
            ) : (
              <motion.div key="empty" className="panel panel--muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Select a zone or sensor to inspect it. Shortcuts: <kbd>V</kbd> select, <kbd>Z</kbd> draw zone, <kbd>S</kbd> sensor, <kbd>F</kbd> fit,{' '}
                <kbd>⌘Z</kbd> undo.
              </motion.div>
            )}
          </AnimatePresence>

          <div className="panel">
            <div className="panel__head">
              <h2>
                Zones <span className="count">{floor.zones.length}</span>
              </h2>
            </div>
            <ul className="list">
              <AnimatePresence initial={false}>
                {floor.zones.map((z) => (
                  <motion.li
                    key={z.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <button
                      className={'list__item' + (selection?.id === z.id ? ' list__item--active' : '')}
                      onClick={() => setSelection({ kind: 'zone', id: z.id })}
                    >
                      <span className="swatch" style={{ background: z.color ?? '#38bdf8' }} />
                      <span className="list__name">{z.name}</span>
                      <span className="list__meta">{z.points.length} pts</span>
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>

          <div className="panel">
            <div className="panel__head">
              <h2>
                Sensors <span className="count">{floor.sensors.length}</span>
              </h2>
            </div>
            <ul className="list">
              <AnimatePresence initial={false}>
                {floor.sensors.map((s) => (
                  <motion.li
                    key={s.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <button
                      className={'list__item' + (selection?.id === s.id ? ' list__item--active' : '')}
                      onClick={() => setSelection({ kind: 'sensor', id: s.id })}
                    >
                      <span className="swatch swatch--sensor" />
                      <span className="list__name">{s.name}</span>
                      <span className="list__meta">
                        {s.x}, {s.y}
                      </span>
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>

          <div className="panel">
            <div className="panel__head">
              <h2>Floor JSON</h2>
              <div className="panel__actions">
                <button className="btn btn--ghost" onClick={() => navigator.clipboard?.writeText(json)}>
                  Copy
                </button>
                <button className="btn btn--ghost" onClick={() => setShowJson((v) => !v)}>
                  {showJson ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <AnimatePresence initial={false}>
              {showJson && (
                <motion.pre
                  className="json"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {json}
                </motion.pre>
              )}
            </AnimatePresence>
          </div>
        </aside>
      </main>
    </div>
  );
}
