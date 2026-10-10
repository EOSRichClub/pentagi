import { Avatar, AvatarFallback } from '@radix-ui/react-avatar';
import {
    ChevronsUpDown,
    Clock,
    Ellipsis,
    FileText,
    Folder,
    GitFork,
    LayoutDashboard,
    LibraryBig,
    LogOut,
    Monitor,
    Moon,
    PencilLine,
    Plus,
    Settings,
    Settings2,
    Star,
    Sun,
    Trash,
    UserIcon,
} from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { Link, useLocation, useMatch, useNavigate, useParams } from 'react-router-dom';

import type { Flow } from '@/providers/sidebar-flows-provider';
import type { Theme } from '@/providers/theme-provider';

import Logo from '@/components/icons/logo';
import ConfirmationDialog from '@/components/shared/confirmation-dialog';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useResourcesUpload } from '@/features/resources/use-resources-upload';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/lib/routes';
import { useFavorites } from '@/providers/favorites-provider';
import { useSidebarFlows } from '@/providers/sidebar-flows-provider';
import { useUser } from '@/providers/user-provider';

interface FlowMenuItemProps {
    activeFlowId: null | number;
    flow: Flow;
    isFavorite: boolean;
    onDelete: (flow: Flow) => void;
    onRename: (flow: Flow) => void;
    onToggleFavorite: (flowId: string) => void;
}

