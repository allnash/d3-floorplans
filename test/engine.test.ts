// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFloorplan } from '../src/core/floorplan';
import type { Floor } from '../src/core/types';

function makeFloor(): Floor {
  return {
    id: 'f',
    name: 'Floor',
    image: { url: 'x.svg', x: 0, y: 0, w: 100, h: 50 },
    zones: [
      { id: 'z1', name: 'Zone 1', points: [[0, 0], [10, 0], [10, 10], [0, 10]] },
      { id: 'z2', name: 'Zone 2', color: '#f00', points: [[20, 0], [30, 0], [30, 10]] },
    ],
    sensors: [{ id: 's1', name: 'S', x: 5, y: 5, w: 4, h: 4 }],
  };
}

describe('createFloorplan (jsdom)', () => {
  let container: HTMLDivElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders zones, handles, sensors and labels from data', () => {
    const fp = createFloorplan(container, { animate: false });
    fp.setFloor(makeFloor());
    expect(container.querySelectorAll('g.fp-zone')).toHaveLength(2);
    expect(container.querySelectorAll('g.fp-zone circle.fp-handle')).toHaveLength(7);
    expect(container.querySelectorAll('g.fp-sensor')).toHaveLength(1);
    expect(container.querySelector('.fp-zone__label')?.textContent).toBe('Zone 1');
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 100 50');
    expect(container.style.aspectRatio).toBe('100 / 50');
    fp.destroy();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('updates and removes on new data (enter/update/exit)', () => {
    const fp = createFloorplan(container, { animate: false });
    const floor = makeFloor();
    fp.setFloor(floor);
    fp.setFloor({ ...floor, zones: [{ ...floor.zones[0], name: 'Renamed', points: [[0, 0], [5, 0], [5, 5]] }], sensors: [] });
    expect(container.querySelectorAll('g.fp-zone')).toHaveLength(1);
    expect(container.querySelector('.fp-zone__label')?.textContent).toBe('Renamed');
    expect(container.querySelectorAll('g.fp-zone circle.fp-handle')).toHaveLength(3);
    expect(container.querySelectorAll('g.fp-sensor')).toHaveLength(0);
    fp.destroy();
  });

  it('emits select and modechange, and is a no-op for the same floor object', () => {
    const fp = createFloorplan(container, { animate: false });
    const floor = makeFloor();
    fp.setFloor(floor);
    const onSelect = vi.fn();
    const onMode = vi.fn();
    fp.on('select', onSelect);
    fp.on('modechange', onMode);
    fp.setSelection({ kind: 'zone', id: 'z1' });
    fp.setSelection({ kind: 'zone', id: 'z1' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(container.querySelector('g.fp-zone[data-id="z1"]')?.classList.contains('fp-selected')).toBe(true);
    fp.setMode('drawZone');
    fp.setMode('drawZone');
    expect(onMode).toHaveBeenCalledWith('drawZone');
    expect(onMode).toHaveBeenCalledTimes(1);
    expect(container.classList.contains('fp-mode-draw')).toBe(true);
    fp.setFloor(floor);
    expect(fp.getFloor()).toBe(floor);
    fp.destroy();
  });

  it('clears a stale selection when the item disappears', () => {
    const fp = createFloorplan(container, { animate: false });
    const floor = makeFloor();
    fp.setFloor(floor);
    fp.setSelection({ kind: 'sensor', id: 's1' });
    fp.setFloor({ ...floor, sensors: [] });
    expect(fp.getSelection()).toBeNull();
    fp.destroy();
  });

  it('removes a selected item on Delete and emits change with a new floor', () => {
    const fp = createFloorplan(container, { animate: false });
    const floor = makeFloor();
    fp.setFloor(floor);
    const onChange = vi.fn();
    fp.on('change', onChange);
    fp.setSelection({ kind: 'zone', id: 'z2' });
    fp.svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const ev = onChange.mock.calls[0][0];
    expect(ev.type).toBe('zone:remove');
    expect(ev.floor).not.toBe(floor);
    expect(ev.floor.zones.map((z: { id: string }) => z.id)).toEqual(['z1']);
    expect(floor.zones).toHaveLength(2);
    fp.destroy();
  });
});
