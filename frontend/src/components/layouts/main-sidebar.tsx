import { Avatar, AvatarFallback } from '@radix-ui/react-avatar';
import {
    ChevronsUpDown,
    GitFork,
    KeyRound,
    LayoutDashboard,
    LibraryBig,
    Loader2,
    LogOut,
    Monitor,
    Moon,
    MoreHorizontal,
    Pencil,
    Plus,
    Settings,
    Settings2,
    Star,
    Sun,
    Trash,
    UserIcon,
    FileText,
    Folder,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useMatch, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import type { Flow } from '@/providers/sidebar-flows-provider';
import type { Theme } from '@/providers/theme-provider';

import Logo from '@/components/icons/logo';
import { FlowStatusIcon } from '@/components/icons/flow-status-icon';
import ConfirmationDialog from '@/components/shared/confirmation-dialog';
import { InlineEditInput } from '@/components/shared/inline-edit';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PasswordChangeForm } from '@/features/authentication/password-change-form';
import { useResourcesUpload } from '@/features/resources/use-resources-upload';
import { ResultType, useDeleteFlowMutation, useRenameFlowMutation } from '@/graphql/types';
import { useTheme } from '@/hooks/use-theme';
import { useFavorites } from '@/providers/favorites-provider';
import { useSidebarFlows } from '@/providers/sidebar-flows-provider';
import { useUser } from '@/providers/user-provider';

interface FlowMenuItemProps {
    activeFlowId: null | number;
    flow: Flow;
    isDeleting: boolean;
    isEditing: boolean;
    isFavorite: boolean;
    isRenameBusy: boolean;
    onDeleteRequest: (flow: Flow) => void;
    onRenameCancel: () => void;
    onRenameSave: (flowId: string, title: string) => void;
    onRenameStart: (flow: Flow) => void;
    onToggleFavorite: (flowId: string) => void;
    renameInputRef: React.RefObject<HTMLInputElement | null>;
}