export function MainSidebar() {
    const navigate = useNavigate();
    const location = useLocation();
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
    const { deleteFlow, flows, renameFlow } = useSidebarFlows();
    const [renamingFlow, setRenamingFlow] = useState<Flow | null>(null);
    const [renameTitle, setRenameTitle] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    const [deletingFlow, setDeletingFlow] = useState<Flow | null>(null);

    const resourcesUpload = useResourcesUpload();

    const flowId = useMemo(() => (flowIdParam ? Number(flowIdParam) : null), [flowIdParam]);

    const handleRenameOpen = (flow: Flow) => {
        setRenamingFlow(flow);
        setRenameTitle(flow.title);
    };

    const handleRenameSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!renamingFlow || !renameTitle.trim() || isRenaming) {
            return;
        }

        setIsRenaming(true);

        try {
            if (await renameFlow(renamingFlow, renameTitle)) {
                setRenamingFlow(null);
            }
        } finally {
            setIsRenaming(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deletingFlow) {
            return;
        }

        const deletedFlowId = Number(deletingFlow.id);
        const deleted = await deleteFlow(deletingFlow);

        if (deleted) {
            removeFavoriteFlow(deletingFlow.id);
            setDeletingFlow(null);

            if (flowId === deletedFlowId) {
                navigate(routes.flows);
            }
        }
    };

    const favoriteFlows = useMemo(
        () =>
            flows
                .filter((flow) => favoriteFlowIds.includes(Number(flow.id)))
                .sort((a, b) => Number(b.id) - Number(a.id)),
        [flows, favoriteFlowIds],
    );

    const recentFlows = useMemo(
        () =>
            flows
                .filter((flow) => !favoriteFlowIds.includes(Number(flow.id)))
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 5),
        [flows, favoriteFlowIds],
    );

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
                                    <Link to={routes.newFlow}>
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
                                    <Link to={routes.dashboard}>
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
                                    <Link to={routes.flows}>
                                        <GitFork />
                                        <span>所有任务流</span>
                                        <span className="text-muted-foreground ml-auto text-xs group-data-[state=collapsed]:hidden">
                                            {flows.length}
                                        </span>
                                    </Link>
                                </SidebarMenuButton>
                                <SidebarMenuAction
                                    asChild
                                    className="data-[state=open]:bg-accent rounded-sm"
                                    showOnHover
                                >
                                    <Link
                                        aria-label="New flow"
                                        to={routes.newFlow}
                                    >
                                        <Plus />
                                    </Link>
                                </SidebarMenuAction>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={!!isTemplatesActive}
                                >
                                    <Link to={routes.templates}>
                                        <FileText />
                                        Templates
                                    </Link>
                                </SidebarMenuButton>
                                <SidebarMenuAction
                                    asChild
                                    className="data-[state=open]:bg-accent rounded-sm"
                                    showOnHover
                                >
                                    <Link
                                        aria-label="New template"
                                        to={routes.newTemplate}
                                    >
                                        <Plus />
                                    </Link>
                                </SidebarMenuAction>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={!!isResourcesActive}
                                >
                                    <Link to={routes.resources}>
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
                                    <Link to={routes.knowledges}>
                                        <LibraryBig />
                                        Knowledges
                                    </Link>
                                </SidebarMenuButton>
                                <SidebarMenuAction
                                    asChild
                                    className="data-[state=open]:bg-accent rounded-sm"
                                    showOnHover
                                >
                                    <Link
                                        aria-label="New knowledge"
                                        to={routes.newKnowledge}
                                    >
                                        <Plus />
                                    </Link>
                                </SidebarMenuAction>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {recentFlows.length > 0 && (
                    <SidebarGroup>
                        <SidebarGroupLabel className="flex items-center gap-2">
                            <Clock />
                            最近任务流
                            <Link
                                className="text-muted-foreground hover:text-foreground ml-auto text-xs"
                                to={routes.flows}
                            >
                                查看全部
                            </Link>
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {recentFlows.map((flow) => (
                                    <FlowMenuItem
                                        activeFlowId={flowId}
                                        flow={flow}
                                        isFavorite={false}
                                        key={flow.id}
                                        onDelete={setDeletingFlow}
                                        onRename={handleRenameOpen}
                                        onToggleFavorite={addFavoriteFlow}
                                    />
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                {favoriteFlows.length > 0 && (
                    <SidebarGroup>
                        <SidebarGroupLabel className="flex items-center gap-2">
                            <Star />
                            Favorite Flows
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {favoriteFlows.map((flow) => (
                                    <FlowMenuItem
                                        activeFlowId={flowId}
                                        flow={flow}
                                        isFavorite
                                        key={flow.id}
                                        onDelete={setDeletingFlow}
                                        onRename={handleRenameOpen}
                                        onToggleFavorite={removeFavoriteFlow}
                                    />
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            isActive={!!isSettingsActive}
                        >
                            <Link
                                state={{ from: location.pathname }}
                                to={routes.settings.root}
                            >
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
                                        <TabsList className="dark:bg-background h-7 p-0.5">
                                            <TabsTrigger
                                                aria-label="System theme"
                                                className="dark:data-[state=active]:bg-card h-6 px-2"
                                                value="system"
                                            >
                                                <Monitor className="size-4" />
                                            </TabsTrigger>
                                            <TabsTrigger
                                                aria-label="Light theme"
                                                className="dark:data-[state=active]:bg-card h-6 px-2"
                                                value="light"
                                            >
                                                <Sun className="size-4" />
                                            </TabsTrigger>
                                            <TabsTrigger
                                                aria-label="Dark theme"
                                                className="dark:data-[state=active]:bg-card h-6 px-2"
                                                value="dark"
                                            >
                                                <Moon className="size-4" />
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link
                                        state={{ from: location.pathname }}
                                        to={routes.settings.account}
                                    >
                                        <UserIcon className="mr-2 size-4" />
                                        Profile
                                    </Link>
                                </DropdownMenuItem>
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
                onOpenChange={(open) => {
                    if (!open && !isRenaming) {
                        setRenamingFlow(null);
                    }
                }}
                open={renamingFlow !== null}
            >
                <DialogContent className="sm:max-w-md">
                    <form
                        className="grid gap-4"
                        onSubmit={(event) => void handleRenameSubmit(event)}
                    >
                        <DialogHeader>
                            <DialogTitle>重命名任务流</DialogTitle>
                            <DialogDescription>输入新的任务流名称。任务记录和运行结果不会改变。</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-2">
                            <Label htmlFor="sidebar-flow-title">任务流名称</Label>
                            <Input
                                autoFocus
                                disabled={isRenaming}
                                id="sidebar-flow-title"
                                onChange={(event) => setRenameTitle(event.target.value)}
                                placeholder="输入任务流名称"
                                value={renameTitle}
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                disabled={isRenaming}
                                onClick={() => setRenamingFlow(null)}
                                type="button"
                                variant="outline"
                            >
                                取消
                            </Button>
                            <Button
                                disabled={isRenaming || !renameTitle.trim()}
                                type="submit"
                            >
                                {isRenaming && <Spinner variant="circle" />}
                                保存
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmationDialog
                cancelText="取消"
                confirmText="删除"
                description={
                    deletingFlow
                        ? `确定删除任务流“${deletingFlow.title}”吗？任务记录、任务容器和独立工作目录将一并删除，此操作无法撤销。`
                        : undefined
                }
                handleConfirm={handleDeleteConfirm}
                handleOpenChange={(open) => {
                    if (!open) {
                        setDeletingFlow(null);
                    }
                }}
                isOpen={deletingFlow !== null}
                title="删除任务流"
            />
        </Sidebar>
    );
}

function FlowMenuItem({ activeFlowId, flow, isFavorite, onDelete, onRename, onToggleFavorite }: FlowMenuItemProps) {
    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                isActive={activeFlowId === Number(flow.id)}
            >
                <Link to={routes.flow(flow.id)}>
                    <span className="-mx-2 w-8 shrink-0 text-center text-xs group-data-[state=expanded]:hidden">
                        {flow.id}
                    </span>
                    <span className="text-muted-foreground bg-background dark:bg-muted -my-0.5 -ml-0.5 h-5 min-w-5 shrink-0 rounded-md px-px py-0.5 text-center text-xs group-data-[state=collapsed]:hidden">
                        {flow.id}
                    </span>
                    <span
                        className="truncate"
                        data-pentagi-user-content="true"
                    >
                        {flow.title}
                    </span>
                </Link>
            </SidebarMenuButton>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <SidebarMenuAction
                        aria-label="任务流操作"
                        className="data-[state=open]:bg-accent rounded-sm"
                        onClick={(event) => event.stopPropagation()}
                        showOnHover
                    >
                        <Ellipsis />
                    </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    side="right"
                >
                    <DropdownMenuItem onSelect={() => onToggleFavorite(flow.id)}>
                        <Star className={isFavorite ? 'fill-yellow-500 stroke-yellow-500' : ''} />
                        {isFavorite ? '取消收藏' : '添加收藏'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onRename(flow)}>
                        <PencilLine />
                        重命名
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onSelect={() => onDelete(flow)}
                        variant="destructive"
                    >
                        <Trash />
                        删除
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </SidebarMenuItem>
    );
}
