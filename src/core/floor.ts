/**
 * Pure, immutable operations on `Floor` objects. The engine uses these so every
 * change produces a fresh floor that can be handed straight to React state.
 */
import type { Floor, Point, Sensor, Zone } from './types';
import { roundPoint, round, translate } from './geometry';

export function cloneFloor(floor: Floor): Floor {
  return {
    ...floor,
    image: { ...floor.image },
    zones: floor.zones.map((z) => ({ ...z, points: z.points.map((p) => [p[0], p[1]] as Point) })),
    sensors: floor.sensors.map((s) => ({ ...s })),
  };
}

export function addZone(floor: Floor, zone: Zone): Floor {
  return { ...floor, zones: [...floor.zones, { ...zone, points: zone.points.map(roundPoint) }] };
}

export function updateZone(floor: Floor, id: string, patch: Partial<Zone>): Floor {
  return {
    ...floor,
    zones: floor.zones.map((z) =>
      z.id === id ? { ...z, ...patch, points: (patch.points ?? z.points).map(roundPoint) } : z,
    ),
  };
}

export function moveZone(floor: Floor, id: string, dx: number, dy: number): Floor {
  const zone = floor.zones.find((z) => z.id === id);
  if (!zone) return floor;
  return updateZone(floor, id, { points: translate(zone.points, dx, dy) });
}

export function moveZoneVertex(floor: Floor, id: string, index: number, point: Point): Floor {
  const zone = floor.zones.find((z) => z.id === id);
  if (!zone || index < 0 || index >= zone.points.length) return floor;
  const points = zone.points.slice();
  points[index] = point;
  return updateZone(floor, id, { points });
}

export function removeZone(floor: Floor, id: string): Floor {
  return { ...floor, zones: floor.zones.filter((z) => z.id !== id) };
}

export function addSensor(floor: Floor, sensor: Sensor): Floor {
  return { ...floor, sensors: [...floor.sensors, roundSensor(sensor)] };
}

export function updateSensor(floor: Floor, id: string, patch: Partial<Sensor>): Floor {
  return {
    ...floor,
    sensors: floor.sensors.map((s) => (s.id === id ? roundSensor({ ...s, ...patch }) : s)),
  };
}

export function moveSensor(floor: Floor, id: string, x: number, y: number): Floor {
  return updateSensor(floor, id, { x, y });
}

export function removeSensor(floor: Floor, id: string): Floor {
  return { ...floor, sensors: floor.sensors.filter((s) => s.id !== id) };
}

function roundSensor(s: Sensor): Sensor {
  return { ...s, x: round(s.x), y: round(s.y), w: round(s.w), h: round(s.h) };
}

/** Clamp a sensor's top-left so the icon stays within the floor image. */
export function clampToImage(floor: Floor, x: number, y: number, w: number, h: number): Point {
  const { image } = floor;
  const cx = Math.min(Math.max(x, image.x), image.x + image.w - w);
  const cy = Math.min(Math.max(y, image.y), image.y + image.h - h);
  return [cx, cy];
}