export function MainSidebar() {
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [editingFlowId, setEditingFlowId] = useState<null | string>(null);
    const [deletingFlow, setDeletingFlow] = useState<Flow | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const renameInputRef = useRef<HTMLInputElement | null>(null);
    const [renameFlowMutation, { loading: isRenameLoading }] = useRenameFlowMutation();
    const [deleteFlowMutation] = useDeleteFlowMutation();
    const navigate = useNavigate();

    const isDashboardActive = useMatch('/dashboard');
    const isFlowsActive = useMatch('/flows/*');
    const isTemplatesActive = useMatch('/templates/*');
    const isKnowledgesActive = useMatch('/knowledges/*');
    const isResourcesActive = useMatch('/resources/*');
    const isSettingsActive = useMatch('/settings/*');
    const { flowId: flowIdParam } = useParams<{ flowId: string }>();

    const { authInfo, logout } = useUser();
    const user = authInfo?.user;
    const { setTheme, theme } = useTheme();
    const { addFavoriteFlow, favoriteFlowIds, removeFavoriteFlow } = useFavorites();
    const { flows } = useSidebarFlows();

    const resourcesUpload = useResourcesUpload();

    const flowId = useMemo(() => (flowIdParam ? Number(flowIdParam) : null), [flowIdParam]);

    // All flows, newest first — no longer capped at 5 "recent".
    const allFlows = useMemo(
        () => [...flows].sort((a, b) => Number(b.id) - Number(a.id)),
        [flows],
    );

    const favoriteFlows = useMemo(
        () =>
            allFlows.filter((flow) => favoriteFlowIds.includes(Number(flow.id))),
        [allFlows, favoriteFlowIds],
    );

    const nonFavoriteFlows = useMemo(
        () => allFlows.filter((flow) => !favoriteFlowIds.includes(Number(flow.id))),
        [allFlows, favoriteFlowIds],
    );

    const handleRenameStart = useCallback((flow: Flow) => {
        setEditingFlowId(flow.id);
    }, []);

    const handleRenameCancel = useCallback(() => {
        setEditingFlowId(null);
    }, []);

    const handleRenameSave = useCallback(
        async (targetFlowId: string, rawTitle: string) => {
            const title = rawTitle.trim();

            if (!title) {
                toast.error('Title cannot be empty');

                return;
            }

            try {
                const { data } = await renameFlowMutation({
                    refetchQueries: ['flows'],
                    variables: {
                        flowId: targetFlowId,
                        title,
                    },
                });

                if (data?.renameFlow === ResultType.Success) {
                    toast.success('Flow renamed');
                    setEditingFlowId(null);
                } else {
                    toast.error('Failed to rename flow');
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to rename flow';

                toast.error(message);
            }
        },
        [renameFlowMutation],
    );

    const handleToggleFavorite = useCallback(
        (id: string) => {
            if (favoriteFlowIds.includes(Number(id))) {
                removeFavoriteFlow(id);
            } else {
                addFavoriteFlow(id);
            }
        },
        [addFavoriteFlow, favoriteFlowIds, removeFavoriteFlow],
    );

    const handleDeleteRequest = useCallback((flow: Flow) => {
        setDeletingFlow(flow);
        setIsDeleteDialogOpen(true);
    }, []);

    const handleDeleteConfirm = useCallback(async () => {
        if (!deletingFlow) {
            return;
        }

        const target = deletingFlow;
        const description = `${target.title || 'Unknown'} (ID: ${target.id})`;

        setIsDeleting(true);

        try {
            const { data } = await deleteFlowMutation({
                refetchQueries: ['flows'],
                variables: { flowId: target.id },
            });

            if (data?.deleteFlow === ResultType.Success || data?.deleteFlow) {
                // Best-effort: some builds return ResultType, others may only succeed without errors.
                if (favoriteFlowIds.includes(Number(target.id))) {
                    removeFavoriteFlow(target.id);
                }

                toast.success('Flow deleted', { description });
                setIsDeleteDialogOpen(false);
                setDeletingFlow(null);

                // If the user is currently viewing this flow, leave the detail page.
                if (flowIdParam && String(flowIdParam) === String(target.id)) {
                    navigate('/flows');
                }
            } else {
                toast.error('Failed to delete flow', { description });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete flow';

            toast.error(message, { description });
        } finally {
            setIsDeleting(false);
        }
    }, [deleteFlowMutation, deletingFlow, favoriteFlowIds, flowIdParam, navigate, removeFavoriteFlow]);

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem className="flex items-center gap-2">
                        <div className="flex aspect-square size-8 items-center justify-center">
                            <Logo className="hover:animate-logo-spin size-6" />
                        </div>
                        <div className="grid flex-1 text-left leading-tight">
                            <span className="truncate font-semibold">PentAGI</span>
                        </div>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup className="bg-sidebar sticky top-0 z-10">
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem className="group-data-[state=expanded]:hidden">
                                <SidebarMenuButton asChild>
                                    <Link to="/flows/new">
                                        <Plus />
                                        New Flow
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={!!isDashboardActive}
                                >
                                    <Link to="/dashboard">
                                        <LayoutDashboard />
                                        Dashboard
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={!!isFlowsActive}
                                >
                                    <Link to="/flows">
                                        <GitFork />
                                        Flows
                                    </Link>
                                </SidebarMenuButton>
                                <SidebarMenuAction
                                    asChild
                                    className="data-[state=open]:bg-accent rounded-sm"
                                    showOnHover
                                >
                                    <Link to="/flows/new">
                                        <Plus />
                                    </Link>
                                </SidebarMenuAction>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={!!isTemplatesActive}
                                >
                                    <Link to="/templates">
                                        <FileText />
                                        Templates
                                    </Link>
                                </SidebarMenuButton>
                                <SidebarMenuAction
                                    asChild
                                    className="data-[state=open]:bg-accent rounded-sm"
                                    showOnHover
                                >
                                    <Link to="/templates/new">
                                        <Plus />
                                    </Link>
                                </SidebarMenuAction>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={!!isResourcesActive}
                                >
                                    <Link to="/resources">
                                        <Folder />
                                        Resources
                                    </Link>
                                </SidebarMenuButton>
                                <SidebarMenuAction
                                    className="data-[state=open]:bg-accent rounded-sm"
                                    onClick={resourcesUpload.openFilePicker}
                                    showOnHover
                                    title="Upload file"
                                    type="button"
                                >
                                    <Plus />
                                </SidebarMenuAction>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={!!isKnowledgesActive}
                                >
                                    <Link to="/knowledges">
                                        <LibraryBig />
                                        Knowledges
                                    </Link>
                                </SidebarMenuButton>
                                <SidebarMenuAction
                                    asChild
                                    className="data-[state=open]:bg-accent rounded-sm"
                                    showOnHover
                                >
                                    <Link to="/knowledges/new">
                                        <Plus />
                                    </Link>
                                </SidebarMenuAction>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {favoriteFlows.length > 0 && (
                    <SidebarGroup>
                        <SidebarGroupLabel className="flex items-center gap-2">
                            <Star />
                            Favorites
                            <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                                {favoriteFlows.length}
                            </span>
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {favoriteFlows.map((flow) => (
                                    <FlowMenuItem
                                        activeFlowId={flowId}
                                        flow={flow}
                                        isDeleting={isDeleting && deletingFlow?.id === flow.id}
                                        isEditing={editingFlowId === flow.id}
                                        isFavorite
                                        isRenameBusy={isRenameLoading && editingFlowId === flow.id}
                                        key={flow.id}
                                        onDeleteRequest={handleDeleteRequest}
                                        onRenameCancel={handleRenameCancel}
                                        onRenameSave={handleRenameSave}
                                        onRenameStart={handleRenameStart}
                                        onToggleFavorite={handleToggleFavorite}
                                        renameInputRef={renameInputRef}
                                    />
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                <SidebarGroup className="flex min-h-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
                    <SidebarGroupLabel className="flex items-center gap-2">
                        <GitFork />
                        All Flows
                        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                            {allFlows.length}
                        </span>
                    </SidebarGroupLabel>
                    <SidebarGroupContent className="min-h-0 flex-1 overflow-y-auto">
                        <SidebarMenu>
                            {allFlows.length === 0 && (
                                <SidebarMenuItem>
                                    <span className="text-muted-foreground px-2 text-xs">No flows yet</span>
                                </SidebarMenuItem>
                            )}
                            {/* Favorites already listed above; still show them here so the full list is complete.
                                To avoid duplicates we only render non-favorites when favorites section exists,
                                otherwise render everything. */}
                            {(favoriteFlows.length > 0 ? nonFavoriteFlows : allFlows).map((flow) => (
                                <FlowMenuItem
                                    activeFlowId={flowId}
                                    flow={flow}
                                    isDeleting={isDeleting && deletingFlow?.id === flow.id}
                                    isEditing={editingFlowId === flow.id}
                                    isFavorite={favoriteFlowIds.includes(Number(flow.id))}
                                    isRenameBusy={isRenameLoading && editingFlowId === flow.id}
                                    key={flow.id}
                                    onDeleteRequest={handleDeleteRequest}
                                    onRenameCancel={handleRenameCancel}
                                    onRenameSave={handleRenameSave}
                                    onRenameStart={handleRenameStart}
                                    onToggleFavorite={handleToggleFavorite}
                                    renameInputRef={renameInputRef}
                                />
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            isActive={!!isSettingsActive}
                        >
                            <Link to="/settings">
                                <Settings />
                                Settings
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton
                                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                    size="lg"
                                >
                                    <Avatar className="bg-background dark:bg-muted size-8 rounded-lg">
                                        <AvatarFallback className="flex size-8 items-center justify-center">
                                            <UserIcon className="size-4" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-semibold">{user?.name}</span>
                                        <span className="truncate text-xs">{user?.mail}</span>
                                    </div>
                                    <ChevronsUpDown className="ml-auto size-4" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                                side="bottom"
                                sideOffset={4}
                            >
                                <DropdownMenuLabel className="p-0 font-normal">
                                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                        <Avatar className="bg-muted flex size-8 items-center justify-center rounded-lg">
                                            <AvatarFallback className="flex items-center justify-center rounded-lg">
                                                <UserIcon className="size-4" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="grid flex-1 text-left text-sm leading-tight">
                                            <span className="truncate font-semibold">{user?.name}</span>
                                            <span className="truncate text-xs">{user?.mail}</span>
                                            <span className="text-muted-foreground truncate text-xs">
                                                {user?.type === 'local' ? 'local' : 'oauth'}
                                            </span>
                                        </div>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="cursor-default hover:bg-transparent focus:bg-transparent"
                                    onSelect={(event) => event.preventDefault()}
                                >
                                    <Settings2 />
                                    Theme
                                    <Tabs
                                        className="-my-1.5 -mr-2 ml-auto"
                                        onValueChange={(value) => setTheme(value as Theme)}
                                        value={theme || 'system'}
                                    >
                                        <TabsList className="h-7 p-0.5">
                                            <TabsTrigger
                                                aria-label="System theme"
                                                className="h-6 px-2"
                                                value="system"
                                            >
                                                <Monitor className="size-4" />
                                            </TabsTrigger>
                                            <TabsTrigger
                                                aria-label="Light theme"
                                                className="h-6 px-2"
                                                value="light"
                                            >
                                                <Sun className="size-4" />
                                            </TabsTrigger>
                                            <TabsTrigger
                                                aria-label="Dark theme"
                                                className="h-6 px-2"
                                                value="dark"
                                            >
                                                <Moon className="size-4" />
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </DropdownMenuItem>
                                {user?.type === 'local' && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setIsPasswordModalOpen(true)}>
                                            <KeyRound className="mr-2 size-4" />
                                            Change Password
                                        </DropdownMenuItem>
                                    </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => logout()}>
                                    <LogOut className="mr-2 size-4" />
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />

            <input
                aria-hidden="true"
                className="hidden"
                key={resourcesUpload.fileInputKey}
                multiple
                name="resource-upload"
                tabIndex={-1}
                type="file"
                {...resourcesUpload.fileInputProps}
            />

            <Dialog
                onOpenChange={setIsPasswordModalOpen}
                open={isPasswordModalOpen}
            >
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                    </DialogHeader>
                    <PasswordChangeForm
                        onCancel={() => setIsPasswordModalOpen(false)}
                        onSuccess={() => setIsPasswordModalOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            <ConfirmationDialog
                cancelText="Cancel"
                confirmText={isDeleting ? 'Deleting…' : 'Delete'}
                description={
                    deletingFlow
                        ? `Delete flow #${deletingFlow.id} “${deletingFlow.title}”? This cannot be undone.`
                        : 'Delete this flow? This cannot be undone.'
                }
                handleConfirm={() => {
                    void handleDeleteConfirm();
                }}
                handleOpenChange={(open) => {
                    if (isDeleting) {
                        return;
                    }

                    setIsDeleteDialogOpen(open);

                    if (!open) {
                        setDeletingFlow(null);
                    }
                }}
                isOpen={isDeleteDialogOpen}
                title="Delete flow"
            />
        </Sidebar>
    );
}

function FlowMenuItem({
    activeFlowId,
    flow,
    isDeleting,
    isEditing,
    isFavorite,
    isRenameBusy,
    onDeleteRequest,
    onRenameCancel,
    onRenameSave,
    onRenameStart,
    onToggleFavorite,
    renameInputRef,
}: FlowMenuItemProps) {
    if (isEditing) {
        return (
            <SidebarMenuItem>
                <div className="w-full px-1 py-0.5">
                    <InlineEditInput
                        autoFocus
                        busy={isRenameBusy}
                        defaultValue={flow.title}
                        inputRef={renameInputRef}
                        onCancel={onRenameCancel}
                        onSave={() => {
                            const value = renameInputRef.current?.value ?? '';

                            void onRenameSave(flow.id, value);
                        }}
                        placeholder="Flow title"
                    />
                </div>
            </SidebarMenuItem>
        );
    }

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                isActive={activeFlowId === Number(flow.id)}
                title={`${flow.id}. ${flow.title}`}
            >
                <Link to={`/flows/${flow.id}`}>
                    <span className="-mx-2 w-8 shrink-0 text-center text-xs group-data-[state=expanded]:hidden">
                        {flow.id}
                    </span>
                    <span className="text-muted-foreground bg-background dark:bg-muted -my-0.5 -ml-0.5 h-5 min-w-5 shrink-0 rounded-md px-px py-0.5 text-center text-xs group-data-[state=collapsed]:hidden">
                        {flow.id}
                    </span>
                    <FlowStatusIcon
                        className="size-3.5 shrink-0 group-data-[state=collapsed]:hidden"
                        status={flow.status}
                    />
                    <span className="truncate">{flow.title}</span>
                </Link>
            </SidebarMenuButton>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <SidebarMenuAction
                        aria-label="Flow actions"
                        className="data-[state=open]:bg-accent rounded-sm"
                        showOnHover
                    >
                        {isDeleting ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
                    </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    side="right"
                    sideOffset={4}
                >
                    <DropdownMenuItem onClick={() => onRenameStart(flow)}>
                        <Pencil className="mr-2 size-4" />
                        Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggleFavorite(flow.id)}>
                        <Star
                            className={
                                isFavorite
                                    ? 'mr-2 size-4 fill-yellow-500 stroke-yellow-500'
                                    : 'mr-2 size-4'
                            }
                        />
                        {isFavorite ? 'Unfavorite' : 'Favorite'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        disabled={isDeleting}
                        onClick={() => onDeleteRequest(flow)}
                    >
                        <Trash className="mr-2 size-4" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </SidebarMenuItem>
    );
}
