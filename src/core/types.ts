/** A point in floor coordinates: `[x, y]`. */
export type Point = [number, number];

/** Background image for a floor. Coordinates are in floor units (usually pixels of the image). */
export interface FloorImage {
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A named polygon region on the floor. */
export interface Zone {
  id: string;
  name: string;
  points: Point[];
  /** Optional CSS colour used for fill/stroke. Falls back to the stylesheet. */
  color?: string;
  /** Arbitrary user data; preserved untouched. */
  data?: Record<string, unknown>;
}

/** A positioned icon (sensor, camera, beacon, ...) on the floor. `x`/`y` are the top-left corner. */
export interface Sensor {
  id: string;
  name: string;
  /** Icon URL. Falls back to `FloorplanOptions.sensorIcon`. */
  url?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  data?: Record<string, unknown>;
}

export interface Floor {
  id: string;
  name: string;
  image: FloorImage;
  zones: Zone[];
  sensors: Sensor[];
}

/** Interaction mode of the floor plan. */
export type Mode = 'select' | 'drawZone' | 'placeSensor';

export type Selection = { kind: 'zone'; id: string } | { kind: 'sensor'; id: string } | null;

export type ChangeType =
  | 'zone:add'
  | 'zone:update'
  | 'zone:rename'
  | 'zone:remove'
  | 'sensor:add'
  | 'sensor:move'
  | 'sensor:rename'
  | 'sensor:remove'
  | 'floor:replace';

export interface ChangeEvent {
  type: ChangeType;
  /** The complete new floor state (a fresh object; safe to store). */
  floor: Floor;
  /** Id of the zone/sensor that changed, where applicable. */
  id?: string;
}

export interface ZoomTransform {
  x: number;
  y: number;
  k: number;
}

export interface ContextMenuItem {
  label: string;
  /** Visual hint; destructive items get a red tint. */
  danger?: boolean;
  action: () => void;
}

export interface ContextMenuRequest {
  kind: 'zone' | 'sensor' | 'background';
  id?: string;
  /** Pointer position in page (client) coordinates. */
  clientX: number;
  clientY: number;
  /** Pointer position in floor coordinates. */
  floorX: number;
  floorY: number;
  /** The default menu items; return them, modify them, or build your own. */
  items: ContextMenuItem[];
}

export interface FloorplanEvents {
  change: (event: ChangeEvent) => void;
  select: (selection: Selection) => void;
  modechange: (mode: Mode) => void;
  zoom: (transform: ZoomTransform) => void;
  /** Fires while a zone is being drawn, with the points placed so far. */
  drawing: (points: Point[]) => void;
}

export interface FloorplanOptions {
  /** Width of the SVG viewport in CSS pixels. Defaults to the container width (responsive). */
  width?: number;
  /** Height of the SVG viewport. Defaults to the aspect ratio of the floor image. */
  height?: number;
  /** Initial interaction mode. Default `'select'`. */
  mode?: Mode;
  /** Enable wheel zoom and background pan. Default `true`. */
  zoom?: boolean;
  /** Minimum/maximum zoom scale. Defaults `0.5` / `8`. */
  minZoom?: number;
  maxZoom?: number;
  /** Default icon for sensors without a `url`. Defaults to a built-in SVG. */
  sensorIcon?: string;
  /** Default size for sensors placed through the UI. Default `32`. */
  sensorSize?: number;
  /** Show zone/sensor name labels. Default `true`. */
  labels?: boolean;
  /** Allow dragging zones, vertices and sensors. Default `true`. */
  editable?: boolean;
  /** Use motion.dev animations on enter/exit/rename. Default `true`. */
  animate?: boolean;
  /** Built-in right-click context menu. Default `true`. */
  contextMenu?: boolean;
  /**
   * Hook to customise the context menu. Return the items to show, or `null`
   * to suppress the menu (e.g. when you render your own).
   */
  onContextMenu?: (request: ContextMenuRequest) => ContextMenuItem[] | null;
  /**
   * Called when the user picks "Rename". Return the new name, or `null` to
   * cancel. Defaults to `window.prompt`. May be async.
   */
  rename?: (current: string, target: { kind: 'zone' | 'sensor'; id: string }) => string | null | Promise<string | null>;
  /** Id generator for new zones/sensors. Defaults to `crypto.randomUUID`. */
  generateId?: () => string;
  /** Name generator for new items. Receives the kind and the current count. */
  generateName?: (kind: 'zone' | 'sensor', index: number) => string;
}

export interface Floorplan {
  /** The root SVG element. */
  readonly svg: SVGSVGElement;
  /** Replace the floor shown. Pass the same object to no-op. */
  setFloor(floor: Floor | null): void;
  getFloor(): Floor | null;
  setMode(mode: Mode): void;
  getMode(): Mode;
  setSelection(selection: Selection): void;
  getSelection(): Selection;
  /** Update options after creation (zoom, labels, editable, animate, ...). */
  setOptions(options: Partial<FloorplanOptions>): void;
  /** Zoom so the floor image fills the viewport. */
  zoomToFit(animated?: boolean): void;
  /** Zoom by a factor around the viewport centre (e.g. `1.5` or `1 / 1.5`). */
  zoomBy(factor: number): void;
  getZoom(): ZoomTransform;
  /** Cancel an in-progress zone drawing. */
  cancelDrawing(): void;
  /** Convert a client (mouse) position to floor coordinates. */
  toFloor(clientX: number, clientY: number): Point;
  on<E extends keyof FloorplanEvents>(event: E, handler: FloorplanEvents[E]): () => void;
  off<E extends keyof FloorplanEvents>(event: E, handler: FloorplanEvents[E]): void;
  /** Re-measure the container and redraw. Called automatically on resize. */
  resize(): void;
  destroy(): void;
}
