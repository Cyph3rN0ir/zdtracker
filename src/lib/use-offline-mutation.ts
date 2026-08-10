import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { runOrQueue, type QueueResult } from "@/lib/offline-queue";

type Snapshot = Array<[QueryKey, unknown]>;

type OfflineMutationOptions<TVariables, TResult> = {
  operation: string;
  mutationFn: (variables: TVariables) => Promise<TResult>;
  affectedKeys: QueryKey[];
  optimisticUpdate?: (queryClient: QueryClient, variables: TVariables) => void;
  coalesceKey?: (variables: TVariables) => string | undefined;
  onSuccess?: (result: QueueResult<TResult>, variables: TVariables) => void;
  onError?: (error: unknown, variables: TVariables) => void;
};

/**
 * Runs a mutation normally when connected and durably queues it when offline.
 * Cache snapshots make the UI update immediately and roll back permanent
 * server errors, while queued writes remain visible until the next sync.
 */
export function useOfflineMutation<TVariables, TResult = unknown>({
  operation,
  mutationFn,
  affectedKeys,
  optimisticUpdate,
  coalesceKey,
  onSuccess,
  onError,
}: OfflineMutationOptions<TVariables, TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: TVariables) =>
      runOrQueue<TResult>(operation, variables, (data) => mutationFn(data as TVariables), {
        coalesceKey: coalesceKey?.(variables),
      }),
    onMutate: async (variables): Promise<Snapshot> => {
      await Promise.all(affectedKeys.map((queryKey) => queryClient.cancelQueries({ queryKey })));
      const snapshots: Snapshot = [];
      for (const queryKey of affectedKeys) {
        for (const [matchedKey, data] of queryClient.getQueriesData({ queryKey })) {
          if (!snapshots.some(([savedKey]) => savedKey === matchedKey)) {
            snapshots.push([matchedKey, data]);
          }
        }
      }
      optimisticUpdate?.(queryClient, variables);
      return snapshots;
    },
    onError: (error, variables, snapshots) => {
      snapshots?.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
      onError?.(error, variables);
    },
    onSuccess: (result, variables) => {
      if (!result.queued) {
        affectedKeys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      }
      onSuccess?.(result, variables);
    },
  });
}

export function updateRows<T extends { id: string }>(
  rows: T[] | undefined,
  id: string,
  update: (row: T) => T,
): T[] {
  return (rows ?? []).map((row) => (row.id === id ? update(row) : row));
}

export function removeRow<T extends { id: string }>(rows: T[] | undefined, id: string): T[] {
  return (rows ?? []).filter((row) => row.id !== id);
}
