import { Download, Folder, Loader2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { FileNode } from '@/components/shared/file-manager';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
    buildFlowFilesDownloadHref,
    buildUniqueDownloadFileName,
    pluralizeItems,
    triggerBrowserDownload,
} from './flow-files-utils';

interface FlowFilesDownloadDialogProps {
    fileNodes: FileNode[];
    flowId: null | string;
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Download picker: defaults to the current flow's file tree. User checks items
 * then downloads (single file or multi zip via existing download API).
 */
export function FlowFilesDownloadDialog({ fileNodes, flowId, isOpen, onClose }: FlowFilesDownloadDialogProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isDownloading, setIsDownloading] = useState(false);

    const flatFiles = useMemo(() => {
        const out: FileNode[] = [];
        const walk = (nodes: FileNode[]) => {
            for (const n of nodes) {
                out.push(n);
                if (n.children?.length) {
                    walk(n.children);
                }
            }
        };
        walk(fileNodes);
        return out;
    }, [fileNodes]);

    const toggle = useCallback((path: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelected(new Set(flatFiles.map((f) => f.path)));
    }, [flatFiles]);

    const clearAll = useCallback(() => setSelected(new Set()), []);

    const handleDownload = useCallback(() => {
        if (!flowId || selected.size === 0) {
            toast.error('请先勾选要下载的文件');
            return;
        }

        const files = flatFiles.filter((f) => selected.has(f.path));
        const href = buildFlowFilesDownloadHref(flowId, files);
        if (!href) {
            toast.error('无法生成下载链接');
            return;
        }

        setIsDownloading(true);
        try {
            const name =
                files.length === 1
                    ? buildUniqueDownloadFileName(flowId, files[0])
                    : `flow-${flowId}__download.zip`;
            triggerBrowserDownload(href, name);
            toast.success(`已开始下载 ${files.length} ${pluralizeItems(files.length)}`);
            onClose();
            setSelected(new Set());
        } finally {
            setIsDownloading(false);
        }
    }, [flatFiles, flowId, onClose, selected]);

    return (
        <Dialog
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
            open={isOpen}
        >
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>下载任务流文件</DialogTitle>
                    <DialogDescription>
                        当前任务流 #{flowId} 文件夹。勾选报告、数据或上传资料后下载。
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-2 text-sm">
                    <Button
                        onClick={selectAll}
                        size="sm"
                        type="button"
                        variant="outline"
                    >
                        全选
                    </Button>
                    <Button
                        onClick={clearAll}
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        清空
                    </Button>
                    <span className="text-muted-foreground ml-auto">已选 {selected.size}</span>
                </div>

                <ScrollArea className="h-72 rounded-md border p-2">
                    {flatFiles.length === 0 ? (
                        <div className="text-muted-foreground flex h-40 flex-col items-center justify-center gap-2 text-sm">
                            <Folder className="size-8 opacity-50" />
                            <p>任务流文件夹暂无文件</p>
                        </div>
                    ) : (
                        <ul className="space-y-1">
                            {flatFiles.map((file) => (
                                <li
                                    className="hover:bg-muted/50 flex items-start gap-2 rounded px-2 py-1.5"
                                    key={file.path}
                                >
                                    <Checkbox
                                        checked={selected.has(file.path)}
                                        className="mt-0.5"
                                        id={`dl-${file.path}`}
                                        onCheckedChange={() => toggle(file.path)}
                                    />
                                    <label
                                        className="min-w-0 flex-1 cursor-pointer"
                                        htmlFor={`dl-${file.path}`}
                                    >
                                        <div className="truncate text-sm font-medium">{file.name}</div>
                                        <div className="text-muted-foreground truncate font-mono text-[11px]">
                                            {file.path}
                                            {file.isDir ? ' /' : ''}
                                        </div>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    )}
                </ScrollArea>

                <DialogFooter>
                    <Button
                        onClick={onClose}
                        type="button"
                        variant="outline"
                    >
                        取消
                    </Button>
                    <Button
                        disabled={selected.size === 0 || isDownloading || !flowId}
                        onClick={handleDownload}
                        type="button"
                    >
                        {isDownloading ? <Loader2 className="animate-spin" /> : <Download />}
                        下载所选
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
