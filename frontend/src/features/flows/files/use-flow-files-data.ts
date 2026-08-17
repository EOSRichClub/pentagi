import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';

import type { FileNode } from '@/components/shared/file-manager';

import { useFlowFilesQuery } from '@/graphql/types';
import { api } from '@/lib/axios';

import { FLOW_FILES_SYNC_API_PATH } from './flow-files-constants';
import { toFileNode } from './flow-files-utils';

interface UseFlowFilesDataParams {
    flowId: null | string;
}

interface UseFlowFilesDataResult {
    fileNodes: FileNode[];
    isInitialLoading: boolean;
    isLoading: boolean;
    refetchFiles: () => Promise<unknown>;
}

const FLOW_FILES_ERROR_TOAST_ID = 'flow-files-error';

/**
 * Loads `flowFiles` for the current flow and converts them into `FileNode`s for the
 * file manager. The `isInitialLoading` flag is derived from Apollo's response shape:
 * it stays `true` only while the very first response is in flight (no cached data
 * yet), so subsequent background `refetch` calls do not flash the skeleton.
 *
 * Before the first GraphQL load and on every manual refresh we call POST /files/sync
 * so the cache pulls latest deliverables from the terminal /work directory. Same-named
 * overwrites keep the main path as the newest content and leave prior versions as
 * `*.vN_prev_*.ext` siblings.
 */
export function useFlowFilesData({ flowId }: UseFlowFilesDataParams): UseFlowFilesDataResult {
    const flowFilesVariables = useMemo(() => ({ flowId: flowId ?? '' }), [flowId]);
    const syncedForFlowRef = useRef<string | null>(null);

    const {
        data: flowFilesData,
        error: flowFilesError,
        loading: isLoading,
        refetch,
    } = useFlowFilesQuery({
        skip: !flowId,
        variables: flowFilesVariables,
    });

    const syncFromContainer = useCallback(async (id: string) => {
        try {
            // Best-effort: listing still works if the terminal is stopped.
            await api.post(FLOW_FILES_SYNC_API_PATH(id), undefined, { timeout: 120_000 });
        } catch {
            // Ignore — GraphQL list remains the source of truth for display.
        }
    }, []);

    // On first mount / flow switch: sync then refetch so UI shows latest HTML/MD.
    useEffect(() => {
        if (!flowId) {
            return;
        }
        if (syncedForFlowRef.current === flowId) {
            return;
        }
        syncedForFlowRef.current = flowId;
        void (async () => {
            await syncFromContainer(flowId);
            try {
                await refetch();
            } catch {
                // refetch errors surface via flowFilesError effect
            }
        })();
    }, [flowId, refetch, syncFromContainer]);

    useEffect(() => {
        if (flowFilesError) {
            toast.error('Failed to load files', {
                description: flowFilesError.message,
                id: FLOW_FILES_ERROR_TOAST_ID,
            });
        }
    }, [flowFilesError]);

    const fileNodes = useMemo<FileNode[]>(
        () => (flowFilesData?.flowFiles ?? []).map(toFileNode),
        [flowFilesData?.flowFiles],
    );

    const refetchFiles = useCallback(async () => {
        if (flowId) {
            await syncFromContainer(flowId);
        }
        return refetch();
    }, [flowId, refetch, syncFromContainer]);

    const isInitialLoading = isLoading && flowFilesData === undefined;

    return {
        fileNodes,
        isInitialLoading,
        isLoading,
        refetchFiles,
    };
}
