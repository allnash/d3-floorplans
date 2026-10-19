import { describe, expect, it } from 'vitest';
import * as ops from '../src/core/floor';
import { centroid, contains } from '../src/core/geometry';
import type { Floor } from '../src/core/types';

const floor: Floor = {
  id: 'f',
  name: 'Floor',
  image: { url: 'x.svg', x: 0, y: 0, w: 100, h: 50 },
  zones: [{ id: 'z1', name: 'Z', points: [[0, 0], [10, 0], [10, 10], [0, 10]] }],
  sensors: [{ id: 's1', name: 'S', x: 5, y: 5, w: 4, h: 4 }],
};

describe('floor ops', () => {
  it('are immutable', () => {
    const next = ops.moveZone(floor, 'z1', 5, 5);
    expect(next).not.toBe(floor);
    expect(floor.zones[0].points[0]).toEqual([0, 0]);
    expect(next.zones[0].points[0]).toEqual([5, 5]);
  });

  it('moves a vertex and rounds', () => {
    const next = ops.moveZoneVertex(floor, 'z1', 1, [12.3456, 0.04]);
    expect(next.zones[0].points[1]).toEqual([12.3, 0]);
  });

  it('ignores unknown ids', () => {
    expect(ops.moveZone(floor, 'nope', 1, 1)).toBe(floor);
    expect(ops.moveZoneVertex(floor, 'z1', 99, [0, 0])).toBe(floor);
  });

  it('adds and removes zones and sensors', () => {
    let next = ops.addZone(floor, { id: 'z2', name: 'Z2', points: [[0, 0], [1, 0], [1, 1]] });
    expect(next.zones).toHaveLength(2);
    next = ops.removeZone(next, 'z1');
    expect(next.zones.map((z) => z.id)).toEqual(['z2']);
    next = ops.addSensor(next, { id: 's2', name: 'S2', x: 1, y: 1, w: 2, h: 2 });
    expect(next.sensors).toHaveLength(2);
    next = ops.removeSensor(next, 's1');
    expect(next.sensors.map((s) => s.id)).toEqual(['s2']);
  });

  it('clamps sensors to the image', () => {
    expect(ops.clampToImage(floor, -10, -10, 4, 4)).toEqual([0, 0]);
    expect(ops.clampToImage(floor, 500, 500, 4, 4)).toEqual([96, 46]);
  });

  it('renames through update', () => {
    expect(ops.updateZone(floor, 'z1', { name: 'New' }).zones[0].name).toBe('New');
    expect(ops.updateSensor(floor, 's1', { name: 'New' }).sensors[0].name).toBe('New');
  });
});

describe('geometry', () => {
  it('computes centroids, including degenerate polygons', () => {
    expect(centroid([[0, 0], [10, 0], [10, 10], [0, 10]])).toEqual([5, 5]);
    expect(centroid([[0, 0], [10, 0]])).toEqual([5, 0]);
    expect(centroid([])).toEqual([0, 0]);
  });
  it('tests containment', () => {
    const sq = [[0, 0], [10, 0], [10, 10], [0, 10]] as [number, number][];
    expect(contains(sq, [5, 5])).toBe(true);
    expect(contains(sq, [50, 5])).toBe(false);
    expect(contains([[0, 0], [1, 1]], [0, 0])).toBe(false);
  });
});
