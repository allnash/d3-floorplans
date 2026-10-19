import { polygonCentroid, polygonArea, polygonContains } from 'd3-polygon';
import type { Point } from './types';

/** Centroid of a polygon. Falls back to the point average for degenerate (zero-area) shapes. */
export function centroid(points: Point[]): Point {
  if (points.length === 0) return [0, 0];
  if (points.length < 3 || Math.abs(polygonArea(points)) < 1e-9) {
    const n = points.length;
    const sx = points.reduce((s, p) => s + p[0], 0);
    const sy = points.reduce((s, p) => s + p[1], 0);
    return [sx / n, sy / n];
  }
  return polygonCentroid(points) as Point;
}

export function contains(points: Point[], p: Point): boolean {
  return points.length >= 3 && polygonContains(points, p);
}

export function translate(points: Point[], dx: number, dy: number): Point[] {
  return points.map(([x, y]) => [x + dx, y + dy]);
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Round to a sensible precision so emitted JSON stays tidy. */
export function round(n: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function roundPoint([x, y]: Point): Point {
  return [round(x), round(y)];
}

export function pointsToString(points: Point[]): string {
  return points.map((p) => p.join(',')).join(' ');
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC4122-ish fallback for older environments.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}
