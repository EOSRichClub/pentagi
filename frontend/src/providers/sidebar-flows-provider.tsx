import { useMutation, useQuery } from '@apollo/client/react';
import { createContext, type ReactNode, useCallback, useContext, useMemo } from 'react';
import { toast } from 'sonner';

import type { FlowFragmentFragment } from '@/graphql/types';

import { DeleteFlowDocument, FlowsDocument, RenameFlowDocument, ResultType } from '@/graphql/types';
import { Log } from '@/lib/log';

export type Flow = FlowFragmentFragment;

interface SidebarFlowsContextValue {
    deleteFlow: (flow: Flow) => Promise<boolean>;
    flows: Array<Flow>;
    renameFlow: (flow: Flow, title: string) => Promise<boolean>;
}

const SidebarFlowsContext = createContext<SidebarFlowsContextValue | undefined>(undefined);

interface SidebarFlowsProviderProps {
    children: ReactNode;
}

export function SidebarFlowsProvider({ children }: SidebarFlowsProviderProps) {
    // Subscriptions are handled by FlowsProvider in FlowsLayout
    const { data: flowsData, refetch } = useQuery(FlowsDocument, {
        fetchPolicy: 'cache-first',
        nextFetchPolicy: 'cache-first',
    });
    const [deleteFlowMutation] = useMutation(DeleteFlowDocument);
    const [renameFlowMutation] = useMutation(RenameFlowDocument);

    const flows = useMemo(() => flowsData?.flows ?? [], [flowsData?.flows]);

    const renameFlow = useCallback(
        async (flow: Flow, title: string) => {
            const nextTitle = title.trim();

            if (!nextTitle) {
                toast.error('任务流名称不能为空');

                return false;
            }

            try {
                const { data } = await renameFlowMutation({ variables: { flowId: flow.id, title: nextTitle } });

                if (data?.renameFlow !== ResultType.Success) {
                    throw new Error('服务器未能完成重命名');
                }

                await refetch();
                toast.success('任务流已重命名');

                return true;
            } catch (error) {
                const message = error instanceof Error ? error.message : '重命名任务流失败';

                toast.error(message);
                Log.error('Error renaming sidebar flow:', error);

                return false;
            }
        },
        [refetch, renameFlowMutation],
    );

    const deleteFlow = useCallback(
        async (flow: Flow) => {
            try {
                const { data } = await deleteFlowMutation({ variables: { flowId: flow.id } });

                if (data?.deleteFlow !== ResultType.Success) {
                    throw new Error('服务器未能删除任务流');
                }

                await refetch();
                toast.success('任务流、容器和工作目录已删除');

                return true;
            } catch (error) {
                const message = error instanceof Error ? error.message : '删除任务流失败';

                toast.error(message);
                Log.error('Error deleting sidebar flow:', error);

                return false;
            }
        },
        [deleteFlowMutation, refetch],
    );

    const value = useMemo(
        () => ({
            deleteFlow,
            flows,
            renameFlow,
        }),
        [deleteFlow, flows, renameFlow],
    );

    return <SidebarFlowsContext.Provider value={value}>{children}</SidebarFlowsContext.Provider>;
}

export function useSidebarFlows() {
    const context = useContext(SidebarFlowsContext);

    if (context === undefined) {
        throw new Error('useSidebarFlows must be used within SidebarFlowsProvider');
    }

    return context;
}
