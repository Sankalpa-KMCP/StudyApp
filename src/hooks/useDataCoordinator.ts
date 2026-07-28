import { useMemo, useSyncExternalStore } from 'react'
import {
  DataOperationCoordinator,
  type DataCoordinatorSnapshot,
  type IDataOperationCoordinator,
} from '../db/dataCoordinator'

export type UseDataCoordinatorResult = {
  coordinator: IDataOperationCoordinator
  snapshot: DataCoordinatorSnapshot
}

/**
 * Creates or subscribes to a DataOperationCoordinator instance.
 * When an existing instance is passed (e.g. from App composition root),
 * subscribes to that instance. Otherwise creates a stable single instance for the component.
 */
export function useDataCoordinator(
  existingCoordinator?: IDataOperationCoordinator,
): UseDataCoordinatorResult {
  const coordinator = useMemo(
    () => existingCoordinator ?? new DataOperationCoordinator(),
    [existingCoordinator],
  )

  const snapshot = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  )

  return {
    coordinator,
    snapshot,
  }
}
