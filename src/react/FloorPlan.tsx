import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type CSSProperties,
} from 'react';
import { createFloorplan } from '../core/floorplan';
import type {
  ChangeEvent,
  Floor,
  Floorplan,
  FloorplanOptions,
  Mode,
  Point,
  Selection,
  ZoomTransform,
} from '../core/types';
import '../styles/floorplan.css';

export interface FloorPlanProps extends Omit<FloorplanOptions, 'mode'> {
  /** The floor to render. Treated as immutable; pass a new object to update. */
  floor: Floor | null;
  /** Fired after every user edit with the new floor state. */
  onChange?: (floor: Floor, event: ChangeEvent) => void;
  /** Interaction mode. Controlled when provided together with `onModeChange`. */
  mode?: Mode;
  onModeChange?: (mode: Mode) => void;
  /** Current selection. Controlled when provided together with `onSelectionChange`. */
  selection?: Selection;
  onSelectionChange?: (selection: Selection) => void;
  onZoom?: (transform: ZoomTransform) => void;
  /** Points placed so far while drawing a zone. */
  onDrawing?: (points: Point[]) => void;
  className?: string;
  style?: CSSProperties;
}

export interface FloorPlanHandle {
  zoomToFit(animated?: boolean): void;
  zoomBy(factor: number): void;
  cancelDrawing(): void;
  toFloor(clientX: number, clientY: number): Point;
  /** Escape hatch to the underlying engine. */
  getInstance(): Floorplan | null;
}

const optionKeys = [
  'width',
  'height',
  'zoom',
  'minZoom',
  'maxZoom',
  'sensorIcon',
  'sensorSize',
  'labels',
  'editable',
  'animate',
  'contextMenu',
  'generateId',
  'generateName',
] as const satisfies readonly (keyof FloorplanOptions)[];

/**
 * React component wrapping the d3-floorplan engine.
 *
 * ```tsx
 * const [floor, setFloor] = useState(initialFloor);
 * <FloorPlan floor={floor} onChange={setFloor} mode={mode} onModeChange={setMode} />
 * ```
 */
export const FloorPlan = forwardRef<FloorPlanHandle, FloorPlanProps>(function FloorPlan(props, ref) {
  const {
    floor,
    onChange,
    mode,
    onModeChange,
    selection,
    onSelectionChange,
    onZoom,
    onDrawing,
    onContextMenu,
    rename,
    className,
    style,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Floorplan | null>(null);

  // Keep latest callbacks in refs so the engine only subscribes once.
  const callbacks = useRef({ onChange, onModeChange, onSelectionChange, onZoom, onDrawing, onContextMenu, rename });
  callbacks.current = { onChange, onModeChange, onSelectionChange, onZoom, onDrawing, onContextMenu, rename };

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const engine = createFloorplan(container, {
      ...pick(props, optionKeys),
      mode,
      onContextMenu: (req) => (callbacks.current.onContextMenu ? callbacks.current.onContextMenu(req) : req.items),
      rename: (current, target) =>
        callbacks.current.rename
          ? callbacks.current.rename(current, target)
          : typeof window !== 'undefined'
            ? window.prompt('Name', current)
            : null,
    });
    engineRef.current = engine;
    engine.on('change', (e) => callbacks.current.onChange?.(e.floor, e));
    engine.on('modechange', (m) => callbacks.current.onModeChange?.(m));
    engine.on('select', (s) => callbacks.current.onSelectionChange?.(s));
    engine.on('zoom', (t) => callbacks.current.onZoom?.(t));
    engine.on('drawing', (p) => callbacks.current.onDrawing?.(p));
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // The engine is created once; prop updates flow through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    engineRef.current?.setFloor(floor);
  }, [floor]);

  useEffect(() => {
    if (mode !== undefined) engineRef.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    if (selection !== undefined) engineRef.current?.setSelection(selection);
  }, [selection]);

  const optionValues = optionKeys.map((k) => props[k]);
  useEffect(() => {
    engineRef.current?.setOptions(pick(props, optionKeys));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, optionValues);

  useImperativeHandle(
    ref,
    () => ({
      zoomToFit: (animated) => engineRef.current?.zoomToFit(animated),
      zoomBy: (factor) => engineRef.current?.zoomBy(factor),
      cancelDrawing: () => engineRef.current?.cancelDrawing(),
      toFloor: (x, y) => engineRef.current?.toFloor(x, y) ?? [0, 0],
      getInstance: () => engineRef.current,
    }),
    [],
  );

  return <div ref={containerRef} className={className} style={style} />;
});

function pick<T extends object, K extends readonly (keyof T)[]>(obj: T, keys: K): Pick<T, K[number]> {
  const out = {} as Pick<T, K[number]>;
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}
