import { NetworkStatus } from '@apollo/client';
import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import type { FlowFormValues } from '@/features/flows/flow-form';
import type { FlowFragmentFragment, FlowsQuery } from '@/graphql/types';

import {
    useCreateAssistantMutation,
    useCreateFlowMutation,
    useDeleteFlowMutation,
    useFinishFlowMutation,
    useFlowCreatedSubscription,
    useFlowDeletedSubscription,
    useFlowsQuery,
    useFlowUpdatedSubscription,
} from '@/graphql/types';
import { Log } from '@/lib/log';

export type Flow = FlowFragmentFragment;

export type DeleteFlowOptions = {
    /** When true, also delete flow-{id}-data on disk and related artifacts */
    purgeFiles?: boolean;
};

interface FlowsContextValue {
    createFlow: (values: FlowFormValues) => Promise<null | string>;
    createFlowWithAssistant: (values: FlowFormValues) => Promise<null | string>;
    deleteFlow: (flow: Flow, options?: DeleteFlowOptions) => Promise<boolean>;
    finishFlow: (flow: Flow) => Promise<boolean>;
    flows: Array<Flow>;
    flowsData: FlowsQuery | undefined;
    flowsError: Error | undefined;
    isLoading: boolean;
}

const FlowsContext = createContext<FlowsContextValue | undefined>(undefined);

interface FlowsProviderProps {
    children: React.ReactNode;
}

export function FlowsProvider({ children }: FlowsProviderProps) {
    const {
        data: flowsData,
        error: flowsError,
        loading,
        networkStatus,
    } = useFlowsQuery({
        notifyOnNetworkStatusChange: true,
    });

    const isLoading = loading && networkStatus === NetworkStatus.loading;
    const flows = useMemo(() => flowsData?.flows ?? [], [flowsData?.flows]);

    useFlowCreatedSubscription();
    useFlowDeletedSubscription();
    useFlowUpdatedSubscription();

    useEffect(() => {
        if (flowsError) {
            toast.error('Error loading flows', {
                description: flowsError.message,
            });
            Log.error('Error loading flows:', flowsError);
        }
    }, [flowsError]);

    const [createFlowMutation] = useCreateFlowMutation();
    const [createAssistantMutation] = useCreateAssistantMutation();
    const [deleteFlowMutation] = useDeleteFlowMutation();
    const [finishFlowMutation] = useFinishFlowMutation();

    const createFlow = useCallback(
        async (values: FlowFormValues) => {
            const { message, providerName, resourceIds } = values;

            const input = message.trim();
            const modelProvider = providerName.trim();

            if (!input || !modelProvider) {
                return null;
            }

            try {
                const { data } = await createFlowMutation({
                    variables: {
                        input,
                        modelProvider,
                        resourceIds: resourceIds?.length ? resourceIds : undefined,
                    },
                });

                if (data?.createFlow?.id) {
                    return data.createFlow.id;
                }

                return null;
            } catch (error) {
                const description = error instanceof Error ? error.message : 'An error occurred while creating flow';
                toast.error('Failed to create flow', {
                    description,
                });
                Log.error('Error creating flow:', error);

                return null;
            }
        },
        [createFlowMutation],
    );

    const createFlowWithAssistant = useCallback(
        async (values: FlowFormValues) => {
            const { message, providerName, resourceIds, useAgents } = values;

            const input = message.trim();
            const modelProvider = providerName.trim();

            if (!input || !modelProvider) {
                return null;
            }

            try {
                const { data } = await createAssistantMutation({
                    variables: {
                        flowId: '0',
                        input,
                        modelProvider,
                        resourceIds: resourceIds?.length ? resourceIds : undefined,
                        useAgents,
                    },
                });

                if (data?.createAssistant?.flow?.id) {
                    return data.createAssistant.flow.id;
                }

                return null;
            } catch (error) {
                const description =
                    error instanceof Error ? error.message : 'An error occurred while creating assistant';
                toast.error('Failed to create assistant', {
                    description,
                });
                Log.error('Error creating assistant:', error);

                return null;
            }
        },
        [createAssistantMutation],
    );

    const deleteFlow = useCallback(
        async (flow: Flow, options?: DeleteFlowOptions) => {
            const { id: flowId, title } = flow;
            const purgeFiles = options?.purgeFiles === true;

            if (!flowId) {
                return false;
            }

            const flowDescription = `${title || '未命名'} (ID: ${flowId})`;
            const modeLabel = purgeFiles ? '彻底删除（含文件）' : '仅删除记录';

            const loadingToastId = toast.loading(`正在删除任务流…（${modeLabel}）`, {
                description: flowDescription,
            });

            try {
                if (purgeFiles) {
                    // REST DeleteFlow supports purgeFiles=1 (removes DB + flow-*-data).
                    const { api } = await import('@/lib/axios');
                    await api.delete(`/flows/${flowId}`, { params: { purgeFiles: true } });
                    // Apollo cache: remove via mutation side-channel if still present
                    try {
                        await deleteFlowMutation({ variables: { flowId } });
                    } catch {
                        /* record already deleted by REST */
                    }
                } else {
                    // GraphQL delete: UI/DB only; keeps disk data
                    await deleteFlowMutation({
                        variables: { flowId },
                    });
                }

                toast.success('任务流已删除', {
                    description: `${flowDescription} · ${modeLabel}`,
                    id: loadingToastId,
                });

                return true;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : '删除任务流失败';
                toast.error(errorMessage, {
                    description: flowDescription,
                    id: loadingToastId,
                });
                Log.error('Error deleting flow:', error);

                return false;
            }
        },
        [deleteFlowMutation],
    );

    const finishFlow = useCallback(
        async (flow: Flow) => {
            const { id: flowId, title } = flow;

            if (!flowId) {
                return false;
            }

            const flowDescription = `${title || 'Unknown'} (ID: ${flowId})`;

            const loadingToastId = toast.loading('Finishing flow...', {
                description: flowDescription,
            });

            try {
                await finishFlowMutation({
                    variables: { flowId },
                });

                toast.success('Flow finished successfully', {
                    description: flowDescription,
                    id: loadingToastId,
                });

                return true;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'An error occurred while finishing flow';
                toast.error(errorMessage, {
                    description: flowDescription,
                    id: loadingToastId,
                });
                Log.error('Error finishing flow:', error);

                return false;
            }
        },
        [finishFlowMutation],
    );

    const value = useMemo(
        () => ({
            createFlow,
            createFlowWithAssistant,
            deleteFlow,
            finishFlow,
            flows,
            flowsData,
            flowsError,
            isLoading,
        }),
        [createFlow, createFlowWithAssistant, deleteFlow, finishFlow, flows, flowsData, flowsError, isLoading],
    );

    return <FlowsContext.Provider value={value}>{children}</FlowsContext.Provider>;
}

export function useFlows() {
    const context = useContext(FlowsContext);

    if (context === undefined) {
        throw new Error('useFlows must be used within FlowsProvider');
    }

    return context;
}
