import type { ColumnDef, Row } from '@tanstack/react-table';

import { useMutation, useQuery } from '@apollo/client/react';
import { ChevronDown, Copy, Ellipsis, Pencil, Plug, Plus, Settings, Trash } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type { ProviderConfigFragmentFragment } from '@/graphql/types';
import type { ModelService } from '@/lib/model-services';

import { providerIcons } from '@/components/icons/provider-icon';
import { AppHeader, AppHeaderActions, AppHeaderContent, AppHeaderTitle } from '@/components/layouts/app/app-header';
import ConfirmationDialog from '@/components/shared/confirmation-dialog';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { DeleteProviderDocument, ProviderType, SettingsProvidersDocument } from '@/graphql/types';
import { useTableState } from '@/hooks/use-table-state';
import { loadModelServices } from '@/lib/model-services';
import { routes } from '@/lib/routes';
import { formatDate } from '@/lib/utils/format';
type Provider = ProviderConfigFragmentFragment;

// Exhaustive Record so a newly-added ProviderType is a compile error here, not a
// provider silently missing from the create-provider menu.
const providerLabels: Record<ProviderType, string> = {
    [ProviderType.Anthropic]: 'Anthropic',
    [ProviderType.Bedrock]: 'Bedrock',
    [ProviderType.Custom]: 'Custom',
    [ProviderType.Deepseek]: 'DeepSeek',
    [ProviderType.Gemini]: 'Gemini',
    [ProviderType.Glm]: 'GLM',
    [ProviderType.Kimi]: 'Kimi',
    [ProviderType.Minimax]: 'MiniMax',
    [ProviderType.Ollama]: 'Ollama',
    [ProviderType.Openai]: 'OpenAI',
    [ProviderType.Qwen]: 'Qwen',
};

const providerTypes = (Object.keys(providerLabels) as ProviderType[]).map((type) => ({
    label: providerLabels[type],
    type,
}));

