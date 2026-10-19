import { select, pointer, type Selection as D3Selection } from 'd3-selection';
import { drag as d3Drag, type D3DragEvent } from 'd3-drag';
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior, type D3ZoomEvent } from 'd3-zoom';
import { animate } from 'motion';

import type {
  ChangeEvent,
  ChangeType,
  ContextMenuItem,
  Floor,
  Floorplan,
  FloorplanEvents,
  FloorplanOptions,
  Mode,
  Point,
  Selection,
  Sensor,
  Zone,
  ZoomTransform,
} from './types';
import { centroid, distance, pointsToString, roundPoint, uuid } from './geometry';
import * as ops from './floor';
import { ContextMenu } from './context-menu';
import { DEFAULT_SENSOR_ICON } from './icons';

type Opts = Required<
  Pick<
    FloorplanOptions,
    | 'mode'
    | 'zoom'
    | 'minZoom'
    | 'maxZoom'
    | 'sensorIcon'
    | 'sensorSize'
    | 'labels'
    | 'editable'
    | 'animate'
    | 'contextMenu'
    | 'generateId'
    | 'generateName'
    | 'rename'
  >
> &
  Pick<FloorplanOptions, 'width' | 'height' | 'onContextMenu'>;

interface HandleDatum {
  zone: Zone;
  p: Point;
  i: number;
}

const defaults: Opts = {
  mode: 'select',
  zoom: true,
  minZoom: 0.5,
  maxZoom: 8,
  sensorIcon: DEFAULT_SENSOR_ICON,
  sensorSize: 32,
  labels: true,
  editable: true,
  animate: true,
  contextMenu: true,
  generateId: uuid,
  generateName: (kind, index) => `${kind === 'zone' ? 'Zone' : 'Sensor'} ${index + 1}`,
  rename: (current) => (typeof window !== 'undefined' ? window.prompt('Name', current) : null),
};

const SPRING = { type: 'spring', stiffness: 320, damping: 26 } as const;

/**
 * Create an interactive floor plan inside `container`.
 *
 * The engine treats the `Floor` you give it as immutable: every interaction
 * produces a new floor object which is emitted through the `change` event and
 * rendered. Call `setFloor` with that object (or your own) to update.
 */
