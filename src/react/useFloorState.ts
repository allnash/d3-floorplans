import { useCallback, useMemo, useState } from 'react';
import type { Floor, Sensor, Zone } from '../core/types';
import * as ops from '../core/floor';

export interface FloorState {
  floor: Floor;
  /** Replace the floor (what you pass to `<FloorPlan onChange>`). Records history. */
  setFloor: (floor: Floor) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Convenience editors that go through the same history. */
  updateZone: (id: string, patch: Partial<Zone>) => void;
  removeZone: (id: string) => void;
  updateSensor: (id: string, patch: Partial<Sensor>) => void;
  removeSensor: (id: string) => void;
  /** Reset to a new floor and clear history (e.g. when switching floors). */
  reset: (floor: Floor) => void;
}

interface History {
  past: Floor[];
  present: Floor;
  future: Floor[];
}

/**
 * Floor state with undo/redo. Pairs with `<FloorPlan floor={floor} onChange={setFloor} />`.
 */
export function useFloorState(initial: Floor, { limit = 100 }: { limit?: number } = {}): FloorState {
  const [history, setHistory] = useState<History>({ past: [], present: initial, future: [] });

  const setFloor = useCallback(
    (next: Floor) =>
      setHistory((h) =>
        next === h.present ? h : { past: [...h.past.slice(-(limit - 1)), h.present], present: next, future: [] },
      ),
    [limit],
  );

  const undo = useCallback(
    () =>
      setHistory((h) => {
        if (h.past.length === 0) return h;
        const present = h.past[h.past.length - 1];
        return { past: h.past.slice(0, -1), present, future: [h.present, ...h.future] };
      }),
    [],
  );

  const redo = useCallback(
    () =>
      setHistory((h) => {
        if (h.future.length === 0) return h;
        const [present, ...future] = h.future;
        return { past: [...h.past, h.present], present, future };
      }),
    [],
  );

  const reset = useCallback((floor: Floor) => setHistory({ past: [], present: floor, future: [] }), []);

  return useMemo(
    () => ({
      floor: history.present,
      setFloor,
      undo,
      redo,
      reset,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      updateZone: (id, patch) => setFloor(ops.updateZone(history.present, id, patch)),
      removeZone: (id) => setFloor(ops.removeZone(history.present, id)),
      updateSensor: (id, patch) => setFloor(ops.updateSensor(history.present, id, patch)),
      removeSensor: (id) => setFloor(ops.removeSensor(history.present, id)),
    }),
    [history, setFloor, undo, redo, reset],
  );
}
