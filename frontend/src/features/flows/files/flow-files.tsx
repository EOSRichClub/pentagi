import { Download, FolderPlus, FolderUp, Loader2, Search, Upload, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
    bulkCopyPathsAction,
    bulkDeleteAction,
    bulkDownloadAction,
    copyPathAction,
    deleteAction,
    FileManager,
    type FileManagerAction,
    type FileManagerBulkAction,
    type FileNode,
} from '@/components/shared/file-manager';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFilesDragAndDrop } from '@/hooks/use-files-drag-and-drop';
import { copyToClipboard } from '@/lib/report';
import { useFlow } from '@/providers/flow-provider';

import { ROOT_GROUPS, UPLOADS_PATH_PREFIX } from './flow-files-constants';
import { FlowFilesDownloadDialog } from './flow-files-download-dialog';
import { FlowFilesMkdirDialog } from './flow-files-mkdir-dialog';
import {
    buildFlowFilesDownloadHref,
    buildUniqueDownloadFileName,
    pluralizeItems,
    triggerBrowserDownload,
} from './flow-files-utils';
import { useFlowFilesData } from './use-flow-files-data';
import { useFlowFilesDelete } from './use-flow-files-delete';
import { useFlowFilesRealtime } from './use-flow-files-realtime';
import { useFlowFilesSearch } from './use-flow-files-search';
import { useFlowFilesUpload } from './use-flow-files-upload';

/**
 * Flow Files panel — simplified to Upload + Download (+ mkdir).
 * Default path is the current flow's data folder.
 */