export function createFloorplan(container: HTMLElement, options: FloorplanOptions = {}): Floorplan {
  let opts: Opts = { ...defaults, ...stripUndefined(options) };
  let floor: Floor | null = null;
  let mode: Mode = opts.mode;
  let selection: Selection = null;
  let drawing: Point[] | null = null;
  let cursor: Point | null = null;
  let destroyed = false;

  // ---- events --------------------------------------------------------------
  const listeners = new Map<keyof FloorplanEvents, Set<(...args: never[]) => void>>();
  function emit<E extends keyof FloorplanEvents>(event: E, ...args: Parameters<FloorplanEvents[E]>) {
    listeners.get(event)?.forEach((fn) => (fn as (...a: unknown[]) => void)(...args));
  }

  // ---- DOM -----------------------------------------------------------------
  container.classList.add('fp-container');
  const svgSel = select(container).append('svg').attr('class', 'fp-svg').attr('tabindex', 0);
  const svg = svgSel.node() as SVGSVGElement;
  const viewport = svgSel.append('g').attr('class', 'fp-viewport');
  const imageLayer = viewport.append('g').attr('class', 'fp-layer fp-layer-image');
  const zoneLayer = viewport.append('g').attr('class', 'fp-layer fp-layer-zones');
  const sensorLayer = viewport.append('g').attr('class', 'fp-layer fp-layer-sensors');
  const drawingLayer = viewport.append('g').attr('class', 'fp-layer fp-layer-drawing');
  const image = imageLayer.append('image').attr('class', 'fp-floor-image').attr('preserveAspectRatio', 'none');

  const menu = new ContextMenu(() => opts.animate);

  // ---- zoom ----------------------------------------------------------------
  let transform: ZoomTransform = { x: 0, y: 0, k: 1 };
  const zoom: ZoomBehavior<SVGSVGElement, unknown> = d3Zoom<SVGSVGElement, unknown>()
    .scaleExtent([opts.minZoom, opts.maxZoom])
    .clickDistance(4)
    .filter((event: MouseEvent | WheelEvent | TouchEvent) => {
      if (!opts.zoom) return false;
      if (event.type === 'wheel') return true;
      if ('button' in event && event.button !== 0) return false;
      // Pan only from the background; zones and sensors have their own drags.
      const target = event.target as Element | null;
      return !target?.closest('.fp-zone, .fp-sensor, .fp-handle');
    })
    .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
      const t = event.transform;
      transform = { x: t.x, y: t.y, k: t.k };
      viewport.attr('transform', t.toString());
      svg.style.setProperty('--fp-zoom', String(t.k));
      emit('zoom', transform);
    });
  svgSel.call(zoom).on('dblclick.zoom', null);

  // ---- sizing --------------------------------------------------------------
  function applySize() {
    if (opts.width) container.style.width = `${opts.width}px`;
    if (opts.height) {
      container.style.height = `${opts.height}px`;
      container.style.removeProperty('aspect-ratio');
    } else if (floor) {
      container.style.removeProperty('height');
      container.style.aspectRatio = `${floor.image.w} / ${floor.image.h}`;
    }
    if (floor) {
      const { x, y, w, h } = floor.image;
      svgSel.attr('viewBox', `${x} ${y} ${w} ${h}`);
      zoom.translateExtent([
        [x - w, y - h],
        [x + 2 * w, y + 2 * h],
      ]);
    }
  }

  function applyModeClasses() {
    container.classList.toggle('fp-mode-select', mode === 'select');
    container.classList.toggle('fp-mode-draw', mode === 'drawZone');
    container.classList.toggle('fp-mode-place', mode === 'placeSensor');
    container.classList.toggle('fp-readonly', !opts.editable);
    container.classList.toggle('fp-no-labels', !opts.labels);
    container.classList.toggle('fp-drawing', drawing !== null);
  }

  // ---- state helpers -------------------------------------------------------
  function commit(type: ChangeType, next: Floor, id?: string) {
    floor = next;
    render();
    const event: ChangeEvent = { type, floor: next, id };
    emit('change', event);
  }

  function setSelection(next: Selection) {
    const same = next === selection || (next && selection && next.kind === selection.kind && next.id === selection.id);
    if (same) return;
    selection = next;
    renderSelection();
    emit('select', selection);
  }

  function setMode(next: Mode) {
    if (next === mode) return;
    if (drawing) cancelDrawing();
    mode = next;
    applyModeClasses();
    emit('modechange', mode);
  }

  function pointerFloor(event: MouseEvent | TouchEvent): Point {
    const [x, y] = pointer(event, viewport.node() as SVGGElement);
    return [x, y];
  }

  // ---- drawing (zones) -----------------------------------------------------
  function addDrawingPoint(p: Point) {
    drawing = [...(drawing ?? []), roundPoint(p)];
    applyModeClasses();
    renderDrawing();
    emit('drawing', drawing);
  }

  function completeDrawing() {
    if (!floor || !drawing || drawing.length < 3) return;
    const zone: Zone = {
      id: opts.generateId(),
      name: opts.generateName('zone', floor.zones.length),
      points: drawing,
    };
    drawing = null;
    renderDrawing();
    commit('zone:add', ops.addZone(floor, zone), zone.id);
    setSelection({ kind: 'zone', id: zone.id });
    setMode('select');
  }

  function cancelDrawing() {
    if (!drawing) return;
    drawing = null;
    cursor = null;
    applyModeClasses();
    renderDrawing();
    emit('drawing', []);
  }

  function placeSensorAt(p: Point) {
    if (!floor) return;
    const size = opts.sensorSize;
    const [x, y] = ops.clampToImage(floor, p[0] - size / 2, p[1] - size / 2, size, size);
    const sensor: Sensor = {
      id: opts.generateId(),
      name: opts.generateName('sensor', floor.sensors.length),
      x,
      y,
      w: size,
      h: size,
    };
    commit('sensor:add', ops.addSensor(floor, sensor), sensor.id);
    setSelection({ kind: 'sensor', id: sensor.id });
    setMode('select');
  }

  // ---- pointer handling on the SVG ----------------------------------------
  svgSel
    .on('click', (event: MouseEvent) => {
      if (!floor) return;
      if (mode === 'drawZone') {
        const target = event.target as Element;
        if (target.closest('.fp-drawing__start') && drawing && drawing.length >= 3) {
          completeDrawing();
        } else {
          addDrawingPoint(pointerFloor(event));
        }
        return;
      }
      if (mode === 'placeSensor') {
        placeSensorAt(pointerFloor(event));
        return;
      }
      // select mode: clicks on zones/sensors are handled by their own listeners
      const target = event.target as Element;
      if (!target.closest('.fp-zone, .fp-sensor')) setSelection(null);
    })
    .on('dblclick', () => {
      if (mode === 'drawZone' && drawing && drawing.length >= 3) completeDrawing();
    })
    .on('mousemove', (event: MouseEvent) => {
      if (mode !== 'drawZone' || !drawing) return;
      cursor = pointerFloor(event);
      renderDrawing();
    })
    .on('mouseleave', () => {
      cursor = null;
      renderDrawing();
    })
    .on('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (drawing) cancelDrawing();
        else if (mode !== 'select') setMode('select');
        else setSelection(null);
      } else if (event.key === 'Enter' && drawing) {
        completeDrawing();
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selection && opts.editable) {
        event.preventDefault();
        removeSelected();
      }
    })
    .on('contextmenu', (event: MouseEvent) => {
      if (!floor) return;
      const target = event.target as Element;
      const zoneEl = target.closest('.fp-zone') as SVGGElement | null;
      const sensorEl = target.closest('.fp-sensor') as SVGGElement | null;
      const [fx, fy] = pointerFloor(event);
      let kind: 'zone' | 'sensor' | 'background' = 'background';
      let id: string | undefined;
      if (zoneEl) {
        kind = 'zone';
        id = zoneEl.dataset.id;
      } else if (sensorEl) {
        kind = 'sensor';
        id = sensorEl.dataset.id;
      }
      let items = defaultMenuItems(kind, id, [fx, fy]);
      if (opts.onContextMenu) {
        const result = opts.onContextMenu({ kind, id, clientX: event.clientX, clientY: event.clientY, floorX: fx, floorY: fy, items });
        if (result === null) {
          event.preventDefault();
          return;
        }
        items = result;
      }
      if (!opts.contextMenu) return;
      event.preventDefault();
      if (id) setSelection({ kind: kind as 'zone' | 'sensor', id });
      menu.open(event.clientX, event.clientY, items);
    });

  function removeSelected() {
    if (!floor || !selection) return;
    const sel = selection;
    setSelection(null);
    if (sel.kind === 'zone') commit('zone:remove', ops.removeZone(floor, sel.id), sel.id);
    else commit('sensor:remove', ops.removeSensor(floor, sel.id), sel.id);
  }

  async function renameItem(kind: 'zone' | 'sensor', id: string) {
    if (!floor) return;
    const current = kind === 'zone' ? floor.zones.find((z) => z.id === id)?.name : floor.sensors.find((s) => s.id === id)?.name;
    if (current === undefined) return;
    const name = await opts.rename(current, { kind, id });
    if (destroyed || !floor || name === null || name === undefined || name.trim() === '' || name === current) return;
    if (kind === 'zone') commit('zone:rename', ops.updateZone(floor, id, { name: name.trim() }), id);
    else commit('sensor:rename', ops.updateSensor(floor, id, { name: name.trim() }), id);
    pulseLabel(kind, id);
  }

  function defaultMenuItems(kind: 'zone' | 'sensor' | 'background', id: string | undefined, at: Point): ContextMenuItem[] {
    if (kind !== 'background' && id) {
      const items: ContextMenuItem[] = [{ label: 'Rename…', action: () => void renameItem(kind, id) }];
      if (opts.editable) {
        items.push({
          label: kind === 'zone' ? 'Delete zone' : 'Delete sensor',
          danger: true,
          action: () => {
            if (!floor) return;
            if (selection?.id === id) setSelection(null);
            if (kind === 'zone') commit('zone:remove', ops.removeZone(floor, id), id);
            else commit('sensor:remove', ops.removeSensor(floor, id), id);
          },
        });
      }
      return items;
    }
    const items: ContextMenuItem[] = [];
    if (opts.editable) {
      items.push(
        {
          label: 'Start zone here',
          action: () => {
            setMode('drawZone');
            addDrawingPoint(at);
          },
        },
        { label: 'Place sensor here', action: () => placeSensorAt(at) },
      );
    }
    items.push({ label: 'Zoom to fit', action: () => zoomToFit(true) });
    return items;
  }

  // ---- drag behaviours -----------------------------------------------------
  const canEdit = () => opts.editable && mode === 'select';

  const zoneDrag = d3Drag<SVGGElement, Zone>()
    .container(() => viewport.node() as SVGGElement)
    .filter((event: MouseEvent) => canEdit() && event.button === 0 && !(event.target as Element).closest('.fp-handle'))
    .clickDistance(4)
    .subject((event: D3DragEvent<SVGGElement, Zone, unknown>) => ({ x: event.x, y: event.y }))
    .on('start', function (_event, d) {
      setSelection({ kind: 'zone', id: d.id });
      this.classList.add('fp-dragging');
    })
    .on('drag', function (event: D3DragEvent<SVGGElement, Zone, { x: number; y: number }>) {
      const dx = event.x - event.subject.x;
      const dy = event.y - event.subject.y;
      this.style.transform = `translate(${dx}px, ${dy}px)`;
    })
    .on('end', function (event: D3DragEvent<SVGGElement, Zone, { x: number; y: number }>, d) {
      this.classList.remove('fp-dragging');
      this.style.transform = '';
      const dx = event.x - event.subject.x;
      const dy = event.y - event.subject.y;
      if (floor && (dx !== 0 || dy !== 0)) commit('zone:update', ops.moveZone(floor, d.id, dx, dy), d.id);
    });

  const handleDrag = d3Drag<SVGCircleElement, HandleDatum>()
    .container(() => viewport.node() as SVGGElement)
    .filter((event: MouseEvent) => canEdit() && event.button === 0)
    .subject((_event, d) => ({ x: d.p[0], y: d.p[1] }))
    .on('start', function (_event, d) {
      setSelection({ kind: 'zone', id: d.zone.id });
      this.classList.add('fp-dragging');
    })
    .on('drag', function (event: D3DragEvent<SVGCircleElement, HandleDatum, { x: number; y: number }>, d) {
      const p: Point = [event.x, event.y];
      const g = select(this.parentNode!.parentNode as SVGGElement);
      const points = d.zone.points.slice();
      points[d.i] = p;
      select(this).attr('cx', p[0]).attr('cy', p[1]);
      g.select('polygon').attr('points', pointsToString(points));
      const c = centroid(points);
      g.select('text').attr('x', c[0]).attr('y', c[1]);
      d.p = p;
    })
    .on('end', function (_event, d) {
      this.classList.remove('fp-dragging');
      if (floor) commit('zone:update', ops.moveZoneVertex(floor, d.zone.id, d.i, d.p), d.zone.id);
    });

  const sensorDrag = d3Drag<SVGGElement, Sensor>()
    .container(() => viewport.node() as SVGGElement)
    .filter((event: MouseEvent) => canEdit() && event.button === 0)
    .clickDistance(4)
    .subject((_event, d) => ({ x: d.x, y: d.y }))
    .on('start', function (_event, d) {
      setSelection({ kind: 'sensor', id: d.id });
      this.classList.add('fp-dragging');
      // Lift to top while dragging.
      this.parentNode?.appendChild(this);
    })
    .on('drag', function (event: D3DragEvent<SVGGElement, Sensor, { x: number; y: number }>, d) {
      if (!floor) return;
      const [x, y] = ops.clampToImage(floor, event.x, event.y, d.w, d.h);
      this.style.transform = `translate(${x - d.x}px, ${y - d.y}px)`;
    })
    .on('end', function (event: D3DragEvent<SVGGElement, Sensor, { x: number; y: number }>, d) {
      this.classList.remove('fp-dragging');
      this.style.transform = '';
      if (!floor) return;
      const [x, y] = ops.clampToImage(floor, event.x, event.y, d.w, d.h);
      if (x !== d.x || y !== d.y) commit('sensor:move', ops.moveSensor(floor, d.id, x, y), d.id);
    });

  // ---- rendering -----------------------------------------------------------
  function render() {
    applyModeClasses();
    if (!floor) {
      image.attr('href', null);
      zoneLayer.selectAll('*').remove();
      sensorLayer.selectAll('*').remove();
      renderDrawing();
      return;
    }
    const { image: img } = floor;
    image.attr('href', img.url).attr('x', img.x).attr('y', img.y).attr('width', img.w).attr('height', img.h);

    renderZones(floor);
    renderSensors(floor);
    renderSelection();
    renderDrawing();
  }

  function renderZones(f: Floor) {
    const zones = zoneLayer
      .selectAll<SVGGElement, Zone>('g.fp-zone:not(.fp-exiting)')
      .data(f.zones, (d) => d.id);

    zones.exit().each(function () {
      removeWithAnimation(this as SVGGElement);
    });

    const enter = zones
      .enter()
      .append('g')
      .attr('class', 'fp-zone')
      .attr('data-id', (d) => d.id)
      .call(zoneDrag)
      .on('click', (event: MouseEvent, d) => {
        if (mode !== 'select') return;
        event.stopPropagation();
        setSelection({ kind: 'zone', id: d.id });
      });
    enter.append('polygon').attr('class', 'fp-zone__shape');
    enter.append('g').attr('class', 'fp-zone__handles');
    enter.append('text').attr('class', 'fp-label fp-zone__label');
    enter.each(function () {
      enterWithAnimation(this as SVGGElement, 0.85);
    });

    const merged = enter.merge(zones);
    merged.attr('data-id', (d) => d.id);
    merged
      .select<SVGPolygonElement>('polygon')
      .attr('points', (d) => pointsToString(d.points))
      .style('fill', (d) => d.color ?? null)
      .style('stroke', (d) => d.color ?? null);
    merged
      .select<SVGTextElement>('text')
      .attr('x', (d) => centroid(d.points)[0])
      .attr('y', (d) => centroid(d.points)[1])
      .text((d) => d.name);

    const handles = merged
      .select<SVGGElement>('g.fp-zone__handles')
      .selectAll<SVGCircleElement, HandleDatum>('circle')
      .data(
        (d) => d.points.map((p, i) => ({ zone: d, p, i })),
        (d) => String(d.i),
      );
    handles.exit().remove();
    handles
      .enter()
      .append('circle')
      .attr('class', 'fp-handle')
      .attr('r', 5)
      .call(handleDrag)
      .on('click', (event: MouseEvent) => event.stopPropagation())
      .merge(handles)
      .attr('cx', (d) => d.p[0])
      .attr('cy', (d) => d.p[1]);
  }

  function renderSensors(f: Floor) {
    const sensors = sensorLayer
      .selectAll<SVGGElement, Sensor>('g.fp-sensor:not(.fp-exiting)')
      .data(f.sensors, (d) => d.id);

    sensors.exit().each(function () {
      removeWithAnimation(this as SVGGElement);
    });

    const enter = sensors
      .enter()
      .append('g')
      .attr('class', 'fp-sensor')
      .attr('data-id', (d) => d.id)
      .call(sensorDrag)
      .on('click', (event: MouseEvent, d) => {
        if (mode !== 'select') return;
        event.stopPropagation();
        setSelection({ kind: 'sensor', id: d.id });
      });
    enter.append('circle').attr('class', 'fp-sensor__halo');
    enter.append('image').attr('class', 'fp-sensor__icon').attr('preserveAspectRatio', 'xMidYMid meet');
    enter.append('text').attr('class', 'fp-label fp-sensor__label');
    enter.each(function () {
      enterWithAnimation(this as SVGGElement, 0.3);
    });

    const merged = enter.merge(sensors);
    merged.attr('data-id', (d) => d.id);
    merged
      .select<SVGCircleElement>('circle')
      .attr('cx', (d) => d.x + d.w / 2)
      .attr('cy', (d) => d.y + d.h / 2)
      .attr('r', (d) => Math.max(d.w, d.h) * 0.72);
    merged
      .select<SVGImageElement>('image')
      .attr('href', (d) => d.url ?? opts.sensorIcon)
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y)
      .attr('width', (d) => d.w)
      .attr('height', (d) => d.h);
    merged
      .select<SVGTextElement>('text')
      .attr('x', (d) => d.x + d.w / 2)
      .attr('y', (d) => d.y + d.h + 4)
      .text((d) => d.name);
  }

  function renderSelection() {
    zoneLayer.selectAll<SVGGElement, Zone>('g.fp-zone').classed('fp-selected', (d) => selection?.kind === 'zone' && selection.id === d.id);
    sensorLayer
      .selectAll<SVGGElement, Sensor>('g.fp-sensor')
      .classed('fp-selected', (d) => selection?.kind === 'sensor' && selection.id === d.id);
  }

  function renderDrawing() {
    drawingLayer.selectAll('*').remove();
    if (!drawing || drawing.length === 0) return;
    const pts = drawing;
    drawingLayer.append('polygon').attr('class', 'fp-drawing__fill').attr('points', pointsToString(pts));
    drawingLayer.append('polyline').attr('class', 'fp-drawing__line').attr('points', pointsToString(pts));
    if (cursor) {
      const last = pts[pts.length - 1];
      drawingLayer
        .append('line')
        .attr('class', 'fp-drawing__rubber')
        .attr('x1', last[0])
        .attr('y1', last[1])
        .attr('x2', cursor[0])
        .attr('y2', cursor[1]);
    }
    const near = cursor && pts.length >= 3 && distance(cursor, pts[0]) < 12 / transform.k;
    drawingLayer
      .selectAll('circle')
      .data(pts)
      .enter()
      .append('circle')
      .attr('class', (_d, i) => 'fp-handle fp-drawing__point' + (i === 0 ? ' fp-drawing__start' : ''))
      .classed('fp-drawing__start--near', (_d, i) => i === 0 && !!near)
      .attr('cx', (d) => d[0])
      .attr('cy', (d) => d[1])
      .attr('r', (_d, i) => (i === 0 ? 7 : 5));
  }

  // ---- animation helpers (motion.dev) --------------------------------------
  function enterWithAnimation(node: SVGGElement, fromScale: number) {
    if (!opts.animate) return;
    animate(node, { opacity: [0, 1], scale: [fromScale, 1] }, SPRING).then(() => {
      node.style.transform = '';
    });
  }

  function removeWithAnimation(node: SVGGElement) {
    node.classList.add('fp-exiting');
    if (!opts.animate) {
      node.remove();
      return;
    }
    animate(node, { opacity: 0, scale: 0.85 }, { duration: 0.18, ease: 'easeIn' }).then(() => node.remove());
  }

  function pulseLabel(kind: 'zone' | 'sensor', id: string) {
    if (!opts.animate) return;
    const sel = kind === 'zone' ? zoneLayer : sensorLayer;
    const node = sel.select<SVGTextElement>(`g[data-id="${cssEscape(id)}"] text`).node();
    if (node) animate(node, { scale: [1, 1.2, 1] }, { duration: 0.35 }).then(() => (node.style.transform = ''));
  }

  // ---- zoom API ------------------------------------------------------------
  function zoomToFit(animated = true) {
    if (!floor) return;
    if (!animated || !opts.animate) {
      svgSel.call(zoom.transform, zoomIdentity);
      return;
    }
    const from = { ...transform };
    animate(0, 1, {
      duration: 0.45,
      ease: 'easeInOut',
      onUpdate: (t) => {
        const k = from.k + (1 - from.k) * t;
        const x = from.x * (1 - t);
        const y = from.y * (1 - t);
        svgSel.call(zoom.transform, zoomIdentity.translate(x, y).scale(k));
      },
    });
  }

  // ---- public API ----------------------------------------------------------
  const api: Floorplan = {
    svg,
    setFloor(next) {
      if (next === floor) return;
      if (drawing) cancelDrawing();
      const previousId = floor?.id;
      floor = next;
      if (next?.id !== previousId) {
        setSelection(null);
        applySize();
        svgSel.call(zoom.transform, zoomIdentity);
      } else if (selection) {
        const stillThere =
          selection.kind === 'zone'
            ? next?.zones.some((z) => z.id === selection!.id)
            : next?.sensors.some((s) => s.id === selection!.id);
        if (!stillThere) setSelection(null);
      }
      render();
    },
    getFloor: () => floor,
    setMode,
    getMode: () => mode,
    setSelection,
    getSelection: () => selection,
    setOptions(next) {
      opts = { ...opts, ...stripUndefined(next) };
      zoom.scaleExtent([opts.minZoom, opts.maxZoom]);
      if (next.mode) setMode(next.mode);
      applySize();
      render();
    },
    zoomToFit,
    zoomBy(factor) {
      if (opts.animate) {
        const start = transform.k;
        const target = Math.min(opts.maxZoom, Math.max(opts.minZoom, start * factor));
        animate(0, 1, {
          duration: 0.25,
          ease: 'easeOut',
          onUpdate: (t) => zoom.scaleTo(svgSel, start + (target - start) * t),
        });
      } else {
        zoom.scaleBy(svgSel, factor);
      }
    },
    getZoom: () => ({ ...transform }),
    cancelDrawing,
    toFloor(clientX, clientY) {
      const ctm = (viewport.node() as SVGGElement).getScreenCTM();
      if (!ctm) return [0, 0];
      const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return [pt.x, pt.y];
    },
    on(event, handler) {
      let set = listeners.get(event);
      if (!set) listeners.set(event, (set = new Set()));
      set.add(handler as (...args: never[]) => void);
      return () => api.off(event, handler);
    },
    off(event, handler) {
      listeners.get(event)?.delete(handler as (...args: never[]) => void);
    },
    resize() {
      applySize();
    },
    destroy() {
      destroyed = true;
      menu.destroy();
      svgSel.on('.zoom', null);
      listeners.clear();
      svg.remove();
      container.classList.remove(
        'fp-container',
        'fp-mode-select',
        'fp-mode-draw',
        'fp-mode-place',
        'fp-readonly',
        'fp-no-labels',
        'fp-drawing',
      );
    },
  };

  applyModeClasses();
  return api;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k in o) if (o[k] !== undefined) out[k] = o[k];
  return out;
}

function cssEscape(s: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&');
}

export type { D3Selection };
