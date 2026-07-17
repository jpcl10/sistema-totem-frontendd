import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Snapshot-based dirty form state.
 *
 * - `values` is the current draft.
 * - `isDirty` is true whenever the draft differs from the snapshot (deep JSON).
 * - `setValues` merges partial updates.
 * - `reset(next)` replaces the snapshot AND draft, clearing dirty.
 * - `revert()` restores the draft to the last saved snapshot.
 */
export function useDirtyForm<T extends Record<string, unknown>>(initial: T) {
  const [values, setValuesState] = useState<T>(initial);
  const snapshotRef = useRef<T>(initial);

  const setValues = useCallback((patch: Partial<T> | ((prev: T) => T)) => {
    setValuesState((prev) =>
      typeof patch === "function" ? (patch as (p: T) => T)(prev) : { ...prev, ...patch },
    );
  }, []);

  const reset = useCallback((next: T) => {
    snapshotRef.current = next;
    setValuesState(next);
  }, []);

  const revert = useCallback(() => {
    setValuesState(snapshotRef.current);
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(snapshotRef.current),
    [values],
  );

  return { values, setValues, reset, revert, isDirty, snapshot: snapshotRef.current };
}
