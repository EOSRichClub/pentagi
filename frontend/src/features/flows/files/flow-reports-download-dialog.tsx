import { Download, FileText, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { FileNode } from '@/components/shared/file-manager';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import {
    buildFlowFilesDownloadHref,
    buildUniqueDownloadFileName,
    formatFileSizeShort,
    isMarkdownReportFile,
    triggerBrowserDownload,
} from './flow-files-utils';

interface FlowReportsDownloadDialogProps {
    fileNodes: readonly FileNode[];
    flowId: null | string;
    isOpen: boolean;
    isRefreshing?: boolean;
    onClose: () => void;
    onRefresh?: () => Promise<unknown> | void;
}

/**
 * Dialog listing every Markdown report in the current flow so the user can
 * click one (or download all). Filenames are prefixed with `flow-{id}__…` so
 * reports from different tasks never overwrite each other in the browser
 * Downloads folder.
 */
export function FlowReportsDownloadDialog({
    fileNodes,
    flowId,
    isOpen,
    isRefreshing = false,
    onClose,
    onRefresh,
}: FlowReportsDownloadDialogProps) {
    const [downloadingPath, setDownloadingPath] = useState<null | string>(null);

    const reports = useMemo(() => {
        const list = fileNodes.filter((file) => !file.isDir && isMarkdownReportFile(file));

        // Newest first when modifiedAt is available.
        return [...list].sort((a, b) => {
            const ta = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
            const tb = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;

            return tb - ta;
        });
    }, [fileNodes]);

    const downloadOne = useCallback(
        (file: FileNode) => {
            if (!flowId) {
                toast.error('未选择任务流');

                return;
            }

            const href = buildFlowFilesDownloadHref(flowId, [file]);

            if (!href) {
                toast.error('无法生成下载地址');

                return;
            }

            const name = buildUniqueDownloadFileName(flowId, file);

            setDownloadingPath(file.path);

            try {
                triggerBrowserDownload(href, name);
                toast.success(`已开始下载：${name}`);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : '下载失败');
            } finally {
                window.setTimeout(() => setDownloadingPath(null), 600);
            }
        },
        [flowId],
    );

    const downloadAll = useCallback(() => {
        if (!flowId || reports.length === 0) {
            return;
        }

        // Stagger clicks slightly so browsers don't coalesce identical navigations.
        reports.forEach((file, index) => {
            window.setTimeout(() => downloadOne(file), index * 350);
        });

        toast.success(`正在下载 ${reports.length} 份报告（文件名已带任务编号，不会互相覆盖）`);
    }, [downloadOne, flowId, reports]);

    const handleRefresh = async () => {
        if (!onRefresh) {
            return;
        }

        try {
            await onRefresh();
            toast.success('文件列表已刷新');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '刷新失败');
        }
    };

    return (
        <Dialog
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
            open={isOpen}
        >
            <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-xl">
                <DialogHeader className="border-b px-6 py-4">
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="size-4" />
                        下载报告
                        {flowId ? (
                            <span className="text-muted-foreground text-sm font-normal">Flow #{flowId}</span>
                        ) : null}
                    </DialogTitle>
                    <DialogDescription>
                        点击某一行即可下载对应 Markdown。保存名格式为{' '}
                        <code className="text-xs">flow-{'{任务ID}'}__路径.md</code>
                        ，多个任务、多份报告不会互相覆盖。
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-between gap-2 border-b px-6 py-2">
                    <span className="text-muted-foreground text-xs">
                        共 {reports.length} 份 Markdown
                        {reports.length === 0 ? '（可先 Pull 容器文件，或点刷新）' : ''}
                    </span>
                    <div className="flex gap-2">
                        {onRefresh ? (
                            <Button
                                disabled={isRefreshing}
                                onClick={() => void handleRefresh()}
                                size="sm"
                                type="button"
                                variant="outline"
                            >
                                {isRefreshing ? (
                                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                                ) : (
                                    <RefreshCw className="mr-1.5 size-3.5" />
                                )}
                                刷新列表
                            </Button>
                        ) : null}
                        <Button
                            disabled={reports.length === 0}
                            onClick={downloadAll}
                            size="sm"
                            type="button"
                            variant="secondary"
                        >
                            <Download className="mr-1.5 size-3.5" />
                            全部下载
                        </Button>
                    </div>
                </div>

                <ScrollArea className="min-h-0 flex-1 px-2">
                    <div className="flex max-h-[50vh] flex-col gap-1 p-2">
                        {reports.length === 0 ? (
                            <div className="text-muted-foreground px-3 py-10 text-center text-sm">
                                当前任务缓存里还没有 Markdown 报告。
                                <br />
                                可先在 Files 里 Pull 容器的 <code>/work</code>，或等任务写出报告后再刷新。
                            </div>
                        ) : (
                            reports.map((file) => {
                                const saveAs = flowId ? buildUniqueDownloadFileName(flowId, file) : file.name;
                                const busy = downloadingPath === file.path;

                                return (
                                    <button
                                        className={cn(
                                            'hover:bg-accent flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                                            busy && 'opacity-70',
                                        )}
                                        disabled={busy}
                                        key={file.path}
                                        onClick={() => downloadOne(file)}
                                        type="button"
                                    >
                                        <FileText className="text-primary mt-0.5 size-4 shrink-0" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">{file.name}</span>
                                            <span className="text-muted-foreground block truncate text-xs">
                                                {file.path}
                                            </span>
                                            <span className="text-muted-foreground mt-0.5 block truncate text-[11px]">
                                                保存为：{saveAs}
                                                {file.size ? ` · ${formatFileSizeShort(file.size)}` : ''}
                                            </span>
                                        </span>
                                        <span className="text-primary flex shrink-0 items-center gap-1 text-xs font-medium">
                                            {busy ? (
                                                <Loader2 className="size-3.5 animate-spin" />
                                            ) : (
                                                <Download className="size-3.5" />
                                            )}
                                            下载
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="border-t px-6 py-3">
                    <Button
                        onClick={onClose}
                        type="button"
                        variant="outline"
                    >
                        关闭
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