export function SettingsProvidersHeader({ services = [] }: { services?: ModelService[] }) {
    const navigate = useNavigate();

    const availableServices = services.filter((service) => service.credentials.some((item) => item.enabled));

    const handleProviderCreate = (service: ModelService) => {
        navigate(
            routes.settings.newProvider({
                serviceId: service.id.toString(),
                type: service.providerType,
            }),
        );
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    aria-label="添加模型提供商"
                    className="w-8 shrink-0 px-0 md:w-auto md:px-3"
                    size="sm"
                    variant="secondary"
                >
                    <Plus />
                    <span className="hidden md:inline">添加模型提供商</span>
                    <ChevronDown className="hidden size-4 md:inline-flex" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {availableServices.length === 0 ? (
                    <DropdownMenuItem onClick={() => navigate(routes.settings.modelApiKeys)}>
                        请先添加模型 API 密钥
                    </DropdownMenuItem>
                ) : (
                    availableServices.map((service) => {
                        const Icon = providerIcons[service.providerType]?.icon;

                        return (
                            <DropdownMenuItem
                                key={service.id}
                                onClick={() => handleProviderCreate(service)}
                            >
                                {Icon && <Icon />}
                                <span>{service.name}</span>
                                <span className="text-muted-foreground text-xs">
                                    {providerLabels[service.providerType]}
                                </span>
                            </DropdownMenuItem>
                        );
                    })
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function SettingsProviders() {
    const { data, error, loading: isLoading, refetch } = useQuery(SettingsProvidersDocument);
    const [deleteProvider, { loading: isDeleteLoading }] = useMutation(DeleteProviderDocument);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deletingProvider, setDeletingProvider] = useState<null | Provider>(null);
    const [services, setServices] = useState<ModelService[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        void loadModelServices()
            .then(setServices)
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : '加载模型服务和密钥失败'));
    }, []);

    const { filter, pageIndex: currentPage, setFilter, setPage: handlePageChange } = useTableState();

    const handleProviderDelete = useCallback(
        async (providerId: string | undefined) => {
            if (!providerId) {
                return;
            }

            try {
                await deleteProvider({
                    refetchQueries: ['settingsProviders'],
                    variables: { providerId: providerId.toString() },
                });

                setDeletingProvider(null);
            } catch (error) {
                toast.error('Failed to delete provider', {
                    description: error instanceof Error ? error.message : undefined,
                });
            }
        },
        [deleteProvider],
    );

    const handleProviderEdit = useCallback(
        (providerId: string) => {
            navigate(routes.settings.provider(providerId));
        },
        [navigate],
    );

    const handleProviderClone = useCallback(
        (providerId: string) => {
            navigate(routes.settings.newProvider({ id: providerId }));
        },
        [navigate],
    );

    const handleProviderDeleteDialogOpen = useCallback((provider: Provider) => {
        setDeletingProvider(provider);
        setIsDeleteDialogOpen(true);
    }, []);

    const columns: ColumnDef<Provider>[] = useMemo(
        () => [
            {
                accessorKey: 'name',
                cell: ({ row }) => <div className="truncate font-medium">{row.getValue('name')}</div>,
                enableHiding: false,
                header: ({ column }) => (
                    <DataTableColumnHeader
                        column={column}
                        title="Name"
                    />
                ),
                // Name flexes to fill remaining width — fixed `size` would push
                // the Type column off-screen on narrow viewports (e.g. 375px).
                meta: { searchable: true },
            },
            {
                accessorKey: 'type',
                cell: ({ row }) => {
                    const providerType = row.getValue('type') as ProviderType;
                    const Icon = providerIcons[providerType]?.icon;
                    const label = providerTypes.find((p) => p.type === providerType)?.label || providerType;

                    return (
                        <Badge
                            className="max-w-full whitespace-nowrap"
                            variant="outline"
                        >
                            {Icon && <Icon className="mr-1 size-3 shrink-0" />}
                            <span className="truncate">{label}</span>
                        </Badge>
                    );
                },
                header: ({ column }) => (
                    <DataTableColumnHeader
                        column={column}
                        title="Type"
                    />
                ),
                meta: { searchable: true },
                minSize: 110,
                size: 160,
            },
            {
                accessorFn: (provider) => {
                    const serviceId = provider.agents?.modelServiceId;
                    const credentialId = provider.agents?.modelCredentialId;
                    const service = services.find((item) => item.id.toString() === serviceId?.toString());
                    const credential = service?.credentials.find(
                        (item) => item.id.toString() === credentialId?.toString(),
                    );

                    return service ? `${service.name} / ${credential?.name ?? '未选择密钥'}` : '旧版环境变量配置';
                },
                cell: ({ getValue }) => <div className="max-w-64 truncate text-sm">{getValue<string>()}</div>,
                header: ({ column }) => (
                    <DataTableColumnHeader
                        column={column}
                        title="模型服务 / 密钥"
                    />
                ),
                id: 'binding',
                meta: { searchable: true },
                minSize: 160,
                size: 240,
            },
            {
                accessorKey: 'createdAt',
                cell: ({ row }) => {
                    const dateString = row.getValue('createdAt') as string;

                    return <div className="text-sm">{formatDate(new Date(dateString))}</div>;
                },
                header: ({ column }) => (
                    <DataTableColumnHeader
                        column={column}
                        title="Created"
                    />
                ),
                meta: { columnMenuLabel: 'Created' },
                size: 120,
                sortingFn: (rowA, rowB) => {
                    const dateA = new Date(rowA.getValue('createdAt') as string);
                    const dateB = new Date(rowB.getValue('createdAt') as string);

                    return dateA.getTime() - dateB.getTime();
                },
            },
            {
                accessorKey: 'updatedAt',
                cell: ({ row }) => {
                    const dateString = row.getValue('updatedAt') as string;

                    return <div className="text-sm">{formatDate(new Date(dateString))}</div>;
                },
                header: ({ column }) => (
                    <DataTableColumnHeader
                        column={column}
                        title="Updated"
                    />
                ),
                size: 120,
                sortingFn: (rowA, rowB) => {
                    const dateA = new Date(rowA.getValue('updatedAt') as string);
                    const dateB = new Date(rowB.getValue('updatedAt') as string);

                    return dateA.getTime() - dateB.getTime();
                },
            },
            {
                cell: ({ row }) => {
                    const provider = row.original;

                    return (
                        <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        aria-label="Open menu"
                                        className="size-8 p-0"
                                        variant="ghost"
                                    >
                                        <Ellipsis />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="min-w-24"
                                >
                                    <DropdownMenuItem onClick={() => handleProviderEdit(provider.id)}>
                                        <Pencil className="size-3" />
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleProviderClone(provider.id)}>
                                        <Copy />
                                        Clone
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        disabled={isDeleteLoading && deletingProvider?.id === provider.id}
                                        onClick={() => handleProviderDeleteDialogOpen(provider)}
                                    >
                                        {isDeleteLoading && deletingProvider?.id === provider.id ? (
                                            <>
                                                <Spinner variant="circle" />
                                                Deleting...
                                            </>
                                        ) : (
                                            <>
                                                <Trash />
                                                Delete
                                            </>
                                        )}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    );
                },
                enableHiding: false,
                header: () => null,
                id: 'actions',
                meta: { preventRowClick: true },
                size: 48,
            },
        ],
        [
            handleProviderClone,
            handleProviderDeleteDialogOpen,
            handleProviderEdit,
            isDeleteLoading,
            deletingProvider,
            services,
        ],
    );

    const renderSubComponent = ({ row }: { row: Row<Provider> }) => {
        const provider = row.original;
        const { agents } = provider;

        if (!agents) {
            return <div className="text-muted-foreground p-4 text-sm">No agent configuration available</div>;
        }

        const getName = (key: string): string =>
            key.replaceAll(/([A-Z])/g, ' $1').replace(/^./, (item) => item.toUpperCase());

        const getFields = (obj: unknown, prefix = ''): { label: string; value: boolean | number | string }[] => {
            if (!obj || typeof obj !== 'object') {
                return [];
            }

            return Object.entries(obj as Record<string, unknown>)
                .filter(([key, value]) => key !== '__typename' && !!value)
                .flatMap(([key, value]) => {
                    const rawLabel = `${prefix ? `${prefix} ` : ''}${getName(key)}`;
                    const localizedLabels: Record<string, string> = {
                        Json: 'JSON',
                        'Price Cache Read': '缓存读取价格',
                        'Price Cache Write': '缓存写入价格',
                        'Price Input': '输入价格',
                        'Price Output': '输出价格',
                    };
                    const label = localizedLabels[rawLabel] ?? rawLabel;

                    return typeof value === 'object'
                        ? getFields(value, label)
                        : [{ label, value: value as boolean | number | string }];
                });
        };

        const agentTypes = Object.entries(agents)
            .filter(([key]) => key !== '__typename')
            .map(([key, data]) => ({
                data,
                key,
                name: getName(key),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        return (
            <div className="bg-muted/20 border-t p-4">
                <h4 className="font-medium">Agent Configurations</h4>
                <hr className="border-muted-foreground/20 my-4" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                    {agentTypes.map(({ data, key, name }) => {
                        const fields = data ? getFields(data) : [];

                        return (
                            <div
                                className="flex flex-col gap-2"
                                key={key}
                            >
                                <div className="text-sm font-medium">{name}</div>
                                {fields.length > 0 ? (
                                    <div className="flex flex-col gap-1 text-sm">
                                        {fields.map(({ label, value }) => (
                                            <div key={label}>
                                                <span className="text-muted-foreground">{label}:</span> {value}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-muted-foreground text-sm">No configuration available</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderRowContextMenu = useCallback(
        (provider: Provider) => (
            <>
                <ContextMenuItem onClick={() => handleProviderEdit(provider.id)}>
                    <Pencil />
                    Edit
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleProviderClone(provider.id)}>
                    <Copy />
                    Clone
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                    disabled={isDeleteLoading && deletingProvider?.id === provider.id}
                    onClick={() => handleProviderDeleteDialogOpen(provider)}
                >
                    <Trash />
                    {isDeleteLoading && deletingProvider?.id === provider.id ? 'Deleting...' : 'Delete'}
                </ContextMenuItem>
            </>
        ),
        [deletingProvider, handleProviderClone, handleProviderDeleteDialogOpen, handleProviderEdit, isDeleteLoading],
    );

    const pageHeader = (
        <AppHeader>
            <AppHeaderContent>
                <AppHeaderTitle icon={<Plug className="size-4 shrink-0" />}>Providers</AppHeaderTitle>
            </AppHeaderContent>
            <AppHeaderActions>
                <SettingsProvidersHeader services={services} />
            </AppHeaderActions>
        </AppHeader>
    );

    if (isLoading && !data) {
        return (
            <>
                {pageHeader}
                <div className="flex flex-1 flex-col gap-4 p-4">
                    <LoadingState
                        description="Please wait while we fetch your provider configurations"
                        title="Loading providers..."
                    />
                </div>
            </>
        );
    }

    // Error surface only when there's no data — a failed background refetch must not blank a working list.
    if (error && !data) {
        return (
            <>
                {pageHeader}
                <div className="flex flex-1 flex-col gap-4 p-4">
                    <ErrorState
                        message={error.message}
                        onRetry={refetch}
                        title="Error loading providers"
                    />
                </div>
            </>
        );
    }

    const providers = data?.settingsProviders?.userDefined || [];

    if (providers.length === 0) {
        return (
            <>
                {pageHeader}
                <div className="flex flex-1 flex-col gap-4 p-4">
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <Settings />
                            </EmptyMedia>
                            <EmptyTitle>No providers configured</EmptyTitle>
                            <EmptyDescription>
                                Get started by adding your first language model provider
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button
                                onClick={() => navigate(routes.settings.newProvider())}
                                variant="secondary"
                            >
                                <Plus />
                                Add Provider
                            </Button>
                        </EmptyContent>
                    </Empty>
                </div>
            </>
        );
    }

    return (
        <>
            {pageHeader}
            <div className="flex flex-1 flex-col gap-4 p-4">
                <DataTable<Provider>
                    columns={columns}
                    data={providers}
                    empty={{ entityName: 'providers' }}
                    filterPlaceholder="Filter providers..."
                    filterValue={filter}
                    onFilterChange={setFilter}
                    onPageChange={handlePageChange}
                    pageIndex={currentPage}
                    renderRowContextMenu={renderRowContextMenu}
                    renderSubComponent={renderSubComponent}
                />

                <ConfirmationDialog
                    cancelText="Cancel"
                    confirmText="Delete"
                    handleConfirm={() => handleProviderDelete(deletingProvider?.id)}
                    handleOpenChange={setIsDeleteDialogOpen}
                    isOpen={isDeleteDialogOpen}
                    itemName={deletingProvider?.name}
                    itemType="provider"
                />
            </div>
        </>
    );
}

export default SettingsProviders;