function FlowFiles() {
    const { flowId } = useFlow();
    const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
    const [isMkdirDialogOpen, setIsMkdirDialogOpen] = useState(false);
    const [uploadDirectory, setUploadDirectory] = useState(UPLOADS_PATH_PREFIX);

    const { fileNodes, isInitialLoading, isLoading, refetchFiles } = useFlowFilesData({ flowId });

    useFlowFilesRealtime({ flowId, isPaused: isLoading });

    const search = useFlowFilesSearch();
    const upload = useFlowFilesUpload({ flowId, targetDirectory: uploadDirectory });
    const deletion = useFlowFilesDelete({ flowId });

    const canAcceptDrop = !!flowId && !upload.isUploading;
    const { dragHandlers, isDragging } = useFilesDragAndDrop({
        canAcceptDrop,
        onDrop: upload.uploadFiles,
    });

    const handleCopyPath = useCallback(async (file: FileNode) => {
        const wasCopied = await copyToClipboard(file.path);

        if (wasCopied) {
            toast.success('路径已复制');

            return;
        }

        toast.error('复制失败');
    }, []);

    const handleBulkCopyPaths = useCallback(async (paths: string[]) => {
        if (paths.length === 0) {
            return;
        }

        const wasCopied = await copyToClipboard(paths.join('\n'));

        if (wasCopied) {
            toast.success(`已复制 ${paths.length} 条路径`);

            return;
        }

        toast.error('复制失败');
    }, []);

    const downloadFileNow = useCallback(
        (file: FileNode) => {
            if (!flowId) {
                toast.error('无法下载：未选择任务流');

                return;
            }

            const href = buildFlowFilesDownloadHref(flowId, [file]);

            if (!href) {
                toast.error('无法下载：无效路径');

                return;
            }

            const name = buildUniqueDownloadFileName(flowId, file);

            triggerBrowserDownload(href, name);
            toast.success(`已开始下载：${name}`);
        },
        [flowId],
    );

    const getRowDownloadHref = useCallback(
        (file: FileNode): string => buildFlowFilesDownloadHref(flowId, [file]) ?? '',
        [flowId],
    );

    const getBulkDownloadHref = useCallback(
        (files: FileNode[]): string => buildFlowFilesDownloadHref(flowId, files) ?? '',
        [flowId],
    );

    const downloadRowAction = useMemo<FileManagerAction>(
        () => ({
            appliesToDirs: true,
            getHref: getRowDownloadHref,
            getHrefDownloadAttr: (file) =>
                flowId ? buildUniqueDownloadFileName(flowId, file) : file.isDir ? `${file.name}.zip` : file.name,
            icon: Download,
            id: 'flow-files-download',
            label: '下载',
            onSelect: () => {},
        }),
        [flowId, getRowDownloadHref],
    );

    const fileManagerActions = useMemo<FileManagerAction[]>(
        () => [downloadRowAction, copyPathAction(handleCopyPath), deleteAction(deletion.requestDelete)],
        [downloadRowAction, handleCopyPath, deletion.requestDelete],
    );

    const fileManagerBulkActions = useMemo<FileManagerBulkAction[]>(
        () => [
            bulkDownloadAction(getBulkDownloadHref, {
                getDownloadName: (files) => {
                    if (files.length === 1 && flowId) {
                        return buildUniqueDownloadFileName(flowId, files[0]);
                    }

                    return flowId ? `flow-${flowId}__download.zip` : 'download.zip';
                },
            }),
            bulkCopyPathsAction(handleBulkCopyPaths),
            bulkDeleteAction(deletion.deleteFiles),
        ],
        [deletion.deleteFiles, flowId, getBulkDownloadHref, handleBulkCopyPaths],
    );

    const noFilesState = (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <FolderUp />
                </EmptyMedia>
                <EmptyTitle>任务流文件夹为空</EmptyTitle>
                <EmptyDescription>
                    点击上方「上传」添加资料，或等待任务产生报告/数据。可先「新建文件夹」再上传。
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    );

    const noMatchesState = (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Search />
                </EmptyMedia>
                <EmptyTitle>无匹配</EmptyTitle>
                <EmptyDescription>
                    没有文件匹配 <code>{search.debouncedQuery.trim()}</code>
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    );

    return (
        <div
            className="relative flex h-full flex-col"
            {...dragHandlers}
        >
            <input
                aria-hidden="true"
                className="hidden"
                key={upload.fileInputKey}
                multiple
                name="flow-file-upload"
                tabIndex={-1}
                type="file"
                {...upload.fileInputProps}
            />

            {isDragging && (
                <div className="bg-primary/10 border-primary pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-lg border-2 border-dashed">
                    <div className="text-primary flex flex-col items-center gap-2">
                        <FolderUp className="size-8" />
                        <span className="text-sm font-medium">拖放文件到此上传</span>
                        <span className="text-muted-foreground text-xs">目标：{uploadDirectory}</span>
                    </div>
                </div>
            )}

            <div className="bg-background sticky top-0 z-10 pb-4">
                <Form {...search.form}>
                    <div className="flex gap-2 p-px">
                        <FormField
                            control={search.form.control}
                            name="search"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormControl>
                                        <InputGroup>
                                            <InputGroupAddon>
                                                <Search />
                                            </InputGroupAddon>
                                            <InputGroupInput
                                                {...field}
                                                autoComplete="off"
                                                placeholder="搜索文件..."
                                                type="text"
                                            />
                                            {field.value && (
                                                <InputGroupAddon align="inline-end">
                                                    <InputGroupButton
                                                        onClick={search.resetSearch}
                                                        type="button"
                                                    >
                                                        <X />
                                                    </InputGroupButton>
                                                </InputGroupAddon>
                                            )}
                                        </InputGroup>
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>
                                    <Button
                                        disabled={!flowId || isLoading}
                                        onClick={() => setIsMkdirDialogOpen(true)}
                                        size="icon-sm"
                                        type="button"
                                        variant="outline"
                                    >
                                        <FolderPlus />
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-64 text-center text-xs">
                                <p className="font-medium">新建文件夹</p>
                                <p className="mt-1">在上传目录下建子文件夹，再上传资料</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>
                                    <Button
                                        disabled={upload.isUploading || isLoading}
                                        onClick={upload.openFilePicker}
                                        size="icon-sm"
                                        type="button"
                                        variant="outline"
                                    >
                                        {upload.isUploading ? <Loader2 className="animate-spin" /> : <Upload />}
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-64 text-center text-xs">
                                <p className="font-medium">上传</p>
                                <p className="mt-1">
                                    上传到当前任务流：
                                    <code>{uploadDirectory}</code>
                                </p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>
                                    <Button
                                        disabled={!flowId || isLoading}
                                        onClick={() => setIsDownloadDialogOpen(true)}
                                        size="icon-sm"
                                        type="button"
                                        variant="outline"
                                    >
                                        <Download />
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-64 text-center text-xs">
                                <p className="font-medium">下载</p>
                                <p className="mt-1">打开当前任务流文件夹，勾选后下载报告/数据</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </Form>
                <p className="text-muted-foreground mt-2 px-1 text-[11px]">
                    任务流 #{flowId} 文件夹 · 上传目录 <code>{uploadDirectory}</code>
                    {uploadDirectory !== UPLOADS_PATH_PREFIX && (
                        <button
                            className="text-primary ml-2 underline"
                            onClick={() => setUploadDirectory(UPLOADS_PATH_PREFIX)}
                            type="button"
                        >
                            重置到 uploads
                        </button>
                    )}
                </p>
            </div>

            <FileManager
                actions={fileManagerActions}
                bulkActions={fileManagerBulkActions}
                className="min-h-0 flex-1"
                emptyState={noFilesState}
                files={fileNodes}
                isLoading={isInitialLoading}
                onOpen={downloadFileNow}
                rootGroups={ROOT_GROUPS}
                search={{ emptyState: noMatchesState, query: search.debouncedQuery }}
            />

            <FlowFilesDownloadDialog
                fileNodes={fileNodes}
                flowId={flowId}
                isOpen={isDownloadDialogOpen}
                onClose={() => setIsDownloadDialogOpen(false)}
            />

            <FlowFilesMkdirDialog
                flowId={flowId}
                isOpen={isMkdirDialogOpen}
                onClose={() => setIsMkdirDialogOpen(false)}
                onCreated={(path) => {
                    setUploadDirectory(path);
                    void refetchFiles();
                }}
                parentPath={UPLOADS_PATH_PREFIX}
            />
        </div>
    );
}

export default FlowFiles;
